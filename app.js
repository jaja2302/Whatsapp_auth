const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const { connectToWhatsApp } = require('./src/services/whatsappService');
const messageQueue = require('./src/services/queue');

// Initialize express app
const app = express();
const server = http.createServer(app);

// Configure Socket.IO with reconnection settings
const io = socketIO(server, {
  pingTimeout: 60000,
  pingInterval: 25000,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Make io available globally
global.io = io;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'src/web/public')));

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send current WhatsApp connection status
  const status = {
    whatsappConnected: !!global.sock?.user,
    queueStatus: global.queue?.getStatus(),
    reconnecting: false,
  };
  socket.emit('connection-status', status);

  // Send current QR code if available
  const currentQR = require('./src/services/whatsappService').getCurrentQR();
  if (currentQR) {
    console.log('Sending cached QR code to new client');
    socket.emit('qr', currentQR);
  } else if (!global.sock?.user) {
    // If no QR code and not connected, request a new one
    socket.emit('request-new-qr');
  }

  socket.on('request-qr', () => {
    const currentQR = require('./src/services/whatsappService').getCurrentQR();
    if (currentQR) {
      socket.emit('qr', currentQR);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('Client disconnected:', socket.id, 'Reason:', reason);
  });
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/web/views/dashboard.html'));
});

const apiRoutes = require('./src/web/routes/api');
app.use('/api', apiRoutes);

// Initialize WhatsApp connection
connectToWhatsApp().catch((err) =>
  console.error('Error connecting to WhatsApp:', err)
);

// Initialize message queue
messageQueue
  .init()
  .catch((err) => console.error('Error initializing queue:', err));

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await messageQueue.saveQueue();
  process.exit(0);
});
