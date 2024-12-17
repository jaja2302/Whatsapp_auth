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
let isReconnecting = false;

async function connectToWhatsApp() {
  try {
    if (isReconnecting) {
      console.log('Already attempting to reconnect...');
      return;
    }

    isReconnecting = true;
    global.io?.emit('reconnecting', true);

    const { state, saveCreds } =
      await useMultiFileAuthState('baileys_auth_info');
    let { version } = await fetchLatestBaileysVersion();

    // If we already have a socket, remove all listeners before creating a new one
    if (global.sock) {
      try {
        global.sock.ev.removeAllListeners();
        await global.sock.end();
      } catch (err) {
        console.log('Error closing existing connection:', err);
        // Continue with new connection even if there's an error closing the old one
      }
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

      if (qr) {
        // Convert QR code to data URL
        const qrUrl = `data:image/png;base64,${qr}`;
        console.log('New QR code generated');
        global.io?.emit('qr', qrUrl);
      }

      if (connection === 'close') {
        isConnected = false;
        isReconnecting = false;
        console.log('WhatsApp disconnected');
        global.io?.emit('connection-status', {
          connected: false,
          isReconnecting: false,
        });

        const shouldReconnect =
          lastDisconnect?.error?.output?.statusCode !==
          DisconnectReason.loggedOut;
        if (shouldReconnect) {
          console.log('Attempting to reconnect...');
          connectToWhatsApp();
        }
      } else if (connection === 'open') {
        isConnected = true;
        isReconnecting = false;
        console.log('WhatsApp connected successfully');
        global.io?.emit('connection-status', {
          connected: true,
          isReconnecting: false,
        });
      }
    });

    global.sock.ev.on('creds.update', saveCreds);

    await sleep(1000);
    return global.sock;
  } catch (error) {
    console.error('Error in connectToWhatsApp:', error);
    isReconnecting = false;
    global.io?.emit('reconnecting', false);
    throw error;
  }
}

// Add a function to check connection status
function isWhatsAppConnected() {
  return {
    isConnected: isConnected && !!global.sock?.user,
    isReconnecting,
  };
}

module.exports = {
  connectToWhatsApp,
  isWhatsAppConnected,
};
