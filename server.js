// server.js - УЛУЧШЕННЫЙ Backend v6 (Сортировка и лог активности)
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { Pool } = require('pg');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

let twitchAccessToken = null;
let tokenExpiry = null;

async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        avatar TEXT,
        bio TEXT,
        theme VARCHAR(20) DEFAULT 'default',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        game_id BIGINT NOT NULL,
        name VARCHAR(255) NOT NULL,
        cover TEXT,
        board VARCHAR(20) NOT NULL,
        position INTEGER DEFAULT 0,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        notes TEXT,
        hours_played INTEGER DEFAULT 0,
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
      
      CREATE TABLE IF NOT EXISTS activity_log (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
          action_type VARCHAR(50) NOT NULL,
          details JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id);
      CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
      CREATE INDEX IF NOT EXISTS idx_reactions_game_id ON reactions(game_id);
      CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);

      ALTER TABLE games ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;
    `);
    console.log('✅ База данных инициализирована');
  } catch (error) {
    console.error('❌ Ошибка инициализации БД:', error);
  } finally {
    client.release();
  }
}

initDatabase();

// Helper to log activities
const logActivity = async (userId, actionType, details) => {
    const client = await pool.connect();
    try {
        await client.query(
            'INSERT INTO activity_log (user_id, action_type, details) VALUES ($1, $2, $3)',
            [userId, actionType, details]
        );
    } catch (err) {
        console.error("Ошибка логирования:", err);
    } finally {
        client.release();
    }
};


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
    console.error('Ошибка Twitch токена:', error.message);
    throw new Error('Не удалось авторизоваться в Twitch API');
  }
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Недействительный токен' });
    req.user = user;
    next();
  });
}

// === AUTH ===

app.post('/api/auth/register', async (req, res) => {
  const client = await pool.connect();
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль минимум 6 символов' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await client.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, avatar, bio, theme',
      [username, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      message: 'Регистрация успешна',
      token,
      user
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Пользователь или email уже существует' });
    }
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

app.post('/api/auth/login', async (req, res) => {
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

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      message: 'Вход выполнен',
      token,
      user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar, bio: user.bio, theme: user.theme }
    });
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

// === PROFILE ===

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

app.post('/api/profile/avatar', authenticateToken, async (req, res) => {
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

app.put('/api/profile', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { username, bio, theme, currentPassword, newPassword } = req.body;
    
    let updateFields = [];
    let values = [];
    let paramCount = 1;

    if (username) {
      updateFields.push(`username = $${paramCount++}`);
      values.push(username);
    }
    if (bio !== undefined) {
      updateFields.push(`bio = $${paramCount++}`);
      values.push(bio);
    }
    if (theme) {
        updateFields.push(`theme = $${paramCount++}`);
        values.push(theme);
    }
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Требуется текущий пароль' });
      }
      const userResult = await client.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
      const validPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Неверный текущий пароль' });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      updateFields.push(`password = $${paramCount++}`);
      values.push(hashedPassword);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    values.push(req.user.id);
    const result = await client.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    const updatedUser = result.rows[0];
    const newToken = jwt.sign({ id: updatedUser.id, username: updatedUser.username }, JWT_SECRET, { expiresIn: '30d' });

    res.json({ 
        message: 'Профиль обновлен', 
        user: { id: updatedUser.id, username: updatedUser.username, email: updatedUser.email, avatar: updatedUser.avatar, bio: updatedUser.bio, theme: updatedUser.theme }, 
        token: newToken 
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Это имя пользователя уже занято' });
    }
    console.error('Ошибка обновления профиля:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});


// === GAMES ===

app.get('/api/games/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Минимум 2 символа' });
    }

    const token = await getTwitchToken();
    const response = await axios.post(
      'https://api.igdb.com/v4/games',
      `search "${q}"; fields name, cover.url, summary, rating, genres.name; limit 20;`,
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
      name: game.name,
      cover: game.cover?.url ? `https:${game.cover.url.replace('t_thumb', 't_cover_big')}` : null,
      summary: game.summary || '',
      rating: game.rating ? Math.round(game.rating / 20) : null,
      genres: game.genres?.map(g => g.name) || []
    }));

    res.json({ games });
  } catch (error) {
    console.error('Ошибка поиска:', error.message);
    res.status(500).json({ error: 'Ошибка поиска' });
  }
});

app.get('/api/user/boards', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT g.*, 
        COALESCE(json_agg(
          json_build_object('user_id', r.user_id, 'emoji', r.emoji, 'username', u.username, 'avatar', u.avatar)
        ) FILTER (WHERE r.id IS NOT NULL), '[]') as reactions
       FROM games g
       LEFT JOIN reactions r ON g.id = r.game_id
       LEFT JOIN users u ON r.user_id = u.id
       WHERE g.user_id = $1
       GROUP BY g.id
       ORDER BY g.position ASC, g.added_at DESC`,
      [req.user.id]
    );

    const boards = { backlog: [], playing: [], completed: [], dropped: [] };

    result.rows.forEach(game => {
      const card = {
        id: game.id.toString(),
        gameId: game.game_id,
        name: game.name,
        cover: game.cover,
        rating: game.rating,
        notes: game.notes,
        hoursPlayed: game.hours_played,
        addedDate: game.added_at,
        reactions: game.reactions
      };
      if (boards[game.board]) {
        boards[game.board].push(card);
      }
    });

    res.json({ boards });
  } catch (error) {
    console.error('Ошибка загрузки досок:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
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
      'INSERT INTO games (user_id, game_id, name, cover, board) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user.id, game.id, game.name, game.cover || null, boardId]
    );
    
    logActivity(req.user.id, 'add_game', { gameName: game.name, board: boardId });

    res.status(201).json({ message: 'Игра добавлена', game: result.rows[0] });
  } catch (error) {
    console.error('Ошибка добавления игры:', error);
    res.status(500).json({ error: 'Ошибка сервера', details: error.message });
  } finally {
    client.release();
  }
});

