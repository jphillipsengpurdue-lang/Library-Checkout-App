/**
 * PRELOAD PROCESS - preload.js
 */

const { contextBridge, ipcRenderer } = require('electron');

const REMOTE_BASE_URL = (process.env.LIBRARY_SERVER_URL || '').trim();
const USE_REMOTE = Boolean(REMOTE_BASE_URL);

function buildUrl(path, query = {}) {
    const url = new URL(path, REMOTE_BASE_URL.endsWith('/') ? REMOTE_BASE_URL : `${REMOTE_BASE_URL}/`);
    Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
    return url.toString();
}

async function remoteGet(path, query = {}) {
    const response = await fetch(buildUrl(path, query));
    return response.json();
}

async function remotePost(path, body = {}) {
    const response = await fetch(buildUrl(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return response.json();
}

function apiCall(ipcChannel, remotePath, payloadBuilder, method = 'POST', queryBuilder) {
    return async (...args) => {
        if (!USE_REMOTE) {
            return ipcRenderer.invoke(ipcChannel, ...args);
        }

        if (method === 'GET') {
            return remoteGet(remotePath, queryBuilder ? queryBuilder(...args) : {});
        }

        return remotePost(remotePath, payloadBuilder ? payloadBuilder(...args) : {});
    };
}

contextBridge.exposeInMainWorld('electronAPI', {
    loginUser: apiCall('login-user', '/api/login-user', (username, password) => ({ username, password })),
    registerUser: apiCall('register-user', '/api/register-user', (name, username, password, userType) => ({ name, username, password, userType })),

    searchBooks: apiCall('search-books', '/api/search-books', null, 'GET', (query) => ({ query })),
    checkoutBook: apiCall('checkout-book', '/api/checkout-book', (userId, isbn, title, author, coverUrl) => ({ userId, isbn, title, author, coverUrl })),
    getUserCheckouts: apiCall('get-user-checkouts', '/api/get-user-checkouts', null, 'GET', (userId) => ({ userId })),

    getAllUsersDetailed: apiCall('get-all-users-detailed', '/api/get-all-users-detailed', null, 'GET'),
    getAllCheckouts: apiCall('get-all-checkouts', '/api/get-all-checkouts', null, 'GET', (searchQuery) => ({ searchQuery })),
    changeUserType: apiCall('change-user-type', '/api/change-user-type', (userId, newType) => ({ userId, newType })),
    changeUserPassword: apiCall('change-user-password', '/api/change-user-password', (userId, newPassword) => ({ userId, newPassword })),
    changeOwnPassword: apiCall('change-own-password', '/api/change-own-password', (payload) => ({ payload })),
    deleteUser: apiCall('delete-user', '/api/delete-user', (userId) => ({ userId })),
    returnBook: apiCall('return-book', '/api/return-book', (checkoutId) => ({ checkoutId })),
    getLibraryBooks: apiCall('get-library-books', '/api/get-library-books', null, 'GET'),
    getUserBookSuggestions: apiCall('get-user-book-suggestions', '/api/get-user-book-suggestions', null, 'GET', (userId) => ({ userId })),

    readSourceFile: apiCall('read-source-file', '/api/read-source-file', null, 'GET', (filename) => ({ filename })),

    getBookSuggestions: apiCall('get-book-suggestions', '/api/get-book-suggestions', (age, interests) => ({ age, interests })),
    getWordHelp: apiCall('get-word-help', '/api/get-word-help', (word) => ({ word })),
    startReadingSession: apiCall('start-reading-session', '/api/start-reading-session', (userId, bookTitle) => ({ userId, bookTitle })),
    endReadingSession: apiCall('end-reading-session', '/api/end-reading-session', (sessionId, pagesRead) => ({ sessionId, pagesRead })),
    setReadingGoal: apiCall('set-reading-goal', '/api/set-reading-goal', (userId, goalType, targetMinutes, startDate, endDate) => ({ userId, goalType, targetMinutes, startDate, endDate })),
    getReadingStats: apiCall('get-reading-stats', '/api/get-reading-stats', null, 'GET', (userId) => ({ userId }))
});
