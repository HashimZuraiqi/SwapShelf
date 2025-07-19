const express = require('express');
const path = require('path');

const app = express();

// Set EJS as the template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sample trending books data
const sampleTrendingBooks = [
    {
        title: "The Seven Husbands of Evelyn Hugo",
        image: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1618329605i/32620332.jpg"
    },
    {
        title: "Where the Crawdads Sing",
        image: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1582135294i/36809135.jpg"
    },
    {
        title: "The Silent Patient",
        image: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1582143772i/40097951.jpg"
    },
    {
        title: "Educated",
        image: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1506026635i/35133922.jpg"
    }
];

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.render('dashboard', {
        user: 'Reader', // You can make this dynamic later
        trendingBooks: sampleTrendingBooks
    });
});

// Login and Register routes (for your existing HTML files)
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.listen(3000, () => {
    console.log('Server is running at http://localhost:3000');
    console.log('Dashboard available at: http://localhost:3000/dashboard');
});
