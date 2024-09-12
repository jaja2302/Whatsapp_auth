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
const {
  userIotChoice,
  configSnoozeBotPengawasanOperator,
  userchoiceSnoozeBotPengawasanOperator,
} = require('./state.js');
const { setupCronJobs } = require('./helper.js');
const {
  handleijinmsg,
  runfunction,
  userchoice,
  sendImageWithCaption,
} = require('./utils/izinkebun/helper.js');
const {
  handleTaksasi,
  sendtaksasiest,
  botTaksasi,
  userTalsasiChoice,
  timeoutHandlestaksasi,
  Generateandsendtaksasi,
  sendfailcronjob,
} = require('./utils/taksasi/taksasihelper.js');
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
    // console.log(messages);
    for (const message of messages) {
      if (!message.key.fromMe) {
        const noWa = message.key.remoteJid;
        const text =
          (message.message?.conversation ||
            message.message?.extendedTextMessage?.text) ??
          'No message text available';
        const lowerCaseMessage = text ? text.toLowerCase() : null;
        if (message.message?.extendedTextMessage?.contextInfo) {
          const contextInfo = message.message.extendedTextMessage.contextInfo;
          const text_repply = message.message.extendedTextMessage.text;
          const quotedMessageSender = contextInfo.participant;
          const respon_atasan = text_repply;
          // console.log(quotedMessageSender);
          if (
            contextInfo.quotedMessage &&
            contextInfo.quotedMessage.conversation
          ) {
            const conversation = contextInfo.quotedMessage.conversation;
            // console.log(conversation);
            if (conversation.includes('Permintaan Persetujuan Izin Baru')) {
              const idPemohonStartIndex =
                conversation.indexOf('*ID Pemohon*: ') +
                '*ID Pemohon*: '.length;
              const idPemohonEndIndex = conversation.indexOf(
                '\n',
                idPemohonStartIndex
              );
              const idPemohon = conversation
                .substring(idPemohonStartIndex, idPemohonEndIndex)
                .trim();

              // Splitting ID Pemohon into id and idAtasan
              const [id, idAtasan] = idPemohon
                .split('/')
                .map((part) => part.trim());

              // Extracting Nama Pemohon
              const namaStartIndex =
                conversation.indexOf('*Nama Pemohon*: ') +
                '*Nama Pemohon*: '.length;
              const namaEndIndex = conversation.indexOf('\n', namaStartIndex);
              const nama = conversation
                .substring(namaStartIndex, namaEndIndex)
                .trim();
              // console.log(conversation);
              // console.log(idAtasan);

              if (
                respon_atasan.toLowerCase() !== 'ya' &&
                respon_atasan.toLowerCase() !== 'tidak'
              ) {
                await sock.sendMessage(
                  noWa,
                  { text: 'Harap hanya balas ya atau tidak' },
                  { quoted: message }
                );
              } else if (respon_atasan.toLowerCase() === 'ya') {
                try {
                  const response = await axios.post(
                    // 'http://127.0.0.1:8000/api/updatenotifijin',
                    'https://management.srs-ssms.com/api/updatenotifijin',
                    {
                      id_data: id,
                      id_atasan: idAtasan,
                      answer: 'ya',
                      email: 'j',
                      password: 'j',
                      response: respon_atasan,
                    }
                  );

                  // Check if status code is 2xx range (success)
                  if (response.status >= 200 && response.status < 300) {
                    let responses = response.data;
                    console.log(`test: ${respon_atasan}`);

                    await sock.sendMessage(noWa, {
                      text: 'Permintaan berhasil diperbaharui',
                    });

                    await sock.sendMessage(noWa, {
                      text: responses.message,
                    });
                  } else {
                    // If status code is not in 2xx range, throw an error
                    throw new Error(
                      `API Error: ${response.status} - ${response.statusText}`
                    );
                  }
                } catch (error) {
                  console.error('Error occurred:', error.message || error); // Log specific error message
                }
              } else if (respon_atasan.toLowerCase() === 'tidak') {
                let message = `*Alasan izin di tolak?*:\n`;
                message += `*ID Pemohon* : ${id}/${idAtasan}\n`;
                message += `*Nama* : ${nama}\n`;
                message += `Silahkan Reply Pesan ini untuk memberikan alasan izin di tolak\n`;
                await sock.sendMessage(noWa, { text: message });
              }
            } else if (conversation.includes('Alasan izin di tolak')) {
              const idPemohonStartIndex =
                conversation.indexOf('*ID Pemohon* : ') +
                '*ID Pemohon* : '.length;
              const idPemohonEndIndex = conversation.indexOf(
                '\n',
                idPemohonStartIndex
              );
              const idPemohon = conversation
                .substring(idPemohonStartIndex, idPemohonEndIndex)
                .trim();
              const [id, idAtasan] = idPemohon
                .split('/')
                .map((part) => part.trim());
              try {
                // const response = await axios.post('http://qc-apps2.test/api/updatenotifijin', {
                const response = await axios.post(
                  'https://management.srs-ssms.com/api/updatenotifijin',
                  // 'http://127.0.0.1:8000/api/updatenotifijin',
                  {
                    id_data: id,
                    id_atasan: idAtasan,
                    answer: 'tidak',
                    response: respon_atasan,
                    email: 'j',
                    password: 'j',
                  }
                );
                let responses = response.data;
                console.log(responses);

                await sock.sendMessage(noWa, {
                  text: 'Izin keluar kebun berhasil di perbaharui',
                });
                await sock.sendMessage(noWa, {
                  text: responses.message,
                });
              } catch (error) {
                console.log('Error approving:', error);
              }
            } else if (
              conversation.includes('*Permintaan barang perlu di review*:')
            ) {
              const idPemohonStartIndex =
                conversation.indexOf('*ID* : ') + '*ID* : '.length;
              const idPemohonEndIndex = conversation.indexOf(
                '\n',
                idPemohonStartIndex
              );
              const idPemohon = conversation
                .substring(idPemohonStartIndex, idPemohonEndIndex)
                .trim();
              const [id] = idPemohon.split('/').map((part) => part.trim());
              if (
                respon_atasan.toLowerCase() !== 'ya' &&
                respon_atasan.toLowerCase() !== 'tidak'
              ) {
                await sock.sendMessage(
                  noWa,
                  { text: 'Harap hanya balas ya atau tidak' },
                  { quoted: message }
                );
              } else if (respon_atasan.toLowerCase() === 'ya') {
                try {
                  const response = await axios.post(
                    // 'http://127.0.0.1:8000/api/acceptedoreder',
                    'https://management.srs-ssms.com/api/acceptedoreder',
                    {
                      email: 'j',
                      password: 'j',
                      id: id,
                    }
                  );
                  let responses = response.data;
                  await sock.sendMessage(noWa, {
                    text: `${responses.message}`,
                  });
                } catch (error) {
                  console.log('Error approving:', error);
                }
              } else if (respon_atasan.toLowerCase() === 'tidak') {
                let message = `*Alasan request barang di tolak?*:\n`;
                message += `*ID* : ${id}\n`;
                message += `Silahkan *wajib* Reply Pesan ini dengan membalas *skip* untuk menolak tanpa alasan. Atau berikan alasan menolak request ini?\n`;
                await sock.sendMessage(noWa, { text: message });
              }
            } else if (
              conversation.includes('Alasan request barang di tolak')
            ) {
              // console.log('disni');
              const idPemohonStartIndex =
                conversation.indexOf('*ID* : ') + '*ID* : '.length;
              const idPemohonEndIndex = conversation.indexOf(
                '\n',
                idPemohonStartIndex
              );
              const idPemohon = conversation
                .substring(idPemohonStartIndex, idPemohonEndIndex)
                .trim();
              const [id] = idPemohon.split('/').map((part) => part.trim());
              console.log(respon_atasan);
              try {
                // const response = await axios.post('http://qc-apps2.test/api/updatenotifijin', {
                const response = await axios.post(
                  'https://management.srs-ssms.com/api/rejectedoreder',
                  {
                    email: 'j',
                    password: 'j',
                    id: id,
                    alasan: respon_atasan,
                  }
                );
                let responses = response.data;
                await sock.sendMessage(noWa, { text: `${responses.message}` });
              } catch (error) {
                console.log('Error approving:', error);
              }
            } else if (
              conversation.includes(
                'Anda memiliki permintaan untuk meverifikasi data dari rekomendator'
              )
            ) {
              // Extract the Doc ID
              const docIdMatch = conversation.match(/\*Doc ID\* : (\d+\/\d+)/);
              if (docIdMatch) {
                const docId = docIdMatch[1];
                const [id, user_id] = docId.split('/');
                // console.log(respon_atasan.toLowerCase());
                if (respon_atasan.toLowerCase() === 'ya') {
                  try {
                    const response = await axios.post(
                      'https://management.srs-ssms.com/api/get_approval_rapid_response',
                      {
                        id: id,
                        user_id: user_id,
                        answer: 'ya',
                        email: 'j',
                        password: 'j',
                      }
                    );
                    let responses = response.data;
                    await sock.sendMessage(noWa, {
                      text: 'Mohon Tunggu server melakukan validasi.....',
                    });
                    await sock.sendMessage(noWa, {
                      text: responses.message,
                    });
                  } catch (error) {
                    console.log('Error approving:', error);
                  }
                } else if (respon_atasan.toLowerCase() === 'tidak') {
                  try {
                    const response = await axios.post(
                      'https://management.srs-ssms.com/api/get_approval_rapid_response',
                      {
                        id: id,
                        user_id: user_id,
                        answer: 'tidak',
                        email: 'j',
                        password: 'j',
                      }
                    );
                    let responses = response.data;
                    await sock.sendMessage(noWa, {
                      text: 'Mohon Tunggu server melakukan validasi.....',
                    });
                    await sock.sendMessage(noWa, {
                      text: responses.message,
                    });
                  } catch (error) {
                    console.log('Error approving:', error);
                  }
                } else {
                  await sock.sendMessage(noWa, {
                    text: 'Hanya bisa memilih ya atau tidak',
                  });
                }
              } else {
                console.log('Doc ID not found in the message.');
              }
            } else {
              console.log('pesan lainnya');
            }
          } else if (
            contextInfo.quotedMessage &&
            contextInfo.quotedMessage.documentWithCaptionMessage &&
            contextInfo.quotedMessage.documentWithCaptionMessage.message &&
            contextInfo.quotedMessage.documentWithCaptionMessage.message
              .documentMessage
          ) {
            const document_type =
              contextInfo.quotedMessage.documentWithCaptionMessage.message;
            const caption = document_type.documentMessage.caption;
            // console.log(contextInfo);
            if (
              caption &&
              caption.includes(
                'Laporan Taksasi Perlu persetujuan sebelum diterbitkan'
              )
            ) {
              // Regular expression to match 'ID : 34'
              const idMatch = caption.match(/ID\s*:\s*(\d+)/);
              if (idMatch && idMatch[1]) {
                const id = idMatch[1];
                // console.log('Extracted ID:', id);
                if (
                  text_repply.toLowerCase() !== 'ya' &&
                  text_repply.toLowerCase() !== 'tidak'
                ) {
                  await sock.sendMessage(noWa, {
                    text: 'Hanya bisa memilih ya atau tidak',
                  });
                } else {
                  try {
                    // console.log(quotedMessageSender);
                    const response = await axios.post(
                      // 'http://127.0.0.1:8000/api/taksasi_verification',
                      'https://management.srs-ssms.com/api/taksasi_verification',
                      {
                        id: id,
                        email: 'j',
                        password: 'j',
                        no_hp: message.key.participant,
                        answer: text_repply,
                      }
                    );
                    let responses = response.data;
                    await sock.sendMessage(noWa, {
                      text: `${responses.message}`,
                    });
                  } catch (error) {
                    // Check if there is a response from the server
                    if (error.response) {
                      // Server responded with a status code other than 2xx
                      console.log('Error status:', error.response.status);
                      console.log('Error data:', error.response.data);
                      // Send the error message to the user
                      await sock.sendMessage(noWa, {
                        text: `${error.response.data.message || 'Something went wrong'}`,
                      });
                    } else if (error.request) {
                      // Request was made but no response received
                      console.log('No response received:', error.request);
                      await sock.sendMessage(noWa, {
                        text: 'No response from the server. Please try again later.',
                      });
                    } else {
                      // Something happened while setting up the request
                      console.log('Error', error.message);
                      await sock.sendMessage(noWa, {
                        text: `Error: ${error.message}`,
                      });
                    }
                  }
                }
              } else {
                console.log('ID not found in the caption.');
              }
            } else {
              console.log('The caption does not contain the required text.');
            }
          } else {
            // console.log('Bukan document');
          }
        } else if (
          message.key.remoteJid.endsWith('@g.us') &&
          !message.message?.extendedTextMessage?.contextInfo
        ) {
          if (lowerCaseMessage && lowerCaseMessage.startsWith('!tarik')) {
            const estateCommand = lowerCaseMessage.replace('!tarik', '').trim();
            const estate = estateCommand.toUpperCase(); // Convert to uppercase for consistency
            // Check if the estate name is valid
            if (!estate) {
              await sock.sendMessage(
                noWa,
                {
                  text: 'Mohon masukkan nama estate setelah perintah !tarik dilanjutkan dengan singkatan nama Estate.\n-Contoh !tarikkne = Untuk Estate KNE dan seterusnya',
                },
                { quoted: message }
              );
              return;
            }
            const apiUrl = 'https://qc-apps.srs-ssms.com/api/getdatacron';
            try {
              const response = await axios.get(apiUrl);
              const dataestate = response.data;
              const matchingTasks = dataestate.filter(
                (task) => task.estate === estate
              );
              if (matchingTasks.length > 0) {
                const {
                  estate: estateFromMatchingTask,
                  group_id,
                  wilayah: folder,
                } = matchingTasks[0];
                await sock.sendMessage(
                  noWa,
                  { text: 'Mohon tunggu laporan sedang di proses' },
                  { quoted: message }
                );
                const result = await sendtaksasiest(
                  estateFromMatchingTask,
                  group_id,
                  folder,
                  sock
                );
                // console.log(result);
                if (result === 'success') {
                  // console.log('success');
                  break;
                } else {
                  await sock.sendMessage(
                    noWa,
                    {
                      text: 'Terjadi kesalahan saat mengirim taksasi. Silakan Hubungi Tim D.A.',
                    },
                    { quoted: message }
                  );
                  break;
                }
              } else {
                await sock.sendMessage(
                  noWa,
                  {
                    text: 'Estate yang anda masukan tidak tersedia di database. Silahkan Ulangi dan Cek Kembali',
                  },
                  { quoted: message }
                );
                break;
              }
            } catch (error) {
              console.log('Error fetching data:', error.message);
              break;
            }
          } else if (lowerCaseMessage === '!taksasi') {
            if (!userTalsasiChoice[noWa]) {
              await handleTaksasi(noWa, lowerCaseMessage, sock);
            }
          } else if (userTalsasiChoice[noWa]) {
            // Continue the ijin process if it has already started
            await handleTaksasi(noWa, text, sock);
          } else if (lowerCaseMessage === '!menu') {
            await sock.sendMessage(
              noWa,
              {
                text: 'Perintah Bot Yang tersedia \n1 = !tarik (Menarik Estate yang di pilih untuk di generate ke dalam grup yang sudah di tentukan) \n2.!getgrup (Menampilkan semua isi list group yang ada) \n3.!cast (melakukan broadcast pesan ke semua grup taksasi) \n4.!taksasi = Menarik Banyak laporar taksasi sekaligus berdasarkan waktu yang di pilih\n5.!laporan izinkebun Menarik laporan izin kebun (Harap gunakan hanya di hari sabtu atau minggu)!',
              },
              { quoted: message }
            );
            break;
          } else if (lowerCaseMessage === '!getgrup') {
            let getGroups = await sock.groupFetchAllParticipating();
            let groups = Object.values(await sock.groupFetchAllParticipating());
            let datagrup = []; // Initialize an empty array to store group information
            for (let group of groups) {
              datagrup.push(
                `id_group: ${group.id} || Nama Group: ${group.subject}`
              );
            }
            await sock.sendMessage(
              noWa,
              { text: `List ${datagrup.join('\n')}` },
              { quoted: message }
            );
            break;
          } else if (lowerCaseMessage === '!cast') {
            // Send a message asking for the broadcast message
            await sock.sendMessage(
              noWa,
              {
                text: 'Masukan Kata kata yang ingin di broadcast ke dalam group?',
              },
              { quoted: message }
            );
            // Define a function to handle the response
            async function handleBroadcast({ messages: responseMessages }) {
              let messageSent = false; // Flag to track if the message has been sent
              for (const responseMessage of responseMessages) {
                if (
                  !responseMessage.key.fromMe &&
                  responseMessage.key.remoteJid === noWa
                ) {
                  // Get the broadcast message from the user's response
                  const broadcastMessage = responseMessage.message.conversation;
                  // Get the participating groups
                  let groups = Object.values(
                    await sock.groupFetchAllParticipating()
                  );
                  let datagrup = groups.map((group) => ({
                    id_group: group.id,
                    nama: group.subject,
                  }));
                  let groupdont = [
                    '120363200959267322@g.us',
                    '120363164661400702@g.us',
                    '120363214741096436@g.us',
                    '120363158376501304@g.us',
                  ];
                  // Send a message indicating that the broadcast is being processed
                  await sock.sendMessage(
                    noWa,
                    { text: 'Mohon Tunggu, Broadcast Sedang Di Proses' },
                    { quoted: message }
                  );
                  // Set a timer for 60 seconds (1 minute)
                  const timer = setTimeout(async () => {
                    if (!messageSent) {
                      // If the message hasn't been sent within the time limit, notify the user
                      await sock.sendMessage(
                        noWa,
                        { text: 'Waktu habis! Silahkan coba kembali.' },
                        { quoted: message }
                      );
                    }
                  }, 60000); // 60 seconds in milliseconds
                  // Send the broadcast message to groups
                  for (const group of datagrup) {
                    if (!groupdont.includes(group.id_group)) {
                      await sock.sendMessage(group.id_group, {
                        text: broadcastMessage,
                      });
                      console.log(group.id_group, { text: broadcastMessage });
                      messageSent = true; // Update the flag since the message has been sent
                    }
                  }
                  // Clear the timer since the message has been sent or the timer has expired
                  clearTimeout(timer);
                  // Send a message indicating that the broadcast message has been sent to all groups
                  await sock.sendMessage(
                    noWa,
                    { text: 'Broadcast Pesan sudah di kirim Kesemua Grup' },
                    { quoted: message }
                  );
                  // Turn off the event listener for handling broadcast messages
                  sock.ev.off('messages.upsert', handleBroadcast);
                  break;
                }
              }
            }
            // Listen for the user's response to the broadcast message
            sock.ev.on('messages.upsert', handleBroadcast);
          } else if (lowerCaseMessage === '!format snooze') {
            await sock.sendMessage(
              noWa,
              {
                text: 'Contoh Option Snooze Bot : \n1).!snooze 27-08-2024 s/d 29-08-2024 (Opsi snooze range tanggal) \n2).!snooze 27-08-2024 (Opsi snooze selama 24 jam) \n3).!snooze 27-08-2024 04:00 - 12.00 (Opsi menyesuaikan range jam)',
              },
              { quoted: message }
            );
            break;
          } else if (lowerCaseMessage.includes('!snooze')) {
            const snoozeContent = lowerCaseMessage
              .substring('!snooze '.length)
              .trim();
            // Regex patterns for different options
            const dateRangePattern =
              /^(\d{1,2}-\d{1,2}-\d{4})\s*s\/d\s*(\d{1,2}-\d{1,2}-\d{4})$/;
            const singleDatePattern = /^(\d{1,2}-\d{1,2}-\d{4})$/;
            const dateTimeRangePattern =
              /^(\d{1,2}-\d{1,2}-\d{4})\s(\d{2}[:.]\d{2})\s*-\s*(\d{2}[:.]\d{2})$/;
            const now = new Date();
            // Helper function to parse date and time into a Date object
            const parseDateTime = (date, time = '00:00') => {
              const [day, month, year] = date.split('-').map(Number);
              const [hour, minute] = time.split(/[:.]/).map(Number);
              return new Date(year, month - 1, day, hour, minute);
            };
            if (dateRangePattern.test(snoozeContent)) {
              const matches = snoozeContent.match(dateRangePattern);
              const startDate = matches[1];
              const endDate = matches[2];
              const startDateTime = parseDateTime(startDate);
              const endDateTime = parseDateTime(endDate);
              if (startDateTime <= now || endDateTime <= now) {
                let text =
                  'Format tanggal dan waktu harus setelah waktu saat ini.';
                await handleChatSnoozePengawasanOperatorAi(noWa, text, sock);
              } else {
                const differenceInMillis = endDateTime - startDateTime;
                const differenceInHours = differenceInMillis / (1000 * 60 * 60);
                configSnoozeBotPengawasanOperator[noWa] = {
                  datetime: `${startDate} s/d ${endDate}`,
                  hour: differenceInHours,
                };
                await handleChatSnoozePengawasanOperatorAi(noWa, text, sock);
              }
            } else if (singleDatePattern.test(snoozeContent)) {
              const matches = snoozeContent.match(singleDatePattern);
              const singleDate = matches[1];
              const singleDateTime = parseDateTime(singleDate);
              if (singleDateTime <= now) {
                let text =
                  'Format tanggal dan waktu harus setelah waktu saat ini.';
                await handleChatSnoozePengawasanOperatorAi(noWa, text, sock);
              } else {
                configSnoozeBotPengawasanOperator[noWa] = {
                  datetime: singleDate,
                  hour: 24,
                };
                await handleChatSnoozePengawasanOperatorAi(noWa, text, sock);
              }
            } else if (dateTimeRangePattern.test(snoozeContent)) {
              const matches = snoozeContent.match(dateTimeRangePattern);
              const date = matches[1];
              const startTime = matches[2];
              const endTime = matches[3];
              const startDateTime = parseDateTime(date, startTime);
              const endDateTime = parseDateTime(date, endTime);
              if (startDateTime <= now) {
                let text =
                  'Format tanggal dan waktu harus setelah waktu saat ini.';
                await handleChatSnoozePengawasanOperatorAi(noWa, text, sock);
              } else {
                const differenceInHours =
                  (endDateTime - startDateTime) / (1000 * 60 * 60);
                configSnoozeBotPengawasanOperator[noWa] = {
                  datetime: `${date} ${startTime} - ${endTime}`,
                  hour: differenceInHours,
                };
                await handleChatSnoozePengawasanOperatorAi(noWa, text, sock);
              }
            } else {
              // Invalid format
              await sock.sendMessage(
                noWa,
                {
                  text: 'Terdapat kesalahan pada input format. Mohon untuk menggunakan format inputan berikut:\n1).!snooze 27-08-2024 s/d 29-08-2024\n2).!snooze 27-08-2024\n3).!snooze 27-08-2024 04:00 - 12:00',
                },
                { quoted: message }
              );
              return;
            }
          } else if (userchoiceSnoozeBotPengawasanOperator[noWa]) {
            let waUser = message.key.participant;
            let phoneNumber = waUser.replace(/[^0-9]/g, '');
            // Replace the first 3 digits (if they are '628') with '08'
            if (phoneNumber.length >= 3) {
              phoneNumber = phoneNumber.replace(/^628/, '08');
            }
            await handleChatSnoozePengawasanOperatorAi(
              noWa,
              text,
              sock,
              phoneNumber
            );
          } else if (lowerCaseMessage === '!laporan izinkebun') {
            await Report_group_izinkebun(sock);
            break;
          }
        } else if (
          !message.key.remoteJid.endsWith('@g.us') &&
          !message.message?.extendedTextMessage?.contextInfo
        ) {
          if (lowerCaseMessage === '!izin') {
            // Start the ijin process only if it's not already started
            if (!userchoice[noWa]) {
              await handleijinmsg(noWa, lowerCaseMessage, sock);
            }
          } else if (userchoice[noWa]) {
            // Continue the ijin process if it has already started
            await handleijinmsg(noWa, text, sock);
          } else if (lowerCaseMessage === '!iot') {
            if (!userIotChoice[noWa]) {
              await handleIotInput(noWa, lowerCaseMessage, sock);
            }
          } else if (userIotChoice[noWa]) {
            // Continue the input process if it has already started
            await handleIotInput(noWa, text, sock);
          } else {
            if (lowerCaseMessage === 'ya') {
              const imagePath = './img/step1.jpeg';
              const imagePath2 = './img/step2.jpeg';
              const caption =
                'Harap balas pesan dengan cara tekan/tahan pesan di atas';
              const caption2 =
                'Lalu balas *ya* untuk menyetujui izin di atas, atau balas *tidak* untuk menolak izin di atas.\n\nAtau balas *ya semua* tanpa menekan/menahan pesan di atas untuk menyetujui semua izin atas persetujuan anda.';

              await sendImageWithCaption(sock, noWa, imagePath, caption);
              await sendImageWithCaption(sock, noWa, imagePath2, caption2);
            } else if (lowerCaseMessage === 'tidak') {
              const imagePath = './img/step1.jpeg';
              const imagePath2 = './img/step2.jpeg';
              const caption =
                'Harap balas pesan dengan cara tekan/tahan pesan di atas';
              const caption2 =
                'Lalu balas *tidak* untuk menyetujui izin di atas, atau balas *ya* untuk menerima izin di atas.\n\nAtau balas *tidak semua* tanpa menekan/menahan pesan di atas untuk menolak semua izin atas persetujuan anda.';

              await sendImageWithCaption(sock, noWa, imagePath, caption);
              await sendImageWithCaption(sock, noWa, imagePath2, caption2);
            } else if (lowerCaseMessage === 'ya semua') {
              try {
                // console.log(quotedMessageSender);
                const response = await axios.post(
                  // 'http://127.0.0.1:8000/api/getizinverifinew',
                  'https://management.srs-ssms.com/api/getizinverifinew',
                  {
                    email: 'j',
                    password: 'j',
                    no_hp: noWa,
                    jawaban: 'ya',
                  }
                );
                let responses = response.data;
                if (Array.isArray(responses.messages)) {
                  // Join the messages into a single string or handle them individually
                  const allMessages = responses.messages.join('\n'); // You can also change the separator as needed
                  console.log(allMessages); // Logs the joined messages
                  await sock.sendMessage(noWa, {
                    text: `${allMessages}`, // Send the combined message
                  });
                } else {
                  // Handle the case where `messages` is not an array
                  // console.log(`ini test: ${responses.message}`);
                  await sock.sendMessage(noWa, {
                    text: `${responses.message}`,
                  });
                }
              } catch (error) {
                // console.log(error);
                // Check if there is a response from the server
                if (error.response) {
                  // Server responded with a status code other than 2xx
                  console.log('Error status:', error.response.status);
                  console.log('Error data:', error.response.data);
                  // Send the error message to the user
                  await sock.sendMessage(noWa, {
                    text: `${error.response.data.message || 'Something went wrong'}`,
                  });
                } else if (error.request) {
                  // Request was made but no response received
                  console.log('No response received:', error.request);
                  await sock.sendMessage(noWa, {
                    text: 'No response from the server. Please try again later.',
                  });
                } else {
                  // Something happened while setting up the request
                  console.log('Error', error.message);
                  await sock.sendMessage(noWa, {
                    text: `Error: ${error.message}`,
                  });
                }
              }
            } else if (lowerCaseMessage === 'tidak semua') {
              try {
                // console.log(quotedMessageSender);
                const response = await axios.post(
                  // 'http://127.0.0.1:8000/api/getizinverifinew',
                  'https://management.srs-ssms.com/api/getizinverifinew',
                  {
                    email: 'j',
                    password: 'j',
                    no_hp: noWa,
                    jawaban: 'tidak',
                  }
                );
                let responses = response.data;
                if (Array.isArray(responses.messages)) {
                  // Join the messages into a single string or handle them individually
                  const allMessages = responses.messages.join('\n'); // You can also change the separator as needed
                  console.log(allMessages); // Logs the joined messages
                  await sock.sendMessage(noWa, {
                    text: `${allMessages}`, // Send the combined message
                  });
                } else {
                  // Handle the case where `messages` is not an array
                  console.log(`ini test: ${responses.message}`);
                  await sock.sendMessage(noWa, {
                    text: `${responses.message}`,
                  });
                }
              } catch (error) {
                console.log(error);
                // Check if there is a response from the server
                if (error.response) {
                  // Server responded with a status code other than 2xx
                  console.log('Error status:', error.response.status);
                  console.log('Error data:', error.response.data);
                  // Send the error message to the user
                  await sock.sendMessage(noWa, {
                    text: `${error.response.data.message || 'Something went wrong'}`,
                  });
                } else if (error.request) {
                  // Request was made but no response received
                  console.log('No response received:', error.request);
                  await sock.sendMessage(noWa, {
                    text: 'No response from the server. Please try again later.',
                  });
                } else {
                  // Something happened while setting up the request
                  console.log('Error', error.message);
                  await sock.sendMessage(noWa, {
                    text: `Error: ${error.message}`,
                  });
                }
              }
            }
          }
        }
      }
    }
  });
  setupCronJobs(sock);
  runfunction(sock);
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
    await Generateandsendtaksasi(sock);
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
