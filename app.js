const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const logger = require('./src/services/logger');
const queue = require('./src/services/queue');
const { connectToWhatsApp } = require('./src/services/whatsappService');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Make io available globally
global.io = io;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'src/web/public')));

// Define routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/web/views/dashboard.html'));
});

// Add this new route for the grading page
app.get('/grading', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/web/views/grading.html'));
});

// API routes
const apiRoutes = require('./src/web/routes/api');
app.use('/api', apiRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info.whatsapp(`Client connected: ${socket.id}`);

  // Send initial status
  socket.emit('connection-status', {
    whatsappConnected: !!global.sock?.user,
    queueStatus: queue.getStatus(),
    reconnecting: false,
  });

  socket.on('disconnect', (reason) => {
    logger.info.whatsapp(
      `Client disconnected: ${socket.id}, Reason: ${reason}`
    );
  });
});

// Initialize WhatsApp connection
connectToWhatsApp()
  .then(() => {
    logger.info.whatsapp('WhatsApp initialized successfully');
  })
  .catch((err) => {
    logger.error.whatsapp('Error initializing WhatsApp:', err);
  });

// Initialize message queue
queue
  .init()
  .then(() => {
    logger.info.whatsapp(
      `Queue initialized with ${queue.queue.length} messages`
    );
  })
  .catch((err) => {
    logger.error.whatsapp('Error initializing queue:', err);
  });

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info.whatsapp(`Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info.whatsapp('Shutting down...');
  await queue.init(); // Save queue state if needed
  process.exit(0);
});
