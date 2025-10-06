# SwapShelf – A Modern Book Exchange & Social Reading Platform

## 🔍 Problem  
Many people buy books from Amazon and never read them again. These books sit unused on shelves, while others want to read them but can't afford to buy new ones.

## 💡 Solution: SwapShelf  
A comprehensive social reading platform where users can:  
- List books they've read and want to swap  
- Create personalized wishlists of books they want to read  
- Connect with nearby readers through real-time chat  
- Track their reading journey with detailed analytics  
- Earn achievement badges and rewards for community participation  
- Upload and manage their profile with custom photos  
- Find swap matches with intelligent recommendations  

## ✨ Features Implemented

### 🔐 **Authentication & Security**
- **User Registration & Login**: Secure account creation and login system
- **Session Management**: Persistent user sessions with security
- **Password Encryption**: BCrypt hashing for secure password storage
- **Secure Logout**: Complete session clearing with cache prevention

### 🏠 **Modern Navigation & UI**
- **Responsive Navigation Bar**: Bootstrap-based navigation with active page highlighting
- **Consistent Design**: Unified dark theme with premium gradients
- **Interactive Elements**: Smooth hover effects and transitions
- **Mobile Responsive**: Works seamlessly on all device sizes
- **Glass-morphism Effects**: Modern backdrop blur and transparency effects

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

### � **Real-Time Chat System**
- **Instant Messaging**: Real-time chat using Socket.IO
- **User Discovery**: Find and connect with other book lovers
- **Chat Search**: Search through conversations and find users
- **Message History**: Persistent conversation storage
- **Online Status**: See who's currently active
- **Chat Pagination**: Organized chat history with page navigation
- **Premium Chat UI**: Modern design with glass-morphism effects

### �📚 **Advanced Book Management**
- **My Library**: Personal book collection with advanced filtering
- **Book Upload**: Add books with cover images and detailed information
- **Wishlist System**: Track books you want to read with priority levels
- **Book Display**: Visual book cards with cover images and ratings
- **CRUD Operations**: Add, edit, delete, and hide books
- **Book Search**: Find books by title, author, or genre
- **Swap Matcher**: Intelligent algorithm to find potential trading partners

### 📊 **Professional Dashboard**
- **User Statistics**: Comprehensive reading journey analytics
- **Visual Data**: Charts and graphs for swap history
- **Quick Actions**: Fast access to common tasks
- **Trending Books**: See what's popular in your area
- **Leaderboard**: Community rankings and achievements
- **Activity Feed**: Recent platform activities and updates
- **Responsive Grid**: Perfect alignment across all screen sizes
- **Premium Design**: Glass-morphism cards with gradient effects
### 🎨 **Premium Design System**
- **Glass-morphism Effects**: Modern backdrop blur and transparency
- **Gradient Elements**: Beautiful color transitions throughout the site
- **Premium Animations**: Smooth cubic-bezier transitions and micro-interactions
- **Card-based Layouts**: Modern card designs with consistent shadows
- **Loading States**: Smooth loading animations and feedback
- **Custom Components**: Professional UI components with hover effects
- **Responsive Typography**: Scalable fonts across all devices

### � **Swap Management**
- **Swap Requests**: Send and receive book swap requests
- **Swap History**: Track all your completed exchanges
- **Swap Status**: Monitor pending, accepted, and completed swaps
- **Smart Matching**: Algorithm-based book recommendations
- **Location-based Matching**: Find swappers in your area

