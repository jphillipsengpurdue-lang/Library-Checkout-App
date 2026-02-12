/**
 * MAIN PROCESS - main.js
 * 
 * This is the backend of our Electron application using SQLite3 database.
 * It handles:
 * - Database operations (SQLite3)
 * - Window management
 * - Secure communication with the frontend
 * - File system operations
 * 
 * SQLite3 is a reliable, file-based database that works well with Electron.
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

/**
 * Global variables to hold our database and window references
 */
let db;
let mainWindow;

const PASSWORD_MIN_LENGTH = 6;

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

    // Backward compatibility with existing plaintext records.
    return plainPassword === storedPassword;
}

function isLegacyPlaintextPassword(storedPassword = '') {
    return !storedPassword.startsWith('pbkdf2$');
}

/**
 * Creates the main application window
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadFile('index.html');

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }
}

/**
 * Initialize the SQLite database with proper error handling
 */
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        try {
            const dbPath = path.join(__dirname, 'library.db');
            console.log('📁 Database path:', dbPath);
            
            // Create or open the database file
            db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error('❌ Error opening database:', err.message);
                    reject(err);
                    return;
                }
                console.log('✅ Connected to SQLite database');
                
                // Create tables after successful connection
                createTables()
                    .then(() => {
                        console.log('✅ Database initialization complete');
                        resolve();
                    })
                    .catch(err => {
                        console.error('❌ Table creation failed:', err);
                        reject(err);
                    });
            });
            
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            reject(error);
        }
    });
}

/**
 * Create the necessary database tables
 */
