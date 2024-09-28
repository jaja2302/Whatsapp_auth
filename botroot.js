const {
  default: makeWASocket,
  MessageType,
  MessageOptions,
  Mimetype,
  DisconnectReason,
  BufferJSON,
  AnyMessageContent,
  delay,
  fetchLatestBaileysVersion,
  isJidBroadcast,
  makeCacheableSignalKeyStore,
  makeInMemoryStore,
  MessageRetryMap,
  useMultiFileAuthState,
  msgRetryCounterMap,
  proto,
} = require('@whiskeysockets/baileys');

const log = (pino = require('pino'));
const { session } = { session: 'baileys_auth_info' };
const { Boom } = require('@hapi/boom');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = require('express')();
const axios = require('axios');

const { setupCronJobs } = require('./helper.js');
const { runfunction } = require('./utils/izinkebun/helper.js');
const { Generateandsendtaksasi } = require('./utils/taksasi/taksasihelper.js');
const { handlePrivateMessage } = require('./utils/private_messages.js');
const { function_rapidresponse } = require('./utils/rapiprespons/helper.js');
const { get_mill_data } = require('./utils/grading/gradinghelper');
const { pingGoogle, sendSummary } = require('./utils/rekap_harian_uptime.js');
// const { get_outstadingdata } = require('./utils/marcom/marcomhelper');
const {
  get_outstadingdata,
  function_marcom,
} = require('./utils/marcom/marcomhelper.js');
const {
  handleReplyNoDocMessage,
} = require('./utils/repply_no_doc_messages.js');
const {
  handleReplyDocMessage,
} = require('./utils/repply_with_doc_messages.js');
const { handleGroupMessage } = require('./utils/group_messages.js');
// enable files upload
app.use(
  fileUpload({
    createParentPath: true,
  })
);

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const port = process.env.PORT || 8000;
const qrcode = require('qrcode');

app.use('/assets', express.static(__dirname + '/client/assets'));

app.get('/scan', (req, res) => {
  res.sendFile('./client/server.html', {
    root: __dirname,
  });
});

app.get('/', (req, res) => {
  res.sendFile('./client/index.html', {
    root: __dirname,
  });
});
//fungsi suara capital
function capital(textSound) {
  const arr = textSound.split(' ');
  for (var i = 0; i < arr.length; i++) {
    arr[i] = arr[i].charAt(0).toUpperCase() + arr[i].slice(1);
  }
  const str = arr.join(' ');
  return str;
}
const store = makeInMemoryStore({
  logger: pino().child({ level: 'silent', stream: 'store' }),
});

let sock;
let qr;
let soket;
let botname = 'bot_grading';
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
  let { version, isLatest } = await fetchLatestBaileysVersion();
  sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    logger: log({ level: 'silent' }),
    version,
    shouldIgnoreJid: (jid) => isJidBroadcast(jid),
  });
  store.bind(sock.ev);
  sock.multi = true;
  sock.ev.on('connection.update', async (update) => {
    //console.log(update);
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      let reason = new Boom(lastDisconnect.error).output.statusCode;
      if (reason === DisconnectReason.badSession) {
        console.log(
          `Bad Session File, Please Delete ${session} and Scan Again`
        );
        // await restartbot(botname);
        sock.logout();
      } else if (reason === DisconnectReason.connectionClosed) {
        console.log('Connection closed, reconnecting....');
        // await restartbot(botname);
        connectToWhatsApp();
      } else if (reason === DisconnectReason.connectionLost) {
        console.log('Connection Lost from Server, reconnecting...');
        // await restartbot(botname);
        connectToWhatsApp();
      } else if (reason === DisconnectReason.connectionReplaced) {
        console.log(
          'Connection Replaced, Another New Session Opened, Please Close Current Session First'
        );
        // await restartbot(botname);
        sock.logout();
      } else if (reason === DisconnectReason.loggedOut) {
        console.log(
          `Device Logged Out, Please Delete ${session} and Scan Again.`
        );
        // await restartbot(botname);
        sock.logout();
      } else if (reason === DisconnectReason.restartRequired) {
        console.log('Restart Required, Restarting...');
        // await restartbot(botname);
        connectToWhatsApp();
      } else if (reason === DisconnectReason.timedOut) {
        console.log('Connection TimedOut, Reconnecting...');
        // await restartbot(botname);
        connectToWhatsApp();
      } else {
        // await restartbot(botname);
        sock.end(`Unknown DisconnectReason: ${reason}|${lastDisconnect.error}`);
      }
    } else if (connection === 'open') {
      console.log('opened connection');
      let getGroups = await sock.groupFetchAllParticipating();
      let groups = Object.values(await sock.groupFetchAllParticipating());
      // console.log(groups);
      // for (let group of groups) {
      //   console.log(
      //     'id_group: ' + group.id + ' || Nama Group: ' + group.subject
      //   );
      // }
      // return;
    }
    if (update.qr) {
      qr = update.qr;
      updateQR('qr');
    } else if ((qr = undefined)) {
      updateQR('loading');
    } else {
      if (update.connection === 'open') {
        updateQR('qrscanned');
        return;
      }
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

io.on('connection', async (socket) => {
  soket = socket;
  // console.log(sock)
  if (isConnected) {
    updateQR('connected');
  } else if (qr) {
    updateQR('qr');
  }
});

// functions
const isConnected = () => {
  return sock.user;
};

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
      soket?.emit('log', 'WhatsApp terhubung!');
      break;
    case 'qrscanned':
      soket?.emit('qrstatus', './assets/check.svg');
      soket?.emit('log', 'QR Code Telah discan!');
      break;
    case 'loading':
      soket?.emit('qrstatus', './assets/loader.gif');
      soket?.emit('log', 'Registering QR Code , please wait!');
      break;
    default:
      break;
  }
};
const sendButtonMessage = async (jid) => {
  let message = 'Hello, this is a button message!\n';
  message += 'Setuju: https://management.srs-ssms.com/dashboard\n';
  message += 'Tidak: https://management.srs-ssms.com/dashboard';

  await sock.sendMessage(jid, {
    text: message,
  });
};

app.get('/testing', async (req, res) => {
  try {
    // await pingGoogle();
    await get_outstadingdata(sock);
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

// websocket

connectToWhatsApp().catch((err) => console.log('unexpected error: ' + err)); // catch any errors
server.listen(port, () => {
  console.log('Server Berjalan pada Port : ' + port);
});
