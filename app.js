require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');

const User = require('./models/User'); //Mongoose User model

const app = express();

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => {
    console.warn('⚠️ MongoDB Connection Failed - Running without database');
    console.warn('Registration and login will be temporarily disabled');
    // Don't exit the process, just log the warning
  });

// Set EJS as the template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public'), {
    index: 'index.html'
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

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

// GET Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    const userName = req.query.user || 'Reader';
    res.render('dashboard', {
        user: userName,
        trendingBooks: sampleTrendingBooks
    });
});

app.get('/login', (req, res) => {
    const error = req.query.error;
    let errorMessage = '';
    
    if (error === 'invalid') {
        errorMessage = 'Invalid email or password. Please try again.';
    } else if (error === 'server') {
        errorMessage = 'Server error. Please try again later.';
    }
    
    console.log('Login page accessed with error:', error, 'Message:', errorMessage);
    res.render('login', { errorMessage });
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Test route for login error
app.get('/test-login-error', (req, res) => {
    res.redirect('/login?error=invalid');
});

// POST Routes - Authentication
app.post('/register', async (req, res) => {
  const { fullname, email, password, location } = req.body;

  try {
    console.log("📩 Registration data:", req.body);

    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.warn("⚠️ MongoDB not connected - simulating registration");
      console.log(`✅ Would register user: ${fullname} (${email}) from ${location}`);
      res.redirect('/login?registered=true');
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({
      fullname,
      email,
      password: hashedPassword,
      location
    });

    console.log("User registered successfully!");
    res.redirect('/login');
  } catch (err) {
    console.error("Error registering user:", err);
    res.status(500).send('Error registering user');
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.warn("⚠️ MongoDB not connected - simulating login");
      console.log(`✅ Would login user: ${email}`);
      res.redirect('/dashboard?user=' + encodeURIComponent(email.split('@')[0]));
      return;
    }

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.redirect('/login?error=invalid');
    }

    console.log("✅ Login successful:", email);
    res.redirect('/dashboard?user=' + encodeURIComponent(user.fullname || user.email.split('@')[0]));
  } catch (err) {
    console.error("Login error:", err);
    res.redirect('/login?error=server');
  }
});

// Start Server
app.listen(3000, () => {
    console.log('Server is running at http://localhost:3000');
    console.log('Dashboard available at: http://localhost:3000/dashboard');
});
