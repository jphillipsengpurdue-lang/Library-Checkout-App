/**
 * PRELOAD PROCESS - preload.js
 * 
 * This file acts as a secure bridge between the main process (backend) and 
 * renderer process (frontend). It exposes specific API functions to the 
 * frontend while maintaining security.
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose protected methods that allow the renderer process to use
 * the ipcRenderer without exposing the entire object
 */
contextBridge.exposeInMainWorld('electronAPI', {
    /**
     * USER MANAGEMENT FUNCTIONS
     */
    loginUser: (username, password) => ipcRenderer.invoke('login-user', username, password),
    registerUser: (username, password, userType) => ipcRenderer.invoke('register-user', username, password, userType),
    
    /**
     * BOOK MANAGEMENT FUNCTIONS  
     */
    searchBooks: (query) => ipcRenderer.invoke('search-books', query),
    checkoutBook: (userId, isbn, title, author, coverUrl) => ipcRenderer.invoke('checkout-book', userId, isbn, title, author, coverUrl),
    getUserCheckouts: (userId) => ipcRenderer.invoke('get-user-checkouts', userId),
    
    /**
     * ADMIN FUNCTIONS
     */
    getAllUsersDetailed: () => ipcRenderer.invoke('get-all-users-detailed'),
    getAllCheckouts: (searchQuery) => ipcRenderer.invoke('get-all-checkouts', searchQuery),
    changeUserType: (userId, newType) => ipcRenderer.invoke('change-user-type', userId, newType),
    changeUserPassword: (userId, newPassword) => ipcRenderer.invoke('change-user-password', userId, newPassword),
    changeOwnPassword: (payload) => ipcRenderer.invoke('change-own-password', payload),
    deleteUser: (userId) => ipcRenderer.invoke('delete-user', userId),
    returnBook: (checkoutId) => ipcRenderer.invoke('return-book', checkoutId),
    getLibraryBooks: () => ipcRenderer.invoke('get-library-books'),
    getUserBookSuggestions: (userId) => ipcRenderer.invoke('get-user-book-suggestions', userId),
    
    /**
     * EDUCATIONAL FUNCTIONS
     */
    readSourceFile: (filename) => ipcRenderer.invoke('read-source-file', filename),
    
    /**
     * NEW FEATURES
     */
    getBookSuggestions: (age, interests) => ipcRenderer.invoke('get-book-suggestions', age, interests),
    getWordHelp: (word) => ipcRenderer.invoke('get-word-help', word),
    startReadingSession: (userId, bookTitle) => ipcRenderer.invoke('start-reading-session', { userId, bookTitle }),
    endReadingSession: (sessionId, pagesRead) => ipcRenderer.invoke('end-reading-session', { sessionId, pagesRead }),
    setReadingGoal: (userId, goalType, targetMinutes, startDate, endDate) => ipcRenderer.invoke('set-reading-goal', userId, goalType, targetMinutes, startDate, endDate),
    getReadingStats: (userId) => ipcRenderer.invoke('get-reading-stats', userId)
});

/**
 * SECURITY NOTE:
 * By using contextBridge, we ensure that the frontend JavaScript
 * cannot access Node.js directly. This prevents potential security
 * vulnerabilities while still providing the functionality we need.
 */
