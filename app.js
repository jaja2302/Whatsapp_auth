// Import necessary modules
const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidBroadcast,
  makeInMemoryStore,
  useMultiFileAuthState,
} = require('@whiskeysockets/baileys');
const winston = require('winston');
const pino = require('pino');
const path = require('path');
const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const qrcode = require('qrcode');
const socketIO = require('socket.io');
const messageQueue = require('./src/services/queue');
const fs = require('fs');
const { connectToWhatsApp } = require('./src/services/whatsappService');
const readline = require('readline');
const util = require('util');

// App Initialization
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Set the io instance in messageQueue
messageQueue.setIO(io);

// Middleware setup
app.use(fileUpload({ createParentPath: true }));
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serving static files
app.use('/assets', express.static(path.join(__dirname, 'client/assets')));

// QR and main route handlers
app.get('/scan', (req, res) =>
  res.sendFile(path.join(__dirname, 'src/web/views/scan.html'))
);
app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'src/web/views/login.html'))
);

const store = makeInMemoryStore({
  logger: pino().child({ level: 'silent', stream: 'store' }),
});
let qr;
let soket;

// Logger Setup
const logger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.Console(),
  ],
});

// Make io available globally for QR code updates
global.io = io;

// Helper function to handle QR code updates
const updateQR = (data) => {
  switch (data) {
    case 'qr':
      qrcode.toDataURL(qr, (err, url) => {
        soket?.emit('qr', url);
        soket?.emit('log', 'QR Code received, please scan!');
      });
      break;
    case 'connected':
      soket?.emit('qrstatus', './assets/check.svg');
      soket?.emit('log', 'WhatsApp connected!');
      break;
    default:
      break;
  }
};

// WebSocket handling
io.on('connection', (socket) => {
  console.log('Client connected');

  soket = socket;
  if (global.sock?.user) {
    updateQR('connected');
  } else if (qr) {
    updateQR('qr');
  }

  // Send recent logs on connection
  const recentLogs = getRecentLogs(); // You'll need to implement this
  recentLogs.forEach((log) => {
    socket.emit('server-log', log);
  });
});

app.get('/testing', async (req, res) => {
  try {
    res.status(200).json({
      status: true,
      response: 'Task Success',
    });
  } catch (error) {
    console.error('Error sending files:', error);
    res.status(500).json({
      status: false,
      response: error.message || 'Internal Server Error',
    });
  }
});

// Use the imported messageQueue instance
global.queue = messageQueue;
console.log('Queue created');

// Check and clear logs if they exceed 2MB
const MB_IN_BYTES = 2 * 1024 * 1024; // 2MB in bytes

function clearLogIfNeeded(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size > MB_IN_BYTES) {
        fs.writeFileSync(filePath, '');
        console.log(`${filePath} exceeded 2MB and was cleared`);
      }
    }
  } catch (error) {
    console.error(`Error handling ${filePath}:`, error);
  }
}

clearLogIfNeeded('./bot_grading_error.log');
clearLogIfNeeded('./bot_grading.log');
console.log('bot_grading_error.log and bot_grading.log cleared');

// Initial connection
connectToWhatsApp().catch((err) =>
  logger.error('Error connecting to WhatsApp:', err)
);

const port = process.env.PORT || 8000;
server.listen(port, () => logger.info(`Server running on port ${port}`));

global.sock = null;

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await global.queue.saveToFile();
  process.exit(0);
});

// Add new imports for web interface
const webRoutes = require('./src/web/routes/serverDashboard');
const apiRoutes = require('./src/web/routes/api');

// Serve static files from the web/public directory
app.use(express.static(path.join(__dirname, 'src/web/public')));

// Use the new routes
app.use('/dashboard', webRoutes);
app.use('/api', apiRoutes);

// Emit logs to clients
function emitLogToClients(level, message) {
  if (global.io) {
    global.io.emit('server-log', { level, message });
  }
}

// Update logger to emit logs
logger.add(
  new winston.transports.Console({
    format: winston.format.printf(({ level, message, timestamp }) => {
      const logMessage = `${timestamp} [${level}]: ${message}`;
      emitLogToClients(level, logMessage);
      return logMessage;
    }),
  })
);

// Watch the queue.log file for changes
fs.watchFile('queue.log', (curr, prev) => {
  if (curr.mtime !== prev.mtime) {
    const rl = readline.createInterface({
      input: fs.createReadStream('queue.log', {
        start: prev.size,
        end: curr.size,
      }),
      output: process.stdout,
      terminal: false,
    });

    rl.on('line', (line) => {
      const logEntry = JSON.parse(line);
      io.emit('server-log', logEntry); // Emit log to clients
    });
  }
});

// Override console.log and console.error
const originalLog = console.log;
const originalError = console.error;

console.log = function () {
  if (global.io) {
    global.io.emit('console-log', util.format.apply(null, arguments));
  }
  originalLog.apply(console, arguments);
};

console.error = function () {
  if (global.io) {
    global.io.emit('error-log', util.format.apply(null, arguments));
  }
  originalError.apply(console, arguments);
};

// Optional: Keep track of recent logs
const recentLogs = [];
const MAX_LOGS = 100;

function getRecentLogs() {
  return recentLogs;
}

function addToRecentLogs(log) {
  recentLogs.push(log);
  if (recentLogs.length > MAX_LOGS) {
    recentLogs.shift();
  }
}

// Add this to your winston logger configuration
logger.on('logging', (transport, level, msg) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: msg,
  };

  addToRecentLogs(logEntry);

  if (global.io) {
    global.io.emit('server-log', logEntry);
  }
});
