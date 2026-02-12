/**
 * RENDERER PROCESS - renderer.js
 * 
 * This file contains all the frontend logic that runs in the browser window.
 * It handles:
 * - User interface interactions
 * - Form submissions
 * - Data display
 * - Communication with the backend via electronAPI
 * 
 * This code runs in a secure sandboxed environment without direct
 * access to Node.js or system resources.
 */

/**
 * GLOBAL APPLICATION STATE
 * Tracks the currently logged-in user throughout the app session
 */
let currentUser = null;
let libraryBooks = [];
let filteredLibraryBooks = [];
let lastLibraryReturnSection = 'welcomeSection';
let lastSuggestionReturnSection = 'welcomeSection';
let passwordTargetUserId = null;
let passwordTargetButton = null;

// =============================================================================
// UTILITY FUNCTIONS - Helper functions used throughout the application
// =============================================================================

/**
 * DEBUG LOGGING: Track function calls and application state
 * Helpful for troubleshooting when things don't work as expected
 */
function debugLog(message) {
    console.log('🔧 DEBUG:', message);
    // Also display debug info in the UI if debug panel is available
    const debugDiv = document.getElementById('adminDebug');
    const debugContent = document.getElementById('debugContent');
    if (debugDiv && debugContent) {
        debugDiv.style.display = 'block';
        debugContent.innerHTML += `<div>${new Date().toLocaleTimeString()}: ${message}</div>`;
    }
}

/**
 * TEST ADMIN FUNCTIONS: Verify that admin features are working
 * Useful for debugging admin panel issues
 */
function testAdminFunctions() {
    debugLog('Testing admin functions...');
    debugLog('loadAllUsers: ' + (typeof loadAllUsers));
    debugLog('loadAllCheckouts: ' + (typeof loadAllCheckouts));
    debugLog('currentUser: ' + (currentUser ? currentUser.username : 'null'));
}

// =============================================================================
// UI MANAGEMENT FUNCTIONS - Control what the user sees
// =============================================================================

/**
 * SHOW SECTION: Display one section while hiding all others
 * This creates a single-page application experience
 */
function showSection(sectionId) {
    // Hide all sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        section.style.display = 'none';
    });
    
    // Show the requested section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
    }
    
    // Toggle quick word helper visibility
    toggleQuickHelperBar(sectionId);
    
    // Update admin visibility when showing welcome section
    if (sectionId === 'welcomeSection' && currentUser) {
        updateAdminVisibility();
    }
    
    // Update navigation visibility
    const loggedInNav = document.getElementById('loggedInNav');
    const loggedInUserMenu = document.getElementById('loggedInUserMenu');
    const loggedOutNav = document.getElementById('loggedOutNav');

    const isLoggedInSection = sectionId !== 'loginSection' && sectionId !== 'registerSection';

    if (loggedInNav) loggedInNav.style.display = isLoggedInSection ? 'flex' : 'none';
    if (loggedInUserMenu) loggedInUserMenu.style.display = isLoggedInSection ? 'flex' : 'none';
    if (loggedOutNav) loggedOutNav.style.display = isLoggedInSection ? 'none' : 'block';

    // ⭐ Load reading stats when entering stats page
    if (sectionId === 'readingStatsSection') {
        loadReadingStats();
    }
}
/**
 * SHOW MESSAGE: Display feedback messages to the user
 * Different types: success (green), error (red), info (blue)
 */
function showMessage(containerId, message, type = 'success') {
    const element = document.getElementById(containerId);
    if (element) {
        element.textContent = message;
        element.className = `message ${type}`;
        element.style.display = 'block';
        
        // Auto-hide success messages after 3 seconds for cleaner UI
        if (type === 'success') {
            setTimeout(() => {
                element.style.display = 'none';
            }, 3000);
        }
    }
}
/**Manages admin card visibility based on user type */
function updateAdminVisibility() {
    const adminCards = document.getElementById('adminCards');
    const adminReturnCard = document.getElementById('adminReturnCard');
    
    // Only proceed if these elements exist on the current page
    if (adminCards) {
        if (currentUser && currentUser.userType === 'admin') {
            adminCards.style.display = 'block';
            if (adminReturnCard) {
                adminReturnCard.style.display = 'block';
            }
        } else {
            adminCards.style.display = 'none';
            if (adminReturnCard) {
                adminReturnCard.style.display = 'none';
            }
        }
    }
    // If elements don't exist, it's fine - they're just not on this page
}
/**
 * Toggle quick word helper bar visibility
 * Only show on login and register pages
 */
function toggleQuickHelperBar(sectionId) {
    const quickWordHelper = document.getElementById('quickWordHelper');
    
    if (!quickWordHelper) {
        console.log('❌ Quick word helper element not found');
        return;
    }
    
    // Show ONLY on login page, NOT register page
    if (sectionId === 'loginSection') {
        quickWordHelper.style.display = 'block';
        console.log('✅ Quick word helper shown on login page');
    } else {
        quickWordHelper.style.display = 'none';
        console.log('✅ Quick word helper hidden');
    }
}
// =============================================================================
// AUTHENTICATION FUNCTIONS - Handle user login and registration
// =============================================================================

/**
 * LOGIN: Authenticate user with username and password
 * Communicates with backend to verify credentials
 */
async function login() {
    // Get values from login form
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    
    // Validate that both fields are filled
    if (!username || !password) {
        showMessage('loginMessage', 'Please enter both username and password', 'error');
        return;
    }
    
    try {
        // Show loading message
        showMessage('loginMessage', 'Logging in...', 'info');
        
        // Call backend to verify credentials
        const result = await window.electronAPI.loginUser(username, password);
        
        if (result.success) {
            // Login successful - store user data and update UI
            currentUser = result.user;
            const welcomeUsername = document.getElementById('welcomeUsername');
            if (welcomeUsername) welcomeUsername.textContent = currentUser.username;
            
            // Update admin visibility
            updateAdminVisibility();
            
            // Clear sensitive form data
            document.getElementById('loginUsername').value = '';
            document.getElementById('loginPassword').value = '';
            document.getElementById('loginMessage').style.display = 'none';
            
            // Redirect based on user type
            if (currentUser.userType === 'admin') {
                showSection('adminSection');
            } else {
                showSection('welcomeSection');
            }
        } else {
            // Login failed - show error message
            showMessage('loginMessage', result.error, 'error');
        }
    } catch (error) {
        // Handle unexpected errors
        showMessage('loginMessage', 'Login error: ' + error.message, 'error');
    }
}

