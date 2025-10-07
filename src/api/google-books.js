// src/api/google-books.js

/**
 * Fetches book information from Google Books API using ISBN
 * @param {string} isbn - The ISBN number to search for
 * @returns {Promise<Object>} - Book information or null if not found
 */
async function fetchBookByISBN(isbn) {
    try {
        console.log(`Searching for book with ISBN: ${isbn}`);
        
        // Clean ISBN (remove dashes and spaces)
        const cleanISBN = isbn.replace(/[-\s]/g, '');
        
        // Google Books API endpoint
        const apiUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanISBN}`;
        
        console.log(`Calling Google Books API: ${apiUrl}`);
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Check if any books were found
        if (data.totalItems === 0 || !data.items) {
            console.log(`No book found for ISBN: ${isbn}`);
            return null;
        }
        
        // Get the first book from results
        const bookInfo = data.items[0].volumeInfo;
        
        // Extract relevant information
        const bookData = {
            title: bookInfo.title || 'Unknown Title',
            authors: bookInfo.authors || ['Unknown Author'],
            publisher: bookInfo.publisher || 'Unknown Publisher',
            publishedDate: bookInfo.publishedDate || 'Unknown Date',
            description: bookInfo.description || 'No description available',
            isbn: cleanISBN,
            pageCount: bookInfo.pageCount || 0,
            categories: bookInfo.categories || ['Unknown Category'],
            thumbnail: bookInfo.imageLinks?.thumbnail || '',
            smallThumbnail: bookInfo.imageLinks?.smallThumbnail || '',
            language: bookInfo.language || 'en'
        };
        
        console.log(`Book found: ${bookData.title} by ${bookData.authors.join(', ')}`);
        return bookData;
        
    } catch (error) {
        console.error('Error fetching book from Google Books API:', error);
        return null;
    }
}

/**
 * Formats book data for our application
 * @param {Object} bookData - Raw book data from Google Books API
 * @returns {Object} - Formatted book data for our app
 */
function formatBookData(bookData) {
    if (!bookData) return null;
    
    return {
        title: bookData.title,
        author: bookData.authors.join(', '), // Convert array to string
        isbn: bookData.isbn,
        cover_url: bookData.thumbnail || bookData.smallThumbnail,
        publisher: bookData.publisher,
        published_date: bookData.publishedDate,
        description: bookData.description
    };
}

// Export functions for use in other files
module.exports = {
    fetchBookByISBN,
    formatBookData
};