function createTables() {
    return new Promise((resolve, reject) => {
        // Create users table
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                userType TEXT DEFAULT 'student',
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('❌ Error creating users table:', err.message);
                reject(err);
                return;
            }
            console.log('✅ Users table ready');
            
            // Create checkouts table
            db.run(`
                CREATE TABLE IF NOT EXISTS checkouts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    isbn TEXT NOT NULL,
                    title TEXT NOT NULL,
                    author TEXT NOT NULL,
                    cover_url TEXT,
                    checkout_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    due_date DATETIME DEFAULT (datetime('now', '+7 days')),
                    returned BOOLEAN DEFAULT 0,
                    return_date DATETIME,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            `, (err) => {
                if (err) {
                    console.error('❌ Error creating checkouts table:', err.message);
                    reject(err);
                    return;
                }
                console.log('✅ Checkouts table ready');

                db.run(`
                    CREATE TABLE IF NOT EXISTS books (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        isbn TEXT UNIQUE NOT NULL,
                        title TEXT NOT NULL,
                        author TEXT,
                        cover_url TEXT,
                        description TEXT,
                        categories TEXT,
                        copies_total INTEGER DEFAULT 1,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (bookErr) => {
                    if (bookErr) {
                        console.error('❌ Error creating books table:', bookErr.message);
                    } else {
                        console.log('✅ Books table ready');
                    }
                });

                // Create reading sessions table
                db.run(`
                    CREATE TABLE IF NOT EXISTS reading_sessions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                        end_time DATETIME,
                        duration_minutes INTEGER,
                        book_title TEXT,
                        pages_read INTEGER,
                        FOREIGN KEY (user_id) REFERENCES users (id)
                    )
                `, (err) => {
                    if (err) {
                        console.error('❌ Error creating reading_sessions table:', err.message);
                    } else {
                        console.log('✅ Reading sessions table ready');
                    }
                });

                // Create reading goals table
                db.run(`
                    CREATE TABLE IF NOT EXISTS reading_goals (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        goal_type TEXT NOT NULL,
                        target_minutes INTEGER NOT NULL,
                        start_date DATE NOT NULL,
                        end_date DATE NOT NULL,
                        completed BOOLEAN DEFAULT 0,
                        FOREIGN KEY (user_id) REFERENCES users (id)
                    )
                `, (err) => {
                    if (err) {
                        console.error('❌ Error creating reading_goals table:', err.message);
                    } else {
                        console.log('✅ Reading goals table ready');
                    }
                    
                    // Create default admin account
                    createDefaultAdmin()
                        .then(() => resolve())
                        .catch(err => reject(err));
                });
            });
        });
    });
}

/**
 * Create default admin account if no users exist
 */
function createDefaultAdmin() {
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
            if (err) {
                console.error('❌ Error checking users:', err.message);
                reject(err);
                return;
            }
            
            if (row.count === 0) {
                db.run(
                    'INSERT INTO users (username, password, userType) VALUES (?, ?, ?)',
                    ['admin', hashPassword('admin123'), 'admin'],
                    function(err) {
                        if (err) {
                            console.error('❌ Error creating admin user:', err.message);
                            reject(err);
                        } else {
                            console.log('✅ Default admin account created: admin / admin123');
                            resolve();
                        }
                    }
                );
            } else {
                console.log('✅ Database is ready with existing users');
                resolve();
            }
        });
    });
}

/**
 * Make HTTPS request using Node.js https module (more reliable in Electron)
 */
function makeHttpsRequest(url) {
    return new Promise((resolve, reject) => {
        console.log(`🌐 Making HTTPS request to: ${url}`);
        
        const request = https.get(url, (response) => {
            let data = '';
            
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            response.on('end', () => {
                console.log(`📡 HTTPS response received, status: ${response.statusCode}`);
                try {
                    const parsedData = JSON.parse(data);
                    resolve(parsedData);
                } catch (parseError) {
                    reject(new Error(`Failed to parse JSON: ${parseError.message}`));
                }
            });
        });
        
        request.on('error', (error) => {
            console.error('❌ HTTPS request failed:', error.message);
            reject(error);
        });
        
        request.setTimeout(10000, () => {
            request.destroy();
            reject(new Error('Request timeout after 10 seconds'));
        });
    });
}

function upsertBookRecord(book) {
    if (!book || !book.isbn || book.isbn === 'No ISBN') return;
    db.run(
        `INSERT INTO books (isbn, title, author, cover_url, description, categories, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(isbn) DO UPDATE SET
            title = excluded.title,
            author = excluded.author,
            cover_url = excluded.cover_url,
            description = COALESCE(NULLIF(excluded.description, ''), books.description),
            categories = COALESCE(NULLIF(excluded.categories, ''), books.categories),
            updated_at = CURRENT_TIMESTAMP`,
        [
            book.isbn,
            book.title || 'Unknown Title',
            book.author || (Array.isArray(book.authors) ? book.authors.join(', ') : 'Unknown Author'),
            book.coverUrl || book.cover_url || '',
            book.description || '',
            Array.isArray(book.categories) ? book.categories.join(', ') : (book.categories || '')
        ]
    );
}

/**
 * Application startup sequence
 */
app.whenReady().then(async () => {
    console.log('🚀 Starting Kids Library Checkout Application...');
    
    try {
        // Initialize database first
        await initializeDatabase();
        console.log('✅ Database ready');
        
        // Then create the window
        createWindow();
        console.log('✅ Application started successfully');
        
    } catch (error) {
        console.error('❌ Failed to start application:', error);
        createWindow();
    }

    // macOS: Re-create window when dock icon is clicked
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

/**
 * Quit application when all windows are closed (except on macOS)
 */
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        if (db) {
            db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                } else {
                    console.log('✅ Database connection closed');
                }
            });
        }
        app.quit();
    }
});

// =============================================================================
// IPC (Inter-Process Communication) HANDLERS
// These functions allow secure communication between frontend and backend
// =============================================================================

/**
 * USER AUTHENTICATION: Verify login credentials
 */
ipcMain.handle('login-user', async (event, username, password) => {
    return new Promise((resolve, reject) => {
        if (!db) {
            resolve({ success: false, error: 'Database not ready. Please restart the application.' });
            return;
        }
        
        db.get(
            'SELECT * FROM users WHERE username = ?',
            [username],
            (err, row) => {
                if (err) {
                    console.error('❌ Login database error:', err.message);
                    resolve({ success: false, error: 'Database error during login' });
                } else if (row && verifyPassword(password, row.password)) {
                    if (isLegacyPlaintextPassword(row.password)) {
                        const upgradedHash = hashPassword(password);
                        db.run('UPDATE users SET password = ? WHERE id = ?', [upgradedHash, row.id]);
                    }
                    console.log(`✅ User logged in: ${username}`);
                    resolve({
                        success: true,
                        user: {
                            id: row.id,
                            username: row.username,
                            userType: row.userType
                        }
                    });
                } else {
                    console.log(`❌ Failed login attempt for: ${username}`);
                    resolve({ success: false, error: 'Invalid username or password' });
                }
            }
        );
    });
});

/**
 * USER REGISTRATION: Create new student accounts
 */
ipcMain.handle('register-user', async (event, username, password, userType = 'student') => {
    return new Promise((resolve, reject) => {
        if (!password || password.length < PASSWORD_MIN_LENGTH) {
            resolve({ success: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` });
            return;
        }

        db.run(
            'INSERT INTO users (username, password, userType) VALUES (?, ?, ?)',
            [username, hashPassword(password), userType],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        resolve({ success: false, error: 'Username already exists' });
                    } else {
                        console.error('❌ Registration error:', err.message);
                        resolve({ success: false, error: 'Registration failed: ' + err.message });
                    }
                } else {
                    console.log(`✅ New user registered: ${username}`);
                    resolve({ success: true, userId: this.lastID });
                }
            }
        );
    });
});

