const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    author: { type: String, trim: true },
    genre: { type: String, trim: true },
    language: { type: String, trim: true },
    publicationYear: { type: Number, min: 0 },
    isbn: { type: String, trim: true },
    publisher: { type: String, trim: true },
    condition: { type: String, enum: ['New','Excellent','Good','Fair','Poor'], default: 'New' },
    coverUrl: { type: String, trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } 
  },
  { timestamps: true }
);

module.exports = mongoose.model('Book', bookSchema);
