# BookSwap – A Smart Book Exchange & Social Reading Platform

## 🔍 Problem  
Many people buy books from Amazon and never read them again. These books sit unused on shelves, while others want to read them but can't afford to buy new ones.

## 💡 Solution: BookSwap  
A comprehensive social reading platform where users can:  
- List books they've read and want to swap  
- Create personalized wishlists of books they want to read  
- Connect with nearby readers and book enthusiasts  
- Track their reading journey and swap history  
- Earn achievement badges and rewards for community participation  
- Upload and manage their profile with custom photos  

## ✨ Features Implemented

### 🔐 **Authentication & Security**
- **User Registration & Login**: Secure account creation and login system
- **Session Management**: Persistent user sessions with security
- **Secure Logout**: Complete session clearing with cache prevention

### 🏠 **Navigation & UI**
- **Responsive Navigation Bar**: Bootstrap-based navigation with active page highlighting
- **Consistent Design**: Unified dark theme across all pages
- **Interactive Elements**: Smooth hover effects and transitions
- **Mobile Responsive**: Works seamlessly on all device sizes

### 👤 **Enhanced Profile System**
- **Profile Photo Upload**: Users can upload and change their profile pictures
  - Interactive hover overlay with camera icon
  - File validation (images only, 5MB max)
  - Real-time photo preview updates
  - Secure file storage in `/uploads/profiles/`
- **Achievement Badges**: Premium reward system with animated badges
  - **Gold Badge**: Top Reader (50+ books) with golden gradient
  - **Silver Badge**: Master Swapper (25+ swaps) with metallic shine
  - **Bronze Badge**: Community Helper (10+ members) with bronze glow
  - **Special Badge**: Early Adopter with unique purple design
  - Animated shine effects and 3D hover animations

### 📚 **Book Management**
- **My Library**: Personal book collection management
- **Wishlist System**: Track books you want to read
- **Book Display**: Visual book cards with cover images
- **CRUD Operations**: Add, edit, delete, and hide books

### 🌐 **Platform Pages**
- **Dashboard**: User overview with trending books and statistics
- **Swap Matcher**: Find potential trading partners
- **Nearby Users**: Location-based book finder
- **Rewards System**: Visual achievement tracking

### 🎨 **Advanced Styling**
- **Gradient Elements**: Beautiful color transitions throughout the site
- **Custom SVG Logo**: Professional branding with gradient effects
- **Card-based Layouts**: Modern card designs for all content
- **Loading States**: Smooth loading animations and feedback

## 🛠️ Technologies  
- **Frontend**: HTML5, CSS3, JavaScript ES6, Bootstrap 4, EJS Templating
- **Backend**: Node.js, Express.js, Multer (file uploads)
- **Database**: MongoDB with Mongoose ODM
- **Session Management**: Express-session with secure configuration
- **File Handling**: Multer for profile photo uploads
- **Icons**: Bootstrap Icons for consistent iconography

## 🚀 Getting Started

### Prerequisites  
- Node.js (v14+)  
- MongoDB (local or Atlas)
- Git

### Installation & Setup

1. **Clone the repository**  
```bash
git clone https://github.com/HashimZuraiqi/SwapShelf.git
cd SwapShelf
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Setup**
Create a `.env` file in the root directory:
```env
MONGODB_URI=mongodb://localhost:27017/bookswap
SESSION_SECRET=your-secret-key-here
```

4. **Start the application**
```bash
node app.js
```

5. **Access the application**
- Main site: http://localhost:3000
- Dashboard: http://localhost:3000/dashboard
- Profile: http://localhost:3000/me

## 📱 Available Routes

### Public Routes
- `/` - Landing page with features overview
- `/login` - User login page
- `/register` - User registration page

### Protected Routes (requires login)
- `/dashboard` - User dashboard with statistics
- `/me` - User profile with photo upload and achievements
- `/library` - Personal book library management
- `/wishlist` - Book wishlist management
- `/swap-matcher` - Find potential book swap partners
- `/nearby` - Discover nearby book lovers
- `/rewards` - View achievement badges and rewards

### API Routes
- `POST /profile/upload-photo` - Upload profile photos
- `POST /logout` - Secure logout with session clearing

## 🎯 Key Features Showcase

### Profile Photo Upload
- **Interactive Upload**: Click profile photo to upload new image
- **Visual Feedback**: Hover effects with camera icon overlay
- **File Validation**: Automatic image type and size validation
- **Real-time Updates**: Instant photo preview without page refresh

### Achievement Badge System
- **Professional Design**: Medal-like badges with metallic gradients
- **Animated Effects**: Subtle shine animations and hover effects
- **Tier System**: Gold, Silver, Bronze, and Special achievement levels
- **Descriptive Labels**: Clear achievement criteria and progress

### Responsive Navigation
- **Active Page Highlighting**: Blue gradient background for current page
- **Consistent Layout**: Same navigation across all pages
- **Profile Dropdown**: Quick access to profile and logout
- **Mobile Friendly**: Collapsible navigation for smaller screens

## 🔧 File Structure
```
SwapShelf/
├── app.js                 # Main server file with routes
├── package.json           # Dependencies and scripts
├── models/
│   └── User.js           # MongoDB user schema
├── public/
│   ├── css/
│   │   └── style.css     # Global styles
│   ├── images/           # Static images
│   └── uploads/
│       └── profiles/     # User profile photos
├── views/
│   ├── dashboard.ejs     # User dashboard
│   ├── profile.ejs       # Enhanced profile page
│   ├── home.ejs          # Dynamic homepage
│   ├── login.ejs         # Login page
│   └── *.ejs            # Other template pages
└── routes/
    └── auth.js           # Authentication routes
```

## 🚀 Recent Updates (August 2025)

### Profile Enhancement Release
- ✅ Added profile photo upload functionality with interactive interface
- ✅ Implemented premium achievement badge system with animations
- ✅ Enhanced visual design with gradients and 3D effects
- ✅ Improved security with secure logout and session management
- ✅ Unified navigation system with active page highlighting
- ✅ Mobile-responsive design improvements

### Technical Improvements
- ✅ Added Multer middleware for file handling
- ✅ Implemented secure file upload with validation
- ✅ Enhanced error handling and user feedback
- ✅ Improved session management and security
- ✅ Optimized CSS with modern animations and effects

## 🎮 Demo Account
For testing purposes, register with any email and password to explore all features.

## 🔮 Future Enhancements
- Amazon API integration for book data
- Google Maps integration for nearby users
- Real-time chat system for swap coordination
- Book barcode scanning
- Advanced matching algorithms
- Push notifications for swap requests
- Social features like book reviews and ratings

---

**Built with ❤️ for the book-loving community**

## 📸 Screenshots

Visit http://localhost:3000/me after logging in to see the new profile photo upload feature and premium achievement badges in action!
