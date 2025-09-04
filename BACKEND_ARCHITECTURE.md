# SwapShelf Backend Architecture Guide

## 📁 Backend Logic Organization

The SwapShelf backend is organized using the **MVC (Model-View-Controller)** pattern with additional layers for better separation of concerns. Here's where each piece of backend logic is located:

## 🗄️ **Models** (`/models/`)
**Purpose**: Database schemas, data validation, and business rules

### `User.js`
- User authentication and profile management
- Wishlist functionality
- User statistics and preferences
- Password hashing and validation

### `Book.js`
- Book information and metadata
- Availability status and condition tracking
- Owner relationships and statistics
- Search indexing and categorization

### `Swap.js`
- Swap request lifecycle management
- Status tracking (pending, accepted, completed, etc.)
- Negotiation history and communication
- Rating and feedback system

## 🎛️ **Controllers** (`/controllers/`)
**Purpose**: Business logic, data processing, and API response handling

### `bookController.js`
- **Book Management**: Add, update, delete books
- **Search Logic**: Advanced book search and filtering
- **Availability**: Toggle book availability status
- **Statistics**: Book performance and engagement metrics

### `swapController.js`
- **Swap Lifecycle**: Create, respond to, complete swaps
- **Status Management**: Handle all swap status transitions
- **Communication**: Message handling between users
- **Rating System**: Post-swap rating and feedback

### `userController.js`
- **Profile Management**: Update user information and photos
- **Wishlist Operations**: Add, remove, update wishlist items
- **Activity Tracking**: User reading history and statistics
- **Matching**: Find wishlist matches with available books

### `dashboardController.js`
- **Data Aggregation**: Combine data from multiple sources
- **Statistics**: Real-time user and platform statistics
- **Recommendations**: Generate personalized book suggestions
- **Analytics**: Performance metrics and insights

## 🛣️ **Routes** (`/routes/`)
**Purpose**: API endpoints, request routing, and middleware application

### `auth.js`
- User registration and login
- Password reset functionality
- Session management
- Authentication middleware

### `books.js`
- RESTful book API endpoints
- Search and filtering endpoints
- Book management operations
- File upload handling for book images

### `swaps.js`
- Swap request and response endpoints
- Status update operations
- Communication between users
- Swap history and tracking

### `users.js`
- User profile endpoints
- Wishlist management API
- User activity and statistics
- Photo upload handling

### `dashboard.js`
- Dashboard data aggregation endpoints
- Real-time statistics API
- Performance metrics
- Personalized recommendations

## 🛡️ **Middleware** (`/middleware/`)
**Purpose**: Cross-cutting concerns like authentication, validation, and security

### `auth.js`
- **Authentication**: `requireAuth` - Verify user login
- **Authorization**: `requireOwnership` - Check resource ownership
- **Rate Limiting**: Prevent API abuse
- **Validation**: Request data validation
- **Security**: CORS, CSRF protection

## 🔧 **Helpers** (`/helpers/`)
**Purpose**: Utility functions and shared business logic

### `dashboardHelper.js` *(deprecated - moved to controller)*
- Data aggregation utilities
- Statistics calculation
- Performance metrics

## 📱 **Main Application** (`app.js`)
**Purpose**: Application setup, routing, and configuration

### Key Sections:
1. **Database Connection**: MongoDB setup with Mongoose
2. **Session Management**: User session configuration
3. **Middleware Setup**: Body parsing, static files, security
4. **Route Mounting**: API and page route configuration
5. **View Engine**: EJS template configuration

## 🔄 **Data Flow Architecture**

```
Frontend Request → Route → Middleware → Controller → Model → Database
                                    ↓
Frontend Response ← View/JSON ← Controller ← Model ← Database
```

### Example: Adding a Book
1. **Route** (`/api/books POST`) receives request
2. **Middleware** (`auth.js`) validates user authentication
3. **Controller** (`bookController.addBook`) processes business logic
4. **Model** (`Book.js`) validates and saves to database
5. **Response** returns success/error to frontend

## 🎯 **API Endpoints Structure**

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout

### Books
- `GET /api/books` - Search and list books
- `POST /api/books` - Add new book
- `PUT /api/books/:id` - Update book
- `DELETE /api/books/:id` - Delete book
- `PATCH /api/books/:id/availability` - Toggle availability

### Swaps
- `POST /api/swaps` - Create swap request
- `PUT /api/swaps/:id/respond` - Accept/decline swap
- `PUT /api/swaps/:id/complete` - Mark swap complete
- `POST /api/swaps/:id/rate` - Rate completed swap

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `POST /api/users/wishlist` - Add to wishlist
- `DELETE /api/users/wishlist/:id` - Remove from wishlist

### Dashboard
- `GET /api/dashboard` - Complete dashboard data
- `GET /api/dashboard/stats` - User statistics
- `GET /api/dashboard/nearby` - Nearby books

## 🔒 **Security Implementation**

### Authentication Flow
1. User logs in via `/auth/login`
2. Session created and stored in MongoDB
3. Subsequent requests include session cookie
4. `requireAuth` middleware validates session
5. User data attached to `req.session.user`

### Authorization Levels
- **Public**: Home page, book browsing (limited)
- **Authenticated**: Dashboard, profile, basic operations
- **Owner**: Edit/delete own books and profile
- **Admin**: Platform administration (future)

## 📊 **Database Design**

### Collections
- **users**: User accounts and profiles
- **books**: Book catalog and metadata
- **swaps**: Swap requests and history
- **sessions**: User session storage

### Relationships
- User → Books (one-to-many)
- User → Swaps (many-to-many via requester/owner)
- Book → Swaps (one-to-many)

## 🚀 **Getting Started with Backend Development**

### Adding New Features
1. **Model**: Define data structure in `/models/`
2. **Controller**: Implement business logic in `/controllers/`
3. **Routes**: Create API endpoints in `/routes/`
4. **Middleware**: Add any security/validation in `/middleware/`
5. **Integration**: Mount routes in `app.js`

### Best Practices
- Keep controllers thin, models fat
- Use middleware for cross-cutting concerns
- Validate all input data
- Handle errors gracefully
- Log important operations
- Use async/await for database operations

## 🔧 **Environment Setup**

### Required Environment Variables
```
MONGO_URI=mongodb://localhost:27017/bookswap
SESSION_SECRET=your-secure-secret-key
NODE_ENV=development
PORT=3000
```

### Development Commands
```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm test           # Run test suite
npm run lint       # Check code quality
```

This architecture provides a scalable, maintainable foundation for the SwapShelf book trading platform!
