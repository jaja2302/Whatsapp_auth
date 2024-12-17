const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidBroadcast,
  useMultiFileAuthState,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

// Keep track of connection state
let isConnected = false;

async function connectToWhatsApp() {
  try {
    const { state, saveCreds } =
      await useMultiFileAuthState('baileys_auth_info');
    let { version } = await fetchLatestBaileysVersion();

    // If we already have a socket, remove all listeners before creating a new one
    if (global.sock) {
      global.sock.ev.removeAllListeners();
      await global.sock.end();
    }

    global.sock = makeWASocket({
      printQRInTerminal: true,
      auth: state,
      logger: pino({ level: 'silent' }),
      version,
      shouldIgnoreJid: (jid) => isJidBroadcast(jid),
    });

    // Set up connection event handlers
    global.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (connection === 'close') {
        isConnected = false;
        console.log('WhatsApp disconnected');

        // Only auto-reconnect if not logged out
        const shouldReconnect =
          lastDisconnect?.error?.output?.statusCode !==
          DisconnectReason.loggedOut;
        if (shouldReconnect) {
          console.log('Attempting to reconnect...');
          connectToWhatsApp();
        }
      } else if (connection === 'open') {
        isConnected = true;
        console.log('WhatsApp connected successfully');
        // Clear any existing QR code from the UI when connected
        global.io?.emit('connection-status', { connected: true });
      }

      // Only emit QR if we're not already connected
      if (qr && !isConnected) {
        global.io?.emit('qr', qr);
      }
    });

    global.sock.ev.on('creds.update', saveCreds);

    await sleep(1000);
    return global.sock;
  } catch (error) {
    console.error('Error in connectToWhatsApp:', error);
    throw error;
  }
}

// Add a function to check connection status
function isWhatsAppConnected() {
  return isConnected && !!global.sock?.user;
}

module.exports = {
  connectToWhatsApp,
  isWhatsAppConnected,
};
