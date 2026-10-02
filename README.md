# RentWheels — Full-Stack Car Rental & Fleet Management System

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B%20%7C%20v20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express.js](https://img.shields.io/badge/Express-4.18-000000?logo=express&logoColor=white)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%208.x-47A248?logo=mongodb&logoColor=white)](https://mongoosejs.com)
[![Jest Test Suite](https://img.shields.io/badge/Tests-136%2F136%20Passed-brightgreen?logo=jest&logoColor=white)](https://jestjs.io)
[![Code Quality](https://img.shields.io/badge/Security-CSRF%20%2B%20RBAC%20%2B%20Bcrypt-blue)](https://owasp.org)
[![License](https://img.shields.io/badge/License-MIT-lightgrey.svg)](LICENSE)

A production-grade, API-driven car rental platform and fleet operations management system built with **Node.js**, **Express**, **MongoDB/Mongoose**, and **Vanilla JavaScript / Bootstrap**. Designed with a decoupled REST API architecture, role-based access control (RBAC), end-to-end CSRF defense, and a full testing suite featuring **136 automated unit and integration tests**.

---

## 🌟 Highlights & Key Features

### 🚗 Vehicle Fleet Management
- **Full Fleet Lifecycle**: Comprehensive CRUD operations for vehicle inventory (make, model, year, daily rate, transmission, fuel type, seating capacity, availability flag).
- **Multipart Media Uploads**: Multer-powered image upload pipeline with MIME-type restriction and secure storage.
- **Dynamic Search & Discovery**: Multi-parameter search filter (keyword search, brand, category, price interval, transmission type).

### 📅 Booking Engine & Reservation Lifecycle
- **Date Verification**: Validation ensuring reservation dates are strictly in the future (`startDate >= today` and `endDate > startDate`).
- **Conflict & Overlap Prevention**: Booking engine prevents double-booking vehicles across overlapping date windows.
- **Automated Cost Calculation**: Total cost calculated server-side based on booking duration and daily vehicle rental rates.
- **Lifecycle Status Machine**: Transitions across `pending` → `confirmed` → `completed` or `cancelled`.
- **Self-Service Cancellation**: Users can safely cancel pending reservations before pickup.

### 🔐 Security & Access Control
- **Role-Based Access Control (RBAC)**: Distinct permissions for `client` (catalog browsing, profile management, personal bookings) and `admin` (fleet creation/updates, booking oversight, administrative analytics dashboard).
- **CSRF Token Guarding**: Double Submit / Synchronizer Token Pattern powered by `csurf` on mutating HTTP methods (`POST`, `PUT`, `DELETE`).
- **Cryptographic Hashing**: Passwords salted and hashed with `bcryptjs`.
- **Session Protection**: Hardened HTTP cookies with `HttpOnly`, `SameSite=Lax`, and MongoDB-backed session persistence via `connect-mongo`.
- **Input Sanitization & Validation**: `express-validator` middleware validating incoming request bodies.

### 📊 Administrative Dashboard
- Real-time fleet metrics (total vehicles, active rentals, pending approvals).
- Fleet utilization rates and cumulative booking revenue statistics.

---

## 🏗️ Architecture & Technology Stack

```
                        ┌─────────────────────────────────────┐
                        │      Client (Browser / SPA UI)      │
                        │   Bootstrap 5 + Fetch API + Forms   │
                        └──────────────────┬──────────────────┘
                                           │ HTTP / JSON / Cookies
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Express.js Application                             │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ Middleware: Helmet, CORS, Session (MongoStore), CSRF, Multer, RBAC   │   │
│   └──────────────────────────────────┬──────────────────────────────────┘   │
│                                      │                                      │
│         ┌────────────────────────────┴───────────────────────────┐          │
│         ▼                                                        ▼          │
│  ┌──────────────┐                                         ┌──────────────┐  │
│  │ Public APIs  │                                         │  Admin APIs  │  │
│  │ Auth, Cars,  │                                         │ Fleet CRUD,  │  │
│  │ Bookings     │                                         │ Dashboard    │  │
│  └──────┬───────┘                                         └──────┬───────┘  │
│         │                                                        │          │
│         └────────────────────────────┬───────────────────────────┘          │
│                                      ▼                                      │
│                      ┌───────────────────────────────┐                      │
│                      │   Controllers & Services      │                      │
│                      └───────────────┬───────────────┘                      │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │ Mongoose ODM 8.x
                                       ▼
                        ┌───────────────────────────────┐
                        │      MongoDB Database         │
                        │ (Users, Cars, Bookings, Sess) │
                        └───────────────────────────────┘
```

| Layer | Technologies | Purpose |
| :--- | :--- | :--- |
| **Runtime & Server** | Node.js (v18+), Express 4.18 | Event-driven backend service |
| **Database & ODM** | MongoDB, Mongoose 8.3 | Schematized data modeling, validation, indexing |
| **Authentication** | `express-session`, `connect-mongo`, `bcryptjs` | Cookie-based session auth with persistent store |
| **Security** | `csurf`, `express-validator` | CSRF mitigation & parameter sanitization |
| **File Handling** | `multer` | Multipart file upload parsing & validation |
| **Testing** | Jest 29, Supertest 6, `mongodb-memory-server` | 136 in-memory unit and integration tests |
| **Frontend** | HTML5, CSS3, Vanilla JS, Bootstrap 5 | Responsive UI for mobile and desktop |

---

## 📁 Repository Structure

```
car_rent/
├── config/
│   ├── database.js          # MongoDB connection handler with test-mode bypass
│   └── multerConfig.js      # Vehicle image upload configuration
├── controllers/
│   ├── admin/
│   │   ├── bookingController.js   # Admin booking status management
│   │   ├── carController.js       # Admin vehicle fleet CRUD
│   │   └── dashboardController.js # Fleet utilization & revenue analytics
│   ├── authController.js    # Register, login, logout, password change
│   ├── bookingController.js # User reservation creation & retrieval
│   └── carController.js     # Public fleet search & retrieval
├── middleware/
│   └── authMiddleware.js    # ensureAuthenticated, isAdmin, forwardAuthenticated
├── models/
│   ├── Booking.js           # Reservation schema, validation, & statuses
│   ├── Car.js               # Vehicle specification schema & availability
│   └── User.js              # User schema with bcrypt pre-save hashing
├── public/
│   ├── admin/               # Admin management portal views
│   ├── auth/                # Login and registration views
│   ├── bookings/            # Reservation forms and user bookings list
│   ├── cars/                # Public vehicle discovery & vehicle detail views
│   ├── css/                 # Global styles and admin theme
│   ├── images/              # Curated vehicle assets and icons
│   ├── js/                  # Client-side API controllers (Fetch API)
│   └── index.html           # Landing page
├── routes/
│   ├── admin/               # Protected administrative routes
│   ├── authRoutes.js        # Authentication endpoints
│   ├── bookingRoutes.js     # Booking lifecycle endpoints
│   └── carRoutes.js         # Public vehicle endpoints
├── tests/
│   ├── fixtures/            # Binary assets for upload tests
│   ├── integration/         # Supertest API endpoint test suites
│   ├── unit/                # Controller, model, and utility unit tests
│   └── setup.js             # MongoMemoryServer lifecycle hooks
├── utils/
│   └── apiResponse.js       # Standardized { success, message, data } formatter
├── app.js                   # Express application setup and middleware assembly
├── jest.config.js           # Jest runner configuration
├── package.json             # NPM dependencies & test scripts
└── README.md                # Project documentation
```

---

## 📡 REST API Reference

All responses conform to the uniform API response envelope:
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

### Authentication Endpoints (`/api/auth`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register a new client account |
| `POST` | `/api/auth/login` | Public | Authenticate user & establish session |
| `POST` | `/api/auth/logout` | Authenticated | Terminate session & clear cookies |
| `GET` | `/api/auth/current-user` | Authenticated | Retrieve authenticated user profile |
| `PUT` | `/api/auth/change-password`| Authenticated | Update user password |

### Vehicle Inventory Endpoints (`/api/cars`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/cars` | Public | Paginated list with filtering (search, brand, price) |
| `GET` | `/api/cars/:id` | Public | Fetch vehicle details by ID |
| `POST` | `/api/admin/cars` | Admin | Create a new vehicle listing with image upload |
| `PUT` | `/api/admin/cars/:id` | Admin | Update vehicle details or availability |
| `DELETE` | `/api/admin/cars/:id` | Admin | Delete vehicle listing from database |

### Booking Lifecycle Endpoints (`/api/bookings`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/bookings` | Authenticated | Create a reservation for an available car |
| `GET` | `/api/bookings/my-bookings`| Authenticated | List all reservations for the current user |
| `PUT` | `/api/bookings/:id/cancel` | Authenticated | Cancel a pending reservation |
| `GET` | `/api/admin/bookings` | Admin | List all reservations across the platform |
| `PUT` | `/api/admin/bookings/:id/status`| Admin | Update reservation status (`confirmed`, `completed`) |

### Dashboard & Analytics (`/api/admin/dashboard`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/dashboard/stats`| Admin | Aggregate fleet, booking, and revenue statistics |

---

## 🧪 Comprehensive Testing Suite

The repository includes **14 test suites** comprising **136 individual tests** covering every layer of the system.

### Test Execution
```bash
npm test
```

### Test Suite Architecture
- **In-Memory Isolation**: Uses `mongodb-memory-server` during integration runs. No local MongoDB daemon required. Zero side effects or leftover database state.
- **Unit Tests**:
  - Model validations (required fields, schema types, regex validation).
  - Controller logic (mocked database responses, edge cases, error branches).
  - API response utility guarantees.
- **Integration Tests**:
  - End-to-end HTTP request/response validation using `supertest`.
  - Authentication flow (registration, session persistence, unauthorized rejection).
  - RBAC enforcement (401 Unauthorized for unauthenticated, 403 Forbidden for non-admins).
  - CSRF protection validation.

```text
PASS tests/unit/utils/apiResponse.test.js
PASS tests/unit/models/Car.test.js
PASS tests/unit/controllers/admin/dashboardController.test.js
PASS tests/unit/controllers/authController.test.js
PASS tests/unit/controllers/bookingController.test.js
PASS tests/unit/controllers/admin/carController.test.js
PASS tests/unit/models/User.test.js
PASS tests/integration/publicCar.test.js
PASS tests/integration/auth.test.js
PASS tests/integration/userBooking.test.js
PASS tests/integration/adminCar.test.js
PASS tests/integration/adminBooking.test.js

Test Suites: 14 passed, 14 total
Tests:       136 passed, 136 total
Snapshots:   0 total
Time:        4.443 s
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.x or v20.x recommended)
- [MongoDB](https://www.mongodb.com/) (v6.x or v7.x running locally, or a MongoDB Atlas URI)
- [Git](https://git-scm.com/)

### 1. Clone & Install
```bash
git clone https://github.com/youunss/car_rent.git
cd car_rent
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory:
```bash
cp .env.example .env
```
Populate `.env` with your settings:
```ini
PORT=3000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/car_rental_db
SESSION_SECRET=super_secret_session_key_minimum_32_characters_long
```

### 3. Run the Application
```bash
# Start server in production mode
npm start

# Or run with nodemon for development
npm run dev
```

The application will be live at `http://localhost:3000`.

---

## 🛡️ Security Best Practices Implemented
1. **CSRF Protection**: All non-GET API endpoints are shielded with CSRF tokens.
2. **Session Hardening**: Sessions are signed with cryptographic secrets and saved to MongoDB.
3. **Password Security**: Bcrypt hashes with auto-generated salt rounds.
4. **Validation**: Server-side request validation on every endpoint prevents bad inputs from reaching the database.
5. **No Secrets in Source**: `.gitignore` strictly protects `.env`, uploaded user assets, and session artifacts.

---

## 👤 Author
**Younss Yahya**  
- GitHub: [@youunss](https://github.com/youunss)
- Degree: Computer Science, Misr International University (MIU)
- Focus: Cybersecurity, Systems Architecture & Cloud Infrastructure