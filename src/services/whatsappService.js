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
        // Don't clear QR here, it might be needed for reconnection
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect =
          statusCode !== DisconnectReason.loggedOut && statusCode !== 401;

        logger.info.whatsapp(
          'Connection closed due to:',
          lastDisconnect?.error?.message
        );

        global.io?.emit('connection-status', {
          whatsappConnected: false,
          queueStatus: global.queue?.getStatus(),
          reconnecting: shouldReconnect,
          error: lastDisconnect?.error?.message,
        });

        if (shouldReconnect && retryCount < maxRetries) {
          retryCount++;
          logger.info.whatsapp(
            `Reconnecting... Attempt ${retryCount} of ${maxRetries}`
          );
          setTimeout(connectToWhatsApp, retryDelay);
        } else {
          retryCount = 0;
          if (!shouldReconnect) {
            await clearAuthInfo();
          }
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
    global.io?.emit('connection-status', {
      whatsappConnected: false,
      queueStatus: global.queue?.getStatus(),
      reconnecting: false,
      error: error.message,
    });
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