/**
 * REGISTER: Create new user account
 * Students can register themselves; only admins can create other admins
 */
async function register() {
    // Get values from registration form
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    
    // Validate that both fields are filled
    if (!username || !password) {
        showMessage('regMessage', 'Please enter both username and password', 'error');
        return;
    }
    
    try {
        // Show loading message
        showMessage('regMessage', 'Creating account...', 'info');
        
        // Call backend to create new user (defaults to student type)
        const result = await window.electronAPI.registerUser(username, password, 'student');
        
        if (result.success) {
            // Registration successful
            showMessage('regMessage', 'Account created! Redirecting to login...', 'success');
            
            // Clear form data
            document.getElementById('regUsername').value = '';
            document.getElementById('regPassword').value = '';
            
            // Redirect to login after short delay
            setTimeout(() => showSection('loginSection'), 2000);
        } else {
            // Registration failed
            showMessage('regMessage', result.error, 'error');
        }
    } catch (error) {
        // Handle unexpected errors
        showMessage('regMessage', 'Registration error: ' + error.message, 'error');
    }
}

/**
 * LOGOUT: Clear user session and return to login screen
 */
function logout() {
    currentUser = null;
    showSection('loginSection');
}

// =============================================================================
// BOOK MANAGEMENT FUNCTIONS - Handle book searching and checkout
// =============================================================================

/**
 * SEARCH BOOKS: Query Google Books API and display results
 * Students can search for books by title, author, or ISBN
 */
async function searchBooks() {
    // Check if user is logged in
    if (!currentUser) {
        showMessage('checkoutMessage', 'Please login first', 'error');
        showSection('loginSection');
        return;
    }
    
    // Get search query from input field
    const query = document.getElementById('bookSearchInput').value.trim();
    if (!query) {
        showMessage('checkoutMessage', 'Please enter a search term', 'error');
        return;
    }
    
    try {
        // Show loading message
        showMessage('checkoutMessage', 'Searching for books...', 'info');
        
        // Call backend to search Google Books API
        const results = await window.electronAPI.searchBooks(query);
        const container = document.getElementById('bookSearchResults');
        
        if (!container) {
            console.error('Book search results container not found');
            return;
        }
        
        // Clear previous results
        container.innerHTML = '';
        
        if (results.length === 0) {
            // No books found
            container.innerHTML = '<p>No books found. Try a different search term.</p>';
            showMessage('checkoutMessage', 'No books found', 'error');
            return;
        }
        
        // Display each book in the results
        results.forEach(book => {
            const bookElement = document.createElement('div');
            bookElement.className = 'checkout-item';
            bookElement.innerHTML = `
                <div style="display: flex; align-items: flex-start;">
                    <div class="book-cover">
                        ${book.coverUrl ? 
                            `<img src="${book.coverUrl}" style="width:100%;height:100%;object-fit:cover;" alt="${book.title}">` : 
                            '📖<br>No Cover'}
                    </div>
                    <div style="flex-grow: 1;">
                        <strong>${book.title}</strong><br>
                        <em>by ${book.authors?.join(', ') || 'Unknown Author'}</em><br>
                        <small>ISBN: ${book.isbn}</small><br>
                        <small>${book.description ? book.description.substring(0, 150) + '...' : 'No description available'}</small>
                    </div>
                    <div>
                        <button onclick="checkoutBook('${book.isbn}', '${book.title.replace(/'/g, "\\'")}', '${book.authors?.[0]?.replace(/'/g, "\\'") || 'Unknown'}', '${book.coverUrl || ''}')">
                            Check Out
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(bookElement);
        });
        
        // Show success message with result count
        showMessage('checkoutMessage', `Found ${results.length} book(s)`, 'success');
    } catch (error) {
        // Handle search errors
        console.error('Search error:', error);
        showMessage('checkoutMessage', 'Error searching for books: ' + error.message, 'error');
    }
}

/**
 * CHECKOUT BOOK: Borrow a book for the current user
 * Creates a checkout record with 7-day due date
 */
async function checkoutBook(isbn, title, author, coverUrl) {
    // Verify user is logged in
    if (!currentUser) {
        showMessage('checkoutMessage', 'Please login first', 'error');
        showSection('loginSection');
        return;
    }
    
    try {
        // Call backend to create checkout record
        const result = await window.electronAPI.checkoutBook(
            currentUser.id, 
            isbn, 
            title, 
            author, 
            coverUrl
        );
        
        if (result.success) {
            // Checkout successful
            showMessage('checkoutMessage', 'Book checked out successfully! Due in 7 days.', 'success');
            
            // Clear search form and results
            const searchInput = document.getElementById('bookSearchInput');
            if (searchInput) searchInput.value = '';
            const resultsContainer = document.getElementById('bookSearchResults');
            if (resultsContainer) resultsContainer.innerHTML = '';
        } else {
            // Checkout failed
            showMessage('checkoutMessage', result.error, 'error');
        }
    } catch (error) {
        // Handle checkout errors
        showMessage('checkoutMessage', 'Checkout error: ' + error.message, 'error');
    }
}

/**
 * Load and display user's checked out books - UNIQUE BOOKS ONLY
 */
async function loadMyCheckouts() {
    if (!currentUser) {
        showSection('loginSection');
        return;
    }
    
    try {
        console.log('🔄 Calling getUserCheckouts API for user:', currentUser.id);
        const checkouts = await window.electronAPI.getUserCheckouts(currentUser.id);
        console.log('📚 Raw checkouts data from API:', checkouts);
        
        const container = document.getElementById('checkoutsList');
        
        if (!container) {
            console.error('❌ Checkouts list container not found');
            return;
        }
        
        container.innerHTML = '';
        
        if (!checkouts || checkouts.length === 0) {
            container.innerHTML = '<p>No books checked out.</p>';
            console.log('✅ No books checked out');
        } else {
            console.log(`✅ Found ${checkouts.length} books to display`);
            checkouts.forEach((checkout, index) => {
                console.log(`📖 Book ${index + 1}:`, checkout);
                const element = document.createElement('div');
                element.className = 'checkout-item';
                element.innerHTML = `
                    <div style="display: flex; align-items: center;">
                        <div class="book-cover">
                            ${checkout.cover_url ? 
                                '<img src="' + checkout.cover_url + '" style="width:100%;height:100%;object-fit:cover;">' : 
                                '📖<br>No Cover'}
                        </div>
                        <div>
                            <strong>${checkout.title}</strong><br>
                            <em>by ${checkout.author}</em><br>
                            Due: ${new Date(checkout.due_date).toLocaleDateString()}
                            ${checkout.returned ? '<span style="color: green;">(Returned)</span>' : ''}
                        </div>
                    </div>
                `;
                container.appendChild(element);
            });
        }
        showSection('myCheckoutsSection');
    } catch (error) {
        console.error('❌ Error in loadMyCheckouts:', error);
        const container = document.getElementById('checkoutsList');
        if (container) container.innerHTML = '<p>Error loading books: ' + error.message + '</p>';
    }
}

// =============================================================================
// ADMIN FUNCTIONS - User management (admin only)
// =============================================================================

/**
 * LOAD ALL USERS: Display all users for admin management
 * Shows user details with management controls
 */
async function loadAllUsers() {
    try {
        debugLog('Loading all users...');
        
        // Call backend to get all users
        const users = await window.electronAPI.getAllUsersDetailed();
        const container = document.getElementById('usersList');
        
        if (!container) {
            console.error('Users list container not found');
            return;
        }
        
        debugLog(`Found ${users.length} users`);
        container.innerHTML = '';
        
        if (users.length === 0) {
            container.innerHTML = '<p>No users found.</p>';
        } else {
            // Create searchable user list with management controls
            container.innerHTML = `
                <div style="margin-bottom: 20px; display: flex; gap: 10px; align-items: center;">
                    <input type="text" id="userSearch" placeholder="🔍 Search users by username or ID..." 
                           style="padding: 10px; flex-grow: 1; border: 2px solid #cbd5e0; border-radius: 10px; font-size: 1.1em;"
                           onkeyup="filterUsers()">
                </div>
                <div id="usersContainer"></div>
            `;

            const usersContainer = document.getElementById('usersContainer');
            
            // Display each user with management options
            users.forEach(user => {
                const element = document.createElement('div');
                element.className = 'user-item';
                element.id = `user-${user.id}`;
                element.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex-grow: 1;">
                            <strong style="font-size: 1.2em;">${user.username}</strong>
                            <span class="user-type-badge ${user.userType}">
                                ${user.userType.toUpperCase()}
                            </span>
                            <br>
                            <small style="color: #718096;">
                                ID: ${user.id} | Joined: ${new Date(user.createdAt).toLocaleDateString()}
                            </small>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 5px; margin-left: 15px;">
                            <select onchange="changeUserType(${user.id}, this.value)" 
                                    style="padding: 5px; border-radius: 5px; border: 1px solid #cbd5e0;">
                                <option value="student" ${user.userType === 'student' ? 'selected' : ''}>Student</option>
                                <option value="admin" ${user.userType === 'admin' ? 'selected' : ''}>Admin</option>
                            </select>
                            
                            <button onclick="changeUserPassword(${user.id}, this)" 
                                    style="padding: 5px 10px; font-size: 0.8em; background: #d69e2e; color: white; border: none; border-radius: 5px; cursor: pointer;">
                                Change Password
                            </button>
                            
                            <button onclick="deleteUser(${user.id}, '${user.username}')" 
                                    style="padding: 5px 10px; font-size: 0.8em; background: #e53e3e; color: white; border: none; border-radius: 5px; cursor: pointer;"
                                    ${user.userType === 'admin' ? 'disabled title="Cannot delete admin users"' : ''}>
                                Delete User
                            </button>
                        </div>
                    </div>
                `;
                usersContainer.appendChild(element);
            });
        }
        
        // Show the users management section
        showSection('manageUsersSection');
        debugLog('Users section shown successfully');
        
    } catch (error) {
        debugLog('ERROR in loadAllUsers: ' + error.message);
        console.error('Error loading users:', error);
        const container = document.getElementById('usersList');
        if (container) {
            container.innerHTML = '<p>Error loading users: ' + error.message + '</p>';
            showSection('manageUsersSection');
        }
    }
}

