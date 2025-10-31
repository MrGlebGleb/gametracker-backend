// server.js - УЛУЧШЕННЫЙ Backend v7 (с полной лентой активности)
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt =require('jsonwebtoken');
const axios = require('axios');
const { Pool } = require('pg');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { body, param, validationResult } = require('express-validator');
const { JSDOM } = require('jsdom');
const DOMPurify = require('dompurify');
const { Parser } = require('json2csv');
const crypto = require('crypto');

// Загружаем SendGrid лениво (только когда нужно)
let sgMail = null;
try {
  sgMail = require('@sendgrid/mail');
} catch (error) {
  console.warn('⚠️ @sendgrid/mail не найден:', error.message);
  console.warn('⚠️ Email функции будут недоступны до установки пакета');
}

const app = express();

// Health check endpoint - определяется САМЫМ ПЕРВЫМ, до всех middleware
// Это критически важно для Railway healthcheck
app.get('/api/health', (req, res) => {
  try {
    res.status(200).json({ 
      status: 'OK', 
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'ERROR', 
      error: error.message 
    });
  }
});

// Trust proxy for Railway deployment
app.set('trust proxy', 1);

// SendGrid Email configuration
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || process.env.EMAIL_USER; // Email отправителя (должен быть verified в SendGrid)

// Инициализируем SendGrid только если API ключ и модуль присутствуют
try {
  if (!sgMail) {
    console.warn('⚠️ Модуль @sendgrid/mail не загружен. Email функции будут недоступны.');
  } else if (SENDGRID_API_KEY) {
    sgMail.setApiKey(SENDGRID_API_KEY);
    console.log('✅ SendGrid инициализирован');
    console.log('📧 FROM_EMAIL:', FROM_EMAIL ? `${FROM_EMAIL.split('@')[0]}@***` : 'НЕ установлен');
    console.log('📧 SENDGRID_API_KEY:', SENDGRID_API_KEY ? 'установлен' : 'НЕ установлен');
    console.log('📧 FRONTEND_URL:', process.env.FRONTEND_URL || 'НЕ установлен (используется localhost:3000)');
  } else {
    console.warn('⚠️ SENDGRID_API_KEY не настроен! Email функции будут недоступны.');
    console.warn('📧 Добавьте SENDGRID_API_KEY в переменные окружения Railway');
  }
} catch (error) {
  console.error('❌ Ошибка инициализации SendGrid:', error.message);
  console.warn('⚠️ Email функции будут недоступны, но сервер продолжит работу');
}

// Функция для генерации токена верификации
function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Функция для отправки email подтверждения - улучшенная для всех почтовых сервисов
async function sendVerificationEmail(email, token, username) {
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
  
  // Определяем домен получателя для персонализации
  const emailDomain = email.split('@')[1]?.toLowerCase();
  let serviceName = 'почтовый сервис';
  
  if (emailDomain?.includes('gmail')) serviceName = 'Gmail';
  else if (emailDomain?.includes('yandex')) serviceName = 'Яндекс.Почта';
  else if (emailDomain?.includes('mail.ru')) serviceName = 'Mail.ru';
  else if (emailDomain?.includes('outlook') || emailDomain?.includes('hotmail')) serviceName = 'Outlook';
  else if (emailDomain?.includes('yahoo')) serviceName = 'Yahoo Mail';
  
  // Проверяем конфигурацию ДО создания сообщения
  // Пытаемся загрузить модуль динамически, если он не был загружен при старте
  if (!sgMail) {
    console.warn('⚠️ [sendVerificationEmail] Модуль @sendgrid/mail не загружен при старте, пытаемся загрузить динамически...');
    try {
      sgMail = require('@sendgrid/mail');
      console.log('✅ [sendVerificationEmail] Модуль @sendgrid/mail успешно загружен динамически');
    } catch (loadError) {
      console.error('❌ [sendVerificationEmail] Модуль @sendgrid/mail не найден!');
      console.error('   Ошибка загрузки:', loadError.message);
      console.error('   Проверьте, что пакет установлен: npm install @sendgrid/mail');
      console.error('   Убедитесь, что зависимость есть в package.json и перезапустите сервер');
      return false;
    }
  }
  
  if (!SENDGRID_API_KEY) {
    console.error('❌ [sendVerificationEmail] SENDGRID_API_KEY не настроен!');
    console.error('   Добавьте SENDGRID_API_KEY в переменные окружения Railway');
    return false;
  }
  
  if (!FROM_EMAIL) {
    console.error('❌ [sendVerificationEmail] FROM_EMAIL не настроен!');
    console.error('   Установите FROM_EMAIL или EMAIL_USER в переменных окружения Railway');
    return false;
  }
  
  // Проверяем что FROM_EMAIL валидный email
  const fromEmail = FROM_EMAIL || 'noreply@gametracker.app';
  if (!fromEmail.includes('@')) {
    console.error('❌ [sendVerificationEmail] Неверный формат FROM_EMAIL:', fromEmail);
    return false;
  }
  
  const msg = {
    to: email,
    from: fromEmail, // Используем FROM_EMAIL или fallback
    subject: '🎮 Подтверждение регистрации - GameTracker',
    html: `
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Подтверждение регистрации</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4; }
          .container { background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 24px; font-weight: bold; color: #007bff; margin-bottom: 10px; }
          .verify-button { display: inline-block; background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; text-align: center; }
          .verify-button:hover { background-color: #0056b3; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .service-info { background-color: #e7f3ff; border: 1px solid #b3d9ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🎮 GameTracker</div>
            <h2>Добро пожаловать!</h2>
          </div>
          
          <p>Привет, <strong>${username}</strong>!</p>
          
          <p>Спасибо за регистрацию в GameTracker. Для завершения регистрации и активации вашего аккаунта, пожалуйста, подтвердите ваш email адрес.</p>
          
          <div style="text-align: center;">
            <a href="${verificationUrl}" class="verify-button">
              ✅ Подтвердить Email
            </a>
          </div>
          
          <div class="warning">
            <strong>⚠️ Важно:</strong> Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:
            <br><br>
            <code style="word-break: break-all; background-color: #f8f9fa; padding: 5px; border-radius: 3px;">${verificationUrl}</code>
          </div>
          
          <div class="service-info">
            <strong>📧 Для пользователей ${serviceName}:</strong><br>
            Если письмо не пришло, проверьте папку "Спам" или "Промоакции". 
            Добавьте наш адрес в контакты для надежной доставки.
          </div>
          
          <p><strong>Что дальше?</strong></p>
          <ul>
            <li>После подтверждения email вы сможете войти в систему</li>
            <li>Добавлять игры в свою коллекцию</li>
            <li>Отслеживать прогресс прохождения</li>
            <li>Делиться достижениями с друзьями</li>
          </ul>
          
          <div class="footer">
            <p><strong>Срок действия ссылки:</strong> 24 часа</p>
            <p>Если вы не регистрировались на нашем сайте, просто проигнорируйте это письмо.</p>
            <p>С уважением,<br>Команда GameTracker</p>
          </div>
        </div>
      </body>
      </html>
    `,
    // Текстовая версия для лучшей совместимости
    text: `
Добро пожаловать в GameTracker!

Привет, ${username}!

Спасибо за регистрацию. Для завершения регистрации и активации вашего аккаунта, пожалуйста, подтвердите ваш email адрес.

Перейдите по ссылке: ${verificationUrl}

Если ссылка не работает, скопируйте и вставьте её в браузер.

Срок действия ссылки: 24 часа

Если вы не регистрировались на нашем сайте, просто проигнорируйте это письмо.

С уважением,
Команда GameTracker
    `
  };

  try {
    // Проверки уже выполнены выше, сразу отправляем
    console.log('📧 [sendVerificationEmail] Отправка email подтверждения через SendGrid:');
    console.log('   От:', FROM_EMAIL);
    console.log('   Кому:', email);
    console.log('   Frontend URL:', process.env.FRONTEND_URL || 'http://localhost:3000');
    
    // Убеждаемся что API ключ установлен (на случай если была проблема)
    if (SENDGRID_API_KEY && sgMail) {
      sgMail.setApiKey(SENDGRID_API_KEY);
    }
    
    // Отправляем email через SendGrid
    console.log('📤 [sendVerificationEmail] Отправка через SendGrid...');
    const [response] = await sgMail.send(msg);
    console.log('✅ [sendVerificationEmail] Email отправлен успешно:', email);
    console.log('   Status Code:', response?.statusCode || 'N/A');
    console.log('   Response Headers:', JSON.stringify(response?.headers || {}, null, 2));
    return true;
  } catch (error) {
    console.error('❌ [sendVerificationEmail] Ошибка отправки email:', email);
    console.error('   Error message:', error.message);
    console.error('   Error name:', error.name);
    
    // Логируем дополнительную информацию для отладки
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    
    // SendGrid возвращает ошибки в error.response.body
    if (error.response) {
      console.error('   SendGrid API Status:', error.response.statusCode);
      console.error('   SendGrid API Body:', JSON.stringify(error.response.body || {}, null, 2));
      
      // Если есть массив errors, показываем их подробно
      if (error.response.body && error.response.body.errors) {
        console.error('   SendGrid Errors:', JSON.stringify(error.response.body.errors, null, 2));
      }
      
      console.error('   SendGrid API Headers:', JSON.stringify(error.response.headers || {}, null, 2));
    } else if (error.message) {
      // Если нет response, возможно проблема с подключением
      console.error('   Возможна проблема с подключением к SendGrid API или неверный API ключ');
    }
    
    if (error.stack) {
      console.error('   Stack trace:', error.stack);
    }
    
    return false;
  }
}

// Функция для отправки email сброса пароля
async function sendPasswordResetEmail(email, token, username) {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
  
  // Определяем домен получателя для персонализации
  const emailDomain = email.split('@')[1]?.toLowerCase();
  let serviceName = 'почтовый сервис';
  
  if (emailDomain?.includes('gmail')) serviceName = 'Gmail';
  else if (emailDomain?.includes('yandex')) serviceName = 'Яндекс.Почта';
  else if (emailDomain?.includes('mail.ru')) serviceName = 'Mail.ru';
  else if (emailDomain?.includes('outlook') || emailDomain?.includes('hotmail')) serviceName = 'Outlook';
  else if (emailDomain?.includes('yahoo')) serviceName = 'Yahoo Mail';
  
  const msg = {
    to: email,
    from: FROM_EMAIL || 'noreply@gametracker.app', // Используем FROM_EMAIL или fallback
    subject: '🔐 Сброс пароля - GameTracker',
    html: `
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Сброс пароля</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4; }
          .container { background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 24px; font-weight: bold; color: #dc3545; margin-bottom: 10px; }
          .reset-button { display: inline-block; background-color: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; text-align: center; }
          .reset-button:hover { background-color: #c82333; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .security-info { background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .service-info { background-color: #e7f3ff; border: 1px solid #b3d9ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🔐 GameTracker</div>
            <h2>Сброс пароля</h2>
          </div>
          
          <p>Привет, <strong>${username}</strong>!</p>
          
          <p>Мы получили запрос на сброс пароля для вашего аккаунта GameTracker. Если это были вы, нажмите на кнопку ниже для создания нового пароля.</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="reset-button">
              🔑 Сбросить пароль
            </a>
          </div>
          
          <div class="warning">
            <strong>⚠️ Важно:</strong> Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:
            <br><br>
            <code style="word-break: break-all; background-color: #f8f9fa; padding: 5px; border-radius: 3px;">${resetUrl}</code>
          </div>
          
          <div class="security-info">
            <strong>🛡️ Безопасность:</strong><br>
            • Эта ссылка действительна только 1 час<br>
            • После использования ссылка станет недействительной<br>
            • Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо<br>
            • Ваш текущий пароль останется без изменений
          </div>
          
          <div class="service-info">
            <strong>📧 Для пользователей ${serviceName}:</strong><br>
            Если письмо не пришло, проверьте папку "Спам" или "Промоакции". 
            Добавьте наш адрес в контакты для надежной доставки.
          </div>
          
          <div class="footer">
            <p><strong>Срок действия ссылки:</strong> 1 час</p>
            <p>Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>
            <p>С уважением,<br>Команда GameTracker</p>
          </div>
        </div>
      </body>
      </html>
    `,
    // Текстовая версия для лучшей совместимости
    text: `
Сброс пароля - GameTracker

Привет, ${username}!

Мы получили запрос на сброс пароля для вашего аккаунта GameTracker. Если это были вы, перейдите по ссылке для создания нового пароля.

Ссылка: ${resetUrl}

ВАЖНО:
- Эта ссылка действительна только 1 час
- После использования ссылка станет недействительной
- Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо
- Ваш текущий пароль останется без изменений

Если ссылка не работает, скопируйте и вставьте её в браузер.

Срок действия ссылки: 1 час

Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.

С уважением,
Команда GameTracker
    `
  };

  try {
    // Проверяем, что SendGrid модуль загружен
    // Пытаемся загрузить модуль динамически, если он не был загружен при старте
    if (!sgMail) {
      console.warn('⚠️ [sendPasswordResetEmail] Модуль @sendgrid/mail не загружен при старте, пытаемся загрузить динамически...');
      try {
        sgMail = require('@sendgrid/mail');
        console.log('✅ [sendPasswordResetEmail] Модуль @sendgrid/mail успешно загружен динамически');
      } catch (loadError) {
        console.error('❌ [sendPasswordResetEmail] Модуль @sendgrid/mail не найден!');
        console.error('   Ошибка загрузки:', loadError.message);
        console.error('   Установите: npm install @sendgrid/mail');
        console.error('   Убедитесь, что зависимость есть в package.json и перезапустите сервер');
        return false;
      }
    }
    
    // Проверяем, что SendGrid настроен
    if (!SENDGRID_API_KEY) {
      console.error('❌ SENDGRID_API_KEY не настроен!');
      return false;
    }
    
    if (!FROM_EMAIL) {
      console.error('❌ FROM_EMAIL не настроен! Установите FROM_EMAIL или EMAIL_USER в переменных окружения.');
      return false;
    }
    
    console.log('📧 Отправка email сброса пароля через SendGrid:');
    console.log('   От:', FROM_EMAIL);
    console.log('   Кому:', email);
    
    // Убеждаемся что API ключ установлен (на случай если модуль был загружен динамически)
    if (SENDGRID_API_KEY && sgMail) {
      sgMail.setApiKey(SENDGRID_API_KEY);
    }
    
    // Отправляем email через SendGrid
    const [response] = await sgMail.send(msg);
    console.log('✅ Password reset email sent successfully to:', email);
    console.log('✅ Status Code:', response.statusCode);
    return true;
  } catch (error) {
    console.error('❌ Error sending password reset email to:', email);
    console.error('Error details:', error.message);
    
    // Логируем дополнительную информацию для отладки
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.response) {
      console.error('SendGrid API response:', JSON.stringify(error.response.body, null, 2));
    }
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    
    return false;
  }
}

// Database test endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    res.json({ 
      status: 'OK', 
      database: 'Connected',
      time: result.rows[0].current_time 
    });
  } catch (error) {
    console.error('Database test failed:', error);
    res.status(500).json({ 
      status: 'Error', 
      database: 'Failed',
      error: error.message 
    });
  }
});

