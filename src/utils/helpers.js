// src/utils/helpers.js

/**
 * Validates ISBN format (supports ISBN-10 and ISBN-13)
 * @param {string} isbn - The ISBN to validate
 * @returns {boolean} - True if valid ISBN format
 */
function validateISBN(isbn) {
    // Remove any hyphens or spaces
    const cleanISBN = isbn.replace(/[-\s]/g, '');
    
    // Check for ISBN-10 or ISBN-13 format
    const isbn10Regex = /^(?:\d{9}[\dXx])$/;
    const isbn13Regex = /^(?:\d{13})$/;
    
    return isbn10Regex.test(cleanISBN) || isbn13Regex.test(cleanISBN);
}

/**
 * Formats a date for display (e.g., "January 15, 2024")
 * @param {string} dateString - ISO date string
 * @returns {string} - Formatted date string
 */
function formatDisplayDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

/**
 * Calculates days until due date
 * @param {string} dueDate - ISO date string of due date
 * @returns {number} - Days until due (negative if overdue)
 */
function daysUntilDue(dueDate) {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

/**
 * Gets a friendly status message for a checkout
 * @param {string} dueDate - ISO date string of due date
 * @param {boolean} returned - Whether book is returned
 * @returns {string} - Status message
 */
function getCheckoutStatus(dueDate, returned) {
    if (returned) {
        return 'Returned ✓';
    }
    
    const days = daysUntilDue(dueDate);
    if (days < 0) {
        return `Overdue by ${Math.abs(days)} days!`;
    } else if (days === 0) {
        return 'Due today!';
    } else if (days === 1) {
        return 'Due tomorrow';
    } else {
        return `Due in ${days} days`;
    }
}

/**
 * Sanitizes user input to prevent XSS attacks
 * @param {string} input - User input string
 * @returns {string} - Sanitized string
 */
function sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

module.exports = {
    validateISBN,
    formatDisplayDate,
    daysUntilDue,
    getCheckoutStatus,
    sanitizeInput
};