const User = require('../models/User');
const Book = require('../models/Books');

/**
 * Find swap matches based on criteria
 * @param {String} userId - The current user's ID
 * @param {String} criteria - One of: "country", "language", "title", "genre"
 * @param {String} value - The value to search for (ex: "Fantasy", "English", "Jordan")
 * @returns {Array} - List of matched users and their books
 */
async function findSwapMatches(userId, criteria, value) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const { location } = user;
  let matches = [];

  if (criteria === 'country') {
    // Match users in the same country
    const matchedUsers = await User.find({ location, _id: { $ne: userId } });

    matches = await Promise.all(
      matchedUsers.map(async (u) => {
        const books = await Book.find({ owner: u._id });
        return {
          user: {
            id: u._id,
            fullname: u.fullname,
            email: u.email,
            location: u.location,
          },
          books,
        };
      })
    );
  } else {
    if (!value) throw new Error(`Value is required for criteria: ${criteria}`);

    // Match books by title, genre, or language (exclude self)
    let query = {};
    query[criteria] = value;

    const matchedBooks = await Book.find({
      ...query,
      owner: { $ne: userId, $exists: true },
    }).populate('owner');

    // Group books by owner
    const grouped = {};
    matchedBooks.forEach((book) => {
      if (!book.owner) return; // skip books without owners
      const id = book.owner._id.toString();
      if (!grouped[id]) {
        grouped[id] = {
          user: {
            id: book.owner._id,
            fullname: book.owner.fullname,
            email: book.owner.email,
            location: book.owner.location,
          },
          books: [],
        };
      }
      grouped[id].books.push(book);
    });

    // Convert to array
    matches = Object.values(grouped);

    // Prioritize same country
    matches.sort((a, b) => {
      const aSameCountry = a.user.location === location;
      const bSameCountry = b.user.location === location;
      return aSameCountry === bSameCountry ? 0 : aSameCountry ? -1 : 1;
    });
  }

  return matches;
}

module.exports = { findSwapMatches };