/**
 * CHANGE USER TYPE: Convert between student and admin
 * Admin users can promote other users to admin status
 */
async function changeUserType(userId, newType) {
    // Confirm the action with the user
    if (!confirm(`Are you sure you want to change this user's type to ${newType}?`)) {
        return;
    }
    
    try {
        debugLog(`Changing user ${userId} to type: ${newType}`);
        
        // Call backend to update user type
        const result = await window.electronAPI.changeUserType(userId, newType);
        
        if (result.success) {
            showMessage('adminMessage', `User type changed to ${newType} successfully`, 'success');
            loadAllUsers(); // Refresh the user list
        } else {
            showMessage('adminMessage', `Error: ${result.error}`, 'error');
        }
    } catch (error) {
        debugLog('ERROR in changeUserType: ' + error.message);
        showMessage('adminMessage', 'Error changing user type: ' + error.message, 'error');
    }
}

/**
 * CHANGE USER PASSWORD: Admin password reset
 * Allows admins to reset passwords for any user
 */
function changeUserPassword(userId, buttonElement) {
    passwordTargetUserId = userId;
    passwordTargetButton = buttonElement || null;

    const passwordInput = document.getElementById('adminNewPassword');
    const confirmInput = document.getElementById('adminConfirmPassword');
    const modal = document.getElementById('adminPasswordModal');

    if (!passwordInput || !confirmInput || !modal) {
        showMessage('adminMessage', 'Password dialog is unavailable. Please restart the app.', 'error');
        return;
    }

    passwordInput.value = '';
    confirmInput.value = '';
    modal.style.display = 'flex';
    passwordInput.focus();
}

function closeAdminPasswordModal(event) {
    if (event && event.target && event.target.id !== 'adminPasswordModal') {
        return;
    }
    const modal = document.getElementById('adminPasswordModal');
    if (modal) modal.style.display = 'none';
    passwordTargetUserId = null;
    passwordTargetButton = null;
}

