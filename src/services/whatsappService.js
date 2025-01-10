const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs').promises;
const path = require('path');
const qrcode = require('qrcode');
const logger = require('./logger');
const MessageUpsert = require('./messageUpsert');

let retryCount = 0;
const maxRetries = 5;
const retryDelay = 5000;
const AUTH_FOLDER = 'auth_info';
let currentQR = null;

async function clearAuthInfo() {
  try {
    const authPath = path.join(process.cwd(), AUTH_FOLDER);
    await fs.rm(authPath, { recursive: true, force: true });
    logger.info.whatsapp('Auth info cleared successfully');
  } catch (error) {
    logger.error.whatsapp('Error clearing auth info:', error);
  }
}

// Di server (whatsappService.js)
async function disconnectAndClearAuth() {
  logger.info.whatsapp('Disconnecting WhatsApp...');
  try {
    if (global.sock) {
      logger.info.whatsapp('Logging out...');
      try {
        await global.sock.logout();
      } catch (error) {
        logger.info.whatsapp('Logout error (expected):', error.message);
      }
      logger.info.whatsapp('Ending connection...');
      await global.sock.end();
      global.sock = null;
    }
    logger.info.whatsapp('Clearing auth info...');
    await clearAuthInfo();
    return true;
  } catch (error) {
    logger.error.whatsapp('Error during disconnect:', error);
    return false;
  }
}

async function connectToWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const messageUpsertInstance = await MessageUpsert;

    const sock = makeWASocket({
      printQRInTerminal: true,
      auth: state,
      logger: pino({ level: 'silent' }),
      retryRequestDelayMs: 3000,
      qrTimeout: 120000,
      connectTimeoutMs: 120000,
      browser: ['WhatsApp Bot', 'Chrome', '4.0.0'],
      keepAliveIntervalMs: 10000,
      connectTimeoutMs: 60000,
      emitOwnEvents: true,
    });

    global.sock = sock;

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          logger.info.whatsapp(
            'New QR Code received, converting to data URL...'
          );
          const qrDataURL = await qrcode.toDataURL(qr);
          currentQR = qrDataURL;
          // Emit to all connected clients
          global.io?.emit('qr', qrDataURL);
          logger.info.whatsapp('QR Code sent to clients');
        } catch (err) {
          logger.error.whatsapp('QR code generation error:', err);
        }
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = new Promise((resolve) => {
          // Check various disconnect reasons
          if (statusCode === DisconnectReason.loggedOut) {
            resolve(false);
          } else if (statusCode === 408) {
            // Handle timeout specifically
            resolve(true);
          } else if (statusCode === 401) {
            // Unauthorized - clear auth and try again
            clearAuthInfo().then(() => resolve(true));
          } else {
            // For other errors, attempt to reconnect
            resolve(true);
          }
        });

        if (await shouldReconnect) {
          logger.info.whatsapp(
            `Connection closed. Attempting reconnect in ${retryDelay}ms...`
          );
          setTimeout(async () => {
            if (retryCount < maxRetries) {
              retryCount++;
              logger.info.whatsapp(
                `Reconnecting... Attempt ${retryCount} of ${maxRetries}`
              );
              await connectToWhatsApp();
            } else {
              logger.error.whatsapp(
                'Max retry attempts reached. Please restart the application.'
              );
              // Optionally emit a critical error to the frontend
              global.io?.emit('connection-status', {
                whatsappConnected: false,
                queueStatus: global.queue?.getStatus(),
                reconnecting: false,
                error:
                  'Max retry attempts reached. Please restart the application.',
              });
            }
          }, retryDelay);
        } else {
          logger.info.whatsapp(
            'Connection closed permanently. Manual restart required.'
          );
          await clearAuthInfo();
        }
      } else if (connection === 'open') {
        // Only clear QR when successfully connected
        currentQR = null;
        global.io?.emit('clear-qr');
        logger.info.whatsapp('WhatsApp connected successfully');
        retryCount = 0;

        global.io?.emit('connection-status', {
          whatsappConnected: true,
          queueStatus: global.queue?.getStatus(),
          reconnecting: false,
        });

        // Resume queue processing when WhatsApp connects
        global.queue?.onWhatsAppReconnect();
      }
    });

    // Add error event handler
    sock.ev.on('error', async (err) => {
      logger.error.whatsapp('Socket error:', err);
      if (global.sock === sock) {
        // Only attempt reconnect if this is the current socket
        setTimeout(async () => {
          if (retryCount < maxRetries) {
            retryCount++;
            logger.info.whatsapp(
              `Reconnecting after error... Attempt ${retryCount} of ${maxRetries}`
            );
            await connectToWhatsApp();
          }
        }, retryDelay);
      }
    });

    // Add message handler
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      for (const message of messages) {
        if (!message.key.fromMe) {
          const noWa = message.key.remoteJid;
          const isGroup = noWa.endsWith('@g.us');
          const isPrivate = noWa.endsWith('@s.whatsapp.net');
          const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.documentWithCaptionMessage?.message
              ?.documentMessage?.caption ||
            'No message text available';
          const lowerCaseMessage = text.toLowerCase();
          const contextInfo = message.message?.extendedTextMessage?.contextInfo;
          const isReply = !!contextInfo?.quotedMessage;

          if (isReply) {
            const text_repply = message.message.extendedTextMessage.text;
            const quotedMessage = contextInfo.quotedMessage;
            const conversation = contextInfo.quotedMessage.conversation;
            const respon_atasan = text_repply;

            if (quotedMessage.conversation) {
              logger.info.whatsapp('Reply message:', conversation);
              await messageUpsertInstance.handleReplyNoDocMessage(
                conversation,
                noWa,
                sock,
                respon_atasan,
                message
              );
            } else if (quotedMessage.documentWithCaptionMessage) {
              logger.info.whatsapp('Reply document message:', conversation);
              await messageUpsertInstance.handleReplyDocMessage(
                conversation,
                noWa,
                sock,
                respon_atasan,
                quotedMessage
              );
            }
          } else {
            if (isGroup) {
              logger.info.whatsapp('Group message:', lowerCaseMessage);
              await messageUpsertInstance.handleGroupMessage(
                lowerCaseMessage,
                noWa,
                text,
                sock,
                message
              );
            } else if (isPrivate) {
              logger.info.whatsapp('Private message:', lowerCaseMessage);
              await messageUpsertInstance.handlePrivateMessage(
                lowerCaseMessage,
                noWa,
                text,
                sock,
                message
              );
            }
          }
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);

    return sock;
  } catch (error) {
    logger.error.whatsapp('Error in connectToWhatsApp:', error);
    // Attempt to reconnect on initialization error
    if (retryCount < maxRetries) {
      retryCount++;
      logger.info.whatsapp(
        `Retrying connection... Attempt ${retryCount} of ${maxRetries}`
      );
      setTimeout(connectToWhatsApp, retryDelay);
    }
    throw error;
  }
}

function isConnected() {
  return {
    connected: !!global.sock?.user && global.sock.ws.readyState === 1,
    reconnecting: retryCount > 0,
  };
}

function getCurrentQR() {
  return currentQR;
}

async function getParticipants() {
  try {
    if (!global.sock?.user) {
      throw new Error('WhatsApp is not connected');
    }
    const participants = await global.sock.groupFetchAllParticipating();
    return participants;
  } catch (error) {
    logger.error.whatsapp('Error fetching participants:', error);
    throw error;
  }
}

module.exports = {
  connectToWhatsApp,
  isConnected,
  disconnectAndClearAuth,
  getCurrentQR,
  getParticipants,
};