/**
 * BOOK SEARCH: Query Google Books API using Node.js https module
 */
ipcMain.handle('search-books', async (event, query) => {
    try {
        console.log(`🔍 Searching books for: "${query}"`);
        
        if (!query || query.trim().length === 0) {
            console.log('❌ Empty search query');
            return [];
        }

        const cleanQuery = query.trim();
        const apiUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(cleanQuery)}&maxResults=15&printType=books`;
        
        const data = await makeHttpsRequest(apiUrl);
        
        console.log(`📊 API response - Total items: ${data.totalItems || 0}`);
        
        if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
            console.log(`📭 No books found in API response for: "${query}"`);
            return [];
        }
        
        console.log(`✅ Found ${data.items.length} items in API response`);
        
        // Process each book
        const books = [];
        
        for (const item of data.items) {
            try {
                const volumeInfo = item.volumeInfo || {};
                
                // Skip items without basic info
                if (!volumeInfo.title) {
                    continue;
                }
                
                // Extract ISBN
                let isbn = 'No ISBN';
                if (volumeInfo.industryIdentifiers && volumeInfo.industryIdentifiers.length > 0) {
                    const isbn13 = volumeInfo.industryIdentifiers.find(id => id.type === 'ISBN_13');
                    const isbn10 = volumeInfo.industryIdentifiers.find(id => id.type === 'ISBN_10');
                    isbn = (isbn13 || isbn10 || volumeInfo.industryIdentifiers[0])?.identifier || 'No ISBN';
                }
                
                // Extract cover image
                let coverUrl = null;
                if (volumeInfo.imageLinks) {
                    coverUrl = volumeInfo.imageLinks.thumbnail || 
                              volumeInfo.imageLinks.smallThumbnail;
                }
                
                // Extract authors
                const authors = volumeInfo.authors || ['Unknown Author'];
                
                const book = {
                    title: volumeInfo.title,
                    authors: authors,
                    isbn: isbn,
                    description: volumeInfo.description || 'No description available',
                    publishedDate: volumeInfo.publishedDate || 'Unknown',
                    publisher: volumeInfo.publisher || 'Unknown',
                    coverUrl: coverUrl,
                    categories: volumeInfo.categories || []
                };
                
                console.log(`📖 Added: "${book.title}" by ${book.authors[0]}`);
                books.push(book);
                upsertBookRecord(book);
                
            } catch (itemError) {
                console.error('❌ Error processing book item:', itemError);
            }
        }
        
        console.log(`✅ Successfully processed ${books.length} books`);
        
        if (books.length === 0) {
            console.log(`❌ No valid books found after processing for: "${query}"`);
        }
        
        return books;
        
    } catch (error) {
        console.error('❌ Book search failed:', error.message);
        
        if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
            console.error('❌ Network error - cannot reach Google Books API');
            console.error('❌ Please check your internet connection');
        } else if (error.message.includes('timeout')) {
            console.error('❌ Request timeout - API is not responding');
        }
        
        return [];
    }
});

/**
 * SMART BOOK SUGGESTIONS: Get book recommendations based on age and interests
 */
ipcMain.handle('get-book-suggestions', async (event, age, interests = []) => {
    try {
        console.log(`📚 Getting book suggestions for age ${age}, interests: ${interests.join(', ')}`);
        
        // Age-appropriate book categories
        const ageCategories = {
            '5-7': ['picture books', 'early readers', 'animals', 'friendship'],
            '8-10': ['chapter books', 'adventure', 'mystery', 'fantasy'],
            '11-13': ['middle grade', 'science fiction', 'historical', 'coming of age']
        };

        // Determine age group
        let ageGroup = '8-10'; // default
        if (age >= 5 && age <= 7) ageGroup = '5-7';
        else if (age >= 8 && age <= 10) ageGroup = '8-10';
        else if (age >= 11 && age <= 13) ageGroup = '11-13';

        const categories = [...ageCategories[ageGroup], ...interests];
        const randomCategory = categories[Math.floor(Math.random() * categories.length)];
        
        const apiUrl = `https://www.googleapis.com/books/v1/volumes?q=subject:${encodeURIComponent(randomCategory)}&maxResults=8&printType=books&langRestrict=en`;
        
        const data = await makeHttpsRequest(apiUrl);
        
        if (!data.items || data.items.length === 0) {
            return [];
        }

        const suggestions = data.items.map(item => {
            const volumeInfo = item.volumeInfo || {};
            return {
                title: volumeInfo.title || 'Unknown Title',
                authors: volumeInfo.authors || ['Unknown Author'],
                isbn: volumeInfo.industryIdentifiers?.[0]?.identifier || 'No ISBN',
                description: volumeInfo.description || 'No description available',
                categories: volumeInfo.categories || [randomCategory],
                coverUrl: volumeInfo.imageLinks?.thumbnail,
                ageGroup: ageGroup,
                reason: `Recommended because you like ${randomCategory}`
            };
        }).filter(book => book.title !== 'Unknown Title');

        console.log(`✅ Generated ${suggestions.length} book suggestions`);
        return suggestions;

    } catch (error) {
        console.error('❌ Error getting book suggestions:', error.message);
        return [];
    }
});
/**
 * WORD HELPER - Using same method as Google Books API
 */
