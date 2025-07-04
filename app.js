const express = require('express');
const app = express();

app.use(express.static('public'));  // Serve your HTML/CSS/JS files

// other middleware, routes, etc.

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
