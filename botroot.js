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
const Queue = require('./utils/queue');
const fs = require('fs');

const { setupCronJobs, statusAWS } = require('./helper');
const {
  runfunction,
  updatestatus_sock_vbot,
} = require('./utils/izinkebun/helper');
const { Generateandsendtaksasi } = require('./utils/taksasi/taksasihelper');
const { handlePrivateMessage } = require('./utils/private_messages');
const { function_rapidresponse } = require('./utils/rapiprespons/helper');
const {
  get_mill_data,
  run_jobs_mill,
  broadcast_grading_mill,
} = require('./utils/grading/gradinghelper');
const { pingGoogle, sendSummary } = require('./utils/rekap_harian_uptime');
const { get_iot_weatherstation } = require('./utils/iot/iothelper');
const {
  get_outstadingdata,
  function_marcom,
} = require('./utils/marcom/marcomhelper');
const { handleReplyNoDocMessage } = require('./utils/repply_no_doc_messages');
const { handleReplyDocMessage } = require('./utils/repply_with_doc_messages');
const { handleGroupMessage } = require('./utils/group_messages');
const { helperfunctionSmartlabs } = require('./utils/smartlabs/smartlabs');
const { connectToWhatsApp } = require('./src/services/whatsappService');

// App Initialization
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

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
  soket = socket;
  if (global.sock?.user) {
    updateQR('connected');
  } else if (qr) {
    updateQR('qr');
  }
});

app.get('/testing', async (req, res) => {
  try {
    // await pingGoogle();
    // await statusAWS();
    // da
    // console.log(sock.user);
    // console.log(result);
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
// Create a global queue instance
global.queue = new Queue();
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
// runfunction();
// setupCronJobs();
// function_rapidresponse();
// function_marcom();
// broadcast_grading_mill();
// helperfunctionSmartlabs();
// ... other function calls
const port = process.env.PORT || 8000;
server.listen(port, () => logger.info(`Server running on port ${port}`));

global.sock = null;

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await global.queue.saveToFile();
  process.exit(0);
});

// Add new imports for web interface
const webRoutes = require('./src/web/routes/dashboard');
const apiRoutes = require('./src/web/routes/api');
const authRoutes = require('./src/web/routes/auth');

// Serve static files from the web/public directory
app.use(express.static(path.join(__dirname, 'src/web/public')));

// Use the new routes
app.use('/auth', authRoutes);
app.use('/dashboard', webRoutes);
app.use('/api', apiRoutes);