ipcMain.handle('get-word-help', async (event, word) => {
    try {
        console.log(`📖 Getting help for word: "${word}"`);
        
        if (!word || word.trim().length === 0) {
            return { success: false, error: 'Please enter a word' };
        }

        const cleanWord = word.trim().toLowerCase();
        const apiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`;
        
        console.log(`🌐 Calling Dictionary API: ${apiUrl}`);
        
        // Use the same function that works for Google Books
        const data = await makeHttpsRequest(apiUrl);
        
        console.log('📊 Dictionary API response received');
        
        if (!data || data.length === 0) {
            return { success: false, error: `Word "${word}" not found` };
        }

        // Check if it's an array of suggestions (when word not found)
        if (typeof data[0] === 'string') {
            return { 
                success: false, 
                error: `Word not found. Did you mean: ${data.slice(0, 3).join(', ')}?` 
            };
        }

        const wordData = data[0];
        const meanings = [];
        
        // Extract definitions
        if (wordData.meanings && Array.isArray(wordData.meanings)) {
            wordData.meanings.forEach(meaning => {
                if (meaning.definitions && Array.isArray(meaning.definitions)) {
                    meaning.definitions.slice(0, 2).forEach(def => {
                        meanings.push({
                            partOfSpeech: meaning.partOfSpeech || 'unknown',
                            definition: def.definition || 'No definition available'
                        });
                    });
                }
            });
        }

        // Get pronunciation
        let phonetic = wordData.phonetic || '';
        if (!phonetic && wordData.phonetics && wordData.phonetics.length > 0) {
            phonetic = wordData.phonetics[0].text || '';
        }

        // Get audio URL
        let audioUrl = '';
        if (wordData.phonetics && wordData.phonetics.length > 0) {
            const audioPhonetic = wordData.phonetics.find(p => p.audio && p.audio !== '');
            if (audioPhonetic && audioPhonetic.audio) {
                audioUrl = audioPhonetic.audio;
                if (audioUrl && !audioUrl.startsWith('http')) {
                    audioUrl = `https:${audioUrl}`;
                }
            }
        }

        const result = {
            success: true,
            word: wordData.word || cleanWord,
            phonetic: phonetic,
            meanings: meanings,
            audio: audioUrl,
            source: 'Dictionary API'
        };

        console.log(`✅ Found ${meanings.length} definitions for "${cleanWord}"`);
        return result;

    } catch (error) {
        console.error('❌ Dictionary API error:', error.message);
        
        // Provide helpful error message
        if (error.message.includes('fetch') || error.message.includes('network')) {
            return { 
                success: false, 
                error: 'Cannot connect to dictionary service. Please check your internet connection.' 
            };
        } else if (error.message.includes('timeout')) {
            return { 
                success: false, 
                error: 'Dictionary service is taking too long to respond. Please try again.' 
            };
        } else {
            return { 
                success: false, 
                error: 'Dictionary service unavailable. Please try a different word.' 
            };
        }
    }
});
/**
 * BOOK CHECKOUT: Record when a user borrows a book
 */
ipcMain.handle('checkout-book', async (event, userId, isbn, title, author, coverUrl) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO checkouts (user_id, isbn, title, author, cover_url) VALUES (?, ?, ?, ?, ?)',
            [userId, isbn, title, author, coverUrl],
            function(err) {
                if (err) {
                    console.error('❌ Checkout error:', err.message);
                    resolve({ success: false, error: 'Checkout failed: ' + err.message });
                } else {
                    upsertBookRecord({ isbn, title, author, coverUrl });
                    console.log(`✅ Book checked out: "${title}" by user ${userId}`);
                    resolve({ success: true, checkoutId: this.lastID });
                }
            }
        );
    });
});

/**
 * GET USER CHECKOUTS: Retrieve books borrowed by a specific user - PROPER UNIQUE BOOKS
 */
ipcMain.handle('get-user-checkouts', async (event, userId) => {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT 
                isbn,
                title,
                author,
                cover_url,
                checkout_date,
                due_date,
                returned,
                return_date
            FROM checkouts 
            WHERE user_id = ? 
            AND id IN (
                SELECT MAX(id) 
                FROM checkouts 
                WHERE user_id = ? 
                GROUP BY isbn
            )
            ORDER BY checkout_date DESC
        `, [userId, userId], (err, rows) => {
            if (err) {
                console.error('❌ Error fetching user checkouts:', err.message);
                resolve([]);
            } else {
                console.log(`✅ Found ${rows.length} unique books for user ${userId}`);
                resolve(rows);
            }
        });
    });
});

