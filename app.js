const path = require('path');
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { connectToWhatsApp } = require('./src/services/whatsappService');
const messageQueue = require('./src/services/queue');
const pino = require('pino');

// Initialize the logger
const logger = pino();

// Initialize the queue first
global.queue = messageQueue;

// Then initialize WhatsApp connection
connectToWhatsApp().catch((err) => {
  console.error('Error connecting to WhatsApp:', err);
});

// App Initialization
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const port = process.env.PORT || 8000;

// Make io available globally and to queue
global.io = io;
messageQueue.setIO(io);

// Import routes (only once!)
const apiRoutes = require('./src/web/routes/api');
const dashboardRoutes = require('./src/web/routes/dashboard');
const authRoutes = require('./src/web/routes/auth');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'src/web/public')));

// Routes
app.use('/api', apiRoutes);
app.use('/', dashboardRoutes);
app.use('/auth', authRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({
    success: false,
    error: err.message || 'Something went wrong!',
  });
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
// Graceful shutdown handler
const handleShutdown = async () => {
  logger.info('Shutting down...');
  try {
    // Stop accepting new connections
    server.close();

    // Close WhatsApp connection
    if (global.sock) {
      try {
        await global.sock.logout();
        await global.sock.end();
      } catch (error) {
        logger.error('Error closing WhatsApp connection:', error);
      }
    }

    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
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
    });
  } catch (err) {
    logger.error('Error starting server:', err);
    process.exit(1);
  }
};

// Start the application
startServer();

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info('Client connected');

  socket.on('disconnect', () => {
    logger.info('Client disconnected');
  });
});

// Export for testing
module.exports = { app, server };
