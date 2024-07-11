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
    msgRetryCounterMap
} = require("@whiskeysockets/baileys");
const simpleGit = require('simple-git');
const git = simpleGit();
const log = (pino = require("pino"));
const { session } = { "session": "baileys_auth_info" };
const { Boom } = require("@hapi/boom");
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require("express");
const fileUpload = require('express-fileupload');
const cors = require('cors');
const bodyParser = require("body-parser");
const app = require("express")()
const cron = require('node-cron');
const axios = require('axios');
const { DateTime } = require('luxon');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const { generatemapstaksasi } = require('./helper.js');
const moment = require('moment-timezone');
const { userchoice,userIotChoice ,userTalsasiChoice } = require('./state.js');
const { sendtaksasiest, setupCronJobs ,handleijinmsg ,getNotifications ,handleIotInput ,handleTaksasi} = require('./helper.js');
// enable files upload
app.use(fileUpload({
    createParentPath: true
}));

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const server = require("http").createServer(app);
const io = require("socket.io")(server);
const port = process.env.PORT || 3000;
const qrcode = require("qrcode");
const { Console } = require("console");

app.use("/assets", express.static(__dirname + "/client/assets"));

app.get("/scan", (req, res) => {
    res.sendFile("./client/server.html", {
        root: __dirname,
    });
});

app.get("/", (req, res) => {
    res.sendFile("./client/index.html", {
        root: __dirname,
    });
});
//fungsi suara capital 
function capital(textSound) {
    const arr = textSound.split(" ");
    for (var i = 0; i < arr.length; i++) {
        arr[i] = arr[i].charAt(0).toUpperCase() + arr[i].slice(1);
    }
    const str = arr.join(" ");
    return str;
}
const store = makeInMemoryStore({ logger: pino().child({ level: "silent", stream: "store" }) });

let sock;
let qr;
let soket;

async function connectToWhatsApp() {

    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info')
    let { version, isLatest } = await fetchLatestBaileysVersion();
    sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        logger: log({ level: "silent" }),
        version,
        shouldIgnoreJid: jid => isJidBroadcast(jid),
    });
    store.bind(sock.ev);
    sock.multi = true
    sock.ev.on('connection.update', async (update) => {
        //console.log(update);
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            let reason = new Boom(lastDisconnect.error).output.statusCode;
            if (reason === DisconnectReason.badSession) {
                console.log(`Bad Session File, Please Delete ${session} and Scan Again`);
                sock.logout();
            } else if (reason === DisconnectReason.connectionClosed) {
                console.log("Connection closed, reconnecting....");
                connectToWhatsApp();
            } else if (reason === DisconnectReason.connectionLost) {
                console.log("Connection Lost from Server, reconnecting...");
                connectToWhatsApp();
            } else if (reason === DisconnectReason.connectionReplaced) {
                console.log("Connection Replaced, Another New Session Opened, Please Close Current Session First");
                sock.logout();
            } else if (reason === DisconnectReason.loggedOut) {
                console.log(`Device Logged Out, Please Delete ${session} and Scan Again.`);
                sock.logout();
            } else if (reason === DisconnectReason.restartRequired) {
                console.log("Restart Required, Restarting...");
                connectToWhatsApp();
            } else if (reason === DisconnectReason.timedOut) {
                console.log("Connection TimedOut, Reconnecting...");
                connectToWhatsApp();
            } else {
                sock.end(`Unknown DisconnectReason: ${reason}|${lastDisconnect.error}`);
            }
        } else if (connection === 'open') {
            console.log('opened connection');
            // let groups = Object.values(await sock.groupFetchAllParticipating())
            // //console.log(groups);
            // for (let group of groups) {
            //     console.log("id_group: " + group.id + " || Nama Group: " + group.subject);
            // }
            // return;
        }
        if (update.qr) {
            qr = update.qr;
            updateQR("qr");
        }
        else if (qr = undefined) {
            updateQR("loading");
        }
        else {
            if (update.connection === "open") {
                updateQR("qrscanned");
                return;
            }
        }
    });
    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("messages.upsert", handleMessagesUpsert);
    setupCronJobs(sock);
}


