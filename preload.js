/**
 * PRELOAD PROCESS - preload.js
 * 
 * This file acts as a secure bridge between the main process (backend) and 
 * renderer process (frontend). It exposes specific API functions to the 
 * frontend while maintaining security.
 * 
 * Why we need this:
 * - Prevents the frontend from having direct access to Node.js
 * - Controls exactly what functions the frontend can call
 * - Maintains security while allowing necessary functionality
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose protected methods that allow the renderer process to use
 * the ipcRenderer without exposing the entire object
 * 
 * This creates a safe API that the frontend can use to communicate
 * with the backend main process.
 */
contextBridge.exposeInMainWorld('electronAPI', {
    /**
     * USER MANAGEMENT FUNCTIONS
     * These handle user authentication and registration
     */
    loginUser: (username, password) => ipcRenderer.invoke('login-user', username, password),
    registerUser: (username, password, userType) => ipcRenderer.invoke('register-user', username, password, userType),
    
    /**
     * BOOK MANAGEMENT FUNCTIONS  
     * These handle book searching and checkout operations
     */
    searchBooks: (query) => ipcRenderer.invoke('search-books', query),
    checkoutBook: (userId, isbn, title, author, coverUrl) => ipcRenderer.invoke('checkout-book', userId, isbn, title, author, coverUrl),
    getUserCheckouts: (userId) => ipcRenderer.invoke('get-user-checkouts', userId),
    
    /**
     * ADMIN FUNCTIONS
     * These are only used by admin users for system management
     */
    getAllUsersDetailed: () => ipcRenderer.invoke('get-all-users-detailed'),
    getAllCheckouts: () => ipcRenderer.invoke('get-all-checkouts'),
    changeUserType: (userId, newType) => ipcRenderer.invoke('change-user-type', userId, newType),
    changeUserPassword: (userId, newPassword) => ipcRenderer.invoke('change-user-password', userId, newPassword),
    deleteUser: (userId) => ipcRenderer.invoke('delete-user', userId),
    returnBook: (checkoutId) => ipcRenderer.invoke('return-book', checkoutId),
    
    /**
     * EDUCATIONAL FUNCTIONS
     * These support the "learn to code" feature
     */
    readSourceFile: (filename) => ipcRenderer.invoke('read-source-file', filename)
});
contextBridge.exposeInMainWorld('electronAPI', {
    // ... your existing functions ...
    deleteCheckout: (checkoutId) => ipcRenderer.invoke('delete-checkout', checkoutId),
    // ... rest of your functions ...
});
/**
 * SECURITY NOTE:
 * By using contextBridge, we ensure that the frontend JavaScript
 * cannot access Node.js directly. This prevents potential security
 * vulnerabilities while still providing the functionality we need.
 */