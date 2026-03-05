const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = Number(process.env.LIBRARY_SERVER_PORT || 4312);
const HOST = process.env.LIBRARY_SERVER_HOST || '0.0.0.0';
const DB_PATH = process.env.LIBRARY_DB_PATH
  ? (path.isAbsolute(process.env.LIBRARY_DB_PATH) ? process.env.LIBRARY_DB_PATH : path.resolve(process.cwd(), process.env.LIBRARY_DB_PATH))
  : path.join(__dirname, 'library.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const PASSWORD_MIN_LENGTH = 6;
const MAX_READING_DURATION_HOURS = 4;
const READING_SESSION_SWEEP_MS = 60 * 1000;

let db;
let sweep;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2$${salt}$${hash}`;
}

function verifyPassword(plainPassword, storedPassword) {
  if (!storedPassword) return false;
  if (storedPassword.startsWith('pbkdf2$')) {
    const parts = storedPassword.split('$');
    if (parts.length !== 3) return false;
    const [, salt, storedHash] = parts;
    const computedHash = crypto.pbkdf2Sync(plainPassword, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(computedHash, 'hex'));
  }
  return plainPassword === storedPassword;
}

function makeHttpsRequest(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    request.on('error', reject);
    request.setTimeout(10000, () => { request.destroy(); reject(new Error('timeout')); });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}
function get(sql, params = []) { return new Promise((resolve, reject) => db.get(sql, params, (e, r) => e ? reject(e) : resolve(r))); }
function all(sql, params = []) { return new Promise((resolve, reject) => db.all(sql, params, (e, r) => e ? reject(e) : resolve(r))); }

async function initDb() {
  db = new sqlite3.Database(DB_PATH);
  await run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, userType TEXT DEFAULT 'student', createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  await run(`CREATE TABLE IF NOT EXISTS checkouts (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,isbn TEXT NOT NULL,title TEXT NOT NULL,author TEXT NOT NULL,cover_url TEXT,checkout_date DATETIME DEFAULT CURRENT_TIMESTAMP,due_date DATETIME DEFAULT (datetime('now', '+7 days')),returned BOOLEAN DEFAULT 0,return_date DATETIME,FOREIGN KEY (user_id) REFERENCES users (id))`);
  await run(`CREATE TABLE IF NOT EXISTS books (id INTEGER PRIMARY KEY AUTOINCREMENT,isbn TEXT UNIQUE NOT NULL,title TEXT NOT NULL,author TEXT,cover_url TEXT,description TEXT,categories TEXT,copies_total INTEGER DEFAULT 1,created_at DATETIME DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  await run(`CREATE TABLE IF NOT EXISTS reading_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,start_time DATETIME DEFAULT CURRENT_TIMESTAMP,end_time DATETIME,duration_minutes INTEGER,book_title TEXT,pages_read INTEGER,FOREIGN KEY (user_id) REFERENCES users (id))`);
  await run(`CREATE TABLE IF NOT EXISTS reading_goals (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,goal_type TEXT NOT NULL,target_minutes INTEGER NOT NULL,start_date DATE NOT NULL,end_date DATE NOT NULL,completed BOOLEAN DEFAULT 0,FOREIGN KEY (user_id) REFERENCES users (id))`);

  const adminCount = await get('SELECT COUNT(*) as count FROM users');
  if ((adminCount?.count || 0) === 0) {
    await run('INSERT INTO users (name, username, password, userType) VALUES (?, ?, ?, ?)', ['Administrator', 'admin', hashPassword('admin123'), 'admin']);
  }

  await run('PRAGMA journal_mode = WAL');
}

function sweepReading() {
  run(`UPDATE reading_sessions SET end_time = datetime(start_time, '+${MAX_READING_DURATION_HOURS} hours'), duration_minutes = ${MAX_READING_DURATION_HOURS * 60} WHERE end_time IS NULL AND datetime(start_time, '+${MAX_READING_DURATION_HOURS} hours') <= CURRENT_TIMESTAMP`).catch(() => {});
}

app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/api/login-user', async (req, res) => {
  try {
    const { username, password } = req.body;
    const row = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!row || !verifyPassword(password, row.password)) return res.json({ success: false, error: 'Invalid credentials' });
    res.json({ success: true, user: { id: row.id, name: row.name, username: row.username, userType: row.userType } });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post('/api/register-user', async (req, res) => {
  try {
    const { name, username, password, userType = 'student' } = req.body;
    if (!password || password.length < PASSWORD_MIN_LENGTH) return res.json({ success: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`});
    const result = await run('INSERT INTO users (name, username, password, userType) VALUES (?, ?, ?, ?)', [name || '', username, hashPassword(password), userType]);
    res.json({ success: true, userId: result.lastID });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.json({ success: false, error: 'Username already exists' });
    res.json({ success: false, error: e.message });
  }
});

app.get('/api/search-books', async (req, res) => {
  try {
    const query = req.query.query || '';
    if (!query.trim()) return res.json([]);
    const encoded = encodeURIComponent(query);
    const data = await makeHttpsRequest(`https://www.googleapis.com/books/v1/volumes?q=${encoded}&maxResults=10`);
    const books = (data.items || []).map(item => ({
      isbn: item.volumeInfo?.industryIdentifiers?.find(id => id.type?.includes('ISBN'))?.identifier || 'No ISBN',
      title: item.volumeInfo?.title || 'Unknown Title',
      authors: item.volumeInfo?.authors || ['Unknown Author'],
      description: item.volumeInfo?.description || '',
      coverUrl: item.volumeInfo?.imageLinks?.thumbnail || ''
    })).filter(b => b.isbn !== 'No ISBN');
    res.json(books);
  } catch (e) { res.json([]); }
});

app.post('/api/checkout-book', async (req, res) => {
  try {
    const { userId, isbn, title, author, coverUrl } = req.body;
    await run('INSERT INTO checkouts (user_id, isbn, title, author, cover_url) VALUES (?, ?, ?, ?, ?)', [userId, isbn, title, author, coverUrl || '']);
    await run(`INSERT INTO books (isbn,title,author,cover_url,updated_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(isbn) DO UPDATE SET title=excluded.title, author=excluded.author, cover_url=excluded.cover_url, updated_at=CURRENT_TIMESTAMP`, [isbn, title, author, coverUrl || '']);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.get('/api/get-user-checkouts', async (req, res) => {
  try { res.json(await all('SELECT * FROM checkouts WHERE user_id = ? AND returned = 0 ORDER BY checkout_date DESC', [req.query.userId])); }
  catch (e) { res.json([]); }
});
app.get('/api/get-all-checkouts', async (req, res) => {
  try {
    const q = (req.query.searchQuery || '').trim();
    const sql = `SELECT c.*, u.username FROM checkouts c JOIN users u ON c.user_id=u.id WHERE (? = '' OR c.title LIKE ? OR c.author LIKE ? OR u.username LIKE ?) ORDER BY c.checkout_date DESC`;
    const like = `%${q}%`;
    res.json(await all(sql, [q, like, like, like]));
  } catch (e) { res.json([]); }
});
app.get('/api/get-all-users-detailed', async (req, res) => {
  try {
    res.json(await all(`SELECT u.id,u.name,u.username,u.userType,u.createdAt,COUNT(c.id) as activeCheckouts FROM users u LEFT JOIN checkouts c ON u.id=c.user_id AND c.returned=0 GROUP BY u.id ORDER BY u.username`));
  } catch (e) { res.json([]); }
});
app.post('/api/change-user-type', async (req, res) => {
  try { const r = await run('UPDATE users SET userType=? WHERE id=?', [req.body.newType, req.body.userId]); res.json({ success: r.changes > 0 }); }
  catch (e) { res.json({ success: false, error: e.message }); }
});
app.post('/api/change-user-password', async (req, res) => {
  try { const r = await run('UPDATE users SET password=? WHERE id=?', [hashPassword(req.body.newPassword), req.body.userId]); res.json({ success: r.changes > 0 }); }
  catch (e) { res.json({ success: false, error: e.message }); }
});
app.post('/api/change-own-password', async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body.payload || {};
    const user = await get('SELECT password FROM users WHERE id=?', [userId]);
    if (!user || !verifyPassword(currentPassword, user.password)) return res.json({ success: false, error: 'Current password is incorrect' });
    const r = await run('UPDATE users SET password=? WHERE id=?', [hashPassword(newPassword), userId]);
    res.json({ success: r.changes > 0 });
  } catch (e) { res.json({ success: false, error: e.message }); }
});
app.post('/api/delete-user', async (req, res) => {
  try { const r = await run('DELETE FROM users WHERE id=?', [req.body.userId]); res.json({ success: r.changes > 0 }); }
  catch (e) { res.json({ success: false, error: e.message }); }
});
app.post('/api/return-book', async (req, res) => {
  try { const r = await run('UPDATE checkouts SET returned = 1, return_date = CURRENT_TIMESTAMP WHERE id = ?', [req.body.checkoutId]); res.json({ success: r.changes > 0 }); }
  catch (e) { res.json({ success: false, error: e.message }); }
});
app.get('/api/get-library-books', async (req, res) => { try { res.json(await all('SELECT * FROM books ORDER BY updated_at DESC')); } catch { res.json([]);} });
app.get('/api/get-user-book-suggestions', async (req, res) => { try { res.json([]); } catch { res.json([]);} });
app.get('/api/read-source-file', async (req, res) => {
  try {
    const filename = req.query.filename;
    const allowed = new Set(['main.js','renderer.js','preload.js','index.html','README.md']);
    if (!allowed.has(filename)) return res.json({ success: false, error: 'File not allowed' });
    const content = fs.readFileSync(path.join(__dirname, filename), 'utf8');
    res.json({ success: true, content });
  } catch (e) { res.json({ success: false, error: e.message }); }
});
app.post('/api/get-book-suggestions', async (req, res) => { res.json([]); });
app.post('/api/get-word-help', async (req, res) => {
  const word = req.body.word || '';
  try {
    const data = await makeHttpsRequest(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    const def = data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition;
    res.json({ success: true, definition: def || 'No definition found' });
  } catch (e) { res.json({ success: false, error: 'Word help unavailable' }); }
});
app.post('/api/start-reading-session', async (req, res) => {
  try { const r = await run('INSERT INTO reading_sessions (user_id, book_title) VALUES (?, ?)', [req.body.userId, req.body.bookTitle || '']); res.json({ success: true, sessionId: r.lastID }); }
  catch (e) { res.json({ success: false, error: e.message }); }
});
app.post('/api/end-reading-session', async (req, res) => {
  try {
    const { sessionId, pagesRead = 0 } = req.body;
    const r = await run(`UPDATE reading_sessions
      SET end_time = CASE WHEN datetime(start_time, '+${MAX_READING_DURATION_HOURS} hours') < CURRENT_TIMESTAMP THEN datetime(start_time, '+${MAX_READING_DURATION_HOURS} hours') ELSE CURRENT_TIMESTAMP END,
      duration_minutes = CASE WHEN ROUND((JULIANDAY(CURRENT_TIMESTAMP)-JULIANDAY(start_time))*24*60) > ${MAX_READING_DURATION_HOURS*60} THEN ${MAX_READING_DURATION_HOURS*60} ELSE ROUND((JULIANDAY(CURRENT_TIMESTAMP)-JULIANDAY(start_time))*24*60) END,
      pages_read = ? WHERE id = ? AND end_time IS NULL`, [pagesRead, sessionId]);
    res.json({ success: r.changes > 0, error: r.changes ? undefined : 'Session not found or already ended' });
  } catch (e) { res.json({ success: false, error: e.message }); }
});
app.post('/api/set-reading-goal', async (req, res) => {
  try { const { userId, goalType, targetMinutes, startDate, endDate } = req.body; const r=await run('INSERT INTO reading_goals (user_id, goal_type, target_minutes, start_date, end_date) VALUES (?, ?, ?, ?, ?)', [userId,goalType,targetMinutes,startDate,endDate]); res.json({ success: true, goalId: r.lastID }); }
  catch (e) { res.json({ success: false, error: e.message }); }
});
app.get('/api/get-reading-stats', async (req, res) => {
  try {
    const userId = req.query.userId;
    const totals = await get(`SELECT COUNT(*) as totalSessions, COALESCE(SUM(duration_minutes),0) as totalMinutes, COALESCE(SUM(pages_read),0) as totalPages, COALESCE(ROUND(AVG(duration_minutes)),0) as avgMinutes FROM reading_sessions WHERE user_id=? AND end_time IS NOT NULL`, [userId]);
    const most = await get(`SELECT book_title, COUNT(*) as c FROM reading_sessions WHERE user_id=? AND book_title IS NOT NULL AND book_title != '' GROUP BY book_title ORDER BY c DESC LIMIT 1`, [userId]);
    const last = await get(`SELECT end_time FROM reading_sessions WHERE user_id=? AND end_time IS NOT NULL ORDER BY end_time DESC LIMIT 1`, [userId]);
    res.json({ ...totals, mostReadBook: most?.book_title || null, lastSession: last?.end_time || null });
  } catch (e) { res.json({ totalSessions:0,totalMinutes:0,totalPages:0,avgMinutes:0,mostReadBook:null,lastSession:null }); }
});

(async () => {
  await initDb();
  sweepReading();
  sweep = setInterval(sweepReading, READING_SESSION_SWEEP_MS);
  app.listen(PORT, HOST, () => {
    console.log(`📚 Library LAN server running on http://${HOST}:${PORT}`);
    console.log(`📁 DB path: ${DB_PATH}`);
  });
})();

process.on('SIGINT', () => { if (sweep) clearInterval(sweep); if (db) db.close(); process.exit(0); });
