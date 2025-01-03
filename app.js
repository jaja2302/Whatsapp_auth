const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const logger = require('./src/services/logger');
const queue = require('./src/services/queue');
const { connectToWhatsApp } = require('./src/services/whatsappService');
const cronJobRunner = require('./src/services/CronJobRunner');
const templateEngine = require('./src/services/templateEngine');
const pusherService = require('./src/services/pusher');
const SmartlabsProgram = require('./src/Programs/Smartlabs');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Make io available globally
global.io = io;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'src/web/public')));

// Define routes
app.get('/', async (req, res) => {
  try {
    const html = await templateEngine.render('dashboard', {
      title: 'Dashboard',
      scripts: '<script src="/js/dashboard.js" defer></script>',
    });
    res.send(html);
  } catch (error) {
    res.status(500).send('Error rendering template');
  }
});

// Add this new route for the grading page
app.get('/grading', async (req, res) => {
  try {
    const html = await templateEngine.render('grading', {
      title: 'Grading Programs',
      scripts: '<script src="/js/grading.js" defer></script>',
    });
    res.send(html);
  } catch (error) {
    res.status(500).send('Error rendering template');
  }
});

app.get('/smartlabs', async (req, res) => {
  try {
    const html = await templateEngine.render('smartlabs', {
      title: 'Smartlabs',
      scripts: '<script src="/js/smartlabs.js" defer></script>',
    });
    res.send(html);
  } catch (error) {
    res.status(500).send('Error rendering template');
  }
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

// Initialize Cron Job Runner
cronJobRunner.initialize().catch((error) => {
  logger.error.grading('Error initializing cron jobs:', error);
});

// Initialize programs that use Pusher
const smartlabs = new SmartlabsProgram();

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
