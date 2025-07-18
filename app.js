require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');

const User = require('./models/User'); //Mongoose User model

const app = express();

//MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Error:', err));

//Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// erve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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
});