// Test endpoint for creating tags without authentication (TEMPORARY)
app.post('/api/test-create-tag', async (req, res) => {
  let client;
  try {
    console.log('TEST: Creating tag without auth...');
    client = await pool.connect();
    console.log('TEST: Database connection successful');
    
    const { name, color = '#3B82F6', type = 'game' } = req.body;
    console.log('TEST: Creating tag:', { name, color, type });
    
    const result = await client.query(
      'INSERT INTO tags (user_id, name, color, type) VALUES ($1, $2, $3, $4) RETURNING *',
      [1, name, color, type] // Используем user_id = 1 для тестирования
    );
    console.log('TEST: Created tag:', result.rows[0]);
    res.status(201).json({ message: 'Тег создан', tag: result.rows[0] });
  } catch (error) {
    console.error('TEST: Error creating tag:', error);
    res.status(500).json({ error: 'Ошибка создания тега', details: error.message });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Tags table test endpoint
app.get('/api/test-tags-table', async (req, res) => {
  let client;
  try {
    console.log('Testing tags table...');
    client = await pool.connect();
    console.log('Database connection successful for test');
    
    // Проверяем существование таблицы tags
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tags'
      );
    `);
    
    // Если таблица существует, проверяем её структуру
    let tableStructure = null;
    if (tableExists.rows[0].exists) {
      const structure = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'tags'
        ORDER BY ordinal_position;
      `);
      tableStructure = structure.rows;
    }
    
    // Проверяем количество тегов
    let tagsCount = 0;
    if (tableExists.rows[0].exists) {
      const count = await client.query('SELECT COUNT(*) as count FROM tags');
      tagsCount = count.rows[0].count;
    }
    
    res.json({ 
      status: 'OK',
      tableExists: tableExists.rows[0].exists,
      tableStructure: tableStructure,
      tagsCount: tagsCount
    });
  } catch (error) {
    console.error('Tags table test error:', error);
    res.status(500).json({ 
      status: 'Error',
      error: error.message,
      stack: error.stack,
      code: error.code
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Database migration endpoint
app.get('/api/migrate', async (req, res) => {
  try {
    const client = await pool.connect();
    
    // Добавляем недостающие колонки
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_profile_public BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS show_activity BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS show_stats BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS allow_friend_requests BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
      ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP,
      ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255),
      ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP
    `);
    
    client.release();
    res.json({ 
      status: 'OK', 
      message: 'Migration completed successfully' 
    });
  } catch (error) {
    console.error('Migration failed:', error);
    res.status(500).json({ 
      status: 'Error', 
      error: error.message 
    });
  }
});

// Временный endpoint для тестирования без аутентификации
app.get('/api/test-boards', async (req, res) => {
  try {
    const client = await pool.connect();
    
    // Проверяем все таблицы
    const gamesCount = await client.query('SELECT COUNT(*) as total_games FROM games');
    const usersCount = await client.query('SELECT COUNT(*) as total_users FROM users');
    const boardsCount = await client.query('SELECT COUNT(*) as total_boards FROM user_boards');
    
    client.release();
    res.json({ 
      status: 'OK', 
      total_games: gamesCount.rows[0].total_games,
      total_users: usersCount.rows[0].total_users,
      total_boards: boardsCount.rows[0].total_boards,
      message: 'Database connection works'
    });
  } catch (error) {
    console.error('Test boards failed:', error);
    res.status(500).json({ 
      status: 'Error', 
      error: error.message 
    });
  }
});

// Временный CORS для отладки
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Security middleware with enhanced configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com", "https://unpkg.com", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https://gametracker-backend-production.up.railway.app", "https://api.themoviedb.org", "https://id.twitch.tv"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Отключаем для совместимости с внешними API
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Compression middleware
app.use(compression());

// CORS configuration - только для фронтенд доменов
const allowedOrigins = [
  'http://localhost:3000',
  'https://localhost:3000',
  'https://gametracker-backend-production.up.railway.app',
  // Vercel домены (для обратной совместимости)
  'https://gametracker-frontend.vercel.app',
  'https://gametracker-frontend-git-main-mrglebgleb.vercel.app',
  'https://gametracker-frontend-git-main.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    console.log('CORS request from origin:', origin);
    console.log('Allowed origins:', allowedOrigins);
    
    // Разрешить запросы без origin (например, мобильные приложения, Postman)
    if (!origin) {
      console.log('No origin, allowing request');
      return callback(null, true);
    }
    
    // Разрешаем Railway домены и Vercel домены
    if (origin.includes('railway.app') || origin.includes('vercel.app') || origin.includes('localhost') || allowedOrigins.indexOf(origin) !== -1) {
      console.log('Origin allowed:', origin);
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Не разрешено CORS политикой'));
    }
  },
  credentials: true
}));

// JSON payload validation middleware
const validateJsonSize = (maxSize) => (req, res, next) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > maxSize) {
    return res.status(413).json({ 
      error: `Payload слишком большой. Максимум ${maxSize / (1024 * 1024)}MB` 
    });
  }
  next();
};

// Middleware для обычных запросов (10MB)
app.use('/api', validateJsonSize(10 * 1024 * 1024));

// Middleware для Base64 изображений (5MB)
app.use('/api/profile/avatar', validateJsonSize(5 * 1024 * 1024));

app.use(express.json({ limit: '10mb' }));

// === STATIC FILES ===
// Маршрут для главной страницы - показываем landing page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/landing.html');
});

// Middleware для предотвращения кеширования HTML файлов
app.use((req, res, next) => {
  if (req.path.endsWith('.html') || req.path === '/' || req.path === '/index.html') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Раздача статических файлов (HTML, CSS, JS)
app.use(express.static('.'));

// === RATE LIMITING ===
// Временно отключаем rate limiting для разработки
const generalLimiter = (req, res, next) => {
  console.log(`Request to ${req.path} from ${req.ip}`);
  next();
};

// Общий лимит: 500 запросов в 15 минут на IP (закомментирован)
/*
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 500, // максимум 500 запросов
  message: {
    error: 'Слишком много запросов с этого IP. Попробуйте снова через 15 минут.',
    retryAfter: '15 минут'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
*/

// Лимит для входа: 5 попыток в 15 минут
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // максимум 5 попыток
  message: {
    error: 'Слишком много попыток входа. Попробуйте снова через 15 минут.',
    retryAfter: '15 минут'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Лимит для регистрации: 3 регистрации в час
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 3, // максимум 3 регистрации
  message: {
    error: 'Слишком много попыток регистрации. Попробуйте снова через час.',
    retryAfter: '1 час'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Лимит для поиска: 30 запросов в минуту
const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 30, // максимум 30 запросов
  message: {
    error: 'Слишком много запросов поиска. Попробуйте снова через минуту.',
    retryAfter: '1 минута'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Лимит для статистики: 10 запросов в минуту
const statsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 10, // максимум 10 запросов
  message: {
    error: 'Слишком много запросов статистики. Попробуйте снова через минуту.',
    retryAfter: '1 минута'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Лимит для загрузки аватара: 5 загрузок в час
const avatarLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 5, // максимум 5 загрузок
  message: {
    error: 'Слишком много загрузок аватара. Попробуйте снова через час.',
    retryAfter: '1 час'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Применяем общий лимит ко всем API запросам
app.use('/api', generalLimiter);

// === ВАЛИДАЦИЯ ВХОДНЫХ ДАННЫХ ===
// Middleware для обработки ошибок валидации
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({
      error: 'Ошибки валидации',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// Валидационные правила
const validateRegister = [
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Имя пользователя должно быть от 3 до 30 символов')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Имя пользователя может содержать только буквы, цифры и подчеркивания'),
  body('email')
    .isEmail()
    .withMessage('Неверный формат email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Пароль должен содержать минимум 6 символов'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Пароли не совпадают');
      }
      return true;
    }),
  handleValidationErrors
];

const validateProfile = [
  body('username')
    .optional()
    .isLength({ min: 3, max: 30 })
    .withMessage('Имя пользователя должно быть от 3 до 30 символов')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Имя пользователя может содержать только буквы, цифры и подчеркивания'),
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Биография не должна превышать 500 символов'),
  body('theme')
    .optional()
    .isIn(['default', 'liquid-eye'])
    .withMessage('Тема должна быть "default" или "liquid-eye"'),
  body('is_profile_public')
    .optional()
    .isBoolean()
    .withMessage('Публичность профиля должна быть булевым значением'),
  body('show_activity')
    .optional()
    .isBoolean()
    .withMessage('Показ активности должен быть булевым значением'),
  body('show_stats')
    .optional()
    .isBoolean()
    .withMessage('Показ статистики должен быть булевым значением'),
  body('allow_friend_requests')
    .optional()
    .isBoolean()
    .withMessage('Разрешение заявок в друзья должно быть булевым значением'),
  handleValidationErrors
];

const validateAvatar = [
  body('avatar')
    .notEmpty()
    .withMessage('Аватар обязателен')
    .custom((value) => {
      if (!value.startsWith('data:image/')) {
        throw new Error('Аватар должен быть в формате Base64');
      }
      
      // Проверяем тип изображения
      const imageType = value.split(';')[0].split('/')[1];
      if (!['jpeg', 'jpg', 'png', 'webp'].includes(imageType)) {
        throw new Error('Поддерживаются только форматы: JPEG, PNG, WebP');
      }
      
      // Проверяем размер (примерно 2MB в Base64)
      const base64Data = value.split(',')[1];
      const sizeInBytes = (base64Data.length * 3) / 4;
      const maxSize = 2 * 1024 * 1024; // 2MB
      
      if (sizeInBytes > maxSize) {
        throw new Error('Размер изображения не должен превышать 2MB');
      }
      
      return true;
    }),
  handleValidationErrors
];

const validateReaction = [
  body('emoji')
    .isIn(['👍', '👎', '❤️', '😂', '😮', '😢', '😡', '🎮', '🔥', '⭐'])
    .withMessage('Недопустимый emoji. Разрешены: 👍, 👎, ❤️, 😂, 😮, 😢, 😡, 🎮, 🔥, ⭐'),
  handleValidationErrors
];

const validateIdParam = (paramName) => [
  param(paramName)
    .isInt({ min: 1 })
    .withMessage(`${paramName} должен быть положительным числом`),
  handleValidationErrors
];

const validateTag = [
  body('name')
    .isLength({ min: 1, max: 50 })
    .withMessage('Название тега должно быть от 1 до 50 символов')
    .matches(/^[a-zA-Zа-яА-Я0-9\s\-_]+$/)
    .withMessage('Название тега может содержать только буквы, цифры, пробелы, дефисы и подчеркивания'),
  body('color')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Цвет должен быть в формате hex (#RRGGBB)'),
  body('type')
    .optional()
    .isIn(['game', 'media'])
    .withMessage('Тип тега должен быть "game" или "media"'),
  handleValidationErrors
];

// === САНИТИЗАЦИЯ ВХОДНЫХ ДАННЫХ ===
// Настройка DOMPurify для серверной среды
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// Middleware для санитизации пользовательского ввода
const sanitizeInput = (req, res, next) => {
  if (req.body) {
    // Поля, которые нужно санитизировать
    const fieldsToSanitize = ['notes', 'review', 'bio', 'nickname', 'name'];
    
    fieldsToSanitize.forEach(field => {
      if (req.body[field] && typeof req.body[field] === 'string') {
        // Санитизируем HTML теги и потенциально опасные символы
        req.body[field] = purify.sanitize(req.body[field], {
          ALLOWED_TAGS: [], // Не разрешаем никакие HTML теги
          ALLOWED_ATTR: [], // Не разрешаем никакие атрибуты
          KEEP_CONTENT: true // Сохраняем текстовое содержимое
        });
        
        // Дополнительная очистка от потенциально опасных символов
        req.body[field] = req.body[field]
          .replace(/[<>]/g, '') // Удаляем оставшиеся < и >
          .replace(/javascript:/gi, '') // Удаляем javascript: ссылки
          .replace(/on\w+=/gi, '') // Удаляем event handlers
          .trim(); // Убираем лишние пробелы
      }
    });
  }
  next();
};

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

let twitchAccessToken = null;
let tokenExpiry = null;

async function initDatabase() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Present' : 'Missing');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  try {
    const client = await pool.connect();
    console.log('Database connection successful');
    console.log('Initializing database tables...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        avatar TEXT,
        bio TEXT,
        theme VARCHAR(20) DEFAULT 'default',
        is_profile_public BOOLEAN DEFAULT true,
        show_activity BOOLEAN DEFAULT true,
        show_stats BOOLEAN DEFAULT true,
        allow_friend_requests BOOLEAN DEFAULT true,
        is_email_verified BOOLEAN DEFAULT false,
        email_verification_token VARCHAR(255),
        email_verification_expires TIMESTAMP,
        password_reset_token VARCHAR(255),
        password_reset_expires TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        game_id BIGINT NOT NULL,
        name VARCHAR(255) NOT NULL,
        cover TEXT,
        board VARCHAR(20) NOT NULL,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        notes TEXT,
        hours_played INTEGER DEFAULT 0,
        video_id VARCHAR(255),
        deep_review_answers JSONB,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS friendships (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        friend_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending',
        nickname VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, friend_id)
      );

      CREATE TABLE IF NOT EXISTS reactions (
        id SERIAL PRIMARY KEY,
        game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        emoji VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(game_id, user_id)
      );
      
      CREATE TABLE IF NOT EXISTS activities (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          action_type VARCHAR(50) NOT NULL,
          details JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS game_scores (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        score INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id);
      CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
      CREATE INDEX IF NOT EXISTS idx_reactions_game_id ON reactions(game_id);
      CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);

      ALTER TABLE games ALTER COLUMN game_id TYPE BIGINT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'default';
      ALTER TABLE friendships ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);
      ALTER TABLE games ADD COLUMN IF NOT EXISTS video_id VARCHAR(255);
      ALTER TABLE games ADD COLUMN IF NOT EXISTS deep_review_answers JSONB;
      ALTER TABLE games ADD COLUMN IF NOT EXISTS review TEXT;
      ALTER TABLE games ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
      ALTER TABLE media_items ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
      ALTER TABLE books ADD COLUMN IF NOT EXISTS review TEXT;
      ALTER TABLE books ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
      ALTER TABLE comics ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;

      -- MEDIA (movies/series)
      CREATE TABLE IF NOT EXISTS media_items (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        tmdb_id BIGINT NOT NULL,
        media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('movie','tv')),
        title VARCHAR(255) NOT NULL,
        poster TEXT,
        board VARCHAR(20) NOT NULL CHECK (board IN ('wishlist','watched')),
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        review TEXT,
        seasons_watched INTEGER DEFAULT 0,
        episodes_watched INTEGER DEFAULT 0,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS media_reactions (
        id SERIAL PRIMARY KEY,
        media_id INTEGER REFERENCES media_items(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        emoji VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(media_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_media_items_user_id ON media_items(user_id);
      CREATE INDEX IF NOT EXISTS idx_media_reactions_media_id ON media_reactions(media_id);

      -- NOTIFICATIONS TABLE
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        from_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL CHECK (type IN ('friend_request', 'friend_accepted', 'game_completed', 'review_added')),
        reference_id INTEGER,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON notifications(user_id, is_read, created_at);

      -- TAGS SYSTEM
            CREATE TABLE IF NOT EXISTS tags (
              id SERIAL PRIMARY KEY,
              user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
              name VARCHAR(50) NOT NULL,
              color VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
              type VARCHAR(20) NOT NULL DEFAULT 'game', -- 'game' или 'media'
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(user_id, name, type)
            );
            
            -- Добавляем колонку type если она не существует
            DO $$ 
            BEGIN
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                           WHERE table_name = 'tags' AND column_name = 'type') THEN
                ALTER TABLE tags ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'game';
                ALTER TABLE tags ADD CONSTRAINT tags_user_id_name_type_unique UNIQUE(user_id, name, type);
              END IF;
            END $$;

      CREATE TABLE IF NOT EXISTS game_tags (
        game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
        tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY(game_id, tag_id)
      );

      CREATE TABLE IF NOT EXISTS media_tags (
        media_id INTEGER REFERENCES media_items(id) ON DELETE CASCADE,
        tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY(media_id, tag_id)
      );

      -- TAGS INDEXES
      CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
      CREATE INDEX IF NOT EXISTS idx_game_tags_game_id ON game_tags(game_id);
      CREATE INDEX IF NOT EXISTS idx_game_tags_tag_id ON game_tags(tag_id);
      CREATE INDEX IF NOT EXISTS idx_media_tags_media_id ON media_tags(media_id);
      CREATE INDEX IF NOT EXISTS idx_media_tags_tag_id ON media_tags(tag_id);

      -- HISTORY LOG TABLE
      CREATE TABLE IF NOT EXISTS history_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('game', 'media')),
        entity_id INTEGER NOT NULL,
        entity_name VARCHAR(255) NOT NULL,
        action VARCHAR(50) NOT NULL CHECK (action IN ('created', 'moved', 'updated', 'deleted')),
        old_value JSONB,
        new_value JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_history_user_entity_created ON history_log(user_id, entity_type, created_at);
    `);
    console.log('✅ База данных инициализирована');
    console.log('✅ Таблицы тегов созданы успешно');
    client.release();
  } catch (error) {
    console.error('❌ Ошибка инициализации БД:', error);
    console.error('❌ Stack trace:', error.stack);
    if (error.code) {
      console.error('❌ Error code:', error.code);
    }
    if (error.message) {
      console.error('❌ Error message:', error.message);
    }
  }
}

// Инициализация базы данных (не блокирует запуск сервера)
initDatabase().catch(error => {
  console.error('❌ Ошибка инициализации базы данных:', error.message);
  console.warn('⚠️ Сервер продолжит работу, но некоторые функции могут быть недоступны');
});

async function getTwitchToken() {
  if (twitchAccessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return twitchAccessToken;
  }
  try {
    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
      console.error('❌ TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET не настроены');
      throw new Error('Отсутствуют креды Twitch для IGDB');
    }
    const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials'
      }
    });
    twitchAccessToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000);
    return twitchAccessToken;
  } catch (error) {
    console.error('Ошибка Twitch токена:', error.response?.data || error.message);
    const err = new Error('Не удалось авторизоваться в Twitch API');
    err.cause = error;
    throw err;
  }
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  console.log('Auth header:', authHeader);
  console.log('Token:', token ? 'Present' : 'Missing');
  console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Present' : 'Missing');
  
  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log('Token verification failed:', err.message);
      console.log('Token:', token);
      console.log('JWT_SECRET length:', process.env.JWT_SECRET?.length);
      return res.status(403).json({ error: 'Недействительный токен' });
    }
    console.log('User authenticated:', user.id);
    req.user = user;
    next();
  });
}

// НОВАЯ ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ЛОГИРОВАНИЯ
async function logActivity(userId, actionType, details) {
  const client = await pool.connect();
  try {
    await client.query(
      'INSERT INTO activities (user_id, action_type, details) VALUES ($1, $2, $3)',
      [userId, actionType, JSON.stringify(details)]
    );
  } catch (error) {
    console.error(`Failed to log activity [${actionType}]:`, error);
  } finally {
    client.release();
  }
}

// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ СОЗДАНИЯ УВЕДОМЛЕНИЙ
async function createNotification(userId, fromUserId, type, message, referenceId = null) {
  const client = await pool.connect();
  try {
    await client.query(
      'INSERT INTO notifications (user_id, from_user_id, type, message, reference_id) VALUES ($1, $2, $3, $4, $5)',
      [userId, fromUserId, type, message, referenceId]
    );
  } catch (error) {
    console.error(`Failed to create notification [${type}]:`, error);
  } finally {
    client.release();
  }
}

