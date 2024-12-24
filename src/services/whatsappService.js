const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs').promises;
const path = require('path');
const qrcode = require('qrcode');

let retryCount = 0;
const maxRetries = 5;
const retryDelay = 5000; // 5 seconds
const AUTH_FOLDER = 'auth_info';
let currentQR = null;

async function clearAuthInfo() {
  try {
    const authPath = path.join(process.cwd(), AUTH_FOLDER);
    await fs.rm(authPath, { recursive: true, force: true });
    console.log('Auth info cleared successfully');
  } catch (error) {
    console.error('Error clearing auth info:', error);
    // Don't throw error here, just log it
  }
}

async function disconnectAndClearAuth() {
  try {
    if (global.sock) {
      try {
        await global.sock.logout();
      } catch (error) {
        console.log('Logout error (expected):', error.message);
      }
      await global.sock.end();
      global.sock = null;
    }
    await clearAuthInfo();
    return true;
  } catch (error) {
    console.error('Error during disconnect:', error);
    // Don't throw error, return false instead
    return false;
  }
}

async function connectToWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

    const sock = makeWASocket({
      printQRInTerminal: true,
      auth: state,
      logger: pino({ level: 'silent' }),
      retryRequestDelayMs: 3000,
      qrTimeout: 60000,
      connectTimeoutMs: 60000,
      browser: ['WhatsApp Bot', 'Chrome', '4.0.0'],
    });

    global.sock = sock;

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          console.log('New QR Code received, converting to data URL...');
          const qrDataURL = await qrcode.toDataURL(qr);
          currentQR = qrDataURL; // Cache the QR code
          console.log('QR Code converted, sending to client...');
          // Emit to all connected clients
          global.io?.emit('qr', qrDataURL);
        } catch (err) {
          console.error('QR code generation error:', err);
        }
      }

      if (connection === 'close') {
        currentQR = null; // Clear QR cache on disconnect
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect =
          statusCode !== DisconnectReason.loggedOut && statusCode !== 401; // Don't reconnect on intentional logout

        console.log(
          'Connection closed due to ',
          lastDisconnect?.error?.message
        );

        // Emit connection status
        global.io?.emit('connection-status', {
          whatsappConnected: false,
          queueStatus: global.queue?.getStatus(),
          reconnecting: shouldReconnect,
          error: lastDisconnect?.error?.message,
        });

        if (shouldReconnect && retryCount < maxRetries) {
          retryCount++;
          console.log(`Reconnecting... Attempt ${retryCount} of ${maxRetries}`);
          setTimeout(connectToWhatsApp, retryDelay);
        } else {
          retryCount = 0;
          if (!shouldReconnect) {
            await clearAuthInfo();
          }
        }
      } else if (connection === 'open') {
        console.log('WhatsApp connected successfully');
        retryCount = 0;

        global.io?.emit('connection-status', {
          whatsappConnected: true,
          queueStatus: global.queue?.getStatus(),
          reconnecting: false,
        });

        global.io?.emit('clear-qr');
      }
    });

    sock.ev.on('creds.update', saveCreds);

    return sock;
  } catch (error) {
    console.error('Error in connectToWhatsApp:', error);
    global.io?.emit('connection-status', {
      whatsappConnected: false,
      queueStatus: global.queue?.getStatus(),
      reconnecting: false,
      error: error.message,
    });
    throw error;
  }
}

// Add function to check connection status
function isConnected() {
  return {
    connected: !!global.sock?.user && global.sock.ws.readyState === 1,
    reconnecting: retryCount > 0,
  };
}

// Add new function to get current QR
function getCurrentQR() {
  return currentQR;
}

module.exports = {
  connectToWhatsApp,
  isConnected,
  disconnectAndClearAuth,
  getCurrentQR, // Export the new function
};
