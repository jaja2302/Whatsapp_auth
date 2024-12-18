const path = require('path');
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { connectToWhatsApp } = require('./src/services/whatsappService');
const routes = require('./src/web/routes/dashboard');
const apiRoutes = require('./src/web/routes/api.js');
const authRoutes = require('./src/web/routes/auth.js');
// const logger = require('.pino');
const logger = require('pino');
// App Initialization
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const port = process.env.PORT || 8000;

// Make io available globally for QR code updates
global.io = io;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'src/web/public')));

// Routes
app.use('/', routes);
app.use('/api', apiRoutes);
app.use('/auth', authRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Something went wrong!',
  });
});

// Graceful shutdown handler
const handleShutdown = async () => {
  console.log('Shutting down...');
  try {
    // Stop accepting new connections
    server.close();

    // Close WhatsApp connection
    if (global.sock) {
      try {
        await global.sock.logout();
        await global.sock.end();
      } catch (error) {
        console.error('Error closing WhatsApp connection:', error);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

// Start server and initialize components
const startServer = async () => {
  try {
    // Initialize WhatsApp connection
    await connectToWhatsApp();

    // Start the server
    server.listen(port, () => {
      logger.info(`Server running on port ${port}`);
      console.log(`Server running on port ${port}`);
    });
  } catch (err) {
    logger.error('Error starting server:', err);
    console.error('Error starting server:', err);
    process.exit(1);
  }
};

// Start the application
startServer();

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Export for testing
module.exports = { app, server };
