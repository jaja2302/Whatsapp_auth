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
const { getdatataksasi } = require('./helper.js');
const moment = require('moment-timezone');
// enable files upload
app.use(fileUpload({
    createParentPath: true
}));

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const server = require("http").createServer(app);
const io = require("socket.io")(server);
const port = process.env.PORT || 8000;
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
        // console.log(update);
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            let reason = new Boom(lastDisconnect.error).output.statusCode;
            if (reason === DisconnectReason.badSession) {
                // console.log(`Bad Session File, Please Delete ${session} and Scan Again`);
                sock.logout();
            } else if (reason === DisconnectReason.connectionClosed) {
                // console.log("Connection closed, reconnecting....");
                connectToWhatsApp();
            } else if (reason === DisconnectReason.connectionLost) {
                // console.log("Connection Lost from Server, reconnecting...");
                connectToWhatsApp();
            } else if (reason === DisconnectReason.connectionReplaced) {
                // console.log("Connection Replaced, Another New Session Opened, Please Close Current Session First");
                sock.logout();
            } else if (reason === DisconnectReason.loggedOut) {
                // console.log(`Device Logged Out, Please Delete ${session} and Scan Again.`);
                sock.logout();
            } else if (reason === DisconnectReason.restartRequired) {
                // console.log("Restart Required, Restarting...");
                connectToWhatsApp();
            } else if (reason === DisconnectReason.timedOut) {
                // console.log("Connection TimedOut, Reconnecting...");
                connectToWhatsApp();
            } else {
                sock.end(`Unknown DisconnectReason: ${reason}|${lastDisconnect.error}`);
            }
        } else if (connection === 'open') {
            
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

    sock.ev.on("messages.upsert", async function handleUpsert({ messages, type }) {
        for (const message of messages) {
            if (!message.key.fromMe) {
                const noWa = message.key.remoteJid;
                const text = message.message.conversation || message.message.extendedTextMessage?.text;
                const lowerCaseMessage = text ? text.toLowerCase() : null;
                if (message.key.remoteJid.endsWith('@g.us')) {
                    if (lowerCaseMessage.startsWith("!tarik")) {
                        // Extract the estate name from the command
                        const estateCommand = lowerCaseMessage.replace("!tarik", "").trim();
                        const estate = estateCommand.toUpperCase(); // Convert to uppercase for consistency
                        
                        // Check if the estate name is valid
                        if (estate) {
                            const tasks = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
                            let estatesDB = [];
        
                            // Extract estates from each task in the JSON data
                            tasks.forEach(task => {
                                estatesDB.push(task.estate);
                            });
                    
                            if (estatesDB.includes(estate)) {
                                // console.log('Estate Tersedia');
                                
                                // Get the task data where estate matches the specified estate
                                const matchingTasks = tasks.filter(task => task.estate === estate);
                                // console.log('Tasks with matching estate:', matchingTasks);
                                const estateFromMatchingTask = matchingTasks.length > 0 ? matchingTasks[0].estate : null;
                                const group_id = matchingTasks.length > 0 ? matchingTasks[0].group_id : null;
                                const folder = matchingTasks.length > 0 ? matchingTasks[0].wilayah : null;
                                // console.log(noWa);
                                try {
                                    await sock.sendMessage(noWa, { text: 'Mohon tunggu laporan sedang di generate' }, { quoted: message });
                                    const result = await sendtaksasiest(estateFromMatchingTask, group_id, folder);
                                    if (result === 'success') {
                                        console.log('succes');
                                    } else if (result === 'error') {
                                        await sock.sendMessage(noWa, { text: 'Terjadi kesalahan saat mengirim taksasi. Silakan Hubungi Tim D.A.' }, { quoted: message });
                                    }
                                } catch (error) {
                                    console.error('Error fetching data:', error.message);
                                
                                }
                            } else {
                                await sock.sendMessage(noWa, { text: 'Estate yang anda masukan tidak tersedia di database. Silahkan Ulangi dan Cek Kembali' }, { quoted: message });
                                // Handle the case where the estate is not found in the database
                            }
                        } else {
                            // Handle the case where no estate name is provided in the command
                            await sock.sendMessage(noWa, { text: 'Mohon masukkan nama estate setelah perintah !tarik dilanjutkan dengan singkatan nama Estate.\n-Contoh !tarikkne = Untuk Estate KNE dan seterusnya' }, { quoted: message });
                        }
                    }else if (lowerCaseMessage === "!menu") {
                        await sock.sendMessage(noWa, { text: "Perintah Bot Yang tersida \n1 = !tarik (Menarik Estate yang di pilih untuk di generate ke dalam grup yang sudah di tentukan) \n2= !help (Hubungi Kami Secara langsung untuk keluhan dan masalah)" }, { quoted: message });
                        break;
                    }else if (lowerCaseMessage === "!getgrup") {
                        // console.log('ini group');
                        let getGroups = await sock.groupFetchAllParticipating();
                        let groups = Object.values(await sock.groupFetchAllParticipating());
                        let datagrup = []; // Initialize an empty array to store group information
                        
                        for (let group of groups) {
                            datagrup.push(`id_group: ${group.id} || Nama Group: ${group.subject}`);
                        }
                        
                        await sock.sendMessage(noWa, { text: `List ${datagrup.join('\n')}` }, { quoted: message }); 
        
                        break;
                    }else if (lowerCaseMessage === "!update") {
                        await fetchDataAndSaveAsJSON();
                        
                        await sock.sendMessage(noWa, { text: `Cronjob Database Patched Gan`}, { quoted: message }); 
                    }else if (lowerCaseMessage === "!cast") {
                        // Send a message asking for the broadcast message
                        await sock.sendMessage(noWa, { text: "Masukan Kata kata yang ingin di broadcast ke dalam group?" }, { quoted: message });
                    
                        // Define a function to handle the response
                        async function handleBroadcast({ messages: responseMessages }) {
                            let messageSent = false; // Flag to track if the message has been sent
                    
                            for (const responseMessage of responseMessages) {
                                if (!responseMessage.key.fromMe && responseMessage.key.remoteJid === noWa) {
                                    // Get the broadcast message from the user's response
                                    const broadcastMessage = responseMessage.message.conversation;
                    
                                    console.log(broadcastMessage);
                    
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
                    }else if (lowerCaseMessage === "!restart") {
                        exec('pm2 restart bot_da', (error, stdout, stderr) => {
                            if (error) {
                                console.error(`Error restarting app: ${error.message}`);
                                return;
                            }
                            if (stderr) {
                                console.error(`Restart error: ${stderr}`);
                                return;
                            }
                            console.log(`App restarted: ${stdout}`);
                        });
                    }
                    // console.log('Message from group:', lowerCaseMessage || 'Text is null');
                } else {
                    if (lowerCaseMessage === "!menu") {
                        await sock.sendMessage(noWa, { text: "Hanya dapat di gunakan di dalam grup!" }, { quoted: message });
                        break;
                    }else if (lowerCaseMessage.startsWith("!tarik")) {
                        await sock.sendMessage(noWa, { text: "Hanya dapat di gunakan di dalam grup!" }, { quoted: message });
                        break;
                    }else if (lowerCaseMessage === "!update"){
                        await sock.sendMessage(noWa, { text: "Hanya dapat di gunakan di dalam grup!" }, { quoted: message });
                        break;
                    }else if (lowerCaseMessage === "!cast"){
                        await sock.sendMessage(noWa, { text: "Hanya dapat di gunakan di dalam grup!" }, { quoted: message });
                        break;
                    }else if (lowerCaseMessage === "!restart"){
                        await sock.sendMessage(noWa, { text: "Hanya dapat di gunakan di dalam grup!" }, { quoted: message });
                        break;
                    }
                    // console.log('Message from personal:', message.message.extendedTextMessage?.text || 'Text is null');
                }
            }
        }
    });
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

connectToWhatsApp()
    .catch(err => console.log("unexpected error: " + err)) // catch any errors
server.listen(port, () => {
    console.log("Server Berjalan pada Port : " + port);
});
