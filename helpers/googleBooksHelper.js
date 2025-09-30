/**
 * Google Books API Helper
 * Fetches book information and images from Google Books API
 */

class GoogleBooksHelper {
    static async searchBookByTitle(title, author = '') {
        try {
            // Skip search for obviously non-book titles, but allow some common names
            if (title.length < 2 || 
                (title.toLowerCase() === 'test' && !author) ||
                (title.toLowerCase() === 'hello' && !author)) {
                console.log(`Skipping search for non-book title: "${title}"`);
                return null;
            }
            
            const query = author ? `${title} ${author}` : title;
            const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1&fields=items(id,volumeInfo(title,authors,publishedDate,publisher,description,imageLinks,industryIdentifiers,categories,language))`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.items && data.items.length > 0) {
                const book = data.items[0];
                return this.extractBookInfo(book);
            }
            
            return null;
        } catch (error) {
            console.error('Error fetching book from Google Books API:', error);
            return null;
        }
    }

    static async searchBookByISBN(isbn) {
        try {
            const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1&fields=items(id,volumeInfo(title,authors,publishedDate,publisher,description,imageLinks,industryIdentifiers,categories,language))`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.items && data.items.length > 0) {
                const book = data.items[0];
                return this.extractBookInfo(book);
            }
            
            return null;
        } catch (error) {
            console.error('Error fetching book by ISBN from Google Books API:', error);
            return null;
        }
    }

    static extractBookInfo(book) {
        const volumeInfo = book.volumeInfo || {};
        const imageLinks = volumeInfo.imageLinks || {};
        
        // Get the best available image
        let imageUrl = null;
        if (imageLinks.thumbnail) {
            imageUrl = imageLinks.thumbnail.replace('http:', 'https:');
        } else if (imageLinks.smallThumbnail) {
            imageUrl = imageLinks.smallThumbnail.replace('http:', 'https:');
        } else if (imageLinks.medium) {
            imageUrl = imageLinks.medium.replace('http:', 'https:');
        } else if (imageLinks.large) {
            imageUrl = imageLinks.large.replace('http:', 'https:');
        }

        return {
            googleBooksId: book.id,
            title: volumeInfo.title || '',
            authors: volumeInfo.authors || [],
            publishedDate: volumeInfo.publishedDate || '',
            publisher: volumeInfo.publisher || '',
            description: volumeInfo.description || '',
            imageUrl: imageUrl,
            isbn: this.extractISBN(volumeInfo.industryIdentifiers),
            categories: volumeInfo.categories || [],
            language: volumeInfo.language || 'en'
        };
    }

    static extractISBN(identifiers) {
        if (!identifiers || !Array.isArray(identifiers)) return null;
        
        // Look for ISBN-13 first, then ISBN-10
        const isbn13 = identifiers.find(id => id.type === 'ISBN_13');
        if (isbn13) return isbn13.identifier;
        
        const isbn10 = identifiers.find(id => id.type === 'ISBN_10');
        if (isbn10) return isbn10.identifier;
        
        return null;
    }

    static async getBookImage(title, author = '') {
        try {
            const bookInfo = await this.searchBookByTitle(title, author);
            return bookInfo ? bookInfo.imageUrl : null;
        } catch (error) {
            console.error('Error getting book image:', error);
            return null;
        }
    }

    static async getBookImageByISBN(isbn) {
        try {
            const bookInfo = await this.searchBookByISBN(isbn);
            return bookInfo ? bookInfo.imageUrl : null;
        } catch (error) {
            console.error('Error getting book image by ISBN:', error);
            return null;
        }
    }
}

module.exports = GoogleBooksHelper;
