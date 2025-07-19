require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');

const User = require('./models/User'); //Mongoose User model

const app = express();

<<<<<<< HEAD
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
=======
//MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Error:', err));

//Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// erve index.html
>>>>>>> c540cea9b362f5926eee3fc737f0ae119aebfa92
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

<<<<<<< HEAD
app.listen(3000, () => {
    console.log('Server is running at http://localhost:3000');
    console.log('Dashboard available at: http://localhost:3000/dashboard');
=======
//Registration Route
app.post('/register', async (req, res) => {
  const { fullname, email, password, location } = req.body;

  try {
    console.log("📩 Registration data:", req.body);

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({
      fullname,
      email,
      password: hashedPassword,
      location
    });

    console.log("User registered successfully!");
    res.redirect('/login.html');
  } catch (err) {
    console.error("Error registering user:", err);
    res.status(500).send('Error registering user');
  }
});

//Login Route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).send('Invalid credentials');
    }

    console.log("✅ Login successful:", email);
    res.send('✅ Login successful');
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send('Server error');
  }
});

//Start Server
app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
>>>>>>> c540cea9b362f5926eee3fc737f0ae119aebfa92
});