/**
 * GET ALL CHECKOUTS (Admin): Retrieve all checkouts with search and filtering
 */
ipcMain.handle('get-all-checkouts', async (event, searchQuery = '') => {
    return new Promise((resolve, reject) => {
        let sql = `
            SELECT c.*, u.username 
            FROM checkouts c 
            JOIN users u ON c.user_id = u.id 
        `;
        let params = [];
        
        // Add search filter if provided
        if (searchQuery && searchQuery.trim() !== '') {
            sql += ` WHERE u.username LIKE ? OR c.title LIKE ? OR c.author LIKE ?`;
            const searchTerm = `%${searchQuery.trim()}%`;
            params = [searchTerm, searchTerm, searchTerm];
        }
        
        sql += ` ORDER BY c.checkout_date DESC`;
        
        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('❌ Error fetching all checkouts:', err.message);
                resolve([]);
            } else {
                console.log(`✅ Found ${rows.length} checkouts for search: "${searchQuery}"`);
                resolve(rows);
            }
        });
    });
});

ipcMain.handle('get-all-users-detailed', async () => {
    return new Promise((resolve) => {
        db.all(
            'SELECT id, username, userType, createdAt FROM users ORDER BY createdAt DESC',
            [],
            (err, rows) => {
                if (err) {
                    console.error('❌ Error fetching users:', err.message);
                    resolve([]);
                } else {
                    resolve(rows);
                }
            }
        );
    });
});