// === AUTH (без изменений) ===
app.post('/api/auth/register', registerLimiter, validateRegister, async (req, res) => {
  const client = await pool.connect();
  try {
    const { username, email, password, confirmPassword } = req.body;
    
    console.log('Registration attempt:', { username, email, hasPassword: !!password, hasConfirmPassword: !!confirmPassword });
    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль минимум 6 символов' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Пароли не совпадают' });
    }
    
    console.log('✅ Validation passed, generating verification token...');
    // Генерируем токен верификации
    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 часа
    
    console.log('✅ Token generated, hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    console.log('✅ Password hashed, inserting user to database...');
    
    // Убеждаемся, что колонки существуют (добавляем если нет)
    try {
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
        ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP,
        ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255),
        ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP,
        ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT false
      `);
    } catch (migrationError) {
      console.warn('⚠️ Migration warning (columns may already exist):', migrationError.message);
      // Продолжаем, так как колонки могут уже существовать
    }
    
    const result = await client.query(
      'INSERT INTO users (username, email, password, email_verification_token, email_verification_expires) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, avatar, bio, theme, is_email_verified',
      [username, email, hashedPassword, verificationToken, verificationExpires]
    );
    const user = result.rows[0];
    console.log('✅ User created successfully:', user.id);
    
    // Отправляем email подтверждения (не блокируем регистрацию если email не отправился)
    try {
      const emailSent = await sendVerificationEmail(email, verificationToken, username);
      if (!emailSent) {
        console.error('Failed to send verification email for user:', username);
        // Продолжаем регистрацию, так как пользователь уже создан
      }
    } catch (emailError) {
      console.error('Error sending verification email (non-blocking):', emailError.message);
      // Не блокируем регистрацию, даже если email не отправился
    }
    
    res.status(201).json({ 
      message: 'Регистрация успешна. Проверьте ваш email для подтверждения аккаунта.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        theme: user.theme,
        is_email_verified: user.is_email_verified
      }
    });
  } catch (error) {
    console.error('❌ Ошибка регистрации:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Пользователь или email уже существует' });
    }
    
    // Возвращаем более подробную информацию об ошибке (только для отладки)
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Ошибка сервера' 
      : error.message || 'Ошибка сервера';
    
    res.status(500).json({ 
      error: 'Ошибка сервера',
      details: process.env.NODE_ENV !== 'production' ? errorMessage : undefined
    });
  } finally {
    client.release();
  }
});

// Endpoint для подтверждения email
app.get('/api/auth/verify-email', async (req, res) => {
  const client = await pool.connect();
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Токен подтверждения не предоставлен' });
    }
    
    // Находим пользователя по токену
    const result = await client.query(
      'SELECT id, username, email, email_verification_expires FROM users WHERE email_verification_token = $1',
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Неверный токен подтверждения' });
    }
    
    const user = result.rows[0];
    
    // Проверяем, не истек ли токен
    if (new Date() > new Date(user.email_verification_expires)) {
      return res.status(400).json({ error: 'Токен подтверждения истек. Запросите новый.' });
    }
    
    // Обновляем статус подтверждения
    await client.query(
      'UPDATE users SET is_email_verified = true, email_verification_token = NULL, email_verification_expires = NULL WHERE id = $1',
      [user.id]
    );
    
    res.status(200).json({ 
      message: 'Email успешно подтвержден! Теперь вы можете войти в систему.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
    
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

// Endpoint для повторной отправки email подтверждения
app.post('/api/auth/resend-verification', async (req, res) => {
  const client = await pool.connect();
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email обязателен' });
    }
    
    // Находим пользователя
    const result = await client.query(
      'SELECT id, username, email, is_email_verified FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь с таким email не найден' });
    }
    
    const user = result.rows[0];
    
    if (user.is_email_verified) {
      return res.status(400).json({ error: 'Email уже подтвержден' });
    }
    
    // Генерируем новый токен
    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    // Обновляем токен в базе
    await client.query(
      'UPDATE users SET email_verification_token = $1, email_verification_expires = $2 WHERE id = $3',
      [verificationToken, verificationExpires, user.id]
    );
    
    // Отправляем email
    const emailSent = await sendVerificationEmail(email, verificationToken, user.username);
    
    if (!emailSent) {
      console.error('❌ Не удалось отправить email подтверждения:', {
        email,
        hasSgMail: !!sgMail,
        hasSENDGRID_API_KEY: !!SENDGRID_API_KEY,
        hasFROM_EMAIL: !!FROM_EMAIL
      });
      
      // Возвращаем более информативную ошибку
      if (!sgMail) {
        return res.status(503).json({ 
          error: 'Сервис отправки email временно недоступен. Попробуйте позже.' 
        });
      }
      
      if (!SENDGRID_API_KEY) {
        return res.status(503).json({ 
          error: 'Сервис отправки email не настроен. Обратитесь к администратору.' 
        });
      }
      
      return res.status(500).json({ 
        error: 'Ошибка отправки email. Попробуйте позже.' 
      });
    }
    
    console.log('✅ Email подтверждения отправлен повторно для:', email);
    res.status(200).json({ message: 'Письмо с подтверждением отправлено повторно' });
    
  } catch (error) {
    console.error('❌ Resend verification error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Ошибка сервера',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// Endpoint для запроса сброса пароля
app.post('/api/auth/forgot-password', async (req, res) => {
  const client = await pool.connect();
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email обязателен' });
    }
    
    // Находим пользователя
    const result = await client.query(
      'SELECT id, username, email FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      // Не раскрываем, существует ли пользователь с таким email
      return res.status(200).json({ 
        message: 'Если пользователь с таким email существует, мы отправили инструкции по сбросу пароля.' 
      });
    }
    
    const user = result.rows[0];
    
    // Генерируем токен сброса пароля
    const resetToken = generateVerificationToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 час
    
    // Обновляем токен в базе
    await client.query(
      'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
      [resetToken, resetExpires, user.id]
    );
    
    // Отправляем email
    const emailSent = await sendPasswordResetEmail(email, resetToken, user.username);
    
    if (!emailSent) {
      console.error('Failed to send password reset email for user:', user.username);
      return res.status(500).json({ error: 'Ошибка отправки email' });
    }
    
    res.status(200).json({ 
      message: 'Если пользователь с таким email существует, мы отправили инструкции по сбросу пароля.' 
    });
    
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

// Endpoint для подтверждения сброса пароля
app.post('/api/auth/reset-password', async (req, res) => {
  const client = await pool.connect();
  try {
    const { token, newPassword, confirmPassword } = req.body;
    
    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Пароль минимум 6 символов' });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Пароли не совпадают' });
    }
    
    // Находим пользователя по токену
    const result = await client.query(
      'SELECT id, username, email, password_reset_expires FROM users WHERE password_reset_token = $1',
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Неверный токен сброса пароля' });
    }
    
    const user = result.rows[0];
    
    // Проверяем, не истек ли токен
    if (new Date() > new Date(user.password_reset_expires)) {
      return res.status(400).json({ error: 'Токен сброса пароля истек. Запросите новый.' });
    }
    
    // Хешируем новый пароль
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Обновляем пароль и удаляем токен
    await client.query(
      'UPDATE users SET password = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $2',
      [hashedPassword, user.id]
    );
    
    res.status(200).json({ 
      message: 'Пароль успешно изменен! Теперь вы можете войти с новым паролем.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
    
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const client = await pool.connect();
  try {
    const { username, password } = req.body;
    const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }
    
    // ВРЕМЕННО ОТКЛЮЧЕНО: Проверка подтверждения email
    // if (!user.is_email_verified) {
    //   return res.status(403).json({ 
    //     error: 'Email не подтвержден. Проверьте вашу почту и подтвердите регистрацию.',
    //     email: user.email,
    //     needsVerification: true
    //   });
    // }
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      message: 'Вход выполнен',
      token,
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        avatar: user.avatar, 
        bio: user.bio, 
        theme: user.theme,
        is_email_verified: user.is_email_verified
      }
    });
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

// === PROFILE (без изменений) ===
app.get('/api/profile', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, username, email, avatar, bio, theme, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Ошибка профиля:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

app.post('/api/profile/avatar', avatarLimiter, authenticateToken, validateAvatar, async (req, res) => {
  const client = await pool.connect();
  try {
    const { avatar } = req.body;
    if (!avatar || !avatar.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Неверный формат изображения' });
    }
    const result = await client.query(
      'UPDATE users SET avatar = $1 WHERE id = $2 RETURNING *',
      [avatar, req.user.id]
    );
    const user = result.rows[0];
    res.json({ message: 'Аватар обновлен', user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar, bio: user.bio, theme: user.theme } });
  } catch (error) {
    console.error('Ошибка загрузки аватара:', error);
    res.status(500).json({ error: 'Ошибка загрузки аватара' });
  } finally {
    client.release();
  }
});

app.put('/api/profile', authenticateToken, validateProfile, sanitizeInput, async (req, res) => {
  const client = await pool.connect();
  try {
    const { username, bio, theme, currentPassword, newPassword, is_profile_public, show_activity, show_stats, allow_friend_requests } = req.body;
    let updateFields = [], values = [], paramCount = 1;
    if (username) { updateFields.push(`username = $${paramCount++}`); values.push(username); }
    if (bio !== undefined) { updateFields.push(`bio = $${paramCount++}`); values.push(bio); }
    if (theme) { updateFields.push(`theme = $${paramCount++}`); values.push(theme); }
    if (is_profile_public !== undefined) { updateFields.push(`is_profile_public = $${paramCount++}`); values.push(is_profile_public); }
    if (show_activity !== undefined) { updateFields.push(`show_activity = $${paramCount++}`); values.push(show_activity); }
    if (show_stats !== undefined) { updateFields.push(`show_stats = $${paramCount++}`); values.push(show_stats); }
    if (allow_friend_requests !== undefined) { updateFields.push(`allow_friend_requests = $${paramCount++}`); values.push(allow_friend_requests); }
    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ error: 'Требуется текущий пароль' });
      const userResult = await client.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
      const validPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password);
      if (!validPassword) return res.status(401).json({ error: 'Неверный текущий пароль' });
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      updateFields.push(`password = $${paramCount++}`);
      values.push(hashedPassword);
    }
    if (updateFields.length === 0) return res.status(400).json({ error: 'Нет данных для обновления' });
    values.push(req.user.id);
    const result = await client.query(`UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`, values);
    const updatedUser = result.rows[0];
    const newToken = jwt.sign({ id: updatedUser.id, username: updatedUser.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ 
        message: 'Профиль обновлен', 
        user: { id: updatedUser.id, username: updatedUser.username, email: updatedUser.email, avatar: updatedUser.avatar, bio: updatedUser.bio, theme: updatedUser.theme }, 
        token: newToken 
    });
  } catch (error) {
    if (error.code === '23505') return res.status(400).json({ error: 'Это имя пользователя уже занято' });
    console.error('Ошибка обновления профиля:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

// === PUBLIC ENDPOINTS FOR LANDING PAGE ===
// Получить популярные игры для landing page (без аутентификации)
app.get('/api/public/popular-games', async (req, res) => {
  try {
    const token = await getTwitchToken();
    const response = await axios.post(
      'https://api.igdb.com/v4/games',
      `fields name, cover.url, rating;
       where rating != null & cover != null & rating > 70;
       sort rating desc;
       limit 200;`,
      {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'text/plain'
        }
      }
    );

    const games = response.data.map(game => ({
      id: game.id,
      title: game.name,
      poster: game.cover ? `https:${game.cover.url.replace('t_thumb', 't_cover_big')}` : null,
      type: 'game',
      rating: game.rating
    })).filter(game => game.poster);

    res.json({ games });
  } catch (error) {
    console.error('Ошибка получения популярных игр:', error.message);
    res.status(500).json({ error: 'Ошибка получения игр', games: [] });
  }
});

// Получить популярные фильмы/сериалы для landing page (без аутентификации)
app.get('/api/public/popular-movies', async (req, res) => {
  try {
    const [moviesResponse, tvResponse] = await Promise.all([
      axios.get(`https://api.themoviedb.org/3/movie/popular`, {
        params: {
          api_key: TMDB_API_KEY,
          language: 'ru-RU',
          page: 1
        }
      }),
      axios.get(`https://api.themoviedb.org/3/tv/popular`, {
        params: {
          api_key: TMDB_API_KEY,
          language: 'ru-RU',
          page: 1
        }
      })
    ]);

    const movies = moviesResponse.data.results.map(movie => ({
      id: movie.id,
      title: movie.title || movie.name,
      poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
      type: 'movie',
      rating: movie.vote_average
    }));

    const series = tvResponse.data.results.map(show => ({
      id: show.id,
      title: show.title || show.name,
      poster: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null,
      type: 'series',
      rating: show.vote_average
    }));

    const allMovies = [...movies, ...series].filter(item => item.poster);

    res.json({ movies: allMovies });
  } catch (error) {
    console.error('Ошибка получения популярных фильмов:', error.message);
    res.status(500).json({ error: 'Ошибка получения фильмов', movies: [] });
  }
});

// === GAMES (С ИЗМЕНЕНИЯМИ ДЛЯ ЛОГИРОВАНИЯ) ===
app.get('/api/games/search', searchLimiter, authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.status(400).json({ error: 'Минимум 2 символа' });
    const safeQ = String(q).replace(/"/g, '\\"').slice(0, 100);
    const token = await getTwitchToken();
    const response = await axios.post(
      'https://api.igdb.com/v4/games', `search "${safeQ}"; fields name, cover.url, summary, rating, genres.name, videos.video_id; limit 20;`,
      { headers: { 'Client-ID': TWITCH_CLIENT_ID, 'Authorization': `Bearer ${token}`, 'Content-Type': 'text/plain' } }
    );
    const games = response.data.map(game => ({
      id: game.id, name: game.name,
      cover: game.cover?.url ? `https:${game.cover.url.replace('t_thumb', 't_cover_big')}` : null,
      summary: game.summary || '', rating: game.rating ? Math.round(game.rating / 20) : null,
      genres: game.genres?.map(g => g.name) || [], videoId: game.videos?.[0]?.video_id || null,
      time_to_beat: (game.time_to_beat && typeof game.time_to_beat === 'object')
        ? [
            Number.isFinite(game.time_to_beat.normally) ? game.time_to_beat.normally : null,
            Number.isFinite(game.time_to_beat.completely) ? game.time_to_beat.completely : null,
            Number.isFinite(game.time_to_beat.hastly) ? game.time_to_beat.hastly : null
          ]
        : null,
    }));
    res.json({ games });
  } catch (error) {
    console.error('Ошибка поиска IGDB:', error.response?.data || error.message);
    res.status(500).json({ error: 'Ошибка поиска' });
  }
});

// === ПОЛУЧЕНИЕ ДЕТАЛЕЙ ИГРЫ ИЗ IGDB ===
app.get('/api/games/:gameId/details', authenticateToken, async (req, res) => {
  try {
    const { gameId } = req.params; // IGDB ID игры
    if (!gameId || isNaN(gameId)) {
      return res.status(400).json({ error: 'Неверный ID игры' });
    }
    
    const token = await getTwitchToken();
    console.log(`[IGDB] details for gameId=${gameId}`);
    // Запрашиваем games с расширением для time_to_beat через expansion
    const response = await axios.post(
      'https://api.igdb.com/v4/games',
      `fields name, cover.url, summary, rating, genres.name, videos.video_id, game_time_to_beats; expand game_time_to_beats; where id = ${gameId}; limit 1;`,
      { headers: { 'Client-ID': TWITCH_CLIENT_ID, 'Authorization': `Bearer ${token}`, 'Content-Type': 'text/plain' } }
    );
    
    if (!response.data || response.data.length === 0) {
      return res.status(404).json({ error: 'Игра не найдена' });
    }
    
    const game = response.data[0];
    console.log('[IGDB] Игра получена:', JSON.stringify(game, null, 2));
    
    // Извлекаем время прохождения из ответа games
    let normalizedTimeToBeat = null;
    
    // Если game_time_to_beats пришел через expansion как массив
    if (game.game_time_to_beats && Array.isArray(game.game_time_to_beats) && game.game_time_to_beats.length > 0) {
      const ttb = game.game_time_to_beats[0];
      console.log('[IGDB] game_time_to_beats из expansion:', JSON.stringify(ttb, null, 2));
      
      const normally = (ttb.normally !== undefined && ttb.normally !== null && Number.isFinite(Number(ttb.normally))) 
        ? Number(ttb.normally) : null;
      const completely = (ttb.completely !== undefined && ttb.completely !== null && Number.isFinite(Number(ttb.completely))) 
        ? Number(ttb.completely) : null;
      const hastly = (ttb.hastly !== undefined && ttb.hastly !== null && Number.isFinite(Number(ttb.hastly))) 
        ? Number(ttb.hastly) : null;
      
      if (normally !== null || completely !== null || hastly !== null) {
        normalizedTimeToBeat = [normally, completely, hastly];
        console.log('[IGDB] ✅ Время прохождения из expansion:', normalizedTimeToBeat);
      }
    } else if (game.game_time_to_beats && typeof game.game_time_to_beats === 'object' && !Array.isArray(game.game_time_to_beats)) {
      // Если пришел как объект (не массив)
      const ttb = game.game_time_to_beats;
      const normally = (ttb.normally !== undefined && ttb.normally !== null && Number.isFinite(Number(ttb.normally))) 
        ? Number(ttb.normally) : null;
      const completely = (ttb.completely !== undefined && ttb.completely !== null && Number.isFinite(Number(ttb.completely))) 
        ? Number(ttb.completely) : null;
      const hastly = (ttb.hastly !== undefined && ttb.hastly !== null && Number.isFinite(Number(ttb.hastly))) 
        ? Number(ttb.hastly) : null;
      
      if (normally !== null || completely !== null || hastly !== null) {
        normalizedTimeToBeat = [normally, completely, hastly];
        console.log('[IGDB] ✅ Время прохождения из объекта:', normalizedTimeToBeat);
      }
    } else {
      console.log('[IGDB] ⚠️ game_time_to_beats не найден в ответе games');
    }
    
    // Если не получили через games expansion, значит данных нет в IGDB для этой игры
    if (!normalizedTimeToBeat) {
      console.log('[IGDB] ⚠️ Данные time_to_beat отсутствуют для этой игры в IGDB');
    }
    const gameDetails = {
      id: game.id,
      name: game.name,
      cover: game.cover?.url ? `https:${game.cover.url.replace('t_thumb', 't_cover_big')}` : null,
      summary: game.summary || '',
      rating: game.rating ? Math.round(game.rating / 20) : null,
      genres: game.genres?.map(g => g.name) || [],
      videoId: game.videos?.[0]?.video_id || null,
      time_to_beat: normalizedTimeToBeat
    };
    
    console.log('[IGDB] Финальный ответ gameDetails:', JSON.stringify(gameDetails, null, 2));
    res.json(gameDetails);
  } catch (error) {
    console.error('Ошибка получения деталей игры:', error.message);
    res.status(500).json({ error: 'Ошибка получения деталей игры' });
  }
});

