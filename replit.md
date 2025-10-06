# SwapShelf - Book Exchange Platform

## Project Overview
SwapShelf is a social book exchange and reading platform where users can list books they want to swap, create wishlists, connect with nearby readers, and track their reading journey. Built with Node.js, Express, MongoDB, and EJS templating.

## Architecture

### Technology Stack
- **Backend**: Node.js with Express.js
- **Database**: MongoDB (Atlas) with Mongoose ODM
- **Frontend**: EJS templating, Bootstrap 4, vanilla JavaScript
- **Session Management**: express-session
- **File Uploads**: Multer (profile photos and book covers)
- **Email**: Nodemailer (password reset functionality)

### Project Structure
```
SwapShelf/
├── app.js                    # Main server file with all routes
├── controllers/              # Business logic controllers
│   ├── bookController.js
│   ├── dashboardController.js
│   ├── swapController.js
│   └── userController.js
├── models/                   # MongoDB schemas
│   ├── User.js
│   ├── Book.js
│   ├── Swap.js
│   └── Activity.js
├── routes/                   # API route handlers
│   ├── auth.js
│   ├── books.js
│   ├── swaps.js
│   └── users.js
├── middleware/
│   └── auth.js              # Authentication middleware
├── helpers/                 # Helper functions
│   ├── dashboardHelper.js
│   └── realDashboardHelper.js
├── views/                   # EJS templates
├── public/                  # Static assets (CSS, JS, images)
└── .env                     # Environment variables (not in git)
```

## Replit Configuration

### Port Configuration
- **Development**: Port 5000, bound to 0.0.0.0
- **Frontend Server**: Runs on port 5000
- **No separate backend port** - all API routes are served from the same Express server

### Environment Variables
The following environment variables are configured in `.env`:
- `MONGO_URI` - MongoDB connection string
- `SESSION_SECRET` - Session encryption key
- `SMTP_*` - Email configuration for password reset
- `PORT` - Server port (defaults to 5000)

### Workflows
- **Server**: Runs `npm start` on port 5000 with webview output

### Deployment
- **Target**: Autoscale (stateless web app)
- **Command**: `node app.js`
- Database state is maintained in MongoDB Atlas (external)

## Key Features

### User Management
- Registration and login (supports both username and email)
- Profile photo upload
- Achievement badge system
- Session-based authentication

### Book Management
- Add books to personal library
- Create and manage wishlists
- Book swapping system
- Activity tracking

### Dashboard
- Real-time user statistics
- Swap insights
- Nearby available books
- Recent activity feed

## Development Notes

### Database
- Uses MongoDB Atlas (cloud-hosted)
- Connection string stored in `.env`
- Graceful fallback when database is unavailable

### Session Management
- Session cookie: `bookswap.sid`
- 7-day expiration
- Secure cookies in production
- Session stores user info including username, email, photo

### File Uploads
- Profile photos: `public/uploads/profiles/`
- Book covers: `public/uploads/books/`
- 5MB file size limit
- Image files only

### Cache Control
- Protected routes have no-cache headers
- Prevents stale data after logout
- Important for session security

## Recent Changes (Replit Import - Sept 30, 2025)
- ✅ Updated server to bind to 0.0.0.0:5000 for Replit environment
- ✅ Configured workflow for automatic server restart
- ✅ Created .gitignore for Node.js project
- ✅ Verified MongoDB connection working
- ✅ Configured deployment for autoscale
- ✅ Landing page displaying correctly

## Testing
- Landing page: `/`
- Login: `/login` or `/auth/login`
- Register: `/register` or `/auth/register`
- Dashboard (requires login): `/dashboard`
- Test user creation: `/create-test-user` (development only)

## Known Issues
None currently - all core features working properly.