ipcMain.handle('get-library-books', async () => {
    return new Promise((resolve) => {
        const sql = `
            SELECT
                b.id,
                b.isbn,
                b.title,
                b.author,
                b.cover_url AS coverUrl,
                b.description,
                b.categories,
                b.copies_total AS copiesTotal,
                MAX(b.copies_total - COALESCE(active.active_count, 0), 0) AS availableCopies
            FROM books b
            LEFT JOIN (
                SELECT isbn, COUNT(*) AS active_count
                FROM checkouts
                GROUP BY isbn
            ) active ON active.isbn = b.isbn
            GROUP BY b.id
            ORDER BY b.updated_at DESC
        `;
        db.all(sql, [], (err, rows) => {
            if (err) {
                console.error('❌ Error fetching library books:', err.message);
                resolve([]);
            } else {
                resolve(rows || []);
            }
        });
    });
});

ipcMain.handle('get-user-book-suggestions', async (event, userId) => {
    return new Promise((resolve) => {
        const suggestionsSql = `
            WITH user_history AS (
                SELECT DISTINCT isbn, title, author FROM checkouts WHERE user_id = ?
            ),
            stats AS (
                SELECT isbn, COUNT(*) AS checkout_count FROM checkouts GROUP BY isbn
            ),
            current_loans AS (
                SELECT isbn, COUNT(*) AS active_count FROM checkouts GROUP BY isbn
            )
            SELECT
                b.id,
                b.isbn,
                b.title,
                b.author,
                b.cover_url AS coverUrl,
                b.description,
                b.categories,
                COALESCE(stats.checkout_count, 0) AS checkoutCount,
                MAX(b.copies_total - COALESCE(current_loans.active_count, 0), 0) AS availableCopies,
                CASE
                    WHEN EXISTS (SELECT 1 FROM user_history uh WHERE LOWER(uh.author) = LOWER(b.author)) THEN 30
                    WHEN EXISTS (SELECT 1 FROM user_history uh WHERE uh.title != b.title AND (LOWER(b.title) LIKE '%' || LOWER(uh.title) || '%' OR LOWER(COALESCE(b.description, '')) LIKE '%' || LOWER(uh.title) || '%')) THEN 15
                    ELSE 0
                END
                + CASE WHEN MAX(b.copies_total - COALESCE(current_loans.active_count, 0), 0) > 0 THEN 10 ELSE 0 END
                + COALESCE(stats.checkout_count, 0) AS score
            FROM books b
            LEFT JOIN stats ON stats.isbn = b.isbn
            LEFT JOIN current_loans ON current_loans.isbn = b.isbn
            WHERE b.isbn NOT IN (SELECT isbn FROM user_history)
            GROUP BY b.id
            ORDER BY score DESC, b.updated_at DESC
            LIMIT 10
        `;

        db.all(suggestionsSql, [userId], (err, rows) => {
            if (err) {
                console.error('❌ Error loading suggestions:', err.message);
                resolve({ suggestions: [], popular: [] });
                return;
            }

            db.all(`
                SELECT b.id, b.isbn, b.title, b.author, b.cover_url AS coverUrl, b.description,
                       COALESCE(stats.checkout_count, 0) AS checkoutCount,
                       MAX(b.copies_total - COALESCE(active.active_count, 0), 0) AS availableCopies
                FROM books b
                LEFT JOIN (SELECT isbn, COUNT(*) AS checkout_count FROM checkouts GROUP BY isbn) stats ON stats.isbn = b.isbn
                LEFT JOIN (SELECT isbn, COUNT(*) AS active_count FROM checkouts GROUP BY isbn) active ON active.isbn = b.isbn
                GROUP BY b.id
                ORDER BY checkoutCount DESC, b.updated_at DESC
                LIMIT 10
            `, [], (popularErr, popularRows) => {
                if (popularErr) {
                    resolve({ suggestions: rows || [], popular: [] });
                    return;
                }
                resolve({ suggestions: rows || [], popular: popularRows || [] });
            });
        });
    });
});