// === ПОИСК ПО СОБСТВЕННЫМ ИГРАМ ===
app.get('/api/user/games/search', searchLimiter, authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { q, board, minRating, maxRating } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Минимум 2 символа для поиска' });
    }

    // Построение WHERE условий
    let whereConditions = ['g.user_id = $1'];
    let queryParams = [req.user.id];
    let paramCount = 1;

    // Поиск по названию и заметкам
    paramCount++;
    whereConditions.push(`(g.name ILIKE $${paramCount} OR g.notes ILIKE $${paramCount})`);
    queryParams.push(`%${q}%`);

    // Фильтр по доске
    if (board && ['backlog', 'playing', 'completed', 'dropped'].includes(board)) {
      paramCount++;
      whereConditions.push(`g.board = $${paramCount}`);
      queryParams.push(board);
    }

    // Фильтр по рейтингу
    if (minRating && !isNaN(minRating)) {
      paramCount++;
      whereConditions.push(`g.rating >= $${paramCount}`);
      queryParams.push(parseInt(minRating));
    }

    if (maxRating && !isNaN(maxRating)) {
      paramCount++;
      whereConditions.push(`g.rating <= $${paramCount}`);
      queryParams.push(parseInt(maxRating));
    }

    // SQL запрос с сортировкой по релевантности
    const query = `
      SELECT g.*, 
        COALESCE(json_agg(
          json_build_object('user_id', r.user_id, 'emoji', r.emoji, 'username', u.username, 'avatar', u.avatar)
        ) FILTER (WHERE r.id IS NOT NULL), '[]') as reactions,
        CASE 
          WHEN g.name ILIKE $${paramCount + 1} THEN 3
          WHEN g.name ILIKE $${paramCount + 2} THEN 2
          WHEN g.notes ILIKE $${paramCount + 1} THEN 1
          ELSE 0
        END as relevance_score
      FROM games g
      LEFT JOIN reactions r ON g.id = r.game_id
      LEFT JOIN users u ON r.user_id = u.id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY g.id
      ORDER BY relevance_score DESC, g.updated_at DESC, g.added_at DESC
      LIMIT 20
    `;

    // Добавляем параметры для точного совпадения (высший приоритет)
    queryParams.push(q); // Точное совпадение названия
    queryParams.push(`${q}%`); // Начинается с поискового запроса

    const result = await client.query(query, queryParams);
    
    const games = result.rows.map(game => ({
      id: game.id.toString(),
      gameId: game.game_id,
      name: game.name,
      cover: game.cover,
      board: game.board,
      rating: game.rating,
      notes: game.notes,
      hoursPlayed: game.hours_played,
      addedDate: game.added_at,
      updatedDate: game.updated_at,
      videoId: game.video_id,
      deepReviewAnswers: game.deep_review_answers,
      reactions: game.reactions,
      relevanceScore: game.relevance_score
    }));

    res.json({ 
      games,
      total: games.length,
      query: q,
      filters: { board, minRating, maxRating }
    });

  } catch (error) {
    console.error('Ошибка поиска по играм:', error);
    res.status(500).json({ error: 'Ошибка поиска по играм' });
  } finally {
    client.release();
  }
});

app.post('/api/user/boards/:boardId/games', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { boardId } = req.params;
    const { game } = req.body;
    if (!game || !game.id || !game.name) {
      return res.status(400).json({ error: 'Неполные данные игры' });
    }
    const result = await client.query(
      'INSERT INTO games (user_id, game_id, name, cover, board, video_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.user.id, game.id, game.name, game.cover || null, boardId, game.videoId || null]
    );
    // ЛОГИРОВАНИЕ
    await logActivity(req.user.id, 'add_game', { gameName: game.name, board: boardId });
    res.status(201).json({ message: 'Игра добавлена', game: result.rows[0] });
  } catch (error) {
    console.error('Ошибка добавления игры:', error);
    res.status(500).json({ error: 'Ошибка сервера', details: error.message });
  } finally {
    client.release();
  }
});

app.delete('/api/user/games/:gameId', authenticateToken, validateIdParam('gameId'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { gameId } = req.params;
    // Сначала получаем данные игры
    const gameResult = await client.query('SELECT name FROM games WHERE id = $1 AND user_id = $2', [gameId, req.user.id]);
    if (gameResult.rows.length > 0) {
      const gameName = gameResult.rows[0].name;
      // Потом удаляем
      await client.query('DELETE FROM games WHERE id = $1 AND user_id = $2', [gameId, req.user.id]);
      // И логируем
      await logActivity(req.user.id, 'remove_game', { gameName });
      res.json({ message: 'Игра удалена' });
    } else {
      res.status(404).json({ message: 'Игра не найдена' });
    }
  } catch (error) {
    console.error('Ошибка удаления:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

app.put('/api/user/games/:gameId', authenticateToken, validateIdParam('gameId'), sanitizeInput, async (req, res) => {
  const client = await pool.connect();
  try {
    const { gameId } = req.params;
    const { board, rating, notes, hoursPlayed, review, is_published } = req.body;

    let oldGameData = null;
    if (board) {
      const oldGameResult = await client.query('SELECT board, name FROM games WHERE id = $1 AND user_id = $2', [gameId, req.user.id]);
      if (oldGameResult.rows.length > 0) oldGameData = oldGameResult.rows[0];
    }

    let updateFields = [], values = [], paramCount = 1;
    if (board) { updateFields.push(`board = $${paramCount++}`); values.push(board); }
    if (rating !== undefined) { updateFields.push(`rating = $${paramCount++}`); values.push(rating); }
    if (notes !== undefined) { updateFields.push(`notes = $${paramCount++}`); values.push(notes); }
    if (hoursPlayed !== undefined) { updateFields.push(`hours_played = $${paramCount++}`); values.push(hoursPlayed); }
    if (review !== undefined) { updateFields.push(`review = $${paramCount++}`); values.push(review); }
    if (is_published !== undefined) { updateFields.push(`is_published = $${paramCount++}`); values.push(is_published); }
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(gameId, req.user.id);
    
    const result = await client.query(
      `UPDATE games SET ${updateFields.join(', ')} WHERE id = $${paramCount} AND user_id = $${paramCount + 1} RETURNING *`,
      values
    );

    // ЛОГИРОВАНИЕ И УВЕДОМЛЕНИЯ
    if (oldGameData && oldGameData.board !== board) {
      if (board === 'completed') {
        await logActivity(req.user.id, 'complete_game', { gameName: oldGameData.name });
        
        // Уведомляем друзей о завершении игры
        const friendsResult = await client.query(
          'SELECT friend_id FROM friendships WHERE user_id = $1 AND status = $2',
          [req.user.id, 'accepted']
        );
        
        for (const friend of friendsResult.rows) {
          await createNotification(
            friend.friend_id,
            req.user.id,
            'game_completed',
            `${req.user.username} завершил игру "${oldGameData.name}"`,
            gameId
          );
        }
      } else {
        await logActivity(req.user.id, 'move_game', { gameName: oldGameData.name, fromBoard: oldGameData.board, toBoard: board });
      }
    }

    res.json({ message: 'Игра обновлена', game: result.rows[0] });
  } catch (error) {
    console.error('Ошибка обновления:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

// === DEEP REVIEW (С ИЗМЕНЕНИЯМИ ДЛЯ ЛОГИРОВАНИЯ) ===
app.post('/api/games/:gameId/deep-review', authenticateToken, validateIdParam('gameId'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { gameId } = req.params;
    const { answers } = req.body;
    if (!Array.isArray(answers) || answers.length !== 20) {
      return res.status(400).json({ error: 'Требуется 20 ответов' });
    }
    const result = await client.query(
      'UPDATE games SET deep_review_answers = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [JSON.stringify(answers), gameId, req.user.id]
    );
    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Игра не найдена или не принадлежит вам' });
    }
    // ЛОГИРОВАНИЕ И УВЕДОМЛЕНИЯ
    await logActivity(req.user.id, 'add_review', { gameName: result.rows[0].name });
    
    // Уведомляем друзей о добавлении отзыва
    const friendsResult = await client.query(
      'SELECT friend_id FROM friendships WHERE user_id = $1 AND status = $2',
      [req.user.id, 'accepted']
    );
    
    for (const friend of friendsResult.rows) {
      await createNotification(
        friend.friend_id,
        req.user.id,
        'review_added',
        `${req.user.username} добавил отзыв к игре "${result.rows[0].name}"`,
        gameId
      );
    }
    
    res.json({ message: 'Отзыв сохранен', game: result.rows[0] });
  } catch (error) {
    console.error('Ошибка сохранения отзыва:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

// Остальные маршруты (без изменений)
app.get('/api/user/boards', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { tags } = req.query;
    
    // Построение WHERE условий
    let whereConditions = ['g.user_id = $1'];
    let queryParams = [req.user.id];
    let paramCount = 1;

    // Фильтр по тегам
    if (tags) {
      const tagIds = tags.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (tagIds.length > 0) {
        paramCount++;
        whereConditions.push(`g.id IN (
          SELECT gt.game_id FROM game_tags gt 
          WHERE gt.tag_id = ANY($${paramCount})
        )`);
        queryParams.push(tagIds);
      }
    }

    const result = await client.query(
      `SELECT g.*, 
        COALESCE(json_agg(
          json_build_object('user_id', r.user_id, 'emoji', r.emoji, 'username', u.username, 'avatar', u.avatar)
        ) FILTER (WHERE r.id IS NOT NULL), '[]') as reactions,
        COALESCE(json_agg(
          json_build_object('id', t.id, 'name', t.name, 'color', t.color)
        ) FILTER (WHERE t.id IS NOT NULL), '[]') as tags
       FROM games g
       LEFT JOIN reactions r ON g.id = r.game_id
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN game_tags gt ON g.id = gt.game_id
       LEFT JOIN tags t ON gt.tag_id = t.id
       WHERE ${whereConditions.join(' AND ')}
       GROUP BY g.id
       ORDER BY g.updated_at DESC, g.added_at DESC`,
      queryParams
    );
    
    const boards = { backlog: [], playing: [], completed: [], dropped: [] };
    result.rows.forEach(game => {
      const card = {
        id: game.id.toString(), gameId: game.game_id, name: game.name,
        cover: game.cover, rating: game.rating, notes: game.notes,
        hoursPlayed: game.hours_played, addedDate: game.added_at,
        reactions: game.reactions, videoId: game.video_id,
        deep_review_answers: game.deep_review_answers,
        review: game.review, is_published: game.is_published,
        tags: game.tags
      };
      if (boards[game.board]) boards[game.board].push(card);
    });
    res.json({ boards });
  } catch (error) {
    console.error('Ошибка загрузки досок:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

// === СТАТИСТИКА ИГР ===
app.get('/api/user/statistics/games', statsLimiter, authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    // 1. Общая статистика
    const generalStatsQuery = `
      SELECT 
        board,
        COUNT(*) as count,
        AVG(rating) as avg_rating,
        SUM(hours_played) as total_hours
      FROM games 
      WHERE user_id = $1 
      GROUP BY board
    `;
    const generalStatsResult = await client.query(generalStatsQuery, [req.user.id]);
    
    const generalStats = {
      backlog: { count: 0, avgRating: 0, totalHours: 0 },
      playing: { count: 0, avgRating: 0, totalHours: 0 },
      completed: { count: 0, avgRating: 0, totalHours: 0 },
      dropped: { count: 0, avgRating: 0, totalHours: 0 }
    };
    
    generalStatsResult.rows.forEach(row => {
      if (generalStats[row.board]) {
        generalStats[row.board] = {
          count: parseInt(row.count),
          avgRating: row.avg_rating ? parseFloat(row.avg_rating).toFixed(1) : 0,
          totalHours: parseInt(row.total_hours) || 0
        };
      }
    });

    // 2. Статистика по месяцам за последние 12 месяцев
    const monthlyStatsQuery = `
      SELECT 
        DATE_TRUNC('month', added_at) as month,
        COUNT(*) as added_count,
        COUNT(CASE WHEN board = 'completed' THEN 1 END) as completed_count
      FROM games 
      WHERE user_id = $1 
        AND added_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', added_at)
      ORDER BY month
    `;
    const monthlyStatsResult = await client.query(monthlyStatsQuery, [req.user.id]);
    
    // Создаем массив для всех месяцев (даже если нет данных)
    const monthlyStats = [];
    const currentDate = new Date();
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthKey = monthDate.toISOString().slice(0, 7); // YYYY-MM
      
      const monthData = monthlyStatsResult.rows.find(row => 
        row.month.toISOString().slice(0, 7) === monthKey
      );
      
      monthlyStats.push({
        month: monthKey,
        added: monthData ? parseInt(monthData.added_count) : 0,
        completed: monthData ? parseInt(monthData.completed_count) : 0
      });
    }

    // 3. Топ-5 жанров (если есть данные о жанрах)
    // Пока что возвращаем пустой массив, так как жанры не сохраняются в текущей схеме
    const topGenres = [];

    // 4. Топ-10 самых высоко оцененных игр
    const topRatedQuery = `
      SELECT 
        id, name, cover, rating, board, hours_played, added_at
      FROM games 
      WHERE user_id = $1 
        AND rating IS NOT NULL 
        AND rating > 0
      ORDER BY rating DESC, hours_played DESC
      LIMIT 10
    `;
    const topRatedResult = await client.query(topRatedQuery, [req.user.id]);
    
    const topRatedGames = topRatedResult.rows.map(game => ({
      id: game.id.toString(),
      name: game.name,
      cover: game.cover,
      rating: game.rating,
      board: game.board,
      hoursPlayed: game.hours_played,
      addedDate: game.added_at
    }));

    // 5. Дополнительная статистика
    const additionalStatsQuery = `
      SELECT 
        COUNT(*) as total_games,
        COUNT(CASE WHEN rating IS NOT NULL THEN 1 END) as rated_games,
        AVG(rating) as overall_avg_rating,
        SUM(hours_played) as total_hours_all,
        MIN(added_at) as first_game_date,
        MAX(added_at) as last_game_date
      FROM games 
      WHERE user_id = $1
    `;
    const additionalStatsResult = await client.query(additionalStatsQuery, [req.user.id]);
    const additionalStats = additionalStatsResult.rows[0];

    // Формируем итоговый ответ в правильном формате для фронтенда
    const statistics = {
      general: generalStats,
      monthlyStats: monthlyStats,
      topGenres: topGenres,
      topGames: topRatedGames,
      summary: {
        totalGames: parseInt(additionalStats.total_games),
        completedGames: generalStats.completed.count,
        ratedGames: parseInt(additionalStats.rated_games),
        overallAvgRating: additionalStats.overall_avg_rating ? 
          parseFloat(additionalStats.overall_avg_rating).toFixed(1) : 0,
        totalHours: parseInt(additionalStats.total_hours_all) || 0,
        firstGameDate: additionalStats.first_game_date,
        lastGameDate: additionalStats.last_game_date
      }
    };

    console.log('Games statistics result:', statistics);
    res.json(statistics);

  } catch (error) {
    console.error('Ошибка получения статистики игр:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  } finally {
    client.release();
  }
});

// === СТАТИСТИКА МЕДИА ===
app.get('/api/user/statistics/media', statsLimiter, authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    // Проверяем, существует ли таблица media_items
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'media_items'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      // Если таблица не существует, возвращаем пустые данные в правильном формате
      res.json({
        summary: {
          watchedMovies: 0,
          watchedTvShows: 0,
          wishlistMovies: 0,
          wishlistTvShows: 0,
          averageRating: 0
        },
        topMovies: [],
        topTv: [],
        monthlyStats: []
      });
      return;
    }
    
    // 1. Общая статистика
    const generalStatsQuery = `
      SELECT 
        media_type,
        board,
        COUNT(*) as count,
        AVG(rating) as avg_rating
      FROM media_items 
      WHERE user_id = $1
      GROUP BY media_type, board
    `;
    
    const generalStats = await client.query(generalStatsQuery, [req.user.id]);
    
    console.log('General stats result:', generalStats.rows);
    
    // 2. Статистика по месяцам
    const monthlyStatsQuery = `
      SELECT 
        TO_CHAR(DATE_TRUNC('month', added_at), 'YYYY-MM') as month,
        COUNT(*) as added,
        COUNT(CASE WHEN board = 'watched' THEN 1 END) as completed
      FROM media_items 
      WHERE user_id = $1 AND added_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', added_at)
      ORDER BY DATE_TRUNC('month', added_at)
    `;
    
    const monthlyStats = await client.query(monthlyStatsQuery, [req.user.id]);
    
    // 3. Топ-10 самых высоко оцененных фильмов
    const topMoviesQuery = `
      SELECT title, rating, board, media_type, poster, added_at
      FROM media_items 
      WHERE user_id = $1 AND rating > 0 AND media_type = 'movie'
      ORDER BY rating DESC, added_at DESC
      LIMIT 10
    `;
    
    const topMovies = await client.query(topMoviesQuery, [req.user.id]);
    
    // 4. Топ-10 самых высоко оцененных сериалов
    const topTvQuery = `
      SELECT title, rating, board, media_type, poster, added_at
      FROM media_items 
      WHERE user_id = $1 AND rating > 0 AND media_type = 'tv'
      ORDER BY rating DESC, added_at DESC
      LIMIT 10
    `;
    
    const topTv = await client.query(topTvQuery, [req.user.id]);
    
    console.log('Monthly stats result:', monthlyStats.rows);
    console.log('Top movies result:', topMovies.rows);
    console.log('Top TV result:', topTv.rows);
    
    // Подготавливаем данные в новом формате
    const summary = {
      watchedMovies: 0,
      watchedTvShows: 0,
      wishlistMovies: 0,
      wishlistTvShows: 0,
      averageRating: 0
    };
    
    const topMoviesList = topMovies.rows.map(item => ({
      id: item.title,
      title: item.title,
      year: new Date(item.added_at).getFullYear(),
      poster: item.poster, // Получаем постер из БД
      rating: item.rating
    }));
    
    const topTvList = topTv.rows.map(item => ({
      id: item.title,
      title: item.title,
      year: new Date(item.added_at).getFullYear(),
      poster: item.poster, // Получаем постер из БД
      rating: item.rating
    }));
    
    // Создаем месячную статистику в правильном формате
    const monthlyStatsFormatted = [];
    const currentDate = new Date();
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthKey = monthDate.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });
      
      const monthData = monthlyStats.rows.find(row => 
        row.month === monthDate.toISOString().slice(0, 7)
      );
      
      monthlyStatsFormatted.push({
        month: monthKey,
        mediaAdded: monthData ? parseInt(monthData.added) : 0,
        mediaWatched: monthData ? parseInt(monthData.completed) : 0
      });
    }
    
    // Подсчитываем общую статистику
    generalStats.rows.forEach(row => {
      if (row.media_type === 'movie') {
        if (row.board === 'watched') {
          summary.watchedMovies += parseInt(row.count);
        } else if (row.board === 'wishlist') {
          summary.wishlistMovies += parseInt(row.count);
        }
      } else if (row.media_type === 'tv') {
        if (row.board === 'watched') {
          summary.watchedTvShows += parseInt(row.count);
        } else if (row.board === 'wishlist') {
          summary.wishlistTvShows += parseInt(row.count);
        }
      }
    });
    
    // Вычисляем средний рейтинг из всех рейтинговых элементов
    const allRatedItems = [...topMovies.rows, ...topTv.rows].filter(item => item.rating > 0);
    if (allRatedItems.length > 0) {
      const totalRating = allRatedItems.reduce((sum, item) => sum + item.rating, 0);
      summary.averageRating = parseFloat((totalRating / allRatedItems.length).toFixed(1));
    }
    
    const statistics = {
      summary: summary,
      topMovies: topMoviesList,
      topTv: topTvList,
      monthlyStats: monthlyStatsFormatted
    };
    
    console.log('Media statistics result:', statistics);
    res.json(statistics);
  } catch (error) {
    console.error('Ошибка статистики медиа:', error);
    console.error('Stack trace:', error.stack);
    // Возвращаем пустые данные в правильном формате
    res.json({
      summary: {
        watchedMovies: 0,
        watchedTvShows: 0,
        wishlistMovies: 0,
        wishlistTvShows: 0,
        averageRating: 0
      },
      topMovies: [],
      topTv: [],
      monthlyStats: []
    });
  } finally {
    client.release();
  }
});

// === ЭКСПОРТ ДАННЫХ ===
app.get('/api/export/games', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { format = 'json' } = req.query;
    const currentDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const filename = `gametracker_games_${currentDate}`;
    
    // Получаем все игры пользователя
    const result = await client.query(
      `SELECT 
        g.*,
        COALESCE(json_agg(
          json_build_object('user_id', r.user_id, 'emoji', r.emoji, 'username', u.username, 'avatar', u.avatar)
        ) FILTER (WHERE r.id IS NOT NULL), '[]') as reactions
       FROM games g
       LEFT JOIN reactions r ON g.id = r.game_id
       LEFT JOIN users u ON r.user_id = u.id
       WHERE g.user_id = $1
       GROUP BY g.id
       ORDER BY g.added_at DESC`,
      [req.user.id]
    );

    if (format === 'csv') {
      // CSV экспорт - основные поля
      const csvData = result.rows.map(game => ({
        'ID': game.id,
        'Game ID': game.game_id,
        'Название': game.name,
        'Доска': game.board,
        'Рейтинг': game.rating || '',
        'Заметки': game.notes || '',
        'Часы игры': game.hours_played || 0,
        'Дата добавления': game.added_at,
        'Дата обновления': game.updated_at,
        'Обложка': game.cover || '',
        'Видео ID': game.video_id || '',
        'Есть отзыв': game.deep_review_answers ? 'Да' : 'Нет'
      }));

      const parser = new Parser();
      const csv = parser.parse(csvData);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csv);
    } else {
      // JSON экспорт - полная структура
      const jsonData = {
        exportDate: new Date().toISOString(),
        totalGames: result.rows.length,
        games: result.rows.map(game => ({
          id: game.id.toString(),
          gameId: game.game_id,
          name: game.name,
          cover: game.cover,
          board: game.board,
          rating: game.rating,
          notes: game.notes,
          hoursPlayed: game.hours_played,
          addedDate: game.added_at,
          updatedDate: game.updated_at,
          videoId: game.video_id,
          deepReviewAnswers: game.deep_review_answers,
          reactions: game.reactions
        }))
      };

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.json(jsonData);
    }

  } catch (error) {
    console.error('Ошибка экспорта игр:', error);
    res.status(500).json({ error: 'Ошибка экспорта игр' });
  } finally {
    client.release();
  }
});