## �🛠️ Technologies  
- **Frontend**: HTML5, CSS3, JavaScript ES6, Bootstrap 4, EJS Templating
- **Backend**: Node.js, Express.js, Socket.IO (real-time chat)
- **Database**: MongoDB with Mongoose ODM
- **File Handling**: Multer for profile photo and book cover uploads
- **Session Management**: Express-session with secure configuration
- **Real-time Features**: Socket.IO for instant messaging
- **Icons**: Bootstrap Icons for consistent iconography
- **Security**: BCrypt for password hashing, secure session management

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
MONGODB_URI=mongodb://localhost:27017/swapshelf
MONGO_URI=mongodb://localhost:27017/swapshelf
SESSION_SECRET=your-secret-key-here
PORT=3000
```

4. **Start the application**
```bash
npm start
# or
node app.js
```

5. **Access the application**
- Main site: http://localhost:3000
- Dashboard: http://localhost:3000/dashboard
- Profile: http://localhost:3000/profile

## 📱 Available Routes

### Public Routes
- `/` - Landing page with features overview
- `/login` - User login page
- `/register` - User registration page

### Protected Routes (requires login)
- `/dashboard` - Enhanced dashboard with analytics and trending data
- `/profile` - User profile with photo upload and achievements
- `/library` - Personal book library management with search
- `/wishlist` - Book wishlist management with priorities
- `/swap-matcher` - Intelligent book swap partner finder
- `/book-details/:id` - Detailed book information and swap options
- `/history` - Complete swap history and activity log

### Real-time Features
- `/messages` - Real-time chat system with Socket.IO
- `/chat` - Direct messaging with other users
- `/users/search` - Find and connect with book lovers

### API Routes
- `POST /profile/upload-photo` - Upload profile photos
- `POST /api/books` - Add new books to library
- `POST /api/chat/send` - Send real-time messages
- `GET /api/dashboard/data` - Fetch dashboard analytics
- `POST /logout` - Secure logout with session clearing

## 📁 Project Structure

```
SwapShelf/
├── app.js                          # Main application server with Socket.IO setup
├── package.json                    # Dependencies and scripts
├── vercel.json                     # Deployment configuration
├── README.md                       # Project documentation
├── DASHBOARD_IMPROVEMENTS.md       # Dashboard enhancement documentation
├── BACKEND_ARCHITECTURE.md         # Backend structure documentation
├── AMAZON_API_SETUP.md            # Amazon API integration guide
│
├── controllers/                    # Business logic controllers
│   ├── bookController.js          # Book CRUD operations and uploads
│   ├── dashboardController.js     # Dashboard analytics and data
│   ├── swapController.js          # Swap request management
│   └── userController.js          # User management and authentication
│
├── routes/                         # Express route definitions
│   ├── auth.js                    # Authentication routes (login, register)
│   ├── books.js                   # Book management routes
│   ├── dashboard.js               # Dashboard data routes
│   ├── swaps.js                   # Swap request routes
│   └── users.js                   # User profile routes
│
├── models/                         # MongoDB data models
│   ├── User.js                    # User schema with profile data
│   ├── Book.js                    # Book schema with details and images
│   ├── Swap.js                    # Swap request schema
│   └── Activity.js                # User activity tracking
│
├── views/                          # EJS templates
│   ├── dashboard.ejs              # Enhanced dashboard with analytics
│   ├── profile.ejs                # User profile with photo upload
│   ├── library.ejs                # Book library management
│   ├── wishlist.ejs              # Book wishlist interface
│   ├── swap-matcher.ejs          # Smart book matching system
│   ├── book-details.ejs          # Detailed book information
│   ├── history.ejs               # Swap history and activity
│   ├── login.ejs                 # User login interface
│   ├── register.ejs              # User registration interface
│   ├── forgot-password.ejs       # Password recovery
│   └── reset-password.ejs        # Password reset interface
│
├── public/                         # Static assets
│   ├── landing.html               # Landing page
│   ├── css/
│   │   └── style.css             # Premium styling with glass-morphism
│   ├── js/
│   │   ├── dashboard-updater.js  # Real-time dashboard updates
│   │   ├── navigation.js         # Navigation and routing
│   │   ├── username-checker.js   # Real-time username validation
│   │   └── country-phone-simple.js # Phone number formatting
│   ├── images/                   # Static images and icons
│   └── uploads/                  # User-generated content
│       ├── books/               # Book cover images
│       └── profiles/            # Profile photos
│
├── middleware/
│   └── auth.js                   # Authentication middleware
│
└── helpers/
    ├── dashboardHelper.js        # Dashboard utility functions
    └── realDashboardHelper.js    # Real-time dashboard features
```

## 🌟 Advanced Features

### 🏠 **Enhanced Dashboard**
- **Performance Analytics**: Book swap metrics and success rates
- **Activity Feed**: Recent activities and trending books
- **Quick Actions**: One-click access to common tasks
- **Statistics Cards**: Visual data representation with charts
- **Responsive Grid**: Professional layout that works on all devices

### 💬 **Real-time Chat System**
- **Socket.IO Integration**: Instant messaging between users
- **Message History**: Persistent chat conversations
- **Online Status**: See who's currently active
- **Typing Indicators**: Real-time typing feedback
- **Message Notifications**: Desktop and in-app notifications

### 📚 **Advanced Book Management**
- **Image Uploads**: High-quality book cover uploads with Multer
- **Smart Search**: Search books by title, author, genre, or ISBN
- **Condition Tracking**: Monitor book condition and quality
- **Availability Status**: Real-time book availability updates
- **Book Details**: Comprehensive book information display

### � **Security & Authentication**
- **BCrypt Encryption**: Secure password hashing
- **Session Management**: Secure user sessions with express-session
- **Route Protection**: Middleware-based authentication
- **CSRF Protection**: Security against cross-site request forgery
- **File Upload Security**: Secure image upload with validation

## 🚀 Recent Updates & Improvements

### ✨ Dashboard Enhancements
- Fixed width alignment between header and statistics sections
- Implemented glass-morphism design effects
- Added gradient backgrounds and premium styling
- Created compact layouts for books and leaderboard
- Enhanced responsive design for all screen sizes

### 🎨 UI/UX Improvements
- Professional design system with consistent branding
- Smooth animations and micro-interactions
- Improved typography and spacing
- Modern card-based layouts throughout
- Enhanced loading states and feedback

### 🔧 Technical Improvements
- Socket.IO integration for real-time features
- Advanced controller architecture
- Comprehensive error handling
- Optimized database queries
- Enhanced file upload system

## 🤝 Contributing
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License
This project is licensed under the MIT License - see the LICENSE file for details.

## 👨‍💻 Author
**Hashim Zuraiqi** - [GitHub Profile](https://github.com/HashimZuraiqi)

## 🙏 Acknowledgments
- Book lovers community for inspiration
- Socket.IO team for real-time capabilities
- Bootstrap team for responsive framework
- MongoDB team for flexible database solution
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