app.delete('/api/user/games/:gameId', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { gameId } = req.params;
    const gameResult = await client.query('SELECT name FROM games WHERE id = $1 AND user_id = $2', [gameId, req.user.id]);
    if (gameResult.rows.length > 0) {
        logActivity(req.user.id, 'remove_game', { gameName: gameResult.rows[0].name });
    }
    await client.query('DELETE FROM games WHERE id = $1 AND user_id = $2', [gameId, req.user.id]);
    res.json({ message: 'Игра удалена' });
  } catch (error) {
    console.error('Ошибка удаления:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

app.put('/api/user/games/:gameId', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { gameId } = req.params;
    const { board, rating, notes, hoursPlayed } = req.body;
    
    const oldGameResult = await client.query('SELECT * FROM games WHERE id = $1 AND user_id = $2', [gameId, req.user.id]);
    if(oldGameResult.rows.length === 0) {
        return res.status(404).json({ error: 'Игра не найдена'});
    }
    const oldGame = oldGameResult.rows[0];

    let updateFields = [];
    let values = [];
    let paramCount = 1;

    if (board) { updateFields.push(`board = $${paramCount++}`); values.push(board); }
    if (rating !== undefined) { updateFields.push(`rating = $${paramCount++}`); values.push(rating); }
    if (notes !== undefined) { updateFields.push(`notes = $${paramCount++}`); values.push(notes); }
    if (hoursPlayed !== undefined) { updateFields.push(`hours_played = $${paramCount++}`); values.push(hoursPlayed); }
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(gameId, req.user.id);

    const result = await client.query(
      `UPDATE games SET ${updateFields.join(', ')} WHERE id = $${paramCount} AND user_id = $${paramCount + 1} RETURNING *`,
      values
    );
    
    if (board && oldGame.board !== board) {
        if (board === 'completed') {
            logActivity(req.user.id, 'complete_game', { gameName: oldGame.name });
        } else {
            logActivity(req.user.id, 'move_game', { gameName: oldGame.name, fromBoard: oldGame.board, toBoard: board });
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

app.put('/api/user/boards/reorder', authenticateToken, async (req, res) => {
    const { boardId, orderedIds } = req.body;
    if (!boardId || !Array.isArray(orderedIds)) {
        return res.status(400).json({ error: 'Неверные параметры'});
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (let i = 0; i < orderedIds.length; i++) {
            const gameId = orderedIds[i];
            const position = i;
            await client.query(
                'UPDATE games SET position = $1 WHERE id = $2 AND user_id = $3 AND board = $4',
                [position, gameId, req.user.id, boardId]
            );
        }
        await client.query('COMMIT');
        res.json({ message: 'Порядок обновлен' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка обновления порядка:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});


// === REACTIONS ===

app.post('/api/games/:gameId/reactions', authenticateToken, async (req, res) => {
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

// === USERS & FRIENDS ===

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

app.post('/api/friends/request', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { friendId } = req.body;
        if (req.user.id == friendId) {
            return res.status(400).json({ error: 'Нельзя добавить себя в друзья' });
        }
        await client.query(
            "INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, 'pending') ON CONFLICT (user_id, friend_id) DO NOTHING",
            [req.user.id, friendId]
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
        await client.query(
            "UPDATE friendships SET status = 'accepted' WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'",
            [friendId, req.user.id]
        );
        await client.query(
            "INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, 'accepted') ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'",
            [req.user.id, friendId]
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
        await client.query(
            'DELETE FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
            [req.user.id, friendId]
        );
        res.json({ message: 'Запрос отклонен' });
    } catch (error) {
        console.error('Ошибка отклонения запроса:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

app.put('/api/friends/:friendId/nickname', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { friendId } = req.params;
    const { nickname } = req.body;
    
    await client.query(
      'UPDATE friendships SET nickname = $1 WHERE user_id = $2 AND friend_id = $3',
      [nickname, req.user.id, friendId]
    );
    
    res.json({ message: 'Метка обновлена' });
  } catch (error) {
    console.error('Ошибка обновления метки:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

app.delete('/api/friends/:friendId', authenticateToken, async (req, res) => {
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
        const friendsResult = await client.query(
            `SELECT u.id, u.username, u.avatar, u.bio, f.nickname
             FROM friendships f JOIN users u ON f.friend_id = u.id
             WHERE f.user_id = $1 AND f.status = 'accepted'`, [req.user.id]
        );
        const requestsResult = await client.query(
            `SELECT u.id, u.username, u.avatar, u.bio
             FROM friendships f JOIN users u ON f.user_id = u.id
             WHERE f.friend_id = $1 AND f.status = 'pending'`, [req.user.id]
        );
        const sentRequestsResult = await client.query(
            `SELECT f.friend_id as id
             FROM friendships f
             WHERE f.user_id = $1 AND f.status = 'pending'`, [req.user.id]
        );

        res.json({
            friends: friendsResult.rows,
            requests: requestsResult.rows,
            sentRequests: sentRequestsResult.rows.map(r => r.id)
        });
    } catch (error) {
        console.error('Ошибка получения друзей и запросов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

app.get('/api/friends/activity', authenticateToken, async(req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT al.id, al.action_type, al.details, al.created_at, u.username 
             FROM activity_log al 
             JOIN users u ON al.user_id = u.id
             WHERE al.user_id IN (SELECT friend_id FROM friendships WHERE user_id = $1 AND status = 'accepted')
             ORDER BY al.created_at DESC
             LIMIT 50`,
             [req.user.id]
        );
        res.json({ activities: result.rows });
    } catch(error) {
        console.error("Ошибка получения активности:", error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});


app.get('/api/user/:userId/boards', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { userId } = req.params;
    const result = await client.query(
      `SELECT g.*, u.username, u.avatar,
        COALESCE(json_agg(
          json_build_object('user_id', r.user_id, 'emoji', r.emoji, 'username', ru.username, 'avatar', ru.avatar)
        ) FILTER (WHERE r.id IS NOT NULL), '[]') as reactions
       FROM games g
       JOIN users u ON g.user_id = u.id
       LEFT JOIN reactions r ON g.id = r.game_id
       LEFT JOIN users ru ON r.user_id = ru.id
       WHERE g.user_id = $1
       GROUP BY g.id, u.username, u.avatar
       ORDER BY g.position ASC, g.added_at DESC`,
      [userId]
    );

    const boards = { backlog: [], playing: [], completed: [], dropped: [] };
    result.rows.forEach(game => {
      const card = {
        id: game.id.toString(),
        gameId: game.game_id,
        name: game.name,
        cover: game.cover,
        rating: game.rating,
        notes: game.notes,
        hoursPlayed: game.hours_played,
        addedDate: game.added_at,
        reactions: game.reactions,
        owner: { username: game.username, avatar: game.avatar }
      };
      if (boards[game.board]) boards[game.board].push(card);
    });

    const userInfo = await client.query('SELECT id, username, avatar, bio, theme FROM users WHERE id = $1', [userId]);
    
    let friendship = 'none';
    let nickname = null;

    if (req.user.id != userId) {
        const friendshipStatusQuery = await client.query(
          `SELECT status, user_id, (SELECT nickname FROM friendships WHERE user_id = $1 AND friend_id = $2) as nickname 
           FROM friendships 
           WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
          [req.user.id, userId]
        );
        
        if (friendshipStatusQuery.rows.length > 0) {
            const f_status = friendshipStatusQuery.rows[0];
            nickname = f_status.nickname;
            if (f_status.status === 'accepted') {
                friendship = 'friends';
            } else if (f_status.status === 'pending') {
                friendship = (f_status.user_id == req.user.id) ? 'request_sent' : 'request_received';
            }
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

app.listen(PORT, () => {
  console.log(`🚀 Сервер на порту ${PORT}`);
});