async function handleMessagesUpsert({ messages, type }) {
    for (const message of messages) {
        if (!message.key.fromMe) {
            const noWa = message.key.remoteJid;
            const text = (message.message?.conversation || message.message?.extendedTextMessage?.text) ?? 'No message text available';
            const lowerCaseMessage = text ? text.toLowerCase() : null;

            if (message.message?.extendedTextMessage?.contextInfo) {
                const contextInfo = message.message.extendedTextMessage.contextInfo;
                const text_repply = message.message.extendedTextMessage.text;
                const quotedMessageSender = contextInfo.participant;
                const respon_atasan = text_repply;

                if (contextInfo.quotedMessage && contextInfo.quotedMessage.conversation) {
                    const conversation = contextInfo.quotedMessage.conversation;

                    if (conversation.includes('Izin baru perlu di approved')) {
                        const idPemohonStartIndex = conversation.indexOf('*ID Pemohon* : ') + '*ID Pemohon* : '.length;
                        const idPemohonEndIndex = conversation.indexOf('\n', idPemohonStartIndex);
                        const idPemohon = conversation.substring(idPemohonStartIndex, idPemohonEndIndex).trim();
                        const [id, idAtasan] = idPemohon.split('/').map(part => part.trim());
                        const namaStartIndex = conversation.indexOf('*Nama* : ') + '*Nama* : '.length;
                        const namaEndIndex = conversation.indexOf('\n', namaStartIndex);
                        const nama = conversation.substring(namaStartIndex, namaEndIndex).trim();

                        if (respon_atasan.toLowerCase() !== 'ya' && respon_atasan.toLowerCase() !== 'tidak') {
                            await sock.sendMessage(noWa, { text: "Harap hanya balas ya atau tidak" }, { quoted: message });
                        } else if (respon_atasan.toLowerCase() === 'ya') {
                            try {
                                const response = await axios.post('https://qc-apps.srs-ssms.com/api/updatenotifijin', {
                                    id_data: id,
                                    id_atasan: idAtasan,
                                    answer: 'ya',
                                });
                                let responses = response.data;

                                const responseKey = Object.keys(responses)[0];

                                await sock.sendMessage(noWa, { text: 'Mohon Tunggu server melakukan validasi.....' });
                                if (responseKey === "error_validasi") {
                                    await sock.sendMessage(noWa, { text: `Data gagal diverifikasi, Karena: ${responses[responseKey]}` });
                                } else {
                                    await sock.sendMessage(noWa, { text: "Izin Berhasil di approved" }, { quoted: message });
                                }

                            } catch (error) {
                                console.log("Error approving:", error);
                            }
                        } else if (respon_atasan.toLowerCase() === 'tidak') {
                            let message = `*Alasan izin di tolak?*:\n`;
                            message += `*ID Pemohon* : ${id}/${idAtasan}\n`;
                            message += `*Nama* : ${nama}\n`;
                            message += `Silahkan Repply Pesan ini untuk memberikan alasan izin di tolak\n`;
                            await sock.sendMessage(noWa, { text: message });  
                        }

                    } else if (conversation.includes('Alasan izin di tolak')) {
                        const idPemohonStartIndex = conversation.indexOf('*ID Pemohon* : ') + '*ID Pemohon* : '.length;
                        const idPemohonEndIndex = conversation.indexOf('\n', idPemohonStartIndex);
                        const idPemohon = conversation.substring(idPemohonStartIndex, idPemohonEndIndex).trim();
                        const [id, idAtasan] = idPemohon.split('/').map(part => part.trim());
                        try {
                            const response = await axios.post('https://qc-apps.srs-ssms.com/api/updatenotifijin', {
                                id_data: id,
                                id_atasan: idAtasan,
                                answer: respon_atasan,
                            });
                            let responses = response.data;

                            const responseKey = Object.keys(responses)[0];

                            await sock.sendMessage(noWa, { text: 'Mohon Tunggu server melakukan validasi.....' });
                            if (responseKey === "error_validasi") {
                                await sock.sendMessage(noWa, { text: `Data gagal diverifikasi, Karena: ${responses[responseKey]}` });
                            } else {
                                await sock.sendMessage(noWa, { text: "Izin Berhasil di tolak" }, { quoted: message });
                            }

                        } catch (error) {
                            console.log("Error approving:", error);
                        }
                    } else {
                        console.log('pesan lainnya');
                    }
                }
            }

            if (message.key.remoteJid.endsWith('@g.us')) {
                if (lowerCaseMessage && lowerCaseMessage.startsWith("!tarik")) {
                    // Extract the estate name from the command
                    const estateCommand = lowerCaseMessage.replace("!tarik", "").trim();
                    const estate = estateCommand.toUpperCase(); // Convert to uppercase for consistency

                    // Check if the estate name is valid
                    if (!estate) {
                        await sock.sendMessage(noWa, { text: 'Mohon masukkan nama estate setelah perintah !tarik dilanjutkan dengan singkatan nama Estate.\n-Contoh !tarikkne = Untuk Estate KNE dan seterusnya' }, { quoted: message });
                        return;
                    }

                    const apiUrl = 'https://qc-apps.srs-ssms.com/api/getdatacron';
                    try {
                        const response = await axios.get(apiUrl);
                        const dataestate = response.data;
                        const matchingTasks = dataestate.filter(task => task.estate === estate);

                        if (matchingTasks.length > 0) {
                            const { estate: estateFromMatchingTask, group_id, wilayah: folder } = matchingTasks[0];
                            await sock.sendMessage(noWa, { text: 'Mohon tunggu laporan sedang di proses' }, { quoted: message });
                            const result = await sendtaksasiest(estateFromMatchingTask, group_id, folder,sock);
                            console.log(result);
                            if (result === 'success') {
                                console.log('success');
                                break;
                            } else {
                                await sock.sendMessage(noWa, { text: 'Terjadi kesalahan saat mengirim taksasi. Silakan Hubungi Tim D.A.' }, { quoted: message });
                                break;
                            }
                        } else {
                            await sock.sendMessage(noWa, { text: 'Estate yang anda masukan tidak tersedia di database. Silahkan Ulangi dan Cek Kembali' }, { quoted: message });
                            break;
                        }
                    } catch (error) {
                        console.log('Error fetching data:', error.message);
                        break;
                    }
                }else if (lowerCaseMessage === '!taksasi') {
                    if (!userTalsasiChoice[noWa]) {
                        await handleTaksasi(noWa, lowerCaseMessage,sock);
                    }
                }
                else if (userTalsasiChoice[noWa]) {
                    // Continue the ijin process if it has already started
                    await handleTaksasi(noWa, text,sock);
                } else if (lowerCaseMessage === "!menu") {
                    await sock.sendMessage(noWa, { text: "Perintah Bot Yang tersida \n1 = !tarik (Menarik Estate yang di pilih untuk di generate ke dalam grup yang sudah di tentukan) \n2.!getgrup (Menampilkan semua isi list group yang ada) \n3.!cast (melakukan broadcast pesan ke semua grup taksasi) \n4.!restart (Merestart Service Bot)" }, { quoted: message });
                    break;
                } else if (lowerCaseMessage === "!getgrup") {
                    let getGroups = await sock.groupFetchAllParticipating();
                    let groups = Object.values(await sock.groupFetchAllParticipating());
                    let datagrup = []; // Initialize an empty array to store group information

                    for (let group of groups) {
                        datagrup.push(`id_group: ${group.id} || Nama Group: ${group.subject}`);
                    }

                    await sock.sendMessage(noWa, { text: `List ${datagrup.join('\n')}` }, { quoted: message });

                    break;
                } else if (lowerCaseMessage === "!cast") {
                    // Send a message asking for the broadcast message
                    await sock.sendMessage(noWa, { text: "Masukan Kata kata yang ingin di broadcast ke dalam group?" }, { quoted: message });

                    // Define a function to handle the response
                    async function handleBroadcast({ messages: responseMessages }) {
                        let messageSent = false; // Flag to track if the message has been sent

                        for (const responseMessage of responseMessages) {
                            if (!responseMessage.key.fromMe && responseMessage.key.remoteJid === noWa) {
                                // Get the broadcast message from the user's response
                                const broadcastMessage = responseMessage.message.conversation;

                                // Get the participating groups
                                let groups = Object.values(await sock.groupFetchAllParticipating());
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
                                await sock.sendMessage(noWa, { text: 'Mohon Tunggu, Broadcast Sedang Di Proses' }, { quoted: message });

                                // Set a timer for 60 seconds (1 minute)
                                const timer = setTimeout(async () => {
                                    if (!messageSent) {
                                        // If the message hasn't been sent within the time limit, notify the user
                                        await sock.sendMessage(noWa, { text: 'Waktu habis! Silahkan coba kembali.' }, { quoted: message });
                                    }
                                }, 60000); // 60 seconds in milliseconds

                                // Send the broadcast message to groups
                                for (const group of datagrup) {
                                    if (!groupdont.includes(group.id_group)) {
                                        await sock.sendMessage(group.id_group, { text: broadcastMessage });
                                        console.log(group.id_group, { text: broadcastMessage });
                                        messageSent = true; // Update the flag since the message has been sent
                                    }
                                }

                                // Clear the timer since the message has been sent or the timer has expired
                                clearTimeout(timer);

                                // Send a message indicating that the broadcast message has been sent to all groups
                                await sock.sendMessage(noWa, { text: 'Broadcast Pesan sudah di kirim Kesemua Grup' }, { quoted: message });

                                // Turn off the event listener for handling broadcast messages
                                sock.ev.off("messages.upsert", handleBroadcast);
                                break;
                            }
                        }
                    }

                    // Listen for the user's response to the broadcast message
                    sock.ev.on("messages.upsert", handleBroadcast);
                }
            } else {
                if (lowerCaseMessage === "!menu") {
                    await sock.sendMessage(noWa, { text: "Hanya dapat di gunakan di dalam grup!" }, { quoted: message });
                    break;
                } else if (lowerCaseMessage.startsWith("!tarik")) {
                    await sock.sendMessage(noWa, { text: "Hanya dapat di gunakan di dalam grup!" }, { quoted: message });
                    break;
                } else if (lowerCaseMessage === "!update") {
                    await sock.sendMessage(noWa, { text: "Hanya dapat di gunakan di dalam grup!" }, { quoted: message });
                    break;
                } else if (lowerCaseMessage === "!cast") {
                    await sock.sendMessage(noWa, { text: "Hanya dapat di gunakan di dalam grup!" }, { quoted: message });
                    break;
                } else if (lowerCaseMessage === "!restart") {
                    await sock.sendMessage(noWa, { text: "Hanya dapat di gunakan di dalam grup!" }, { quoted: message });
                    break;
                } else if (lowerCaseMessage === "!izin") {
                    // Start the ijin process only if it's not already started
                    if (!userchoice[noWa]) {
                        await handleijinmsg(noWa, lowerCaseMessage,sock);
                    }
                } else if (userchoice[noWa]) {
                    // Continue the ijin process if it has already started
                    await handleijinmsg(noWa, text,sock);
                } else if (lowerCaseMessage === "!iot") {
                    if (!userIotChoice[noWa]) {
                        await handleIotInput(noWa, lowerCaseMessage,sock);
                    }
                } else if (userIotChoice[noWa]) {
                    // Continue the input process if it has already started
                    await handleIotInput(noWa, text,sock);
                } else {
                    // Handle other messages
                    console.log('message comming to number');
                    // await handleMessage(noWa, lowerCaseMessage, messages);
                }
            }
        }
    }
}



