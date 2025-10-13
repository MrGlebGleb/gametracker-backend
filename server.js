// server.js - Backend для Railway.com
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Имитация БД (в продакшене используй PostgreSQL/MongoDB)
const users = [];
const userBoards = {};

// Конфигурация (переменные окружения Railway)
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

let twitchAccessToken = null;
let tokenExpiry = null;

// Получить Twitch Access Token
async function getTwitchToken() {
  if (twitchAccessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return twitchAccessToken;
  }

  try {
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
    console.error('Ошибка получения Twitch токена:', error.response?.data || error.message);
    throw new Error('Не удалось авторизоваться в Twitch API');
  }
}

// Middleware для проверки JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Недействительный токен' });
    }
    req.user = user;
    next();
  });
}

// === AUTH ENDPOINTS ===

// Регистрация
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Валидация
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
    }

    // Проверка существующего пользователя
    if (users.find(u => u.username === username)) {
      return res.status(400).json({ error: 'Пользователь уже существует' });
    }

    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'Email уже используется' });
    }

    // Хеширование пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создание пользователя
    const user = {
      id: Date.now().toString(),
      username,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };

    users.push(user);

    // Инициализация пустых досок
    userBoards[user.id] = {
      backlog: [],
      playing: [],
      completed: [],
      dropped: []
    };

    // Создание JWT токена
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Пользователь зарегистрирован',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Вход
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    // Поиск пользователя
    const user = users.find(u => u.username === username);
    if (!user) {
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }

    // Проверка пароля
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }

    // Создание токена
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Вход выполнен',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// === GAME SEARCH ENDPOINTS ===

// Поиск игр через IGDB (Twitch)
app.get('/api/games/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Запрос должен содержать минимум 2 символа' });
    }

    const token = await getTwitchToken();

    // Запрос к IGDB API
    const response = await axios.post(
      'https://api.igdb.com/v4/games',
      `search "${q}"; fields name, cover.url, summary, rating, genres.name, release_dates.date; limit 20;`,
      {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'text/plain'
        }
      }
    );

    // Форматирование результатов
    const games = response.data.map(game => ({
      id: game.id,
      name: game.name,
      cover: game.cover?.url ? `https:${game.cover.url.replace('t_thumb', 't_cover_big')}` : null,
      summary: game.summary || '',
      rating: game.rating ? Math.round(game.rating / 20) : null,
      genres: game.genres?.map(g => g.name) || [],
      releaseDate: game.release_dates?.[0]?.date || null
    }));

    res.json({ games });
  } catch (error) {
    console.error('Ошибка поиска игр:', error.response?.data || error.message);
    res.status(500).json({ error: 'Ошибка поиска игр' });
  }
});

// Получить детали игры
app.get('/api/games/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const token = await getTwitchToken();

    const response = await axios.post(
      'https://api.igdb.com/v4/games',
      `fields name, cover.url, summary, rating, genres.name, release_dates.date, screenshots.url; where id = ${id};`,
      {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'text/plain'
        }
      }
    );

    if (response.data.length === 0) {
      return res.status(404).json({ error: 'Игра не найдена' });
    }

    const game = response.data[0];
    res.json({
      id: game.id,
      name: game.name,
      cover: game.cover?.url ? `https:${game.cover.url.replace('t_thumb', 't_cover_big')}` : null,
      summary: game.summary || '',
      rating: game.rating ? Math.round(game.rating / 20) : null,
      genres: game.genres?.map(g => g.name) || [],
      releaseDate: game.release_dates?.[0]?.date || null,
      screenshots: game.screenshots?.map(s => `https:${s.url}`) || []
    });
  } catch (error) {
    console.error('Ошибка получения игры:', error.response?.data || error.message);
    res.status(500).json({ error: 'Ошибка получения информации об игре' });
  }
});

// === USER BOARDS ENDPOINTS ===

// Получить доски пользователя
app.get('/api/user/boards', authenticateToken, (req, res) => {
  try {
    const boards = userBoards[req.user.id] || {
      backlog: [],
      playing: [],
      completed: [],
      dropped: []
    };

    res.json({ boards });
  } catch (error) {
    console.error('Ошибка получения досок:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Сохранить доски пользователя
app.post('/api/user/boards', authenticateToken, (req, res) => {
  try {
    const { boards } = req.body;

    if (!boards) {
      return res.status(400).json({ error: 'Данные досок обязательны' });
    }

    userBoards[req.user.id] = boards;

    res.json({ message: 'Доски сохранены', boards });
  } catch (error) {
    console.error('Ошибка сохранения досок:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Добавить игру на доску
app.post('/api/user/boards/:boardId/games', authenticateToken, (req, res) => {
  try {
    const { boardId } = req.params;
    const { game } = req.body;

    if (!userBoards[req.user.id]) {
      userBoards[req.user.id] = {
        backlog: [],
        playing: [],
        completed: [],
        dropped: []
      };
    }

    if (!userBoards[req.user.id][boardId]) {
      return res.status(400).json({ error: 'Неверная доска' });
    }

    const card = {
      id: `game-${Date.now()}`,
      gameId: game.id,
      name: game.name,
      cover: game.cover,
      rating: null,
      notes: '',
      addedDate: new Date().toISOString()
    };

    userBoards[req.user.id][boardId].push(card);

    res.json({ message: 'Игра добавлена', card });
  } catch (error) {
    console.error('Ошибка добавления игры:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`🔑 Twitch Client ID: ${TWITCH_CLIENT_ID ? '✅ Установлен' : '❌ Не установлен'}`);
  console.log(`🔒 Twitch Client Secret: ${TWITCH_CLIENT_SECRET ? '✅ Установлен' : '❌ Не установлен'}`);
});