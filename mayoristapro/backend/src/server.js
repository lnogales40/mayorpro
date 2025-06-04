// mayoristapro/backend/src/server.js
require('dotenv').config(); // Load environment variables at the top

const express = require('express');
const cors = require('cors');
// const db = require('./db'); // Will be used later when routes are added
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 3000;
const WEBSOCKET_PORT = process.env.WEBSOCKET_PORT || 3001; // For later use

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Basic Route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to MayoristaPro Backend API!' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes); // Mount user routes under /api/users
// const productRoutes = require('./routes/productRoutes'); // Placeholder for next routes
// app.use('/api/products', productRoutes); // Placeholder for next routes
// ... and so on for other routes

// Global error handler (basic example)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start Server
if (process.env.NODE_ENV !== 'test') { // Avoid starting server during tests
  app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
  });

  // Placeholder for WebSocket server initialization (to be implemented in websocket/index.js)
  // const initializeWebSocketServer = require('./websocket');
  // const httpServer = require('http').createServer(); // Or attach to existing Express app if sharing port
  // initializeWebSocketServer(httpServer);
  // httpServer.listen(WEBSOCKET_PORT, () => {
  //   console.log(`WebSocket server is running on ws://localhost:${WEBSOCKET_PORT}`);
  // });
}

module.exports = app; // Export for testing purposes
