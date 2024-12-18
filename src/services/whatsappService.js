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
const { handleGroupMessage } = require('../../utils/group_messages');
const { handlePrivateMessage } = require('../../utils/private_messages');
const {
  handleReplyNoDocMessage,
} = require('../../utils/repply_no_doc_messages');
const {
  handleReplyDocMessage,
} = require('../../utils/repply_with_doc_messages');
const { log } = require('../web/programs/grading/gradingMill');

// Keep track of connection state
let isConnected = false;
let isReconnecting = false;

// Add handler state management
const messageHandlers = {
  groupMessages: { enabled: true, name: 'Group Messages' },
  privateMessages: { enabled: true, name: 'Private Messages' },
  replyNoDoc: { enabled: true, name: 'Reply (No Doc)' },
  replyWithDoc: { enabled: true, name: 'Reply (With Doc)' },
};

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

      // Update queue when connection is established
      if (connection === 'open' && global.sock.user) {
        console.log('WhatsApp connected!');
        if (global.queue) {
          global.queue.whatsappConnected = true;
          // Emit connection status to all clients
          if (global.io) {
            global.io.emit('whatsapp:status', {
              connected: true,
              user: global.sock.user.id,
            });
          }
        }
      } else if (connection === 'close') {
        console.log('WhatsApp disconnected!');
        if (global.queue) {
          global.queue.whatsappConnected = false;
          global.queue.pause();
          // Emit connection status to all clients
          if (global.io) {
            global.io.emit('whatsapp:status', {
              connected: false,
            });
          }
        }
      }
    });

    global.sock.ev.on('creds.update', saveCreds);

    global.sock.ev.on('messages.upsert', async ({ messages, type }) => {
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
          // console.log(
          //   `remoteJid: ${noWa}, isReply: ${isReply}, isGroup: ${isGroup}, isPrivate: ${isPrivate}`
          // );
          console.log(text);

          try {
            if (isGroup && messageHandlers.groupMessages.enabled) {
              await handleGroupMessage(message);
            } else if (isPrivate && messageHandlers.privateMessages.enabled) {
              await handlePrivateMessage(message);
            }

            if (isReply) {
              if (
                quotedMessage?.documentMessage &&
                messageHandlers.replyWithDoc.enabled
              ) {
                await handleReplyDocMessage(message);
              } else if (messageHandlers.replyNoDoc.enabled) {
                await handleReplyNoDocMessage(message);
              }
            }
          } catch (error) {
            console.error('Error handling message:', error);
          }
          // Handle document messages (both in private and group)
          if (message.message?.documentWithCaptionMessage) {
            const documentMessage =
              message.message.documentWithCaptionMessage.message
                .documentMessage;
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

    // Add connection check method
    global.sock.isConnected = () => {
      return (
        global.sock.user &&
        global.sock.ws.readyState === global.sock.ws.OPEN &&
        typeof global.sock.sendMessage === 'function'
      );
    };

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

// Add function to toggle handlers
function toggleMessageHandler(handlerId, enabled) {
  if (messageHandlers[handlerId] !== undefined) {
    messageHandlers[handlerId].enabled = enabled;
    return true;
  }
  return false;
}

// Add function to get handler states
function getMessageHandlerStates() {
  return messageHandlers;
}

module.exports = {
  connectToWhatsApp,
  isWhatsAppConnected,
  toggleMessageHandler,
  getMessageHandlerStates,
};
