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

const { setupCronJobs } = require('./helper');
const { runfunction } = require('./utils/izinkebun/helper');
const { Generateandsendtaksasi } = require('./utils/taksasi/taksasihelper');
const { handlePrivateMessage } = require('./utils/private_messages');
const { function_rapidresponse } = require('./utils/rapiprespons/helper');
const { get_mill_data } = require('./utils/grading/gradinghelper');
const { pingGoogle, sendSummary } = require('./utils/rekap_harian_uptime');
const { get_iot_weatherstation } = require('./utils/iot/iothelper');
const {
  get_outstadingdata,
  function_marcom,
} = require('./utils/marcom/marcomhelper');
const { handleReplyNoDocMessage } = require('./utils/repply_no_doc_messages');
const { handleReplyDocMessage } = require('./utils/repply_with_doc_messages');
const { handleGroupMessage } = require('./utils/group_messages');

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
  res.sendFile('./client/server.html', { root: __dirname })
);
app.get('/', (req, res) =>
  res.sendFile('./client/index.html', { root: __dirname })
);

const store = makeInMemoryStore({
  logger: pino().child({ level: 'silent', stream: 'store' }),
});
let sock;
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

// WhatsApp Connection Function
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
  let { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    logger: pino({ level: 'silent' }),
    version,
    shouldIgnoreJid: (jid) => isJidBroadcast(jid),
  });

  store.bind(sock.ev);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (lastDisconnect?.error) {
      logger.error('Connection Error:', lastDisconnect.error);
      if (
        lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut
      ) {
        setTimeout(() => connectToWhatsApp(), 5000); // Retry logic
      }
    } else if (connection === 'open') {
      logger.info('WhatsApp connected successfully');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    for (const message of messages) {
      if (!message.key.fromMe) {
        const noWa = message.key.remoteJid;
        const isGroup = noWa.endsWith('@g.us');
        const isPrivate = noWa.endsWith('@s.whatsapp.net');
        const text =
          message.message?.conversation ||
          message.message?.extendedTextMessage?.text ||
          message.message?.documentWithCaptionMessage?.message?.documentMessage
            ?.caption ||
          'No message text available';
        const lowerCaseMessage = text.toLowerCase();
        const contextInfo = message.message?.extendedTextMessage?.contextInfo;
        const isReply = !!contextInfo?.quotedMessage;
        // console.log(
        //   `remoteJid: ${noWa}, isReply: ${isReply}, isGroup: ${isGroup}, isPrivate: ${isPrivate}`
        // );
        if (isReply) {
          const contextInfo = message.message.extendedTextMessage.contextInfo;
          const text_repply = message.message.extendedTextMessage.text;
          const quotedMessageSender = contextInfo.participant;
          const respon_atasan = text_repply;
          const is_repply_text =
            contextInfo.quotedMessage && contextInfo.quotedMessage.conversation;
          const is_repply_doc =
            contextInfo.quotedMessage &&
            contextInfo.quotedMessage.documentWithCaptionMessage &&
            contextInfo.quotedMessage.documentWithCaptionMessage.message &&
            contextInfo.quotedMessage.documentWithCaptionMessage.message
              .documentMessage;
          const quotedMessage = contextInfo.quotedMessage;
          const conversation = contextInfo.quotedMessage.conversation;
          if (quotedMessage.conversation) {
            // console.log('This is a reply to a text message');
            // Handle reply to text
            await handleReplyNoDocMessage(
              conversation,
              noWa,
              sock,
              respon_atasan,
              message
            );
          } else if (quotedMessage.documentWithCaptionMessage) {
            // console.log('This is a reply to a text document');
            await handleReplyDocMessage(
              conversation,
              noWa,
              sock,
              respon_atasan,
              quotedMessage
            );
          }
        } else {
          if (isGroup) {
            // console.log('This is a group message without reply:', text);
            // Handle group message
            await handleGroupMessage(
              lowerCaseMessage,
              noWa,
              text,
              sock,
              message
            );
          } else if (isPrivate) {
            // console.log('This is a private message without reply:', text);
            // Handle other private messages
            await handlePrivateMessage(lowerCaseMessage, noWa, text, sock);
          }
        }
        // Handle document messages (both in private and group)
        if (message.message?.documentWithCaptionMessage) {
          const documentMessage =
            message.message.documentWithCaptionMessage.message.documentMessage;
          console.log(
            'This message contains a document:',
            documentMessage.fileName,
            documentMessage.caption
          );
          // Handle document message
        }
      }
    }
  });

  setupCronJobs(sock);
  runfunction(sock);
  function_rapidresponse(sock);
  function_marcom(sock);
}

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
  if (sock?.user) {
    updateQR('connected');
  } else if (qr) {
    updateQR('qr');
  }
});

connectToWhatsApp().catch((err) =>
  logger.error('Error connecting to WhatsApp:', err)
);
const port = process.env.PORT || 8000;
server.listen(port, () => logger.info(`Server running on port ${port}`));