/**
 * READ SOURCE FILE: Educational feature to show app source code
 */
ipcMain.handle('read-source-file', async (event, filename) => {
    try {
        const allowedFiles = ['main.js', 'renderer.js', 'preload.js', 'index.html'];
        
        if (!allowedFiles.includes(filename)) {
            return { success: false, error: 'File access not allowed' };
        }
        
        const content = await fs.promises.readFile(path.join(__dirname, filename), 'utf8');
        return { success: true, content };
        
    } catch (error) {
        console.error('❌ Error reading source file:', error.message);
        return { success: false, error: error.message };
    }
});

// =============================================================================
// ADMIN MANAGEMENT FUNCTIONS
// These functions are only available to admin users
// =============================================================================

/**
 * CHANGE USER TYPE: Convert between student and admin
 */
ipcMain.handle('change-user-type', async (event, userId, newType) => {
    return new Promise((resolve, reject) => {
        console.log(`🔄 Changing user ${userId} to type: ${newType}`);
        
        db.run(
            'UPDATE users SET userType = ? WHERE id = ?',
            [newType, userId],
            function(err) {
                if (err) {
                    console.error('❌ Error changing user type:', err.message);
                    resolve({ success: false, error: err.message });
                } else if (this.changes === 0) {
                    resolve({ success: false, error: 'User not found' });
                } else {
                    console.log(`✅ User ${userId} type changed to ${newType}`);
                    resolve({ success: true });
                }
            }
        );
    });
});

/**
 * CHANGE USER PASSWORD: Admin password reset
 */
