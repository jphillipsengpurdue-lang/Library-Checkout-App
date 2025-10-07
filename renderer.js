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
    // First hide all sections to ensure only one is visible
    document.querySelectorAll('.section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Then show the requested section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
    }
    
    // Special setup for sections that need extra initialization
    if (sectionId === 'checkoutSection') {
        // Focus on search input for better user experience
        setTimeout(() => {
            const searchInput = document.getElementById('bookSearchInput');
            if (searchInput) searchInput.focus();
        }, 100);
    }
    
    // Show admin button only if current user is an admin
    const adminButtonContainer = document.getElementById('adminButtonContainer');
    if (adminButtonContainer) {
        if (currentUser && currentUser.userType === 'admin') {
            adminButtonContainer.style.display = 'block';
        } else {
            adminButtonContainer.style.display = 'none';
        }
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
        const checkouts = await window.electronAPI.getUserCheckouts(currentUser.id);
        const container = document.getElementById('checkoutsList');
        
        if (!container) {
            console.error('Checkouts list container not found');
            return;
        }
        
        container.innerHTML = '';
        
        if (checkouts.length === 0) {
            container.innerHTML = '<p>No books checked out.</p>';
        } else {
            checkouts.forEach(checkout => {
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
                            Due: ${new Date(checkout.current_due_date).toLocaleDateString()}
                            ${checkout.returned ? '<span style="color: green;">(Returned)</span>' : ''}
                        </div>
                    </div>
                `;
                container.appendChild(element);
            });
        }
        showSection('myCheckoutsSection');
    } catch (error) {
        console.error('Error loading checkouts:', error);
        const container = document.getElementById('checkoutsList');
        if (container) container.innerHTML = '<p>Error loading books.</p>';
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
                    <button onclick="showActualPasswords()" 
                            style="padding: 10px 15px; background: #4a5568; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        👁️ Show All Passwords
                    </button>
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
                                ID: ${user.id} | 
                                Password: <span class="password-field">••••••••</span>
                                <button class="toggle-password" onclick="togglePasswordVisibility(${user.id}, '${user.password}')" 
                                        style="margin-left: 5px; background: none; border: 1px solid #cbd5e0; border-radius: 3px; cursor: pointer; font-size: 0.8em; padding: 2px 6px;">
                                    👁️ Show
                                </button>
                                | Joined: ${new Date(user.createdAt).toLocaleDateString()}
                            </small>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 5px; margin-left: 15px;">
                            <select onchange="changeUserType(${user.id}, this.value)" 
                                    style="padding: 5px; border-radius: 5px; border: 1px solid #cbd5e0;">
                                <option value="student" ${user.userType === 'student' ? 'selected' : ''}>Student</option>
                                <option value="admin" ${user.userType === 'admin' ? 'selected' : ''}>Admin</option>
                            </select>
                            
                            <button onclick="changeUserPassword(${user.id})" 
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
async function changeUserPassword(userId) {
    // Prompt for new password
    const newPassword = prompt('Enter new password for this user:');
    if (!newPassword) {
        return;
    }
    
    // Validate password length
    if (newPassword.length < 3) {
        alert('Password must be at least 3 characters long');
        return;
    }
    
    try {
        debugLog(`Changing password for user ${userId}`);
        
        // Call backend to update password
        const result = await window.electronAPI.changeUserPassword(userId, newPassword);
        
        if (result.success) {
            showMessage('adminMessage', 'Password changed successfully', 'success');
            loadAllUsers(); // Refresh the user list
        } else {
            showMessage('adminMessage', `Error: ${result.error}`, 'error');
        }
    } catch (error) {
        debugLog('ERROR in changeUserPassword: ' + error.message);
        showMessage('adminMessage', 'Error changing password: ' + error.message, 'error');
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
 * TOGGLE PASSWORD VISIBILITY: Show/hide user passwords
 * Educational feature to see how passwords are stored
 */
function togglePasswordVisibility(userId, actualPassword) {
    const passwordField = document.querySelector(`#user-${userId} .password-field`);
    const toggleButton = document.querySelector(`#user-${userId} .toggle-password`);
    
    if (passwordField && toggleButton) {
        if (passwordField.textContent === '••••••••') {
            // Show actual password (for educational purposes)
            passwordField.textContent = actualPassword;
            toggleButton.textContent = '👁️ Hide';
            toggleButton.style.background = '#e53e3e';
            toggleButton.style.color = 'white';
        } else {
            // Hide password
            passwordField.textContent = '••••••••';
            toggleButton.textContent = '👁️ Show';
            toggleButton.style.background = '';
            toggleButton.style.color = '';
        }
    }
}

/**
 * SHOW ACTUAL PASSWORDS: Reveal all passwords at once
 * Useful for admin troubleshooting and education
 */
async function showActualPasswords() {
    try {
        debugLog('Showing all passwords');
        
        // Get all users with their passwords
        const users = await window.electronAPI.getAllUsersDetailed();
        const passwordFields = document.querySelectorAll('.password-field');
        const toggleButtons = document.querySelectorAll('.toggle-password');
        
        // Update all password fields to show actual passwords
        passwordFields.forEach((field, index) => {
            if (index < users.length) {
                const user = users[index];
                field.textContent = user.password;
            }
        });
        
        // Update all toggle buttons to "Hide" state
        toggleButtons.forEach(button => {
            button.textContent = '👁️ Hide';
            button.style.background = '#e53e3e';
            button.style.color = 'white';
        });
        
        showMessage('adminMessage', 'All passwords revealed', 'success');
        
    } catch (error) {
        debugLog('ERROR in showActualPasswords: ' + error.message);
        console.error('Error showing passwords:', error);
        showMessage('adminMessage', 'Error loading passwords', 'error');
    }
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
    
    console.log('✅ Renderer script loaded successfully');
    debugLog('Application initialized');
});