io.on("connection", async (socket) => {
    soket = socket;
    // console.log(sock)
    if (isConnected) {
        updateQR("connected");
    } else if (qr) {
        updateQR("qr");
    }
});

// functions
const isConnected = () => {
    return (sock.user);
};

const updateQR = (data) => {
    switch (data) {
        case "qr":
            qrcode.toDataURL(qr, (err, url) => {
                soket?.emit("qr", url);
                soket?.emit("log", "QR Code received, please scan!");
            });
            break;
        case "connected":
            soket?.emit("qrstatus", "./assets/check.svg");
            soket?.emit("log", "WhatsApp terhubung!");
            break;
        case "qrscanned":
            soket?.emit("qrstatus", "./assets/check.svg");
            soket?.emit("log", "QR Code Telah discan!");
            break;
        case "loading":
            soket?.emit("qrstatus", "./assets/loader.gif");
            soket?.emit("log", "Registering QR Code , please wait!");
            break;
        default:
            break;
    }
};



app.get("/testing", async (req, res) => {
    try {
        await getNotifications();
        // Send a response back to the client indicating success
        res.status(200).json({
            status: true,
            message: "Messages sent successfully"
        });
    } catch (error) {
        console.error("Error sending files:", error);
        // Send an error response back to the client
        res.status(500).json({
            status: false,
            response: error.message || "Internal Server Error"
        });
    }
});


connectToWhatsApp()
    .catch(err => console.log("unexpected error: " + err))
server.listen(port, () => {
    console.log("Server Berjalan pada Port : " + port);
});