ipcMain.handle('change-user-password', async (event, userId, newPassword) => {
    return new Promise((resolve, reject) => {
        console.log(`🔄 Admin password reset for user ${userId}`);

        if (!newPassword || newPassword.length < PASSWORD_MIN_LENGTH) {
            resolve({ success: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` });
            return;
        }
        
        db.run(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashPassword(newPassword), userId],
            function(err) {
                if (err) {
                    console.error('❌ Error changing password:', err.message);
                    resolve({ success: false, error: err.message });
                } else if (this.changes === 0) {
                    resolve({ success: false, error: 'User not found' });
                } else {
                    console.log(`✅ Password changed for user ${userId}`);
                    resolve({ success: true });
                }
            }
        );
    });
});

/**
 * DELETE USER: Remove user accounts (except admins)
 */
ipcMain.handle('delete-user', async (event, userId) => {
    return new Promise((resolve, reject) => {
        console.log(`🔄 Deleting user ${userId}`);
        
        // First check if user is admin
        db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
            if (err) {
                resolve({ success: false, error: err.message });
                return;
            }
            
            if (!user) {
                resolve({ success: false, error: 'User not found' });
                return;
            }
            
            if (user.userType === 'admin') {
                resolve({ success: false, error: 'Cannot delete admin users' });
                return;
            }
            
            // Delete the user
            db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
                if (err) {
                    console.error('❌ Error deleting user:', err.message);
                    resolve({ success: false, error: err.message });
                } else if (this.changes === 0) {
                    resolve({ success: false, error: 'User not found' });
                } else {
                    console.log(`✅ User ${userId} deleted`);
                    resolve({ success: true });
                }
            });
        });
    });
});

/**
 * RETURN BOOK: Mark a book as returned
 */
// RETURN BOOK: Hard-delete the checkout row by id (sqlite3 async)
ipcMain.handle('return-book', async (event, { checkoutId }) => {
  return new Promise((resolve) => {
    db.run('DELETE FROM checkouts WHERE id = ?', [checkoutId], function (err) {
      if (err) {
        console.error('❌ Error deleting checkout:', err.message);
        resolve({ success: false, error: err.message });
      } else {
        // this.changes === 1 when a row was deleted
        resolve({ success: this.changes === 1 });
      }
    });
  });
});


// =============================================================================
// READING TIMER FUNCTIONS
// =============================================================================

/**
 * START READING SESSION
 */
ipcMain.handle('start-reading-session', async (event, { userId, bookTitle = '' }) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO reading_sessions (user_id, book_title) VALUES (?, ?)',
            [userId, bookTitle],
            function(err) {
                if (err) {
                    console.error('❌ Error starting reading session:', err.message);
                    resolve({ success: false, error: err.message });
                } else {
                    console.log(`✅ Reading session started for user ${userId}`);
                    resolve({ success: true, sessionId: this.lastID });
                }
            }
        );
    });
});

/**
 * END READING SESSION
 */
ipcMain.handle('end-reading-session', async (event, { sessionId, pagesRead = 0 }) => {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE reading_sessions 
             SET end_time = CURRENT_TIMESTAMP,
                 duration_minutes = ROUND((JULIANDAY(CURRENT_TIMESTAMP) - JULIANDAY(start_time)) * 24 * 60),
                 pages_read = ?
             WHERE id = ? AND end_time IS NULL`,
            [pagesRead, sessionId],
            function(err) {
                if (err) {
                    console.error('❌ Error ending reading session:', err.message);
                    resolve({ success: false, error: err.message });
                } else if (this.changes === 0) {
                    resolve({ success: false, error: 'Session not found or already ended' });
                } else {
                    console.log(`✅ Reading session ${sessionId} ended`);
                    resolve({ success: true });
                }
            }
        );
    });
});

/**
 * SET READING GOAL
 */
ipcMain.handle('set-reading-goal', async (event, userId, goalType, targetMinutes, startDate, endDate) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO reading_goals (user_id, goal_type, target_minutes, start_date, end_date) VALUES (?, ?, ?, ?, ?)',
            [userId, goalType, targetMinutes, startDate, endDate],
            function(err) {
                if (err) {
                    console.error('❌ Error setting reading goal:', err.message);
                    resolve({ success: false, error: err.message });
                } else {
                    console.log(`✅ Reading goal set for user ${userId}`);
                    resolve({ success: true, goalId: this.lastID });
                }
            }
        );
    });
});

// =============================================================================
// GET DETAILED READING STATS
// =============================================================================
ipcMain.handle('get-reading-stats', async (event, userId) => {
    return new Promise((resolve) => {
        const query = `
            SELECT 
                COUNT(*) as totalSessions,
                SUM(duration_minutes) as totalMinutes,
                SUM(pages_read) as totalPages,
                AVG(duration_minutes) as avgMinutes,
                (
                    SELECT book_title 
                    FROM reading_sessions 
                    WHERE user_id = ? 
                    GROUP BY book_title 
                    ORDER BY COUNT(*) DESC 
                    LIMIT 1
                ) as mostReadBook,
                (
                    SELECT duration_minutes 
                    FROM reading_sessions 
                    WHERE user_id = ? 
                    ORDER BY end_time DESC 
                    LIMIT 1
                ) as lastSession
            FROM reading_sessions
            WHERE user_id = ?;
        `;

        db.get(query, [userId, userId, userId], (err, row) => {
            if (err) {
                resolve({ success: false, error: err.message });
            } else {
                resolve(row);
            }
        });
    });
});

console.log('✅ Main process loaded successfully');
