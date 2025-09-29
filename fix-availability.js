const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Book = require('./models/Book');

async function fixAvailability() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Check current book availability status
        const allBooks = await Book.find({});
        console.log('\n📊 Current book availability status:');
        console.log('Total books:', allBooks.length);
        
        const availabilityCount = {};
        allBooks.forEach(book => {
            const status = book.availability || 'undefined';
            availabilityCount[status] = (availabilityCount[status] || 0) + 1;
        });
        
        console.log('Availability breakdown:', availabilityCount);

        // Show some sample books with their status
        console.log('\n📚 Sample books with IDs:');
        allBooks.slice(0, 5).forEach(book => {
            console.log(`- ${book.title} (${book.author}): ${book.availability} - Owner: ${book.owner} - ID: ${book._id}`);
        });
        
        // Show books with owners specifically
        const booksWithOwners = allBooks.filter(book => book.owner);
        console.log('\n📚 Books WITH owners:');
        booksWithOwners.slice(0, 5).forEach(book => {
            console.log(`- ID: ${book._id} | ${book.title} | Owner: ${book.owner}`);
        });

        // Check for books with missing owners
        const booksWithoutOwners = await Book.find({ 
            $or: [
                { owner: { $exists: false } },
                { owner: null },
                { owner: undefined }
            ]
        });
        
        if (booksWithoutOwners.length > 0) {
            console.log(`\n⚠️  Found ${booksWithoutOwners.length} books without owners:`);
            booksWithoutOwners.forEach(book => {
                console.log(`- ${book.title} (${book._id}): owner = ${book.owner}`);
            });
        }

        // Fix any books that might have wrong availability status
        const booksToFix = await Book.find({ 
            availability: { $nin: ['available', 'swapped', 'unavailable'] } 
        });
        
        if (booksToFix.length > 0) {
            console.log(`\n🔧 Found ${booksToFix.length} books with invalid availability status:`);
            booksToFix.forEach(book => {
                console.log(`- ${book.title}: "${book.availability}" -> "available"`);
            });
            
            await Book.updateMany(
                { availability: { $nin: ['available', 'swapped', 'unavailable'] } },
                { $set: { availability: 'available' } }
            );
            console.log('✅ Fixed invalid availability statuses');
        } else {
            console.log('\n✅ All books have valid availability status');
        }

        // Reset all books to available for testing
        const result = await Book.updateMany(
            { availability: { $ne: 'available' } },
            { $set: { availability: 'available' } }
        );
        
        console.log(`\n🔄 Reset ${result.modifiedCount} books to 'available' status for testing`);

        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixAvailability();