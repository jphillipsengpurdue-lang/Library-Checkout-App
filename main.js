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

/**
 * Global variables to hold our database and window references
 */
let db;
let mainWindow;

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
                
                // Create default admin account
                createDefaultAdmin()
                    .then(() => resolve())
                    .catch(err => reject(err));
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
                    ['admin', 'admin123', 'admin'],
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
                    coverUrl: coverUrl
                };
                
                console.log(`📖 Added: "${book.title}" by ${book.authors[0]}`);
                books.push(book);
                
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
            'SELECT * FROM users WHERE username = ? AND password = ?',
            [username, password],
            (err, row) => {
                if (err) {
                    console.error('❌ Login database error:', err.message);
                    resolve({ success: false, error: 'Database error during login' });
                } else if (row) {
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
        db.run(
            'INSERT INTO users (username, password, userType) VALUES (?, ?, ?)',
            [username, password, userType],
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
 * BOOK CHECKOUT: Record when a user borrows a book WITH LIMIT CHECK
 */
ipcMain.handle('checkout-book', async (event, userId, isbn, title, author, coverUrl) => {
    return new Promise((resolve, reject) => {
        // First check how many active checkouts the user has
        db.get(
            'SELECT COUNT(*) as active_count FROM checkouts WHERE user_id = ? AND returned = 0',
            [userId],
            (err, row) => {
                if (err) {
                    console.error('❌ Error checking active checkouts:', err.message);
                    resolve({ success: false, error: 'Checkout failed: ' + err.message });
                    return;
                }
                
                const MAX_CHECKOUTS = 1; // Set your limit here
                
                if (row.active_count >= MAX_CHECKOUTS) {
                    resolve({ 
                        success: false, 
                        error: `You cannot check out more than ${MAX_CHECKOUTS} books at a time. Please return some books first.` 
                    });
                    return;
                }
                
                // If under limit, proceed with checkout
                db.run(
                    'INSERT INTO checkouts (user_id, isbn, title, author, cover_url) VALUES (?, ?, ?, ?, ?)',
                    [userId, isbn, title, author, coverUrl],
                    function(err) {
                        if (err) {
                            console.error('❌ Checkout error:', err.message);
                            resolve({ success: false, error: 'Checkout failed: ' + err.message });
                        } else {
                            console.log(`✅ Book checked out: "${title}" by user ${userId}`);
                            resolve({ success: true, checkoutId: this.lastID });
                        }
                    }
                );
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
 * GET ALL USERS (Admin): Retrieve all users with detailed information
 */
ipcMain.handle('get-all-users-detailed', async (event) => {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM users ORDER BY createdAt DESC', (err, rows) => {
            if (err) {
                console.error('❌ Error fetching all users:', err.message);
                resolve([]);
            } else {
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
/**
 * DELETE CHECKOUT: Completely remove a checkout record from database
 */
ipcMain.handle('delete-checkout', async (event, checkoutId) => {
    return new Promise((resolve, reject) => {
        console.log(`🗑️ Deleting checkout record: ${checkoutId}`);
        
        db.run(
            'DELETE FROM checkouts WHERE id = ?',
            [checkoutId],
            function(err) {
                if (err) {
                    console.error('❌ Error deleting checkout:', err.message);
                    resolve({ success: false, error: err.message });
                } else if (this.changes === 0) {
                    resolve({ success: false, error: 'Checkout not found' });
                } else {
                    console.log(`✅ Checkout ${checkoutId} deleted from database`);
                    resolve({ success: true });
                }
            }
        );
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
        console.log(`🔄 Changing password for user ${userId}`);
        
        db.run(
            'UPDATE users SET password = ? WHERE id = ?',
            [newPassword, userId],
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
ipcMain.handle('return-book', async (event, checkoutId) => {
    return new Promise((resolve, reject) => {
        console.log(`🔄 Returning book with checkout ID: ${checkoutId}`);
        
        db.run(
            `UPDATE checkouts 
             SET returned = 1, return_date = CURRENT_TIMESTAMP 
             WHERE id = ? AND returned = 0`,
            [checkoutId],
            function(err) {
                if (err) {
                    console.error('❌ Error returning book:', err.message);
                    resolve({ success: false, error: err.message });
                } else if (this.changes === 0) {
                    resolve({ success: false, error: 'Checkout not found or already returned' });
                } else {
                    console.log(`✅ Book returned for checkout ID: ${checkoutId}`);
                    resolve({ success: true });
                }
            }
        );
    });
});

console.log('✅ Main process loaded successfully');