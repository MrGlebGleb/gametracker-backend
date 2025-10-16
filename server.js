// server.js - УЛУЧШЕННЫЙ Backend v7 (с полной лентой активности)
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt =require('jsonwebtoken');
const axios = require('axios');
const { Pool } = require('pg');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

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
    `);
    console.log('✅ База данных инициализирована');
  } catch (error) {
    console.error('❌ Ошибка инициализации БД:', error);
  } finally {
    client.release();
  }
}

initDatabase();

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

// === AUTH (без изменений) ===
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
    res.status(201).json({ message: 'Регистрация успешна', token, user });
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
    let updateFields = [], values = [], paramCount = 1;
    if (username) { updateFields.push(`username = $${paramCount++}`); values.push(username); }
    if (bio !== undefined) { updateFields.push(`bio = $${paramCount++}`); values.push(bio); }
    if (theme) { updateFields.push(`theme = $${paramCount++}`); values.push(theme); }
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

// === GAMES (С ИЗМЕНЕНИЯМИ ДЛЯ ЛОГИРОВАНИЯ) ===
app.get('/api/games/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.status(400).json({ error: 'Минимум 2 символа' });
    const token = await getTwitchToken();
    const response = await axios.post(
      'https://api.igdb.com/v4/games', `search "${q}"; fields name, cover.url, summary, rating, genres.name, videos.video_id; limit 20;`,
      { headers: { 'Client-ID': TWITCH_CLIENT_ID, 'Authorization': `Bearer ${token}`, 'Content-Type': 'text/plain' } }
    );
    const games = response.data.map(game => ({
      id: game.id, name: game.name,
      cover: game.cover?.url ? `https:${game.cover.url.replace('t_thumb', 't_cover_big')}` : null,
      summary: game.summary || '', rating: game.rating ? Math.round(game.rating / 20) : null,
      genres: game.genres?.map(g => g.name) || [], videoId: game.videos?.[0]?.video_id || null,
    }));
    res.json({ games });
  } catch (error) {
    console.error('Ошибка поиска:', error.message);
    res.status(500).json({ error: 'Ошибка поиска' });
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

app.delete('/api/user/games/:gameId', authenticateToken, async (req, res) => {
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

app.put('/api/user/games/:gameId', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { gameId } = req.params;
    const { board, rating, notes, hoursPlayed } = req.body;

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
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(gameId, req.user.id);
    
    const result = await client.query(
      `UPDATE games SET ${updateFields.join(', ')} WHERE id = $${paramCount} AND user_id = $${paramCount + 1} RETURNING *`,
      values
    );

    // ЛОГИРОВАНИЕ
    if (oldGameData && oldGameData.board !== board) {
      if (board === 'completed') {
        await logActivity(req.user.id, 'complete_game', { gameName: oldGameData.name });
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
app.post('/api/games/:gameId/deep-review', authenticateToken, async (req, res) => {
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
    // ЛОГИРОВАНИЕ
    await logActivity(req.user.id, 'add_review', { gameName: result.rows[0].name });
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
       ORDER BY g.updated_at DESC, g.added_at DESC`,
      [req.user.id]
    );
    const boards = { backlog: [], playing: [], completed: [], dropped: [] };
    result.rows.forEach(game => {
      const card = {
        id: game.id.toString(), gameId: game.game_id, name: game.name,
        cover: game.cover, rating: game.rating, notes: game.notes,
        hoursPlayed: game.hours_played, addedDate: game.added_at,
        reactions: game.reactions, videoId: game.video_id,
        deep_review_answers: game.deep_review_answers,
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

app.delete('/api/games/:gameId/deep-review', authenticateToken, async (req, res) => {
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

// === TMDB PROXY AND MEDIA ENDPOINTS ===
app.get('/api/media/search', authenticateToken, async (req, res) => {
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
    const result = await client.query(
      `SELECT m.*, COALESCE(json_agg(json_build_object('user_id', r.user_id, 'emoji', r.emoji, 'username', u.username, 'avatar', u.avatar))
          FILTER (WHERE r.id IS NOT NULL), '[]') as reactions
       FROM media_items m
       LEFT JOIN media_reactions r ON r.media_id = m.id
       LEFT JOIN users u ON u.id = r.user_id
       WHERE m.user_id = $1
       GROUP BY m.id
       ORDER BY m.updated_at DESC, m.added_at DESC`,
      [req.user.id]
    );
    const boards = {
      movies: { wishlist: [], watched: [] },
      tv: { wishlist: [], watched: [] }
    };
    result.rows.forEach(row => {
      const card = {
        id: row.id.toString(), tmdbId: row.tmdb_id, mediaType: row.media_type,
        title: row.title, poster: row.poster, rating: row.rating, review: row.review,
        seasonsWatched: row.seasons_watched, episodesWatched: row.episodes_watched,
        addedDate: row.added_at, reactions: row.reactions
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

app.put('/api/user/media/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { board, rating, review, seasonsWatched, episodesWatched } = req.body;
    let updateFields = [], values = [], n = 1;
    if (board) { updateFields.push(`board = $${n++}`); values.push(board === 'watched' ? 'watched' : 'wishlist'); }
    if (rating !== undefined) { updateFields.push(`rating = $${n++}`); values.push(rating); }
    if (review !== undefined) { updateFields.push(`review = $${n++}`); values.push(review); }
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

app.delete('/api/user/media/:id', authenticateToken, async (req, res) => {
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

app.post('/api/media/:id/reactions', authenticateToken, async (req, res) => {
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

app.post('/api/friends/request', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { friendId } = req.body;
        if (req.user.id == friendId) return res.status(400).json({ error: 'Нельзя добавить себя в друзья' });
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
        await client.query("UPDATE friendships SET status = 'accepted' WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'", [friendId, req.user.id]);
        await client.query("INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, 'accepted') ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'", [req.user.id, friendId]);
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

app.put('/api/friends/:friendId/nickname', authenticateToken, async (req, res) => {
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

app.get('/api/user/:userId/boards', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { userId } = req.params;
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
        deep_review_answers: game.deep_review_answers, owner: { username: game.username, avatar: game.avatar }
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
app.get('/api/user/:userId/media/boards', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { userId } = req.params;
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
        seasonsWatched: row.seasons_watched, episodesWatched: row.episodes_watched,
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

app.get('/api/friends/activity', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { media } = req.query; // optional: 'games' | 'media'
        let whereMedia = '';
        if (media === 'games') {
          // filter only game-related actions
          whereMedia = " AND (a.action_type LIKE '%%game%%') ";
        } else if (media === 'media') {
          // we will log movie/tv actions to include 'media' in action_type
          whereMedia = " AND (a.action_type LIKE '%%media%%') ";
        }
        const result = await client.query(
          `SELECT a.id, a.action_type, a.details, a.created_at, u.username
           FROM activities a JOIN users u ON u.id = a.user_id
           WHERE a.user_id IN (SELECT friend_id FROM friendships WHERE user_id = $1 AND status = 'accepted')${whereMedia}
           ORDER BY a.created_at DESC LIMIT 12;`,
          [req.user.id]
        );
        res.json({ activities: result.rows });
    } catch (error) {
        console.error('Error fetching friend activity:', error);
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

app.listen(PORT, () => {
  console.log(`🚀 Сервер на порту ${PORT}`);
});