async function submitAdminPasswordChange() {
    if (!passwordTargetUserId) {
        showMessage('adminMessage', 'Please select a user before changing password.', 'error');
        return;
    }

    const passwordInput = document.getElementById('adminNewPassword');
    const confirmInput = document.getElementById('adminConfirmPassword');
    const modalButton = document.getElementById('adminSavePasswordBtn');
    const newPassword = passwordInput?.value || '';
    const confirmPassword = confirmInput?.value || '';

    if (!newPassword) {
        showMessage('adminMessage', 'Please enter a new password.', 'error');
        return;
    }
    if (newPassword.length < 6) {
        showMessage('adminMessage', 'Password must be at least 6 characters long.', 'error');
        return;
    }
    if (newPassword !== confirmPassword) {
        showMessage('adminMessage', 'Password confirmation does not match.', 'error');
        return;
    }

    try {
        if (modalButton) {
            modalButton.disabled = true;
            modalButton.textContent = 'Saving...';
        }
        if (passwordTargetButton) {
            passwordTargetButton.disabled = true;
            passwordTargetButton.textContent = 'Saving...';
        }

        const result = await window.electronAPI.changeUserPassword(passwordTargetUserId, newPassword);
        if (result.success) {
            showMessage('adminMessage', 'Password changed successfully', 'success');
            closeAdminPasswordModal();
            loadAllUsers();
        } else {
            showMessage('adminMessage', `Error: ${result.error}`, 'error');
        }
    } catch (error) {
        debugLog('ERROR in submitAdminPasswordChange: ' + error.message);
        showMessage('adminMessage', 'Error changing password: ' + error.message, 'error');
    } finally {
        if (modalButton) {
            modalButton.disabled = false;
            modalButton.textContent = 'Save Password';
        }
        if (passwordTargetButton) {
            passwordTargetButton.disabled = false;
            passwordTargetButton.textContent = 'Change Password';
        }
    }
}

/**
 * DELETE USER: Remove user accounts (except admins)
 * Safety feature: prevents deletion of admin accounts
 */
async function deleteUser(userId, username) {
    // Confirm deletion with the user
    if (!confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
        return;
    }
    
    try {
        debugLog(`Deleting user: ${username} (ID: ${userId})`);
        
        // Call backend to delete user
        const result = await window.electronAPI.deleteUser(userId);
        
        if (result.success) {
            showMessage('adminMessage', `User "${username}" deleted successfully`, 'success');
            loadAllUsers(); // Refresh the user list
        } else {
            showMessage('adminMessage', `Error: ${result.error}`, 'error');
        }
    } catch (error) {
        debugLog('ERROR in deleteUser: ' + error.message);
        showMessage('adminMessage', 'Error deleting user: ' + error.message, 'error');
    }
}

/**
 * FILTER USERS: Search through the user list
 * Makes it easier to find specific users in large lists
 */
function filterUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const userItems = document.querySelectorAll('.user-item');
    
    // Show/hide users based on search term
    userItems.forEach(item => {
        const username = item.querySelector('strong').textContent.toLowerCase();
        const userId = item.id.replace('user-', '');
        
        if (username.includes(searchTerm) || userId.includes(searchTerm)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

/**
async function showLibrarySection(returnSection = 'welcomeSection') {
    lastLibraryReturnSection = returnSection;
    const backBtn = document.getElementById('libraryBackBtn');
    if (backBtn) backBtn.setAttribute('onclick', `showSection('${returnSection}')`);
    showSection('librarySection');
    await loadLibraryBooks();
}

async function loadLibraryBooks() {
    libraryBooks = await window.electronAPI.getLibraryBooks();
    filteredLibraryBooks = [...libraryBooks];
    renderBookList('libraryList', filteredLibraryBooks);
}

function filterLibraryBooks() {
    const query = (document.getElementById('librarySearchInput')?.value || '').toLowerCase().trim();
    filteredLibraryBooks = libraryBooks.filter(book => {
        return [book.title, book.author, book.isbn].some(value => (value || '').toLowerCase().includes(query));
    });
    renderBookList('libraryList', filteredLibraryBooks);
}

async function showSuggestionsSection(returnSection = 'welcomeSection') {
    if (!currentUser) return;
    lastSuggestionReturnSection = returnSection;
    const backBtn = document.getElementById('suggestionsBackBtn');
    if (backBtn) backBtn.setAttribute('onclick', `showSection('${returnSection}')`);
    showSection('suggestionsSection');

    const response = await window.electronAPI.getUserBookSuggestions(currentUser.id);
    const suggestions = response.suggestions || [];
    const popular = response.popular || [];
    const list = suggestions.length > 0 ? suggestions : popular;

    const summary = document.getElementById('suggestionsSummary');
    if (summary) {
        summary.textContent = suggestions.length > 0
            ? 'Recommended based on your checkout history (author/topic overlap and availability).'
            : 'No personal history yet, showing popular books as a fallback.';
    }

    renderBookList('suggestionsList', list);
}

function renderBookList(containerId, books) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!books || books.length === 0) {
        container.innerHTML = '<p>No books available.</p>';
        return;
    }

    container.innerHTML = '';
    books.forEach(book => {
        const item = document.createElement('div');
        item.className = 'checkout-item book-list-item';
        item.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <div class="book-cover">${book.coverUrl ? `<img src="${book.coverUrl}" style="width:100%;height:100%;object-fit:cover;" alt="${book.title}">` : '📖'}</div>
                <div>
                    <strong>${book.title}</strong><br>
                    <em>${book.author || 'Unknown Author'}</em><br>
                    <small>ISBN: ${book.isbn || 'N/A'}</small>
                </div>
            </div>
        `;
        item.addEventListener('click', () => openBookDetail(book));
        container.appendChild(item);
    });
}

function openBookDetail(book) {
    const overlay = document.getElementById('bookDetailOverlay');
    const content = document.getElementById('bookDetailContent');
    if (!overlay || !content) return;
    content.innerHTML = `
        <div style="display:flex; gap:16px; align-items:flex-start;">
            <div class="book-cover" style="width:140px;height:190px;">
                ${book.coverUrl ? `<img src="${book.coverUrl}" style="width:100%;height:100%;object-fit:cover;" alt="${book.title}">` : '📖'}
            </div>
            <div>
                <h3 style="margin-top:0;">${book.title}</h3>
                <p><strong>Author:</strong> ${book.author || 'Unknown Author'}</p>
                <p><strong>ISBN:</strong> ${book.isbn || 'N/A'}</p>
                <p><strong>Available Copies:</strong> ${book.availableCopies ?? 'N/A'}</p>
                <p><strong>Description:</strong> ${book.description || 'No description available for this title yet.'}</p>
            </div>
        </div>
    `;
    overlay.style.display = 'flex';
}

function closeBookDetail(event) {
    if (event && event.target && event.target.id !== 'bookDetailOverlay') return;
    const overlay = document.getElementById('bookDetailOverlay');
    if (overlay) overlay.style.display = 'none';
}

// =============================================================================
// ADMIN FUNCTIONS - Checkout management (admin only)
// =============================================================================

/**
 * Load and display all checkouts with search functionality
 */
async function loadAllCheckouts(searchQuery = '') {
    try {
        debugLog('Loading all checkouts...');
        
        const checkouts = await window.electronAPI.getAllCheckouts(searchQuery);
        const container = document.getElementById('allCheckoutsList');
        
        if (!container) {
            debugLog('ERROR: allCheckoutsList container not found');
            return;
        }
        
        debugLog(`Found ${checkouts.length} checkouts`);
        
        // Create search bar and checkouts container
        container.innerHTML = `
            <div style="margin-bottom: 20px;">
                <input type="text" id="checkoutSearch" placeholder="🔍 Search by username, book title, or author..." 
                       value="${searchQuery}"
                       style="padding: 10px; width: 100%; border: 2px solid #cbd5e0; border-radius: 10px; font-size: 1.1em;"
                       onkeyup="debouncedSearchCheckouts()">
            </div>
            <div id="checkoutsContainer"></div>
        `;

        const checkoutsContainer = document.getElementById('checkoutsContainer');
        
        if (checkouts.length === 0) {
            checkoutsContainer.innerHTML = '<p>No checkouts found.</p>';
        } else {
            checkouts.forEach(checkout => {
                const element = document.createElement('div');
                element.className = 'checkout-item';
                element.id = `checkout-${checkout.id}`;
                element.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex-grow: 1;">
                            <strong>${checkout.title}</strong><br>
                            <em>by ${checkout.author}</em><br>
                            <small>
                                User: ${checkout.username} (ID: ${checkout.user_id}) | 
                                Due: ${new Date(checkout.due_date).toLocaleDateString()} |
                                Checked out: ${new Date(checkout.checkout_date).toLocaleDateString()}
                            </small>
                            ${checkout.returned ? '<br><span style="color: green;">✓ Returned on ' + new Date(checkout.return_date).toLocaleDateString() + '</span>' : ''}
                        </div>
			${!checkout.returned ? `
    				<button onclick="window.adminReturnBook(${checkout.id})" 
            				style="background: #48bb78; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; margin-left: 10px;">
        				Mark Returned
    				</button>
			` : ''}
                    </div>
                `;
                checkoutsContainer.appendChild(element);
            });
        }
        
        showSection('allCheckoutsSection');
        debugLog('All checkouts section shown successfully');
        
    } catch (error) {
        debugLog('ERROR in loadAllCheckouts: ' + error.message);
        console.error('Error loading checkouts:', error);
        const container = document.getElementById('allCheckoutsList');
        if (container) {
            container.innerHTML = '<p>Error loading checkouts: ' + error.message + '</p>';
            showSection('allCheckoutsSection');
        }
    }
}

/**
 * Debounced search function to prevent too many API calls
 */
let searchTimeout;
function debouncedSearchCheckouts() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const searchQuery = document.getElementById('checkoutSearch').value;
        loadAllCheckouts(searchQuery);
    }, 300); // Wait 300ms after user stops typing
}

/**
 * Admin return book function - WORKING VERSION
 */
async function adminReturnBook(checkoutId) {
    console.log(`🔄 Return button clicked for checkout ID: ${checkoutId}`);
    
    if (!confirm('Mark this book as returned and remove it from the list?')) {
        console.log('❌ User cancelled return');
        return;
    }
    
    try {
        debugLog(`Calling returnBook API for checkout ID: ${checkoutId}`);
        const result = await window.electronAPI.returnBook(checkoutId);
        
        console.log('📡 API response:', result);
        
        if (result.success) {
            showMessage('adminMessage', 'Book returned and removed from list', 'success');
            console.log(`✅ Book ${checkoutId} returned successfully`);
            
            // Remove the element from the display
            const returnedElement = document.getElementById(`checkout-${checkoutId}`);
            if (returnedElement) {
                console.log(`🗑️ Removing element: checkout-${checkoutId}`);
                returnedElement.remove();
                
                // Check if container is empty and show message
                const container = document.getElementById('checkoutsContainer');
                if (container && container.children.length === 0) {
                    container.innerHTML = '<p>No active checkouts found.</p>';
                }
            } else {
                console.log(`❌ Could not find element: checkout-${checkoutId}`);
            }
            
        } else {
            console.log(`❌ API returned error: ${result.error}`);
            showMessage('adminMessage', `Error: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('❌ Error in adminReturnBook:', error);
        debugLog('ERROR in adminReturnBook: ' + error.message);
        showMessage('adminMessage', 'Error returning book: ' + error.message, 'error');
    }
}
/**
 * Admin return book function with complete deletion from database
 */
async function adminReturnBook(checkoutId) {
    if (!confirm('Permanently delete this checkout record?')) {
        return;
    }
    
    try {
        debugLog(`Deleting checkout record: ${checkoutId}`);
        const result = await window.electronAPI.deleteCheckout(checkoutId);
        
        if (result.success) {
            showMessage('adminMessage', 'Checkout record permanently deleted', 'success');
            
            // Immediately remove from display
            const returnedElement = document.getElementById(`checkout-${checkoutId}`);
            if (returnedElement) {
                returnedElement.remove();
                
                // Update message if no more items
                const container = document.getElementById('checkoutsContainer');
                if (container && container.children.length === 0) {
                    container.innerHTML = '<p>No active checkouts found.</p>';
                }
            }
            
        } else {
            showMessage('adminMessage', `Error: ${result.error}`, 'error');
        }
    } catch (error) {
        debugLog('ERROR in adminReturnBook: ' + error.message);
        showMessage('adminMessage', 'Error deleting checkout: ' + error.message, 'error');
    }
}
/**
 * Quick word helper for login page - UPDATED FOR NEW FORMAT
 */
async function quickWordHelp() {
    const word = document.getElementById('quickWordInput').value.trim();
    
    if (!word) {
        const container = document.getElementById('quickWordResult');
        container.innerHTML = '<p style="color: #e53e3e;">Please enter a word</p>';
        return;
    }
    
    try {
        const container = document.getElementById('quickWordResult');
        container.innerHTML = '<p>🔍 Looking up word...</p>';
        
        const result = await window.electronAPI.getWordHelp(word);
        console.log('Word help result:', result);
        
        if (result.success) {
            const hasMeanings = result.meanings && result.meanings.length > 0;
            
            container.innerHTML = `
                <div style="background: #e6fffa; padding: 15px; border-radius: 5px; border: 1px solid #81e6d9;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div>
                            <strong style="font-size: 1.3em;">${result.word}</strong> 
                            ${result.phonetic ? `<br><small style="color: #666;">Pronunciation: ${result.phonetic}</small>` : ''}
                        </div>
                        <div>
                            <button onclick="speakWord('${result.word.replace(/'/g, "\\'")}')" 
                                    style="background: #4299e1; color: white; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; margin-left: 5px;">
                                🔊 Speak
                            </button>
                        </div>
                    </div>
                    
                    ${hasMeanings ? `
                        <div style="background: white; padding: 10px; border-radius: 3px;">
                            <strong>Definitions:</strong>
                            ${result.meanings.map(meaning => `
                                <div style="margin: 8px 0; padding: 5px; border-left: 3px solid #4299e1;">
                                    <em style="color: #667eea; font-style: italic;">${meaning.partOfSpeech}</em>
                                    <div style="margin-top: 3px;">${meaning.definition}</div>
                                </div>
                            `).join('')}
                            <small style="color: #666; display: block; margin-top: 8px;">Source: ${result.source}</small>
                        </div>
                    ` : `
                        <div style="background: #fff3cd; padding: 10px; border-radius: 3px; border: 1px solid #ffeaa7;">
                            <p style="margin: 0; color: #856404;">Definition not available, but you can still hear the pronunciation!</p>
                        </div>
                    `}
                </div>
            `;
            
        } else {
            container.innerHTML = `
                <div style="background: #fed7d7; padding: 15px; border-radius: 5px; border: 1px solid #feb2b2;">
                    <p style="color: #742a2a; margin: 0 0 10px 0;">${result.error}</p>
                    <button onclick="speakWord('${word.replace(/'/g, "\\'")}')" 
                            style="background: #4299e1; color: white; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer;">
                        🔊 Speak "${word}" anyway
                    </button>
                </div>
            `;
        }
    } catch (error) {
        const container = document.getElementById('quickWordResult');
        container.innerHTML = `
            <div style="background: #fed7d7; padding: 15px; border-radius: 5px; border: 1px solid #feb2b2;">
                <p style="color: #742a2a; margin: 0 0 10px 0;">Error: ${error.message}</p>
                <button onclick="speakWord('${word.replace(/'/g, "\\'")}')" 
                        style="background: #4299e1; color: white; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer;">
                    🔊 Speak "${word}" anyway
                </button>
            </div>
        `;
    }
}
/**
 * Text-to-speech function - FIXED VERSION
 */
function speakWord(word) {
    if (!word) return;
    
    console.log(`🔊 Attempting to speak: "${word}"`);
    
    // Check if browser supports speech synthesis
    if ('speechSynthesis' in window) {
        // Stop any current speech
        window.speechSynthesis.cancel();
        
        // Create speech request
        const utterance = new SpeechSynthesisUtterance(word);
        
        // Configure voice settings for clear pronunciation
        utterance.rate = 0.8; // Slower for clarity
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        // Get available voices
        const voices = window.speechSynthesis.getVoices();
        console.log('Available voices:', voices.length);
        
        // Try to use a clear English voice
        const englishVoice = voices.find(voice => 
            voice.lang.startsWith('en') && voice.name.includes('Female')
        ) || voices.find(voice => voice.lang.startsWith('en'));
        
        if (englishVoice) {
            utterance.voice = englishVoice;
            console.log(`Using voice: ${englishVoice.name}`);
        }
        
        // Add event listeners for debugging
        utterance.onstart = () => console.log('🎵 Speech started');
        utterance.onend = () => console.log('🎵 Speech ended');
        utterance.onerror = (event) => console.error('🎵 Speech error:', event.error);
        
        // Speak the word
        window.speechSynthesis.speak(utterance);
        
    } else {
        console.error('❌ Text-to-speech not supported');
        alert('Text-to-speech not supported in this browser.');
    }
}

/**
 * Play audio from URL
 */
function playAudio(audioUrl) {
    console.log(`🎵 Playing audio from: ${audioUrl}`);
    const audio = new Audio(audioUrl);
    audio.play().catch(error => {
        console.error('❌ Audio playback failed:', error);
        alert('Could not play audio. Trying text-to-speech instead.');
        // Extract word from URL or use the displayed word
        const wordElement = document.querySelector('#quickWordResult strong');
        if (wordElement) {
            speakWord(wordElement.textContent);
        }
    });
}

/**
 * Initialize speech synthesis
 */
function initSpeechSynthesis() {
    if ('speechSynthesis' in window) {
        // Load voices
        const loadVoices = () => {
            const voices = window.speechSynthesis.getVoices();
            console.log(`✅ ${voices.length} speech voices loaded`);
        };
        
        window.speechSynthesis.onvoiceschanged = loadVoices;
        loadVoices(); // Initial load
    } else {
        console.error('❌ Speech synthesis not supported');
    }
}
// =============================================================================
// ADMIN FUNCTIONS - Book management (admin only)
// =============================================================================

/**
 * SHOW BOOK MANAGEMENT: Display the book management interface
 * Admin tool for searching and viewing book information
 */
function showBookManagement() {
    debugLog('Showing book management section...');
    
    // Show the book management section
    showSection('bookManagementSection');
    
    // Clear previous search results
    const container = document.getElementById('adminBookResults');
    if (container) {
        container.innerHTML = '';
    }
    
    // Focus on search input for better user experience
    setTimeout(() => {
        const searchInput = document.getElementById('adminBookSearch');
        if (searchInput) {
            searchInput.focus();
            debugLog('Search input focused');
        }
    }, 100);
    
    debugLog('Book management section shown successfully');
}

/**
 * ADMIN SEARCH BOOKS: Search for books (admin version)
 * Same as student search but with different display options
 */
async function adminSearchBooks() {
    debugLog('Admin searching books...');
    
    // Get search query
    const query = document.getElementById('adminBookSearch').value.trim();
    if (!query) {
        debugLog('No search query provided');
        alert('Please enter a search term');
        return;
    }
    
    try {
        debugLog('Searching for: ' + query);
        
        // Call backend to search books
        const results = await window.electronAPI.searchBooks(query);
        const container = document.getElementById('adminBookResults');
        
        if (!container) {
            console.error('Admin book results container not found');
            return;
        }
        
        debugLog(`Found ${results.length} results`);
        container.innerHTML = '';
        
        if (results.length === 0) {
            container.innerHTML = '<p>No books found.</p>';
        } else {
            // Display book results (admin view has more details)
            results.forEach(book => {
                const bookElement = document.createElement('div');
                bookElement.className = 'checkout-item';
                bookElement.innerHTML = `
                    <div style="display: flex; align-items: flex-start;">
                        <div class="book-cover">
                            ${book.coverUrl ? 
                                `<img src="${book.coverUrl}" style="width:100%;height:100%;object-fit:cover;" alt="${book.title}">` : 
                                '📖<br>No Cover'}
                        </div>
                        <div style="flex-grow: 1;">
                            <strong>${book.title}</strong><br>
                            <em>by ${book.authors?.join(', ') || 'Unknown Author'}</em><br>
                            <small>ISBN: ${book.isbn}</small><br>
                            <small>Published: ${book.publishedDate || 'Unknown'}</small><br>
                            <small>Publisher: ${book.publisher || 'Unknown'}</small><br>
                            <small>${book.description ? book.description.substring(0, 200) + '...' : 'No description available'}</small>
                        </div>
                    </div>
                `;
                container.appendChild(bookElement);
            });
        }
        
        debugLog('Book search completed successfully');
        
    } catch (error) {
        debugLog('ERROR in adminSearchBooks: ' + error.message);
        console.error('Admin book search error:', error);
        const container = document.getElementById('adminBookResults');
        if (container) {
            container.innerHTML = '<p>Error searching for books: ' + error.message + '</p>';
        }
    }
}

// =============================================================================
// EDUCATIONAL FUNCTIONS - Source code viewer
// =============================================================================

/**
 * VIEW SOURCE FILE: Display app source code for learning
 * Educational feature that teaches kids how the app works
 */
async function viewSourceFile(filename) {
    try {
        console.log('Loading source file:', filename);
        
        // Call backend to read source file
        const sourceCode = await window.electronAPI.readSourceFile(filename);
        
        if (sourceCode.success) {
            // Hide file list and show code viewer
            const fileList = document.getElementById('sourceFileList');
            const codeViewer = document.getElementById('sourceCodeViewer');
            const codeContent = document.getElementById('sourceCodeContent');
            const fileTitle = document.getElementById('currentFileTitle');
            
            if (fileList) fileList.style.display = 'none';
            if (codeViewer) codeViewer.style.display = 'block';
            if (fileTitle) fileTitle.textContent = filename;
            if (codeContent) {
                // Apply basic syntax highlighting
                const highlightedCode = syntaxHighlight(sourceCode.content);
                codeContent.innerHTML = highlightedCode;
            }
        } else {
            alert('Error loading file: ' + sourceCode.error);
        }
    } catch (error) {
        console.error('Error viewing source file:', error);
        alert('Error: ' + error.message);
    }
}

/**
 * HIDE SOURCE VIEWER: Return to file selection
 * Navigates back from code view to file list
 */
function hideSourceViewer() {
    const fileList = document.getElementById('sourceFileList');
    const codeViewer = document.getElementById('sourceCodeViewer');
    
    if (fileList) fileList.style.display = 'block';
    if (codeViewer) codeViewer.style.display = 'none';
}

/**
 * SYNTAX HIGHLIGHTING: Add colors to code for better readability
 * Basic highlighting for educational purposes
 */
function syntaxHighlight(code) {
    if (!code) return '';
    
    // Simple regex-based syntax highlighting
    return code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')
        .replace(/\s/g, '&nbsp;')
        .replace(/(\/\/.*?)(<br>|$)/g, '<span style="color: green;">$1</span>$2')
        .replace(/(\b(function|const|let|var|if|else|for|while|return|async|await|try|catch|import|export|from)\b)/g, '<span style="color: blue;">$1</span>')
        .replace(/(".*?"|'.*?')/g, '<span style="color: orange;">$1</span>');
}
/**
 * Admin return book function - GLOBAL SCOPE VERSION
 */
window.adminReturnBook = async function(checkoutId) {
    console.log('🎯 ADMIN RETURN BOOK CALLED WITH ID:', checkoutId);
    
    // Immediate feedback
    const button = event?.target || document.querySelector(`[onclick*="${checkoutId}"]`);
    if (button) {
        button.style.background = '#e53e3e';
        button.textContent = 'Returning...';
        button.disabled = true;
    }
    
    if (!confirm('Mark this book as returned and remove it from the list?')) {
        if (button) {
            button.style.background = '#48bb78';
            button.textContent = 'Mark Returned';
            button.disabled = false;
        }
        return;
    }
    
    try {
        console.log('📡 Calling returnBook API...');
        const result = await window.electronAPI.returnBook(checkoutId);
        console.log('📡 API Response:', result);
        
        if (result.success) {
            showMessage('adminMessage', 'Book returned successfully!', 'success');
            
            // Remove the element with animation
            const element = document.getElementById(`checkout-${checkoutId}`);
            if (element) {
                element.style.transition = 'all 0.3s ease';
                element.style.opacity = '0';
                element.style.transform = 'translateX(-100%)';
                
                setTimeout(() => {
                    element.remove();
                    
                    // Update if no items left
                    const container = document.getElementById('checkoutsContainer');
                    if (container && container.children.length === 0) {
                        container.innerHTML = '<p>No active checkouts found.</p>';
                    }
                }, 300);
            }
        } else {
            showMessage('adminMessage', `Error: ${result.error}`, 'error');
            if (button) {
                button.style.background = '#48bb78';
                button.textContent = 'Mark Returned';
                button.disabled = false;
            }
        }
    } catch (error) {
        console.error('❌ Error:', error);
        showMessage('adminMessage', 'Error: ' + error.message, 'error');
        if (button) {
            button.style.background = '#48bb78';
            button.textContent = 'Mark Returned';
            button.disabled = false;
        }
    }
};
let activeReadingSession = null;
let readingStartTime = null;
let readingInterval = null;

// Update stopwatch display
function updateStopwatch() {
    const now = Date.now();
    const elapsedMs = now - readingStartTime;
    const sec = Math.floor(elapsedMs / 1000) % 60;
    const min = Math.floor(elapsedMs / 60000);

    document.getElementById('readingResults').innerHTML =
        `<p><strong>Timer:</strong> ${min}m ${sec}s</p>`;
}

async function startReadingTimer() {
    if (!currentUser) {
        showMessage('readingStatus', 'Please log in first', 'error');
        return;
    }

    const title = document.getElementById('readingBookTitle').value.trim();

    // Start backend session
    const result = await window.electronAPI.startReadingSession(currentUser.id, title);

    if (result.success) {
        activeReadingSession = result.sessionId;
        readingStartTime = Date.now();
        console.log("START SESSION RESULT:", result);
        console.log("SESSION ID WE SAVED:", activeReadingSession);
        // Start stopwatch
        readingInterval = setInterval(updateStopwatch, 1000);

        showMessage('readingStatus', '⏱️ Reading session started!', 'success');
        document.getElementById('startReadingBtn').style.display = 'none';
        document.getElementById('stopReadingBtn').style.display = 'inline-block';
        document.getElementById('pagesReadContainer').style.display = 'block';
        document.getElementById('pauseReadingBtn').style.display = 'inline-block';
        document.getElementById('resumeReadingBtn').style.display = 'none';

    } else {
        showMessage('readingStatus', 'Error starting session', 'error');
    }
}
let isPaused = false;
let pausedAt = null;

// Pause the timer
function pauseReadingTimer() {
    if (!readingInterval) return;

    clearInterval(readingInterval);
    readingInterval = null;
    isPaused = true;
    pausedAt = Date.now();

    showMessage('readingStatus', '⏸️ Reading paused.', 'info');

    document.getElementById('pauseReadingBtn').style.display = 'none';
    document.getElementById('resumeReadingBtn').style.display = 'inline-block';
}

// Resume the timer
function resumeReadingTimer() {
    if (!isPaused) return;

    // Adjust start time so paused time is not counted
    const pausedDuration = Date.now() - pausedAt;
    readingStartTime += pausedDuration;

    readingInterval = setInterval(updateStopwatch, 1000);

    isPaused = false;
    pausedAt = null;

    showMessage('readingStatus', '▶️ Reading resumed!', 'success');

    document.getElementById('resumeReadingBtn').style.display = 'none';
    document.getElementById('pauseReadingBtn').style.display = 'inline-block';
}
async function stopReadingTimer() {
    console.log("STOP BUTTON CLICKED");

    if (!activeReadingSession) {
        showMessage('readingStatus', 'No active reading session was found', 'error');
        return;
    }

    // Stop stopwatch
    clearInterval(readingInterval);

    // Read pages from the input box
    const pg = parseInt(document.getElementById('pagesReadInput').value || "0");

    // End backend session
    const result = await window.electronAPI.endReadingSession(activeReadingSession, pg);
    console.log("RESULT FROM BACKEND:", result);

    if (result.success) {
        showMessage('readingStatus', '📘 Reading session saved!', 'success');
        document.getElementById('readingResults').innerHTML +=
            `<p><strong>Session saved.</strong> Pages read: ${pg}</p>`;
    } else {
        showMessage('readingStatus', 'Error ending session', 'error');
    }

    // UI RESET — This is the part you asked about
    activeReadingSession = null;

    document.getElementById('startReadingBtn').style.display = 'inline-block';
    document.getElementById('stopReadingBtn').style.display = 'none';
    document.getElementById('pagesReadContainer').style.display = 'none';
    document.getElementById('pagesReadInput').value = "";
    document.getElementById('pauseReadingBtn').style.display = 'none';
    document.getElementById('resumeReadingBtn').style.display = 'none';
    isPaused = false;
    pausedAt = null;
}
async function loadReadingStats() {
    if (!currentUser) return;

    const stats = await window.electronAPI.getReadingStats(currentUser.id);

    document.getElementById('readingStatsContent').innerHTML = `
        <p><strong>Total Sessions:</strong> ${stats.totalSessions}</p>
        <p><strong>Total Minutes:</strong> ${stats.totalMinutes}</p>
        <p><strong>Total Pages:</strong> ${stats.totalPages}</p>
        <p><strong>Average Session Length:</strong> ${stats.avgMinutes} minutes</p>
        <p><strong>Most Read Book:</strong> ${stats.mostReadBook || "N/A"}</p>
        <p><strong>Last Session:</strong> ${stats.lastSession || "N/A"}</p>
    `;
}
// =============================================================================
// APPLICATION INITIALIZATION
// =============================================================================

/**
 * INITIALIZE APP: Set up event listeners when page loads
 * This runs when the HTML document is fully loaded and ready
/**
 * Initialize app when page loads
 */
document.addEventListener('DOMContentLoaded', function() {
    // Start with login section
    showSection('loginSection');
    
    // Enter key support for forms
    const loginPassword = document.getElementById('loginPassword');
    const regPassword = document.getElementById('regPassword');
    const bookSearchInput = document.getElementById('bookSearchInput');
    const adminBookSearch = document.getElementById('adminBookSearch');
    const userSearch = document.getElementById('userSearch');
    const checkoutSearch = document.getElementById('checkoutSearch');
    
    if (loginPassword) {
        loginPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') login();
        });
    }
    
    if (regPassword) {
        regPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') register();
        });
    }
    
    if (bookSearchInput) {
        bookSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchBooks();
        });
    }
    
    if (adminBookSearch) {
        adminBookSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') adminSearchBooks();
        });
    }
    
    if (userSearch) {
        userSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') filterUsers();
        });
    }
    
    if (checkoutSearch) {
        checkoutSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const searchQuery = document.getElementById('checkoutSearch').value;
                loadAllCheckouts(searchQuery);
            }
        });
    }
    document.addEventListener('DOMContentLoaded', function() {
    	// Start with login section
    	showSection('loginSection');
    
   	 // Initialize speech synthesis
    	initSpeechSynthesis();
    
    	// ... rest of your existing DOMContentLoaded code ...
    });
    console.log('✅ Renderer script loaded successfully');
    debugLog('Application initialized');
});