app.get('/api/export/media', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { format = 'json' } = req.query;
    const currentDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const filename = `gametracker_media_${currentDate}`;
    
    // Получаем все медиа пользователя
    const result = await client.query(
      `SELECT 
        m.*,
        COALESCE(json_agg(
          json_build_object('user_id', r.user_id, 'emoji', r.emoji, 'username', u.username, 'avatar', u.avatar)
        ) FILTER (WHERE r.id IS NOT NULL), '[]') as reactions
       FROM media_items m
       LEFT JOIN media_reactions r ON m.id = r.media_id
       LEFT JOIN users u ON r.user_id = u.id
       WHERE m.user_id = $1
       GROUP BY m.id
       ORDER BY m.added_at DESC`,
      [req.user.id]
    );

    if (format === 'csv') {
      // CSV экспорт - основные поля
      const csvData = result.rows.map(media => ({
        'ID': media.id,
        'TMDB ID': media.tmdb_id,
        'Тип': media.media_type,
        'Название': media.title,
        'Доска': media.board,
        'Рейтинг': media.rating || '',
        'Отзыв': media.review || '',
        'Просмотрено сезонов': media.seasons_watched || 0,
        'Просмотрено серий': media.episodes_watched || 0,
        'Дата добавления': media.added_at,
        'Дата обновления': media.updated_at,
        'Постер': media.poster || ''
      }));

      const parser = new Parser();
      const csv = parser.parse(csvData);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csv);
    } else {
      // JSON экспорт - полная структура
      const jsonData = {
        exportDate: new Date().toISOString(),
        totalMedia: result.rows.length,
        media: result.rows.map(media => ({
          id: media.id.toString(),
          tmdbId: media.tmdb_id,
          mediaType: media.media_type,
          title: media.title,
          poster: media.poster,
          board: media.board,
          rating: media.rating,
          review: media.review,
          seasonsWatched: media.seasons_watched,
          episodesWatched: media.episodes_watched,
          addedDate: media.added_at,
          updatedDate: media.updated_at,
          reactions: media.reactions
        }))
      };

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.json(jsonData);
    }

  } catch (error) {
    console.error('Ошибка экспорта медиа:', error);
    res.status(500).json({ error: 'Ошибка экспорта медиа' });
  } finally {
    client.release();
  }
});

// === УПРАВЛЕНИЕ ТЕГАМИ ===
// Получить все теги пользователя
app.get('/api/tags', authenticateToken, async (req, res) => {
  let client;
  try {
    console.log('GET /api/tags - Attempting to connect to database...');
    client = await pool.connect();
    console.log('GET /api/tags - Database connection successful');
    
    const { type = 'game' } = req.query; // По умолчанию 'game' для обратной совместимости
    console.log('GET /api/tags - User ID:', req.user.id, 'Type:', type);
    
    const result = await client.query(
      'SELECT * FROM tags WHERE user_id = $1 AND type = $2 ORDER BY name ASC',
      [req.user.id, type]
    );
    console.log('GET /api/tags - Found tags:', result.rows.length);
    res.json({ tags: result.rows });
  } catch (error) {
    console.error('GET /api/tags - Ошибка получения тегов:', error);
    console.error('GET /api/tags - Error code:', error.code);
    console.error('GET /api/tags - Error message:', error.message);
    res.status(500).json({ error: 'Ошибка получения тегов' });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Создать новый тег
app.post('/api/tags', authenticateToken, validateTag, sanitizeInput, async (req, res) => {
  let client;
  try {
    console.log('POST /api/tags - Attempting to connect to database...');
    client = await pool.connect();
    console.log('POST /api/tags - Database connection successful');
    
    const { name, color = '#3B82F6', type = 'game' } = req.body;
    console.log('POST /api/tags - User ID:', req.user.id, 'Name:', name, 'Color:', color, 'Type:', type);
    
    const result = await client.query(
      'INSERT INTO tags (user_id, name, color, type) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, name, color, type]
    );
    console.log('POST /api/tags - Created tag:', result.rows[0]);
    res.status(201).json({ message: 'Тег создан', tag: result.rows[0] });
  } catch (error) {
    console.error('POST /api/tags - Error:', error);
    console.error('POST /api/tags - Error code:', error.code);
    console.error('POST /api/tags - Error message:', error.message);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Тег с таким названием уже существует' });
    }
    console.error('Ошибка создания тега:', error);
    res.status(500).json({ error: 'Ошибка создания тега' });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Обновить тег
app.put('/api/tags/:id', authenticateToken, validateIdParam('id'), validateTag, sanitizeInput, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    
    const result = await client.query(
      'UPDATE tags SET name = $1, color = $2 WHERE id = $3 AND user_id = $4 RETURNING *',
      [name, color, id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Тег не найден' });
    }
    
    res.json({ message: 'Тег обновлен', tag: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Тег с таким названием уже существует' });
    }
    console.error('Ошибка обновления тега:', error);
    res.status(500).json({ error: 'Ошибка обновления тега' });
  } finally {
    client.release();
  }
});

// Удалить тег
app.delete('/api/tags/:id', authenticateToken, validateIdParam('id'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    
    const result = await client.query(
      'DELETE FROM tags WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Тег не найден' });
    }
    
    res.json({ message: 'Тег удален' });
  } catch (error) {
    console.error('Ошибка удаления тега:', error);
    res.status(500).json({ error: 'Ошибка удаления тега' });
  } finally {
    client.release();
  }
});

// === ПРИВЯЗКА ТЕГОВ К ИГРАМ ===
// Прикрепить тег к игре
app.post('/api/games/:gameId/tags/:tagId', authenticateToken, validateIdParam('gameId'), validateIdParam('tagId'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { gameId, tagId } = req.params;
    
    // Проверяем, что игра принадлежит пользователю
    const gameCheck = await client.query(
      'SELECT id FROM games WHERE id = $1 AND user_id = $2',
      [gameId, req.user.id]
    );
    if (gameCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Игра не найдена' });
    }
    
    // Проверяем, что тег принадлежит пользователю
    const tagCheck = await client.query(
      'SELECT id FROM tags WHERE id = $1 AND user_id = $2',
      [tagId, req.user.id]
    );
    if (tagCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Тег не найден' });
    }
    
    // Привязываем тег к игре
    await client.query(
      'INSERT INTO game_tags (game_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [gameId, tagId]
    );
    
    res.json({ message: 'Тег прикреплен к игре' });
  } catch (error) {
    console.error('Ошибка привязки тега к игре:', error);
    res.status(500).json({ error: 'Ошибка привязки тега' });
  } finally {
    client.release();
  }
});

// Открепить тег от игры
app.delete('/api/games/:gameId/tags/:tagId', authenticateToken, validateIdParam('gameId'), validateIdParam('tagId'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { gameId, tagId } = req.params;
    
    const result = await client.query(
      'DELETE FROM game_tags WHERE game_id = $1 AND tag_id = $2',
      [gameId, tagId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Связь не найдена' });
    }
    
    res.json({ message: 'Тег откреплен от игры' });
  } catch (error) {
    console.error('Ошибка отвязки тега от игры:', error);
    res.status(500).json({ error: 'Ошибка отвязки тега' });
  } finally {
    client.release();
  }
});

// === ПРИВЯЗКА ТЕГОВ К МЕДИА ===
// Прикрепить тег к медиа
app.post('/api/media/:mediaId/tags/:tagId', authenticateToken, validateIdParam('mediaId'), validateIdParam('tagId'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { mediaId, tagId } = req.params;
    
    // Проверяем, что медиа принадлежит пользователю
    const mediaCheck = await client.query(
      'SELECT id FROM media_items WHERE id = $1 AND user_id = $2',
      [mediaId, req.user.id]
    );
    if (mediaCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Медиа не найдено' });
    }
    
    // Проверяем, что тег принадлежит пользователю
    const tagCheck = await client.query(
      'SELECT id FROM tags WHERE id = $1 AND user_id = $2',
      [tagId, req.user.id]
    );
    if (tagCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Тег не найден' });
    }
    
    // Привязываем тег к медиа
    await client.query(
      'INSERT INTO media_tags (media_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [mediaId, tagId]
    );
    
    res.json({ message: 'Тег прикреплен к медиа' });
  } catch (error) {
    console.error('Ошибка привязки тега к медиа:', error);
    res.status(500).json({ error: 'Ошибка привязки тега' });
  } finally {
    client.release();
  }
});

// Открепить тег от медиа
app.delete('/api/media/:mediaId/tags/:tagId', authenticateToken, validateIdParam('mediaId'), validateIdParam('tagId'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { mediaId, tagId } = req.params;
    
    const result = await client.query(
      'DELETE FROM media_tags WHERE media_id = $1 AND tag_id = $2',
      [mediaId, tagId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Связь не найдена' });
    }
    
    res.json({ message: 'Тег откреплен от медиа' });
  } catch (error) {
    console.error('Ошибка отвязки тега от медиа:', error);
    res.status(500).json({ error: 'Ошибка отвязки тега' });
  } finally {
    client.release();
  }
});

// === ПОЛУЧЕНИЕ КОНТЕНТА ПО ТЕГАМ ===
// Получить все игры с определенным тегом
app.get('/api/user/games/by-tag/:tagId', authenticateToken, validateIdParam('tagId'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { tagId } = req.params;
    
    // Проверяем, что тег принадлежит пользователю
    const tagCheck = await client.query(
      'SELECT id, name, color FROM tags WHERE id = $1 AND user_id = $2',
      [tagId, req.user.id]
    );
    if (tagCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Тег не найден' });
    }
    
    const result = await client.query(
      `SELECT g.*, 
        COALESCE(json_agg(
          json_build_object('user_id', r.user_id, 'emoji', r.emoji, 'username', u.username, 'avatar', u.avatar)
        ) FILTER (WHERE r.id IS NOT NULL), '[]') as reactions
       FROM games g
       JOIN game_tags gt ON g.id = gt.game_id
       LEFT JOIN reactions r ON g.id = r.game_id
       LEFT JOIN users u ON r.user_id = u.id
       WHERE g.user_id = $1 AND gt.tag_id = $2
       GROUP BY g.id
       ORDER BY g.updated_at DESC, g.added_at DESC`,
      [req.user.id, tagId]
    );
    
    const games = result.rows.map(game => ({
      id: game.id.toString(),
      gameId: game.game_id,
      name: game.name,
      cover: game.cover,
      board: game.board,
      rating: game.rating,
      notes: game.notes,
      hoursPlayed: game.hours_played,
      addedDate: game.added_at,
      updatedDate: game.updated_at,
      videoId: game.video_id,
      deepReviewAnswers: game.deep_review_answers,
      reactions: game.reactions
    }));
    
    res.json({ 
      tag: tagCheck.rows[0],
      games,
      total: games.length
    });
  } catch (error) {
    console.error('Ошибка получения игр по тегу:', error);
    res.status(500).json({ error: 'Ошибка получения игр' });
  } finally {
    client.release();
  }
});

// Получить все медиа с определенным тегом
app.get('/api/user/media/by-tag/:tagId', authenticateToken, validateIdParam('tagId'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { tagId } = req.params;
    
    // Проверяем, что тег принадлежит пользователю
    const tagCheck = await client.query(
      'SELECT id, name, color FROM tags WHERE id = $1 AND user_id = $2',
      [tagId, req.user.id]
    );
    if (tagCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Тег не найден' });
    }
    
    const result = await client.query(
      `SELECT m.*, 
        COALESCE(json_agg(
          json_build_object('user_id', r.user_id, 'emoji', r.emoji, 'username', u.username, 'avatar', u.avatar)
        ) FILTER (WHERE r.id IS NOT NULL), '[]') as reactions
       FROM media_items m
       JOIN media_tags mt ON m.id = mt.media_id
       LEFT JOIN media_reactions r ON m.id = r.media_id
       LEFT JOIN users u ON r.user_id = u.id
       WHERE m.user_id = $1 AND mt.tag_id = $2
       GROUP BY m.id
       ORDER BY m.updated_at DESC, m.added_at DESC`,
      [req.user.id, tagId]
    );
    
    const media = result.rows.map(item => ({
      id: item.id.toString(),
      tmdbId: item.tmdb_id,
      mediaType: item.media_type,
      title: item.title,
      poster: item.poster,
      board: item.board,
      rating: item.rating,
      review: item.review,
      seasonsWatched: item.seasons_watched,
      episodesWatched: item.episodes_watched,
      addedDate: item.added_at,
      updatedDate: item.updated_at,
      reactions: item.reactions
    }));
    
    res.json({ 
      tag: tagCheck.rows[0],
      media,
      total: media.length
    });
  } catch (error) {
    console.error('Ошибка получения медиа по тегу:', error);
    res.status(500).json({ error: 'Ошибка получения медиа' });
  } finally {
    client.release();
  }
});

app.delete('/api/games/:gameId/deep-review', authenticateToken, validateIdParam('gameId'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { gameId } = req.params;
    const result = await client.query(
      'UPDATE games SET deep_review_answers = NULL WHERE id = $1 AND user_id = $2',
      [gameId, req.user.id]
    );
     if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Игра не найдена или не принадлежит вам' });
    }
    res.json({ message: 'Отзыв удален' });
  } catch (error) {
    console.error('Ошибка удаления отзыва:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

// Удаление обычного отзыва
app.delete('/api/games/:gameId/review', authenticateToken, validateIdParam('gameId'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { gameId } = req.params;
    const result = await client.query(
      'UPDATE games SET review = NULL, is_published = false WHERE id = $1 AND user_id = $2 RETURNING *',
      [gameId, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Игра не найдена или не принадлежит вам' });
    }
    
    res.json({ message: 'Отзыв удален', game: result.rows[0] });
  } catch (error) {
    console.error('Ошибка удаления отзыва:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

// Удаление отзыва медиа
app.delete('/api/user/media/:id/review', authenticateToken, validateIdParam('id'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const result = await client.query(
      'UPDATE media_items SET review = NULL, is_published = false WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Медиа не найдено или не принадлежит вам' });
    }
    
    res.json({ message: 'Отзыв удален', media: result.rows[0] });
  } catch (error) {
    console.error('Ошибка удаления отзыва медиа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

app.post('/api/games/:gameId/reactions', authenticateToken, validateIdParam('gameId'), validateReaction, async (req, res) => {
  const client = await pool.connect();
  try {
    const { gameId } = req.params;
    const { emoji } = req.body;
    await client.query(
      'INSERT INTO reactions (game_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT (game_id, user_id) DO UPDATE SET emoji = $3',
      [gameId, req.user.id, emoji]
    );
    res.json({ message: 'Реакция добавлена' });
  } catch (error) {
    console.error('Ошибка реакции:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

// === TMDB PROXY AND MEDIA ENDPOINTS ===
app.get('/api/media/search', searchLimiter, authenticateToken, async (req, res) => {
  try {
    const { q, type } = req.query; // type: 'movie' | 'tv'
    if (!TMDB_API_KEY) return res.status(500).json({ error: 'TMDB_API_KEY not configured' });
    if (!q || q.length < 2) return res.status(400).json({ error: 'Минимум 2 символа' });
    const endpoint = type === 'tv' ? 'search/tv' : 'search/movie';
    const url = `https://api.themoviedb.org/3/${endpoint}`;
    const response = await axios.get(url, {
      params: { api_key: TMDB_API_KEY, query: q, language: 'ru-RU', include_adult: false }
    });
    const items = response.data.results.slice(0, 20).map(it => ({
      tmdbId: it.id,
      mediaType: type === 'tv' ? 'tv' : 'movie',
      title: it.title || it.name,
      poster: it.poster_path ? `https://image.tmdb.org/t/p/w342${it.poster_path}` : null,
      overview: it.overview || '',
      year: (it.release_date || it.first_air_date || '').slice(0, 4)
    }));
    res.json({ items });
  } catch (error) {
    console.error('TMDB search error:', error.message);
    res.status(500).json({ error: 'Ошибка поиска' });
  }
});

// === ПОИСК ПО СОБСТВЕННЫМ МЕДИА ===
app.get('/api/user/media/search', searchLimiter, authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { q, mediaType, board, minRating, maxRating, offset = 0 } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Минимум 2 символа для поиска' });
    }

    // Построение WHERE условий
    let whereConditions = ['m.user_id = $1'];
    let queryParams = [req.user.id];
    let paramCount = 1;

    // Поиск по названию и отзыву
    paramCount++;
    whereConditions.push(`(m.title ILIKE $${paramCount} OR m.review ILIKE $${paramCount})`);
    queryParams.push(`%${q}%`);

    // Фильтр по типу медиа
    if (mediaType && ['movie', 'tv'].includes(mediaType)) {
      paramCount++;
      whereConditions.push(`m.media_type = $${paramCount}`);
      queryParams.push(mediaType);
    }

    // Фильтр по доске
    if (board && ['wishlist', 'watched'].includes(board)) {
      paramCount++;
      whereConditions.push(`m.board = $${paramCount}`);
      queryParams.push(board);
    }

    // Фильтр по рейтингу
    if (minRating && !isNaN(minRating)) {
      paramCount++;
      whereConditions.push(`m.rating >= $${paramCount}`);
      queryParams.push(parseInt(minRating));
    }

    if (maxRating && !isNaN(maxRating)) {
      paramCount++;
      whereConditions.push(`m.rating <= $${paramCount}`);
      queryParams.push(parseInt(maxRating));
    }

    // Валидация offset
    const offsetValue = parseInt(offset) || 0;
    if (offsetValue < 0) {
      return res.status(400).json({ error: 'Offset не может быть отрицательным' });
    }

    // SQL запрос с сортировкой по релевантности
    const query = `
      SELECT m.*, 
        COALESCE(json_agg(
          json_build_object('user_id', r.user_id, 'emoji', r.emoji, 'username', u.username, 'avatar', u.avatar)
        ) FILTER (WHERE r.id IS NOT NULL), '[]') as reactions,
        CASE 
          WHEN m.title ILIKE $${paramCount + 1} THEN 3
          WHEN m.title ILIKE $${paramCount + 2} THEN 2
          WHEN m.review ILIKE $${paramCount + 1} THEN 1
          ELSE 0
        END as relevance_score
      FROM media_items m
      LEFT JOIN media_reactions r ON m.id = r.media_id
      LEFT JOIN users u ON r.user_id = u.id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY m.id
      ORDER BY relevance_score DESC, m.updated_at DESC, m.added_at DESC
      LIMIT 20 OFFSET $${paramCount + 3}
    `;

    // Добавляем параметры для точного совпадения и offset
    queryParams.push(q); // Точное совпадение названия
    queryParams.push(`${q}%`); // Начинается с поискового запроса
    queryParams.push(offsetValue); // Offset для пагинации

    const result = await client.query(query, queryParams);
    
    const media = result.rows.map(item => ({
      id: item.id.toString(),
      tmdbId: item.tmdb_id,
      mediaType: item.media_type,
      title: item.title,
      poster: item.poster,
      board: item.board,
      rating: item.rating,
      review: item.review,
      seasonsWatched: item.seasons_watched,
      episodesWatched: item.episodes_watched,
      addedDate: item.added_at,
      updatedDate: item.updated_at,
      reactions: item.reactions,
      relevanceScore: item.relevance_score
    }));

    // Получаем общее количество результатов для пагинации
    const countQuery = `
      SELECT COUNT(*) as total
      FROM media_items m
      WHERE ${whereConditions.join(' AND ')}
    `;
    const countResult = await client.query(countQuery, queryParams.slice(0, -3)); // Убираем параметры для точного совпадения и offset
    const total = parseInt(countResult.rows[0].total);

    res.json({ 
      media,
      total,
      offset: offsetValue,
      hasMore: offsetValue + media.length < total,
      query: q,
      filters: { mediaType, board, minRating, maxRating }
    });

  } catch (error) {
    console.error('Ошибка поиска по медиа:', error);
    res.status(500).json({ error: 'Ошибка поиска по медиа' });
  } finally {
    client.release();
  }
});

app.post('/api/user/media', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { item, board } = req.body; // item: { tmdbId, mediaType, title, poster }
    if (!item || !item.tmdbId || !item.mediaType || !item.title) {
      return res.status(400).json({ error: 'Неполные данные медиа' });
    }
    const safeBoard = board === 'watched' ? 'watched' : 'wishlist';
    const result = await client.query(
      `INSERT INTO media_items (user_id, tmdb_id, media_type, title, poster, board)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, item.tmdbId, item.mediaType, item.title, item.poster || null, safeBoard]
    );
    await logActivity(req.user.id, 'add_media', { title: item.title, mediaType: item.mediaType, board: safeBoard });
    res.status(201).json({ message: 'Добавлено', media: result.rows[0] });
  } catch (error) {
    console.error('Ошибка добавления медиа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

app.get('/api/user/media/boards', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { tags } = req.query;
    
    // Построение WHERE условий
    let whereConditions = ['m.user_id = $1'];
    let queryParams = [req.user.id];
    let paramCount = 1;

    // Фильтр по тегам
    if (tags) {
      const tagIds = tags.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (tagIds.length > 0) {
        paramCount++;
        whereConditions.push(`m.id IN (
          SELECT mt.media_id FROM media_tags mt 
          WHERE mt.tag_id = ANY($${paramCount})
        )`);
        queryParams.push(tagIds);
      }
    }

    const result = await client.query(
      `SELECT m.*, 
        COALESCE(json_agg(json_build_object('user_id', r.user_id, 'emoji', r.emoji, 'username', u.username, 'avatar', u.avatar))
          FILTER (WHERE r.id IS NOT NULL), '[]') as reactions,
        COALESCE(json_agg(
          json_build_object('id', t.id, 'name', t.name, 'color', t.color)
        ) FILTER (WHERE t.id IS NOT NULL), '[]') as tags
       FROM media_items m
       LEFT JOIN media_reactions r ON r.media_id = m.id
       LEFT JOIN users u ON u.id = r.user_id
       LEFT JOIN media_tags mt ON m.id = mt.media_id
       LEFT JOIN tags t ON mt.tag_id = t.id
       WHERE ${whereConditions.join(' AND ')}
       GROUP BY m.id
       ORDER BY m.updated_at DESC, m.added_at DESC`,
      queryParams
    );
    
    const boards = {
      movies: { wishlist: [], watched: [] },
      tv: { wishlist: [], watched: [] }
    };
    result.rows.forEach(row => {
      const card = {
        id: row.id.toString(), tmdbId: row.tmdb_id, mediaType: row.media_type,
        title: row.title, poster: row.poster, rating: row.rating, review: row.review,
        is_published: row.is_published, seasonsWatched: row.seasons_watched, episodesWatched: row.episodes_watched,
        addedDate: row.added_at, reactions: row.reactions, tags: row.tags
      };
      const scope = row.media_type === 'tv' ? boards.tv : boards.movies;
      if (scope[row.board]) scope[row.board].push(card);
    });
    res.json({ boards });
  } catch (error) {
    console.error('Ошибка загрузки медиа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

app.put('/api/user/media/:id', authenticateToken, validateIdParam('id'), sanitizeInput, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { board, rating, review, seasonsWatched, episodesWatched, is_published } = req.body;
    let updateFields = [], values = [], n = 1;
    if (board) { updateFields.push(`board = $${n++}`); values.push(board === 'watched' ? 'watched' : 'wishlist'); }
    if (rating !== undefined) { updateFields.push(`rating = $${n++}`); values.push(rating); }
    if (review !== undefined) { updateFields.push(`review = $${n++}`); values.push(review); }
    if (is_published !== undefined) { updateFields.push(`is_published = $${n++}`); values.push(is_published); }
    if (seasonsWatched !== undefined) { updateFields.push(`seasons_watched = $${n++}`); values.push(seasonsWatched); }
    if (episodesWatched !== undefined) { updateFields.push(`episodes_watched = $${n++}`); values.push(episodesWatched); }
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id, req.user.id);
    const result = await client.query(
      `UPDATE media_items SET ${updateFields.join(', ')} WHERE id = $${n} AND user_id = $${n + 1} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Не найдено' });
    const row = result.rows[0];
    if (board) {
      await logActivity(req.user.id, row.board === 'watched' ? 'complete_media' : 'move_media', {
        title: row.title, mediaType: row.media_type, toBoard: board
      });
    }
    res.json({ message: 'Обновлено', media: row });
  } catch (error) {
    console.error('Ошибка обновления медиа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

app.delete('/api/user/media/:id', authenticateToken, validateIdParam('id'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const existed = await client.query('SELECT title FROM media_items WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    await client.query('DELETE FROM media_items WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (existed.rows[0]) await logActivity(req.user.id, 'remove_media', { title: existed.rows[0].title });
    res.json({ message: 'Удалено' });
  } catch (error) {
    console.error('Ошибка удаления медиа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

app.post('/api/media/:id/reactions', authenticateToken, validateIdParam('id'), validateReaction, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params; // media id
    const { emoji } = req.body;
    await client.query(
      `INSERT INTO media_reactions (media_id, user_id, emoji)
       VALUES ($1, $2, $3)
       ON CONFLICT (media_id, user_id) DO UPDATE SET emoji = $3`,
      [id, req.user.id, emoji]
    );
    res.json({ message: 'Реакция добавлена' });
  } catch (error) {
    console.error('Ошибка реакции медиа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

app.get('/api/users', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { q } = req.query;
    let query, params;
    if (q) {
      query = 'SELECT id, username, avatar, bio FROM users WHERE username ILIKE $1 AND id != $2 LIMIT 50';
      params = [`%${q}%`, req.user.id];
    } else {
      query = 'SELECT id, username, avatar, bio FROM users WHERE id != $1 ORDER BY created_at DESC LIMIT 100';
      params = [req.user.id];
    }
    const result = await client.query(query, params);
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

// Получить данные конкретного пользователя
app.get('/api/users/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const result = await client.query(
      'SELECT id, username, nickname, avatar, bio FROM users WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

app.post('/api/friends/request', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { friendId } = req.body;
        if (req.user.id == friendId) return res.status(400).json({ error: 'Нельзя добавить себя в друзья' });
        
        // Проверяем настройки приватности получателя
        const userResult = await client.query(
            'SELECT allow_friend_requests, username FROM users WHERE id = $1',
            [friendId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        const { allow_friend_requests, username } = userResult.rows[0];
        
        if (!allow_friend_requests) {
            return res.status(403).json({ 
                error: `Пользователь ${username} не принимает заявки в друзья` 
            });
        }
        
        await client.query(
            "INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, 'pending') ON CONFLICT (user_id, friend_id) DO NOTHING",
            [req.user.id, friendId]
        );
        
        // Создаем уведомление для получателя запроса
        await createNotification(
            friendId, 
            req.user.id, 
            'friend_request', 
            `${req.user.username} отправил вам запрос в друзья`
        );
        
        res.json({ message: 'Запрос в друзья отправлен' });
    } catch (error) {
        console.error('Ошибка отправки запроса:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

app.post('/api/friends/accept', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { friendId } = req.body;
        await client.query("UPDATE friendships SET status = 'accepted' WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'", [friendId, req.user.id]);
        await client.query("INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, 'accepted') ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'", [req.user.id, friendId]);
        
        // Создаем уведомление для отправителя запроса
        await createNotification(
            friendId, 
            req.user.id, 
            'friend_accepted', 
            `${req.user.username} принял ваш запрос в друзья`
        );
        
        res.json({ message: 'Друг добавлен' });
    } catch (error) {
        console.error('Ошибка принятия запроса:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

app.post('/api/friends/reject', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { friendId } = req.body;
        await client.query('DELETE FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)', [req.user.id, friendId]);
        res.json({ message: 'Запрос отклонен' });
    } catch (error) {
        console.error('Ошибка отклонения запроса:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

app.put('/api/friends/:friendId/nickname', authenticateToken, validateIdParam('friendId'), sanitizeInput, async (req, res) => {
  const client = await pool.connect();
  try {
    const { friendId } = req.params;
    const { nickname } = req.body;
    await client.query('UPDATE friendships SET nickname = $1 WHERE user_id = $2 AND friend_id = $3', [nickname, req.user.id, friendId]);
    res.json({ message: 'Метка обновлена' });
  } catch (error) {
    console.error('Ошибка обновления метки:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

app.delete('/api/friends/:friendId', authenticateToken, validateIdParam('friendId'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { friendId } = req.params;
    await client.query('DELETE FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)', [req.user.id, friendId]);
    res.json({ message: 'Друг удален' });
  } catch (error) {
    console.error('Ошибка удаления друга:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

app.get('/api/friends', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const friendsResult = await client.query(`SELECT u.id, u.username, u.avatar, u.bio, f.nickname FROM friendships f JOIN users u ON f.friend_id = u.id WHERE f.user_id = $1 AND f.status = 'accepted'`, [req.user.id]);
        const requestsResult = await client.query(`SELECT u.id, u.username, u.avatar, u.bio FROM friendships f JOIN users u ON f.user_id = u.id WHERE f.friend_id = $1 AND f.status = 'pending'`, [req.user.id]);
        const sentRequestsResult = await client.query(`SELECT f.friend_id as id FROM friendships f WHERE f.user_id = $1 AND f.status = 'pending'`, [req.user.id]);
        res.json({ friends: friendsResult.rows, requests: requestsResult.rows, sentRequests: sentRequestsResult.rows.map(r => r.id) });
    } catch (error) {
        console.error('Ошибка получения друзей и запросов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

app.get('/api/user/:userId/boards', authenticateToken, validateIdParam('userId'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { userId } = req.params;
    
    // Проверка приватности профиля
    const userResult = await client.query(
      'SELECT is_profile_public FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    const isProfilePublic = userResult.rows[0].is_profile_public;
    
    // Если профиль приватный, проверяем дружбу
    if (!isProfilePublic) {
      if (parseInt(userId) !== req.user.id) {
        const friendshipResult = await client.query(
          'SELECT status FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
          [req.user.id, userId]
        );
        
        if (friendshipResult.rows.length === 0 || friendshipResult.rows[0].status !== 'accepted') {
          return res.status(403).json({ 
            error: 'Профиль пользователя приватный. Доступ разрешен только друзьям.' 
          });
        }
      }
    }
    
    const result = await client.query(
      `SELECT g.*, u.username, u.avatar, COALESCE(json_agg(json_build_object('user_id', r.user_id, 'emoji', r.emoji, 'username', ru.username, 'avatar', ru.avatar)) FILTER (WHERE r.id IS NOT NULL), '[]') as reactions
       FROM games g JOIN users u ON g.user_id = u.id LEFT JOIN reactions r ON g.id = r.game_id LEFT JOIN users ru ON r.user_id = ru.id
       WHERE g.user_id = $1 GROUP BY g.id, u.username, u.avatar ORDER BY g.updated_at DESC, g.added_at DESC`,
      [userId]
    );
    const boards = { backlog: [], playing: [], completed: [], dropped: [] };
    result.rows.forEach(game => {
      const card = {
        id: game.id.toString(), gameId: game.game_id, name: game.name, cover: game.cover, rating: game.rating, notes: game.notes,
        hoursPlayed: game.hours_played, addedDate: game.added_at, reactions: game.reactions, videoId: game.video_id,
        deep_review_answers: game.deep_review_answers, review: game.review, is_published: game.is_published,
        owner: { username: game.username, avatar: game.avatar }
      };
      if (boards[game.board]) boards[game.board].push(card);
    });
    const userInfo = await client.query('SELECT id, username, avatar, bio, theme FROM users WHERE id = $1', [userId]);
    let friendship = 'none', nickname = null;
    if (req.user.id != userId) {
        const friendshipStatusQuery = await client.query(
          `SELECT status, user_id, (SELECT nickname FROM friendships WHERE user_id = $1 AND friend_id = $2) as nickname 
           FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
          [req.user.id, userId]
        );
        if (friendshipStatusQuery.rows.length > 0) {
            const f_status = friendshipStatusQuery.rows[0];
            nickname = f_status.nickname;
            if (f_status.status === 'accepted') friendship = 'friends';
            else if (f_status.status === 'pending') friendship = (f_status.user_id == req.user.id) ? 'request_sent' : 'request_received';
        }
    }
    res.json({ boards, user: userInfo.rows[0], friendship, nickname });
  } catch (error) {
    console.error('Ошибка загрузки досок пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

// MEDIA: view another user's boards (movies/tv)
app.get('/api/user/:userId/media/boards', authenticateToken, validateIdParam('userId'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { userId } = req.params;
    
    // Проверка приватности профиля
    const userResult = await client.query(
      'SELECT is_profile_public FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    const isProfilePublic = userResult.rows[0].is_profile_public;
    
    // Если профиль приватный, проверяем дружбу
    if (!isProfilePublic) {
      if (parseInt(userId) !== req.user.id) {
        const friendshipResult = await client.query(
          'SELECT status FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
          [req.user.id, userId]
        );
        
        if (friendshipResult.rows.length === 0 || friendshipResult.rows[0].status !== 'accepted') {
          return res.status(403).json({ 
            error: 'Профиль пользователя приватный. Доступ разрешен только друзьям.' 
          });
        }
      }
    }
    
    const result = await client.query(
      `SELECT m.*, u.username, u.avatar,
              COALESCE(json_agg(json_build_object('user_id', r.user_id, 'emoji', r.emoji, 'username', ru.username, 'avatar', ru.avatar))
                FILTER (WHERE r.id IS NOT NULL), '[]') as reactions
       FROM media_items m
       JOIN users u ON m.user_id = u.id
       LEFT JOIN media_reactions r ON r.media_id = m.id
       LEFT JOIN users ru ON ru.id = r.user_id
       WHERE m.user_id = $1
       GROUP BY m.id, u.username, u.avatar
       ORDER BY m.updated_at DESC, m.added_at DESC`,
      [userId]
    );
    const boards = { movies: { wishlist: [], watched: [] }, tv: { wishlist: [], watched: [] } };
    result.rows.forEach(row => {
      const card = {
        id: row.id.toString(), tmdbId: row.tmdb_id, mediaType: row.media_type,
        title: row.title, poster: row.poster, rating: row.rating, review: row.review,
        is_published: row.is_published, seasonsWatched: row.seasons_watched, episodesWatched: row.episodes_watched,
        addedDate: row.added_at, reactions: row.reactions,
        owner: { username: row.username, avatar: row.avatar }
      };
      const scope = row.media_type === 'tv' ? boards.tv : boards.movies;
      if (scope[row.board]) scope[row.board].push(card);
    });
    const userInfo = await client.query('SELECT id, username, avatar, bio, theme FROM users WHERE id = $1', [userId]);
    let friendship = 'none';
    if (req.user.id != userId) {
      const friendshipStatusQuery = await client.query(
        `SELECT status, user_id
         FROM friendships
         WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
        [req.user.id, userId]
      );
      if (friendshipStatusQuery.rows.length > 0) {
        const f = friendshipStatusQuery.rows[0];
        if (f.status === 'accepted') friendship = 'friends';
        else if (f.status === 'pending') friendship = (f.user_id == req.user.id) ? 'request_sent' : 'request_received';
      }
    }
    res.json({ boards, user: userInfo.rows[0], friendship });
  } catch (error) {
    console.error('Ошибка загрузки медиа досок пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

app.put('/api/user/boards/reorder', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
      const { boardId, orderedIds } = req.body;
      if (!boardId || !Array.isArray(orderedIds)) return res.status(400).json({ error: 'Invalid data' });
      await client.query('BEGIN');
      for (let i = 0; i < orderedIds.length; i++) {
          await client.query(
              `UPDATE games SET updated_at = (NOW() - interval '1 second' * $1) WHERE id = $2 AND user_id = $3 AND board = $4`,
              [orderedIds.length - i, orderedIds[i], req.user.id, boardId]
          );
      }
      await client.query('COMMIT');
      res.json({ message: 'Board reordered successfully' });
  } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error reordering board:', error);
      res.status(500).json({ error: 'Server error' });
  } finally {
      client.release();
  }
});


app.post('/api/game/score', authenticateToken, async (req, res) => {
    const { score } = req.body;
    if (typeof score !== 'number' || score < 0) return res.status(400).json({ error: 'Неверный формат очков' });
    const client = await pool.connect();
    try {
        await client.query(`
            INSERT INTO game_scores (user_id, score, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET score = GREATEST(game_scores.score, EXCLUDED.score), updated_at = CURRENT_TIMESTAMP;`,
            [req.user.id, score]
        );
        res.status(200).json({ message: 'Рекорд успешно обновлен' });
    } catch (error) {
        console.error('Ошибка сохранения рекорда:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

app.get('/api/game/highscores', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const globalRes = await client.query('SELECT u.username, gs.score FROM game_scores gs JOIN users u ON u.id = gs.user_id ORDER BY gs.score DESC LIMIT 1');
        const friendRes = await client.query(`
            SELECT u.username, gs.score FROM game_scores gs JOIN users u ON u.id = gs.user_id
            WHERE gs.user_id IN (SELECT friend_id FROM friendships WHERE user_id = $1 AND status = 'accepted')
            ORDER BY gs.score DESC LIMIT 1`, [req.user.id]);
        res.json({
            global: globalRes.rows[0] || { username: 'Никто', score: 0 },
            friend: friendRes.rows[0] || { username: 'Никто', score: 0 }
        });
    } catch (error) {
        console.error('Ошибка получения рекордов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

// API эндпоинты для уведомлений
app.get('/api/notifications', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT n.*, u.username as from_username, u.avatar as from_user_avatar
       FROM notifications n
       LEFT JOIN users u ON n.from_user_id = u.id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json({ notifications: result.rows });
  } catch (error) {
    console.error('Ошибка загрузки уведомлений:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

app.get('/api/notifications/unread-count', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Ошибка загрузки счетчика уведомлений:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const result = await client.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Уведомление не найдено' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка отметки уведомления:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

app.put('/api/notifications/mark-all-read', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );
    
    res.json({ success: true, updated: result.rowCount });
  } catch (error) {
    console.error('Ошибка отметки всех уведомлений:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

// === BOOKS API ENDPOINTS ===

// Прокси для OpenLibrary API
app.get('/api/books/search', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const response = await axios.get(`https://openlibrary.org/search.json`, {
      params: { q, limit },
      timeout: 10000
    });

    // Нормализуем данные книг
    const normalizedBooks = response.data.docs.map(book => ({
      id: book.key || `book_${Date.now()}_${Math.random()}`,
      title: book.title || 'Без названия',
      author: book.author_name?.[0] || book.author_name || 'Неизвестный автор',
      year: book.first_publish_year || book.publish_year?.[0] || null,
      isbn: book.isbn?.[0] || null,
      coverUrl: getBookCoverUrl(book),
      description: book.first_sentence?.[0] || null,
      pages: book.number_of_pages_median || null,
      subjects: book.subject || [],
      language: book.language?.[0] || 'ru'
    }));

    res.json({ books: normalizedBooks });
  } catch (error) {
    console.error('OpenLibrary search error:', error);
    res.status(500).json({ error: 'Failed to search books' });
  }
});

// Функция для получения URL обложки книги
function getBookCoverUrl(book) {
  if (!book) return null;
  
  // Пробуем разные идентификаторы для обложки
  const identifiers = [
    book.isbn?.[0],
    book.isbn?.[1], 
    book.isbn?.[2],
    book.oclc?.[0],
    book.lccn?.[0],
    book.olid
  ].filter(Boolean);

  console.log('Generating cover URL for book:', book.title, 'identifiers:', identifiers);

  for (const id of identifiers) {
    if (id.startsWith('978') || id.startsWith('979')) {
      // ISBN
      const url = `https://covers.openlibrary.org/b/isbn/${id}-M.jpg`;
      console.log('Using ISBN cover URL:', url);
      return url;
    } else if (id.startsWith('OL')) {
      // OLID
      const url = `https://covers.openlibrary.org/b/olid/${id}-M.jpg`;
      console.log('Using OLID cover URL:', url);
      return url;
    } else if (id.startsWith('OCLC')) {
      // OCLC
      const url = `https://covers.openlibrary.org/b/oclc/${id}-M.jpg`;
      console.log('Using OCLC cover URL:', url);
      return url;
    } else if (id.startsWith('LCCN')) {
      // LCCN
      const url = `https://covers.openlibrary.org/b/lccn/${id}-M.jpg`;
      console.log('Using LCCN cover URL:', url);
      return url;
    }
  }

  // Если ничего не найдено, пробуем cover_i
  if (book.cover_i) {
    const url = `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`;
    console.log('Using cover_i URL:', url);
    return url;
  }

  // Если ничего не найдено, возвращаем дефолтную обложку
  const defaultUrl = 'https://placehold.co/96x128/1f2937/ffffff?text=📚';
  console.log('Using placeholder cover URL:', defaultUrl);
  return defaultUrl;
}

// Поиск по своим книгам
app.get('/api/books/search-my', authenticateToken, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    const { q } = req.query;
    if (!q) {
      return res.json({ books: [] });
    }

    const result = await client.query(`
      SELECT b.*, 
             b.cover_url as "coverUrl",
             COALESCE(
               (SELECT AVG(rating) FROM book_ratings WHERE book_id = b.id), 
               0
             ) as avg_rating,
             COALESCE(
               (SELECT rating FROM book_ratings WHERE book_id = b.id AND user_id = $1), 
               0
             ) as user_rating
      FROM books b 
      WHERE b.user_id = $1 
      AND (LOWER(b.title) LIKE LOWER($2) OR LOWER(b.author) LIKE LOWER($2))
      ORDER BY b.created_at DESC
    `, [req.user.id, `%${q}%`]);
    
    res.json({ books: result.rows });
  } catch (error) {
    console.error('Ошибка поиска по своим книгам:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    if (client) client.release();
  }
});

// Получить все книги пользователя
app.get('/api/books', authenticateToken, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    const result = await client.query(`
      SELECT b.*, 
             b.cover_url as "coverUrl",
             COALESCE(
               (SELECT AVG(rating) FROM book_ratings WHERE book_id = b.id), 
               0
             ) as avg_rating,
             COALESCE(
               (SELECT rating FROM book_ratings WHERE book_id = b.id AND user_id = $1), 
               0
             ) as user_rating
      FROM books b 
      WHERE b.user_id = $1 
      ORDER BY b.created_at DESC
    `, [req.user.id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения книг:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    if (client) client.release();
  }
});

// Получить книги конкретного пользователя
app.get('/api/user/:userId/books', authenticateToken, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    const { userId } = req.params;
    
    const result = await client.query(`
      SELECT b.*, 
             b.cover_url as "coverUrl",
             COALESCE(
               (SELECT AVG(rating) FROM book_ratings WHERE book_id = b.id), 
               0
             ) as avg_rating,
             COALESCE(
               (SELECT rating FROM book_ratings WHERE book_id = b.id AND user_id = $1), 
               0
             ) as user_rating
      FROM books b 
      WHERE b.user_id = $2 
      ORDER BY b.created_at DESC
    `, [req.user.id, userId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения книг пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    if (client) client.release();
  }
});

// Добавить новую книгу
app.post('/api/books', authenticateToken, [
  body('title').notEmpty().withMessage('Название обязательно'),
  body('author').notEmpty().withMessage('Автор обязателен'),
  body('status').isIn(['want_to_read', 'reading', 'read', 'dropped']).withMessage('Неверный статус')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  let client;
  try {
    client = await pool.connect();
    
    const { title, author, year, isbn, coverUrl, description, pages, subjects, language, status } = req.body;
    
    const result = await client.query(`
      INSERT INTO books (
        user_id, title, author, year, isbn, cover_url, description, 
        pages, subjects, language, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *, cover_url as "coverUrl"
    `, [
      req.user.id, title, author, year, isbn, coverUrl, description,
      pages, JSON.stringify(subjects || []), language || 'ru', status
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка добавления книги:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    if (client) client.release();
  }
});

// Обновить книгу
app.patch('/api/books/:id', authenticateToken, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    const { id } = req.params;
    const updates = req.body;
    
    // Проверяем, что книга принадлежит пользователю
    const bookCheck = await client.query(
      'SELECT id FROM books WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    if (bookCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Книга не найдена' });
    }
    
    // Строим динамический запрос
    const updateFields = [];
    const values = [];
    let paramCount = 1;
    
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        if (key === 'subjects') {
          updateFields.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(updates[key]));
        } else {
          updateFields.push(`${key} = $${paramCount}`);
          values.push(updates[key]);
        }
        paramCount++;
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Нет полей для обновления' });
    }
    
    updateFields.push(`updated_at = NOW()`);
    values.push(id, req.user.id);
    
    const result = await client.query(`
      UPDATE books 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING *
    `, values);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка обновления книги:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    if (client) client.release();
  }
});

// Удалить книгу
app.delete('/api/books/:id', authenticateToken, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    const { id } = req.params;
    
    const result = await client.query(
      'DELETE FROM books WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Книга не найдена' });
    }
    
    res.json({ success: true, message: 'Книга удалена' });
  } catch (error) {
    console.error('Ошибка удаления книги:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    if (client) client.release();
  }
});

// Удалить отзыв книги
app.delete('/api/books/:id/review', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const result = await client.query(
      'UPDATE books SET review = NULL, is_published = false WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Книга не найдена или не принадлежит вам' });
    }
    
    res.json({ message: 'Отзыв удален', book: result.rows[0] });
  } catch (error) {
    console.error('Ошибка удаления отзыва книги:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

// Оценить книгу
app.post('/api/books/:id/rate', authenticateToken, [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Рейтинг должен быть от 1 до 5')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  let client;
  try {
    client = await pool.connect();
    
    const { id } = req.params;
    const { rating } = req.body;
    
    // Проверяем, что книга принадлежит пользователю
    const bookCheck = await client.query(
      'SELECT id FROM books WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    if (bookCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Книга не найдена' });
    }
    
    // Добавляем или обновляем рейтинг
    await client.query(`
      INSERT INTO book_ratings (book_id, user_id, rating, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (book_id, user_id)
      DO UPDATE SET rating = $3, updated_at = NOW()
    `, [id, req.user.id, rating]);
    
    // Получаем обновленную книгу с рейтингом
    const updatedBook = await client.query(`
      SELECT b.*, 
             b.cover_url as "coverUrl",
             COALESCE(
               (SELECT AVG(rating) FROM book_ratings WHERE book_id = b.id), 
               0
             ) as avg_rating,
             COALESCE(
               (SELECT rating FROM book_ratings WHERE book_id = b.id AND user_id = $1), 
               0
             ) as user_rating
      FROM books b 
      WHERE b.id = $2 AND b.user_id = $1
    `, [req.user.id, id]);
    
    res.json(updatedBook.rows[0]);
  } catch (error) {
    console.error('Ошибка оценки книги:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    if (client) client.release();
  }
});

// Добавить реакцию к книге
app.post('/api/books/:id/react', authenticateToken, [
  body('emoji').notEmpty().withMessage('Эмодзи обязательно')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  let client;
  try {
    client = await pool.connect();
    
    const { id } = req.params;
    const { emoji } = req.body;
    
    // Проверяем, что книга принадлежит пользователю
    const bookCheck = await client.query(
      'SELECT id FROM books WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    if (bookCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Книга не найдена' });
    }
    
    // Добавляем реакцию
    await client.query(`
      INSERT INTO book_reactions (book_id, user_id, emoji, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (book_id, user_id)
      DO UPDATE SET emoji = $3, updated_at = NOW()
    `, [id, req.user.id, emoji]);
    
    res.json({ success: true, message: 'Реакция добавлена' });
  } catch (error) {
    console.error('Ошибка добавления реакции:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    if (client) client.release();
  }
});

// Получить активность друзей
app.get('/api/friends/activity', authenticateToken, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    const { type } = req.query;
    
    if (type === 'book') {
      // Получаем активность друзей по книгам
      const result = await client.query(`
        SELECT 
          a.id,
          a.action,
          a.created_at,
          u.username,
          u.avatar,
          b.title as book_title,
          b.cover_url as book_cover
        FROM book_activities a
        JOIN users u ON a.user_id = u.id
        JOIN books b ON a.book_id = b.id
        WHERE a.user_id IN (
          SELECT friend_id FROM friendships 
          WHERE user_id = $1 AND status = 'accepted'
          UNION
          SELECT user_id FROM friendships 
          WHERE friend_id = $1 AND status = 'accepted'
        )
        ORDER BY a.created_at DESC
        LIMIT 12
      `, [req.user.id]);
      
      const activities = result.rows.map(row => ({
        id: row.id,
        action: row.action,
        created_at: row.created_at,
        user: {
          username: row.username,
          avatar: row.avatar
        },
        book: {
          title: row.book_title,
          cover_url: row.book_cover
        }
      }));
      
      res.json({ activities });
    } else {
      // Получаем общую активность друзей (по умолчанию)
      const result = await client.query(`
        SELECT a.id, a.action_type, a.details, a.created_at, u.username, u.id as user_id
        FROM activities a 
        JOIN users u ON u.id = a.user_id
        JOIN friendships f ON f.friend_id = a.user_id
        WHERE f.user_id = $1 AND f.status = 'accepted' AND u.show_activity = true
        ORDER BY a.created_at DESC LIMIT 12
      `, [req.user.id]);
      
      res.json({ activities: result.rows });
    }
  } catch (error) {
    console.error('Ошибка получения активности друзей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    if (client) client.release();
  }
});

// Создать таблицы для книг (миграция)
app.post('/api/books/migrate', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    // Создаем таблицу книг
    await client.query(`
      CREATE TABLE IF NOT EXISTS books (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        author VARCHAR(300) NOT NULL,
        year INTEGER,
        isbn VARCHAR(20),
        cover_url TEXT,
        description TEXT,
        pages INTEGER,
        subjects JSONB DEFAULT '[]'::jsonb,
        language VARCHAR(10) DEFAULT 'ru',
        status VARCHAR(20) NOT NULL DEFAULT 'want_to_read',
        review TEXT,
        is_published BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Создаем таблицу рейтингов книг
    await client.query(`
      CREATE TABLE IF NOT EXISTS book_ratings (
        id SERIAL PRIMARY KEY,
        book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(book_id, user_id)
      )
    `);
    
    // Создаем таблицу реакций на книги
    await client.query(`
      CREATE TABLE IF NOT EXISTS book_reactions (
        id SERIAL PRIMARY KEY,
        book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(book_id, user_id)
      )
    `);
    
        // Создаем таблицу активности по книгам
        await client.query(`
          CREATE TABLE IF NOT EXISTS book_activities (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
            action VARCHAR(20) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        
        // Создаем индексы для производительности
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id);
          CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
          CREATE INDEX IF NOT EXISTS idx_book_ratings_book_id ON book_ratings(book_id);
          CREATE INDEX IF NOT EXISTS idx_book_reactions_book_id ON book_reactions(book_id);
          CREATE INDEX IF NOT EXISTS idx_book_activities_user_id ON book_activities(user_id);
          CREATE INDEX IF NOT EXISTS idx_book_activities_created_at ON book_activities(created_at);
        `);
    
    client.release();
    res.json({ 
      status: 'OK', 
      message: 'Таблицы для книг созданы успешно' 
    });
  } catch (error) {
    console.error('Ошибка миграции книг:', error);
    res.status(500).json({ 
      status: 'Error', 
      error: error.message 
    });
  } finally {
    if (client) client.release();
  }
});

// === COMICS API ENDPOINTS ===

// Rate limiting для Comics Vine API (1 запрос в секунду)
const comicsVineRateLimiter = rateLimit({
  windowMs: 1000, // 1 секунда
  max: 1, // 1 запрос
  message: 'Слишком много запросов к Comics Vine API. Попробуйте через секунду.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Кэш для Comics Vine запросов
const comicsCache = new Map();
const COMICS_CACHE_TTL = 3600000; // 1 час

// Прокси для Comics Vine API с кэшированием
app.get('/api/comics/search', comicsVineRateLimiter, async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    // Проверяем кэш
    const cacheKey = `search_${q}_${limit}`;
    const cachedResult = comicsCache.get(cacheKey);
    
    if (cachedResult && (Date.now() - cachedResult.timestamp < COMICS_CACHE_TTL)) {
      console.log('Returning cached Comics Vine result for:', q);
      return res.json(cachedResult.data);
    }

    const COMICS_VINE_API_KEY = process.env.COMICS_VINE_API;
    
    if (!COMICS_VINE_API_KEY) {
      return res.status(500).json({ error: 'Comics Vine API key not configured' });
    }

    // Comics Vine API использует формат: https://comicvine.gamespot.com/api/search/
    const response = await axios.get(`https://comicvine.gamespot.com/api/search/`, {
      params: {
        api_key: COMICS_VINE_API_KEY,
        format: 'json',
        query: q,
        resources: 'volume', // Ищем серии комиксов (volumes)
        limit: limit,
        field_list: 'id,name,start_year,publisher,image,description,count_of_issues,deck'
      },
      timeout: 10000,
      headers: {
        'User-Agent': 'Omnilogue Comics Tracker'
      }
    });

    // Нормализуем данные комиксов
    const normalizedComics = (response.data.results || []).map(comic => ({
      id: `cv_${comic.id}`,
      title: comic.name || 'Без названия',
      publisher: comic.publisher?.name || 'Неизвестный издатель',
      year: comic.start_year || null,
      description: comic.deck || comic.description || '',
      issueCount: comic.count_of_issues || 0,
      coverUrl: comic.image?.medium_url || comic.image?.small_url || comic.image?.thumb_url || 'https://placehold.co/200x300/1f2937/ffffff?text=📚',
      apiId: comic.id
    }));

    const result = { comics: normalizedComics };
    
    // Сохраняем в кэш
    comicsCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    // Очищаем старые записи из кэша
    if (comicsCache.size > 100) {
      const firstKey = comicsCache.keys().next().value;
      comicsCache.delete(firstKey);
    }

    res.json(result);
  } catch (error) {
    console.error('ComicsVine API error:', error.message);
    if (error.response) {
      console.error('ComicsVine API response:', error.response.data);
    }
    res.status(500).json({ 
      error: 'Ошибка поиска комиксов',
      comics: [] 
    });
  }
});

// Получить все комиксы пользователя
app.get('/api/comics', authenticateToken, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    const result = await client.query(`
      SELECT 
        c.*,
        cr.rating as user_rating,
        json_agg(
          json_build_object(
            'emoji', cre.emoji,
            'user_id', cre.user_id,
            'username', u.username
          )
        ) FILTER (WHERE cre.id IS NOT NULL) as reactions
      FROM comics c
      LEFT JOIN comic_ratings cr ON c.id = cr.comic_id AND cr.user_id = $1
      LEFT JOIN comic_reactions cre ON c.id = cre.comic_id
      LEFT JOIN users u ON cre.user_id = u.id
      WHERE c.user_id = $1
      GROUP BY c.id, cr.rating
      ORDER BY c.created_at DESC
    `, [req.user.id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения комиксов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    if (client) client.release();
  }
});

// Добавить комикс
app.post('/api/comics', authenticateToken, async (req, res) => {
  let client;
  try {
    const { title, publisher, year, description, issueCount, coverUrl, status = 'want_to_read', apiId } = req.body;
    
    client = await pool.connect();
    
    const result = await client.query(`
      INSERT INTO comics (user_id, title, publisher, year, description, issue_count, cover_url, status, api_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [req.user.id, title, publisher, year, description, issueCount, coverUrl, status, apiId]);
    
    // Логируем активность
    await client.query(`
      INSERT INTO comic_activities (user_id, comic_id, action_type, details)
      VALUES ($1, $2, 'add_comic', $3)
    `, [req.user.id, result.rows[0].id, JSON.stringify({ title, status })]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка добавления комикса:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    if (client) client.release();
  }
});

// Обновить комикс
app.patch('/api/comics/:id', authenticateToken, async (req, res) => {
  let client;
  try {
    const { id } = req.params;
    const { status, review, is_published } = req.body;
    
    client = await pool.connect();
    
    // Получаем текущий статус для логирования
    const currentComic = await client.query('SELECT title, status FROM comics WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    
    if (currentComic.rows.length === 0) {
      return res.status(404).json({ error: 'Комикс не найден' });
    }
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (status) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    
    if (review !== undefined) {
      updates.push(`review = $${paramCount++}`);
      values.push(review);
    }
    
    if (is_published !== undefined) {
      updates.push(`is_published = $${paramCount++}`);
      values.push(is_published);
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id, req.user.id);
    
    const result = await client.query(`
      UPDATE comics
      SET ${updates.join(', ')}
      WHERE id = $${paramCount++} AND user_id = $${paramCount++}
      RETURNING *
    `, values);
    
    // Логируем активность при изменении статуса
    if (status && status !== currentComic.rows[0].status) {
      await client.query(`
        INSERT INTO comic_activities (user_id, comic_id, action_type, details)
        VALUES ($1, $2, 'move_comic', $3)
      `, [req.user.id, id, JSON.stringify({ title: currentComic.rows[0].title, status })]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка обновления комикса:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    if (client) client.release();
  }
});

// Удалить комикс
app.delete('/api/comics/:id', authenticateToken, async (req, res) => {
  let client;
  try {
    const { id } = req.params;
    
    client = await pool.connect();
    
    // Получаем данные комикса перед удалением для логирования
    const comic = await client.query('SELECT title FROM comics WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    
    if (comic.rows.length === 0) {
      return res.status(404).json({ error: 'Комикс не найден' });
    }
    
    await client.query('DELETE FROM comics WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    
    // Логируем активность
    await client.query(`
      INSERT INTO comic_activities (user_id, comic_id, action_type, details)
      VALUES ($1, $2, 'remove_comic', $3)
    `, [req.user.id, id, JSON.stringify({ title: comic.rows[0].title })]);
    
    res.json({ message: 'Комикс удален' });
  } catch (error) {
    console.error('Ошибка удаления комикса:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    if (client) client.release();
  }
});

// Удалить отзыв комикса
app.delete('/api/comics/:id/review', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const result = await client.query(
      'UPDATE comics SET review = NULL, is_published = false WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Комикс не найден или не принадлежит вам' });
    }
    
    res.json({ message: 'Отзыв удален', comic: result.rows[0] });
  } catch (error) {
    console.error('Ошибка удаления отзыва комикса:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

// Оценить комикс
app.post('/api/comics/:id/rate', authenticateToken, async (req, res) => {
  let client;
  try {
    const { id } = req.params;
    const { rating } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Рейтинг должен быть от 1 до 5' });
    }
    
    client = await pool.connect();
    
    // Получаем данные комикса для логирования
    const comic = await client.query('SELECT title FROM comics WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    
    if (comic.rows.length === 0) {
      return res.status(404).json({ error: 'Комикс не найден' });
    }
    
    await client.query(`
      INSERT INTO comic_ratings (comic_id, user_id, rating)
      VALUES ($1, $2, $3)
      ON CONFLICT (comic_id, user_id)
      DO UPDATE SET rating = $3, updated_at = NOW()
    `, [id, req.user.id, rating]);
    
    // Получаем обновленный комикс
    const result = await client.query(`
      SELECT 
        c.*,
        cr.rating as user_rating
      FROM comics c
      LEFT JOIN comic_ratings cr ON c.id = cr.comic_id AND cr.user_id = $2
      WHERE c.id = $1 AND c.user_id = $2
    `, [id, req.user.id]);
    
    // Логируем активность
    await client.query(`
      INSERT INTO comic_activities (user_id, comic_id, action_type, details)
      VALUES ($1, $2, 'rate_comic', $3)
    `, [req.user.id, id, JSON.stringify({ title: comic.rows[0].title, rating })]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка оценки комикса:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    if (client) client.release();
  }
});

// Добавить реакцию на комикс
app.post('/api/comics/:id/react', authenticateToken, async (req, res) => {
  let client;
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    
    client = await pool.connect();
    
    await client.query(`
      INSERT INTO comic_reactions (comic_id, user_id, emoji)
      VALUES ($1, $2, $3)
      ON CONFLICT (comic_id, user_id)
      DO UPDATE SET emoji = $3
    `, [id, req.user.id, emoji]);
    
    res.json({ message: 'Реакция добавлена' });
  } catch (error) {
    console.error('Ошибка добавления реакции:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    if (client) client.release();
  }
});

// Поиск по своим комиксам
app.get('/api/comics/search-my', authenticateToken, async (req, res) => {
  let client;
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    client = await pool.connect();
    
    const result = await client.query(`
      SELECT 
        c.*,
        cr.rating as user_rating
      FROM comics c
      LEFT JOIN comic_ratings cr ON c.id = cr.comic_id AND cr.user_id = $1
      WHERE c.user_id = $1 AND (
        LOWER(c.title) LIKE LOWER($2) OR
        LOWER(c.publisher) LIKE LOWER($2)
      )
      ORDER BY c.created_at DESC
      LIMIT 20
    `, [req.user.id, `%${q}%`]);
    
    res.json({ comics: result.rows });
  } catch (error) {
    console.error('Ошибка поиска по своим комиксам:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    if (client) client.release();
  }
});

// Получить активность друзей по комиксам
app.get('/api/friends/activity', authenticateToken, async (req, res) => {
  let client;
  try {
    const { type } = req.query;
    
    client = await pool.connect();
    
    if (type === 'comic') {
      const result = await client.query(`
        SELECT 
          ca.*,
          u.username,
          u.id as user_id
        FROM comic_activities ca
        JOIN users u ON ca.user_id = u.id
        JOIN friends f ON (f.user_id = $1 AND f.friend_id = ca.user_id) OR (f.friend_id = $1 AND f.user_id = ca.user_id)
        WHERE f.status = 'accepted' AND u.show_activity = true
        ORDER BY ca.created_at DESC LIMIT 12
      `, [req.user.id]);
      
      res.json({ activities: result.rows });
    } else {
      res.json({ activities: [] });
    }
  } catch (error) {
    console.error('Ошибка получения активности друзей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    if (client) client.release();
  }
});

// Создать таблицы для комиксов (миграция)
app.post('/api/comics/migrate', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    // Создаем таблицу комиксов
    await client.query(`
      CREATE TABLE IF NOT EXISTS comics (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        publisher VARCHAR(300) NOT NULL,
        year INTEGER,
        api_id VARCHAR(50),
        cover_url TEXT,
        description TEXT,
        issue_count INTEGER,
        review TEXT,
        is_published BOOLEAN DEFAULT false,
        status VARCHAR(20) NOT NULL DEFAULT 'want_to_read',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Создаем таблицу рейтингов комиксов
    await client.query(`
      CREATE TABLE IF NOT EXISTS comic_ratings (
        id SERIAL PRIMARY KEY,
        comic_id INTEGER NOT NULL REFERENCES comics(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(comic_id, user_id)
      )
    `);
    
    // Создаем таблицу реакций на комиксы
    await client.query(`
      CREATE TABLE IF NOT EXISTS comic_reactions (
        id SERIAL PRIMARY KEY,
        comic_id INTEGER NOT NULL REFERENCES comics(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(comic_id, user_id)
      )
    `);
    
    // Создаем таблицу активности по комиксам
    await client.query(`
      CREATE TABLE IF NOT EXISTS comic_activities (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        comic_id INTEGER REFERENCES comics(id) ON DELETE CASCADE,
        action_type VARCHAR(50) NOT NULL,
        details JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Создаем индексы
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_comics_user_id ON comics(user_id);
      CREATE INDEX IF NOT EXISTS idx_comics_status ON comics(status);
      CREATE INDEX IF NOT EXISTS idx_comic_ratings_comic_id ON comic_ratings(comic_id);
      CREATE INDEX IF NOT EXISTS idx_comic_reactions_comic_id ON comic_reactions(comic_id);
      CREATE INDEX IF NOT EXISTS idx_comic_activities_user_id ON comic_activities(user_id);
      CREATE INDEX IF NOT EXISTS idx_comic_activities_created_at ON comic_activities(created_at);
    `);
    
    client.release();
    res.json({ 
      status: 'OK', 
      message: 'Таблицы для комиксов созданы успешно' 
    });
  } catch (error) {
    console.error('Ошибка миграции комиксов:', error);
    res.status(500).json({ 
      status: 'Error', 
      error: error.message 
    });
  } finally {
    if (client) client.release();
  }
});

// Обработка неперехваченных ошибок и promise rejections
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
});

// Запуск сервера
console.log('🚀 Запуск сервера...');
console.log('📋 Порты и переменные:');
console.log('   PORT:', PORT);
console.log('   NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('   DATABASE_URL:', process.env.DATABASE_URL ? 'present' : 'missing');
console.log('   SENDGRID_API_KEY:', SENDGRID_API_KEY ? 'present' : 'missing');
console.log('   FROM_EMAIL:', FROM_EMAIL || 'not set');
console.log('   Healthcheck URL: http://0.0.0.0:' + PORT + '/api/health');

// Запускаем сервер
const server = app.listen(PORT, '0.0.0.0', (err) => {
  if (err) {
    console.error('❌ Ошибка запуска:', err);
    process.exit(1);
  }
  console.log(`🚀 Сервер успешно запущен на порту ${PORT}`);
  console.log(`🌐 Доступен по адресу: http://0.0.0.0:${PORT}`);
  console.log(`📊 Healthcheck endpoint: http://0.0.0.0:${PORT}/api/health`);
  console.log(`✅ Сервер готов принимать запросы`);
});

server.on('error', (error) => {
  console.error('❌ Ошибка сервера:', error);
  console.error('Error code:', error.code);
  console.error('Error message:', error.message);
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Порт ${PORT} уже занят!`);
  }
  process.exit(1);
});

// Обработка ошибок на уровне сервера
server.on('listening', () => {
  console.log('✅ Сервер начал прослушивать порт', PORT);
});
