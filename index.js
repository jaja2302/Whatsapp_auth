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
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Adding 1 because getMonth() returns zero-based index
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Get the current date
const today = new Date();

// Format the current date to 'YYYY-MM-DD' format
const datetimeValue = formatDate(today);
const idgroup = '120363205553012899@g.us' 
// const idgroup = '120363204285862734@g.us'


async function senddata(groupID, destinationPath,fileName) {
    const pesankirim = fileName

    const messageOptions = {
        document: {
            url: destinationPath,
            caption: pesankirim
        },
        fileName: fileName
    };

    // Send the PDF file
    await sock.sendMessage(groupID, messageOptions);

    // Unlink the file after sending
    fs.unlink(destinationPath, (err) => {
        if (err) {
            console.error('Error unlinking the file:', err);
            
        }
    });

}

async function checkAndDeleteFiles() {
    let attempts = 0;
    const maxAttempts = 5;
    const retryDelay = 3000; // 3 seconds in milliseconds

    while (attempts < maxAttempts) {
        try {
            const getStatus = await axios.get('https://srs-ssms.com/whatsapp_bot/checkfolderstatus.php');
            const { data: folderStatus } = getStatus;

            if (Array.isArray(folderStatus) && folderStatus.length > 0) {
                for (const file of folderStatus) {
                    if (file.hasOwnProperty('wilayah') && file.hasOwnProperty('filename')) {
                        const { wilayah, filename } = file;
                        await deleteFile(filename, wilayah);
                    }
                }
            } else {
                console.log('No files found or empty folder. Nothing to delete.');
            }
            // Break the loop if successful
            break;
        } catch (error) {
            attempts++;
            console.error('Error checking and deleting files:', error);
            if (attempts < maxAttempts) {
                console.log(`Retrying attempt ${attempts} after ${retryDelay / 1000} seconds`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            } else {
                console.error(`Max retry attempts (${maxAttempts}) reached. Exiting retry loop.`);
                throw error; // Throw the error after max attempts are reached
            }
        }
    }
}


// taksasi func 

async function deleteFile(filename, folder) {
    try {
        const response = await axios.head(`https://srs-ssms.com/whatsapp_bot/deletebot.php?filename=${filename}&path=${folder}`);

        if (response.status === 200) {
            await axios.get(`https://srs-ssms.com/whatsapp_bot/deletebot.php?filename=${filename}&path=${folder}`);
            console.log(`File '${filename}' in folder '${folder}' deleted successfully.`);
        } else if (response.status === 404) {
            console.log(`File '${filename}' in folder '${folder}' doesn't exist. Skipping deletion.`);
        } else {
            console.log(`Unexpected status code ${response.status} received. Skipping deletion.`);
        }
    } catch (error) {
        console.log(`Error checking or deleting file '${filename}' in folder '${folder}':`, error.message);
        await sock.sendMessage(idgroup, { text: 'Error checking or deleting file' })
    }
}

async function sendPdfToGroups(folder, groupID) {
    try {
        const response = await axios.get(`https://srs-ssms.com/whatsapp_bot/taksasiScan.php?folder=${folder}`);

        // Accessing the response data
        const files = response.data;

        if (!files || files.length === 0) {
            // return res.status(200).json({
            //     status: false,
            //     response: "Folder is empty"
            // });
            await sock.sendMessage(idgroup, { text: 'Folder is empty' })
            console.log('empty');
        }

        for (const key in files) {
            if (Object.hasOwnProperty.call(files, key)) {
                const fileName = files[key];
                const fileUrl = `https://srs-ssms.com/whatsapp_bot/taksasi/${folder}/${fileName}`;
                const destinationPath = `./uploads/${fileName}`;

                const file = fs.createWriteStream(destinationPath);

                await new Promise((resolve, reject) => {
                    https.get(fileUrl, function(response) {
                        response.pipe(file);
                        file.on('finish', function() {
                            file.close(() => {
                                console.log('File downloaded successfully.');
                                resolve(); // Resolve the promise after the file is downloaded
                            });
                        });
                    }).on('error', function(err) {
                        fs.unlink(destinationPath, () => {}); // Delete the file if there is an error
                        console.error('Error downloading the file:', err);
                        reject(err); // Reject the promise if there is an error
                    });
                });

                await senddata(groupID, destinationPath, fileName);
                await deleteFile(fileName, folder);
            }
        }
        await sock.sendMessage(idgroup, { text: 'Laporan berhasil di kirim ke grup' })
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

  
async function Generatedmapsest(estate, datetime) {
    const maxRetries = 5;
    let retryCount = 0;
    while (retryCount < maxRetries) {
        try {
            const formData = new URLSearchParams();
            formData.append('estate', estate);
            formData.append('datetime', datetime);

            // const response = await axios.post('http://localhost:3000/api/run', formData, {
            //     headers: {
            //         'Content-Type': 'application/x-www-form-urlencoded' // Set the proper content type for form data
            //     }
            // });
            const response = await axios.post('https://digi-kappa-lac.vercel.app/api/run', formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded' // Set the proper content type for form data
                }
            });


            // console.log('Response data:', response.data); // Access the response data
            await sock.sendMessage(idgroup, { text: `Map ${estate} berhasil di generate` });
            return response.data;
        } catch (error) {
            console.error('Error fetching data:', error);
            await sock.sendMessage(idgroup, { text: `Map ${estate} gagal di generate ${error.status}`});
            retryCount++;
            if (retryCount === maxRetries) {
                await sock.sendMessage(idgroup, { text: `Terjadi kesalahan menarik ${estate} yang gagal di generate`});
                throw error;
            } else {
                console.log(`Retrying (${retryCount}/${maxRetries})...`);
                await sock.sendMessage(idgroup, { text: `Menarik ulang Map ${estate} yang gagal di generate`});
            }
        }
    }
}


  
async function GenDefaultTaksasi(est) {
    let attempts = 0;
    const maxAttempts = 5;
    const retryDelay = 3000; // 3 seconds in milliseconds

    while (attempts < maxAttempts) {
        try {
            const response = await axios.get(`https://srs-ssms.com/rekap_pdf/pdf_taksasi_folder.php?est=${est.toLowerCase()}`);
            await sock.sendMessage(idgroup, { text: `Pdf berhasil di generate ${est}` })
            return response;
        } catch (error) {
            console.error('Error fetching data:', error);
            attempts++;
            if (attempts < maxAttempts) {
                console.log(`Retrying attempt ${attempts} for ${est}`);
                await sock.sendMessage(idgroup, { text: `Mengulang Generate PDF ${est}` })
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            } else {
                await sock.sendMessage(idgroup, { text: `Sudah Max Generate PDF ${est} Gagal` })
                throw error; // Throw the error after max attempts are reached
            }
        }
    }
}
  
async function sendtaksasiest(estate,group_id,folder) {
    try {
        await checkAndDeleteFiles(); 
        await generatemapstaksasi(estate,datetimeValue)
        await GenDefaultTaksasi(estate)
        await sendPdfToGroups(folder, group_id);

        return 'success';
    } catch (error) {
        return 'error';
    }
}

// end taksasi func 
function formatPhoneNumber(phoneNumber) {
    if (phoneNumber.startsWith("08")) {
        return "628" + phoneNumber.substring(2);
    } else {
        return phoneNumber;
    }
}

let phoneNumber = "082295204921";
let formattedNumber = formatPhoneNumber(phoneNumber);
// console.log(formattedNumber);  // Output: 6282295204921

// smartlab func 
async function sendMessagesBasedOnData() {
    try {
        // console.log('smartlabs');
        const response = await axios.get('https://srs-ssms.com/whatsapp_bot/getmsgsmartlab.php');
        const numberData = response.data;

        if (!Array.isArray(numberData) || numberData.length === 0) {
            // console.log('Invalid or empty data.'); // Log the error
            return;
        }

            // Assuming this is inside a loop or function
        for (const data of numberData) {
            const numberWA = formatPhoneNumber(data.penerima) + "@s.whatsapp.net";
            console.log(numberWA); // Log the WhatsApp number for debugging

            if (isConnected) {
                
                const currentTime = moment().tz('Asia/Jakarta');
                const currentHour = currentTime.hours();
                let greeting;
                if (currentHour < 10) {
                    greeting = 'Selamat Pagi';
                } else if (currentHour < 15) {
                    greeting = 'Selamat Siang';
                } else if (currentHour < 19) {
                    greeting = 'Selamat Sore';
                } else {
                    greeting = 'Selamat Malam';
                }
            
                let chatContent; // Declare chatContent outside of the if-else block
                if (data.type === "input") {
                    chatContent = `Yth. Pelanggan Setia Lab CBI,\n\nSampel anda telah kami terima dengan no surat *${data.no_surat}*. \nprogress saat ini: *${data.progres}*. Progress anda dapat dilihat di website https://smartlab.srs-ssms.com/tracking_sampel dengan kode tracking sample : *${data.kodesample}*\nTerima kasih telah mempercayakan sampel anda untuk dianalisa di Lab kami.`;
                } else {
                    chatContent = `Yth. Pelanggan Setia Lab CBI,\n\nProgress Sampel anda telah *Terupdate* dengan no surat *${data.no_surat}*. \nProgress saat ini: *${data.progres}*. Progress anda dapat dilihat di website https://smartlab.srs-ssms.com/tracking_sampel dengan kode tracking sample : *${data.kodesample}*\nTerima kasih telah mempercayakan sampel anda untuk dianalisa di Lab kami.`;
                }
            
                const message = `${greeting}\n${chatContent}`;
            


                const result = await sock.sendMessage(numberWA, { text: message });

                console.log('Message sent:smartlab', data.id); // Log the result for debugging
                await deletemsg(data.id)
                // Stop the loop or function after the message is sent
                break;
            } else {
                console.log('WhatsApp belum terhubung.'); // Log if WhatsApp is not connected
            }
        }

    } catch (error) {
        console.error('Error fetching data or sending messages:', error); // Log the error if any occurs
    }
}

async function deletemsg(idmsg) {
    try {
        // await axios.post('http://localhost:52914/deletedata', { id: idmsg });
        await axios.post('https://srs-ssms.com/whatsapp_bot/getmsgsmartlab.php', { id: idmsg });
     
        console.log(`Message ID '${idmsg}' deleted successfully.`);
    } catch (error) {
        console.log(`Error deleting message ID '${idmsg}':`, error);
    }
}

// 5 menit sekali 

// end smartlab func 

// func untuk aws 


async function statusAWS() {
    try {
        const response = await axios.get('https://srs-ssms.com/iot/notif_wa_last_online_device.php');
        // console.log('iot');
        // Check if response.data is not empty
        if (Array.isArray(response.data) && response.data.length > 0) {
            const jsonArray = response.data; // Use the response directly

            // Iterate through each object in the array
            for (const item of jsonArray) {
                // Check if 'online' is equal to 0 and 'group_id' is not empty
                if (item.online === 0 && item.group_id && item.group_id.trim() !== '') {
                     await sock.sendMessage(item.group_id, { text: item.message });
                     console.log(item.group_id, { text: item.message });
                }
            }
        }
    } catch (error) {
        console.error(`Error fetching files:`, error);
    }
}

// cron edit history 

function readLatestId() {
    try {
        if (fs.existsSync('latest_id.txt')) {
            const data = fs.readFileSync('latest_id.txt', 'utf8');
            return parseInt(data.trim()); // Parse the ID as an integer
        } else {
            // If the file doesn't exist, set the initial latest_id to 9
            writeLatestId(9);
            return 9;
        }
    } catch (err) {
        console.error('Error reading latest ID:', err);
        return null;
    }
}

// Function to write the latest ID to a file
function writeLatestId(id) {
    try {
        fs.writeFileSync('latest_id.txt', id.toString()); // Write the ID to the file
    } catch (err) {
        console.error('Error writing latest ID:', err);
    }
}
async function statusHistory() {
    try {
        // Get the latest ID from the file
        let latestId = readLatestId();

        // Fetch new data from the API using the latest ID
        const response = await axios.get('https://qc-apps.srs-ssms.com/api/history', {
            params: {
                id: latestId // Change the parameter name to "id"
            }
        });
        const numberData = response.data;

        if (Array.isArray(numberData) && numberData.length > 0) {
            for (const data of numberData) {
                if (isConnected) {
                    const maxId = Math.max(...response.data.map(item => item.id));
                    writeLatestId(maxId);
        
                    const pesankirim = data.menu;
                    const groupId = '120363205553012899@g.us'; // Update with your actual group ID
                    let existIdGroup = await sock.groupMetadata(groupId);
                    console.log(existIdGroup.id);
                    console.log("isConnected");

                    if (existIdGroup?.id || (existIdGroup && existIdGroup[0]?.id)) {
                        await sock.sendMessage(groupId, { text: `User ${data.nama_user} melakukan ${data.menu} pada ${data.tanggal}` });
                        console.log('Message sent successfully.');
                    } else {
                        console.log(`ID Group ${groupId} tidak terdaftar.`);
                    }
                    break;
                } else {
                    console.log('WhatsApp belum terhubung.');
                    break;
                }
            }
        } else {
            console.log('No data or invalid data received from the API.');
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        // Handle the error accordingly
    }
}


// end aws 

async function checkatasan(nama_atasansatu) {
    try {
  
        // const response = await axios.post('http://qc-apps2.test/api/getnamaatasan', {
        //     nama: nama_atasansatu
        // });
        const response = await axios.post('http://qc-apps2.test/api/getnamaatasan', {
            nama: nama_atasansatu
        });

        return response.data.data; // Assuming your API response structure has a 'data' field
    } catch (error) {
        // Check if the error response is due to a 404 status code
        if (error.response && error.response.status === 404) {
            return { message: 'Nama Atasan tidak ditemukan' };
        } else {
            console.error('Error fetching data:', error);
            // throw new Error('Error fetching data from API');
        }
    }
}

async function getunitlist(nama_atasansatu) {
    try {
        // Fetch data from the API using the provided name
        // const response = await axios.get('http://qc-apps2.test/api/getunitdata');
        const response = await axios.get('http://qc-apps2.test/api/getunitdata');

        return response.data.data;
    } catch (error) {
        // Check if the error response is due to a 404 status code
        if (error.response && error.response.status === 404) {
            return { message: 'Nama Unit tidak ditemukan' };
        } else {
            console.error('Error fetching data:', error);
            // throw new Error('Error fetching data from API');
        }
    }
}
async function getuserinfo(user) {
    try {
        // Fetch data from the API using the provided name
        // const response = await axios.post('http://qc-apps2.test/api/getuserinfo', {
        //     nama: user
        // });
        const response = await axios.post('http://qc-apps2.test/api/getuserinfo', {
            nama: user
        });

        return response.data.data; // Assuming your API response structure has a 'data' field
    } catch (error) {
        // Check if the error response is due to a 404 status code
        if (error.response && error.response.status === 404) {
            return { message: 'Nama User tidak ditemukan' };
        } else {
            console.error('Error fetching data:', error);
            // throw new Error('Error fetching data from API');
        }
    }
}

const userchoice = {};
const botpromt = {};
const timeoutHandles = {};

const handleijinmsg = async (noWa, text) => {


    const resetUserState = async () => {
        await sock.sendMessage(noWa, { text: 'Waktu Anda telah habis. Silakan mulai kembali dengan mengetikkan !izin.' });
        delete userchoice[noWa];
        delete botpromt[noWa];
        if (timeoutHandles[noWa]) {
            clearTimeout(timeoutHandles[noWa]);
            delete timeoutHandles[noWa];
        }
    };

    const setUserTimeout = () => {
        if (timeoutHandles[noWa]) {
            clearTimeout(timeoutHandles[noWa]);
        }
        // 10 menit timeout 
        // timeoutHandles[noWa] = setTimeout(resetUserState, 10 * 60 * 1000);
        // 10 detik timeout 
        timeoutHandles[noWa] = setTimeout(resetUserState, 60 * 1000);

    };


    if (!userchoice[noWa]) {
        userchoice[noWa] = 'name';
        botpromt[noWa] = { attempts: 0 }; 
        await sock.sendMessage(noWa, { text: 'Silakan masukkan *nama lengkap anda* atau *nama depan Anda* untuk pencarian di database.' });

        setUserTimeout();
    } else {
        setUserTimeout(); // Reset timeout with every interaction
        const step = userchoice[noWa];

        if (step === 'name') {
            botpromt[noWa].name = text;
            userchoice[noWa] = 'check_user';
            await sock.sendMessage(noWa, { text: 'Memeriksa nama pengguna di database...' });

            const result = await getuserinfo(text);

            // console.log(result);
            if (result.message && result.message === 'Nama User tidak ditemukan') {
                botpromt[noWa].attempts += 1;
                if (botpromt[noWa].attempts >= 3) {
                    await sock.sendMessage(noWa, { text: 'Anda telah mencoba 3 kali. Silakan coba lagi nanti.' });
                    delete userchoice[noWa];
                    delete botpromt[noWa];
                    clearTimeout(timeoutHandles[noWa]);
                    delete timeoutHandles[noWa];
                } else {
                    await sock.sendMessage(noWa, { text: 'Pengguna tidak ditemukan di database. Harap masukkan ulang:' });
                    userchoice[noWa] = 'name';
                }
            } else if (result !== null && result.length > 0) {
                botpromt[noWa].user_id_option = result;

                let message = 'Silakan pilih pengguna dari daftar berikut ,*HARAP MASUKAN ANGKA SAJA DARI PILIHAN TERSEDIA*:\n';
                result.forEach((item, index) => {
                    message += `${index + 1}. ${item.nama} (${item.departemen})\n`;
                });
                message += `${result.length + 1}. Pengguna tidak tersedia dalam daftar.\n`;
                message += `${result.length + 2}. Coba masukan nama kembali`;
                

                userchoice[noWa] = 'choose_name';
                await sock.sendMessage(noWa, { text: message });
            }
        } else if (step === 'choose_name') {
            const chosenIndex = parseInt(text) - 1;
            const options = botpromt[noWa].user_id_option;
         
            if (isNaN(chosenIndex) || !options || chosenIndex < 0 || chosenIndex >= options.length + 2) {
                await sock.sendMessage(noWa, { text: 'Pilihan tidak valid. Silakan masukkan nomor yang sesuai:' });
                return;
            }
        

            if (chosenIndex === options.length) {
                await sock.sendMessage(noWa, { text: 'Jika nama tidak tersedia, silakan hubungi admin di nomor +62-xxx-xxx-xxxx untuk bantuan.' });
                delete userchoice[noWa];
                delete botpromt[noWa];
                clearTimeout(timeoutHandles[noWa]);
                delete timeoutHandles[noWa];
            } else if (chosenIndex === options.length + 1) {
                userchoice[noWa] = 'name';
                await sock.sendMessage(noWa, { text: 'Silakan masukkan *nama lengkap anda* atau *nama depan Anda* untuk pencarian di database.' });
            } else {
                try {
                    const response = await axios.post('https://qc-apps.srs-ssms.com/api/formdataizin', {
                        name: options[chosenIndex].id,
                        type: 'check_user',
                        no_hp: noWa,
                    });
                    let responses = response.data;

                    const responseKey = Object.keys(responses)[0];

                    // console.log(responses);
                    await sock.sendMessage(noWa, { text: 'Mohon tunggu, server sedang melakukan validasi.' });
                    if (responseKey === "error_validasi") {
                        await sock.sendMessage(noWa, { text: `Verifikasi data gagal karena: ${responses[responseKey]}` });
                        await sock.sendMessage(noWa, { text: `Session Berakhir, Silahkan Izin Ulang dengan perintah !izin` });
                        delete userchoice[noWa];
                        delete botpromt[noWa];
                        clearTimeout(timeoutHandles[noWa]);
                        delete timeoutHandles[noWa];
                    } else {
                        botpromt[noWa].user_nama = options[chosenIndex].nama;
                        botpromt[noWa].user_nama_id = options[chosenIndex].id;
                        userchoice[noWa] = 'location';
                        await sock.sendMessage(noWa, { text: 'Mohon tentukan *LOKASI* yang akan Anda kunjungi untuk pengajuan izin.' });
                    }
                               
                } catch (error) {
                    if (error.response && error.response.status === 404) {
                        await sock.sendMessage(noWa, { text: 'Terjadi error tidak terduga' });
                        delete userchoice[noWa];
                        delete botpromt[noWa];
                        clearTimeout(timeoutHandles[noWa]);
                        delete timeoutHandles[noWa];
                    } else {
                        await sock.sendMessage(noWa, { text: 'Terjadi kesalahan saat mengirim data. Mohon coba lagi.' });
                        delete userchoice[noWa];
                        delete botpromt[noWa];
                        clearTimeout(timeoutHandles[noWa]);
                        delete timeoutHandles[noWa];
                    }
                }
            }
        } else if (step === 'location') {
            botpromt[noWa].location = text;
            userchoice[noWa] = 'date';
            await sock.sendMessage(noWa, { text: 'Harap masukkan tanggal *UNTUK KELUAR KEBUN* dengan format (DD-MM-YYYY)(23-02-2024) yang benar:' });

        } else if (step === 'date') {
            const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
            if (!dateRegex.test(text)) {
                await sock.sendMessage(noWa, { text: 'Tanggal Tidak sesuai harap masukkan kembali (Format:Hari-Bulan-Tahun):' });
                return;
            }

            const [day, month, year] = text.split('-').map(Number);

            if (month < 1 || month > 12 || day < 1 || day > 31) {
                await sock.sendMessage(noWa, { text: 'Tanggal atau bulan tidak valid. Harap masukkan kembali (Format:Hari-Bulan-Tahun):' });
                return;
            }

            const inputDate = new Date(year, month - 1, day);
            if (inputDate.getDate() !== day || inputDate.getMonth() !== (month - 1) || inputDate.getFullYear() !== year) {
                await sock.sendMessage(noWa, { text: 'Tanggal tidak valid. Harap masukkan kembali (Format:Hari-Bulan-Tahun):' });
                return;
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (inputDate < today) {
                await sock.sendMessage(noWa, { text: 'Tanggal Tidak boleh di masa lalu. Harap masukkan tanggal yang valid (Format:Hari-Bulan-Tahun):' });
                return;
            }

            botpromt[noWa].date = text;
            userchoice[noWa] = 'date_2';
            await sock.sendMessage(noWa, { text: 'Harap masukkan tanggal *UNTUK KEMBALI* dengan format (DD-MM-YYYY)(23-02-2024) yang benar:' });
        } else if (step === 'date_2') {
            const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
            if (!dateRegex.test(text)) {
                await sock.sendMessage(noWa, { text: 'Tanggal Tidak sesuai harap masukkan kembali (Format:Hari-Bulan-Tahun):' });
                return;
            }

            const [day, month, year] = text.split('-').map(Number);

            if (month < 1 || month > 12 || day < 1 || day > 31) {
                await sock.sendMessage(noWa, { text: 'Tanggal atau bulan tidak valid. Harap masukkan kembali (Format:Hari-Bulan-Tahun):' });
                return;
            }

            const inputDate = new Date(year, month - 1, day);
            if (inputDate.getDate() !== day || inputDate.getMonth() !== (month - 1) || inputDate.getFullYear() !== year) {
                await sock.sendMessage(noWa, { text: 'Tanggal tidak valid. Harap masukkan kembali (Format:Hari-Bulan-Tahun):' });
                return;
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (inputDate < today) {
                await sock.sendMessage(noWa, { text: 'Tanggal Tidak boleh di masa lalu. Harap masukkan tanggal yang valid (Format:Hari-Bulan-Tahun):' });
                return;
            }

            botpromt[noWa].date_2 = text;
            userchoice[noWa] = 'needs';
            await sock.sendMessage(noWa, { text: 'Mohon jelaskan keperluan Anda untuk keluar dari kebun:' });

        }else if (step === 'needs') {
            botpromt[noWa].needs = text;
            userchoice[noWa] = 'atasan_satu';
            await sock.sendMessage(noWa, { text: 'Silakan masukkan nama lengkap *ATASAN PERTAMA* atau nama depan untuk pencarian didatabase' });

        } else if (step === 'atasan_satu') {
            botpromt[noWa].atasan_satu = text;
            const nama_atasansatu = text;
            const result = await checkatasan(nama_atasansatu);
        
            if (result.message && result.message === 'Nama Atasan tidak ditemukan') {
                botpromt[noWa].attempts = (botpromt[noWa].attempts || 0) + 1;
                if (botpromt[noWa].attempts >= 3) {
                    await sock.sendMessage(noWa, { text: 'Anda sudah melakukan percobaan 3 kali. Silahkan coba kembali nanti.' });
                    delete userchoice[noWa];
                    delete botpromt[noWa];
                    clearTimeout(timeoutHandles[noWa]);
                    delete timeoutHandles[noWa];
                } else {
                    await sock.sendMessage(noWa, { text: 'Nama Atasan Tidak ditemukan di database. Harap input ulang:' });
                }
            } else if (result && result.length > 0) {
                botpromt[noWa].atasan_options_satu = result;
        
                let message = 'Pilih Nama Atasan Pertama.*HARAP MASUKAN ANGKA SAJA DARI PILIHAN TERSEDIA*:\n';
                result.forEach((item, index) => {
                    message += `${index + 1}. ${item.nama} (${item.departemen})\n`;
                });
                message += `${result.length + 1}. Nama tidak tersedia di dalam pilihan\n`;
                message += `${result.length + 2}. Coba masukan nama kembali`;
        
                userchoice[noWa] = 'choose_atasan_satu';
                await sock.sendMessage(noWa, { text: message });
            } else {
                await sock.sendMessage(noWa, { text: 'Nama Atasan Tidak ditemukan di database. Harap input ulang:' });
            }
        } else if (step === 'choose_atasan_satu') {
            const chosenIndex = parseInt(text) - 1;
            const options = botpromt[noWa].atasan_options_satu;
        
            if (isNaN(chosenIndex) || !options || chosenIndex < 0 || chosenIndex >= options.length + 2) {
                botpromt[noWa].attempts = (botpromt[noWa].attempts || 0) + 1;
                if (botpromt[noWa].attempts >= 3) {
                    await sock.sendMessage(noWa, { text: 'Anda sudah melakukan percobaan 3 kali. Silahkan coba kembali nanti.' });
                    delete userchoice[noWa];
                    delete botpromt[noWa];
                    clearTimeout(timeoutHandles[noWa]);
                    delete timeoutHandles[noWa];
                    return;
                } else {
                    await sock.sendMessage(noWa, { text: 'Pilihan tidak valid. Silakan masukkan nomor yang sesuai:' });
                    return;
                }
            }
        
            if (chosenIndex === options.length) {
                await sock.sendMessage(noWa, { text: 'Nama Atasan tidak tersedia. Silakan hubungi admin di nomor: +62-xxx-xxx-xxxx untuk keluhan.' });
                delete userchoice[noWa];
                delete botpromt[noWa];
                clearTimeout(timeoutHandles[noWa]);
                delete timeoutHandles[noWa];
            } else if (chosenIndex === options.length + 1) {
                userchoice[noWa] = 'atasan_satu';
                await sock.sendMessage(noWa, { text: 'Silakan masukkan nama lengkap atasan *PERTAMA* atau nama depan untuk pencarian didatabase' });
            } else {
                botpromt[noWa].atasan_satu = options[chosenIndex].nama;
                botpromt[noWa].atasan_satu_id = options[chosenIndex].id;
                delete botpromt[noWa].atasan_options_satu;
        
                userchoice[noWa] = 'atasan_dua';
                // botpromt[noWa] = { attempts: 0 };
                await sock.sendMessage(noWa, { text: 'Silakan masukkan nama lengkap *ATASAN KEDUA* atau nama depan untuk pencarian didatabase' });
            }
        }
        else if (step === 'atasan_dua') {
            botpromt[noWa].atasan_dua = text;
            const nama_atasandua = text;
            const result = await checkatasan(nama_atasandua);
            if (result.message && result.message === 'Nama Atasan tidak ditemukan') {
                botpromt[noWa].attempts += 1;
                if (botpromt[noWa].attempts >= 3) {
                    await sock.sendMessage(noWa, { text: 'Anda sudah melakukan percobaan *3 kali*. Silahkan coba kembali nanti.' });
                    delete userchoice[noWa];
                    delete botpromt[noWa];
                    clearTimeout(timeoutHandles[noWa]);
                    delete timeoutHandles[noWa];
                } else {
                    await sock.sendMessage(noWa, { text: 'Nama Atasan Tidak ditemukan di database. Harap input ulang:' });
                 
                }
            } else if (result !== null && result.length > 0) {
                botpromt[noWa].atasan_options_dua = result;

                let message = 'Pilih Nama Atasan kedua , *HARAP MASUKAN ANGKA SAJA DARI PILIHAN TERSEDIA*:\n';
                result.forEach((item, index) => {
                    message += `${index + 1}. ${item.nama} (${item.departemen})\n`;
                });
                message += `${result.length + 1}. Nama tidak tersedia di dalam pilihan\n`;
                message += `${result.length + 2}. Coba masukan nama kembali`;
        

                userchoice[noWa] = 'choose_atasan_dua';
                await sock.sendMessage(noWa, { text: message });
            } else {
                await sock.sendMessage(noWa, { text: 'Nama Atasan Tidak ditemukan di database. Harap input ulang:' });
            }
        } else if (step === 'choose_atasan_dua') {
            const chosenIndex = parseInt(text) - 1;
            const options = botpromt[noWa].atasan_options_dua;

            if (isNaN(chosenIndex) || !options || chosenIndex < 0 || chosenIndex >= options.length + 2) {
                botpromt[noWa].attempts = (botpromt[noWa].attempts || 0) + 1;
                if (botpromt[noWa].attempts >= 3) {
                    await sock.sendMessage(noWa, { text: 'Anda sudah melakukan percobaan 3 kali. Silahkan coba kembali nanti.' });
                    delete userchoice[noWa];
                    delete botpromt[noWa];
                    clearTimeout(timeoutHandles[noWa]);
                    delete timeoutHandles[noWa];
                    return;
                } else {
                    await sock.sendMessage(noWa, { text: 'Pilihan tidak valid. Silakan masukkan nomor yang sesuai:' });
                    return;
                }  
            }

            if (chosenIndex === options.length) {
                await sock.sendMessage(noWa, { text: 'Nama Atasan tidak tersedia. Silakan hubungi admin di nomor: +62-xxx-xxx-xxxx untuk keluhan.' });
                delete userchoice[noWa];
                delete botpromt[noWa];
                clearTimeout(timeoutHandles[noWa]);
                delete timeoutHandles[noWa];
            }else if (chosenIndex === options.length + 1) {
                userchoice[noWa] = 'atasan_dua';
                await sock.sendMessage(noWa, { text: 'Silakan masukkan nama lengkap atasan *KEDUA* atau nama depan untuk pencarian didatabase' });
            } else if (!isNaN(chosenIndex) && options && options[chosenIndex]) {
                botpromt[noWa].atasan_dua = options[chosenIndex].nama;
                botpromt[noWa].atasan_dua_id = options[chosenIndex].id;
                delete botpromt[noWa].atasan_options_dua;

                userchoice[noWa] = 'confirm';
                await sock.sendMessage(noWa, { text: `*HARAP CROSSCHECK DATA ANDA TERLEBIH DAHULU*:
                \nNama: ${botpromt[noWa].user_nama}
                \nTujuan: ${botpromt[noWa].location}
                \nTanggal Izin Keluar: ${botpromt[noWa].date}
                \nTanggal Kembali: ${botpromt[noWa].date_2}
                \nKeperluan: ${botpromt[noWa].needs}
                \nAtasan Satu: ${botpromt[noWa].atasan_satu}
                \nAtasan Dua: ${botpromt[noWa].atasan_dua}
                \nApakah semua data sudah sesuai? (ya/tidak)` });
            }
        } else if (step === 'confirm') {
            if (text.toLowerCase() === 'ya') {
                try {
                    const response = await axios.post('https://qc-apps.srs-ssms.com/api/formdataizin', {
                        name: botpromt[noWa].user_nama_id,
                        tujuan: botpromt[noWa].location,
                        unit_kerja: botpromt[noWa].unit_kerja_id,
                        pergi: botpromt[noWa].date,
                        kembali: botpromt[noWa].date_2,
                        keperluan: botpromt[noWa].needs,
                        atasan_satu: botpromt[noWa].atasan_satu_id,
                        atasan_dua: botpromt[noWa].atasan_dua_id,
                        no_hp: noWa,
                    });

                    let responses = response.data;

                    const responseKey = Object.keys(responses)[0];

                    console.log(responses);
                    await sock.sendMessage(noWa, { text: 'Mohon Tunggu server melakukan validasi.....' });
                    if (responseKey === "error_validasi") {
                        await sock.sendMessage(noWa, { text: `Data gagal diverifikasi, Karena: ${responses[responseKey]}` });
                    } else {
                        await sock.sendMessage(noWa, { text: 'Permohonan izin berhasil dikirim dan sedang menunggu persetujuan dari atasan. Harap tunggu notifikasi selanjutnya atau cek perkembangan di website: https://srs-ssms.com.' });
                    }
                    

                   
                } catch (error) {
                    if (error.response && error.response.status === 404) {
                        await sock.sendMessage(noWa, { text: 'Nama Atasan tidak ditemukan di database. Harap input ulang.' });
                    } else {
                        console.error('Error fetching data:', error);
                        await sock.sendMessage(noWa, { text: 'Terjadi kesalahan saat mengirim data. Silakan coba lagi.' });
                    }
                }
            } else if (text.toLowerCase() === 'tidak') {
                await sock.sendMessage(noWa, { text: 'Silakan coba lagi untuk input dengan mengetikkan !izin.' });
            } else {
                await sock.sendMessage(noWa, { text: 'Pilihan tidak valid. Silakan jawab dengan "ya" atau "tidak":' });
                return;
            }

            delete userchoice[noWa];
            delete botpromt[noWa];
            clearTimeout(timeoutHandles[noWa]);
            delete timeoutHandles[noWa];
        } else {
            await sock.sendMessage(noWa, { text: 'Pilihan tidak valid. Silakan masukkan nomor yang sesuai:' });
        }
    }
};

async function getNotifications() {
    try {
        const response = await axios.get('http://qc-apps2.test/api/getnotifijin');
        const data = response.data;

        if (data.status === '200' && data.data && data.data.length > 0) {
            const result = data.data;
            for (const itemdata of result) {
                if (itemdata.no_hp) {
                    if (itemdata.status === 'approved') {
                        let message = `*Ijin baru perlu di approved*:\n`;
                        message += `Hallo Selamat Siang Pak/Ibu ${itemdata.atasan_nama}\n`;
                        message += `Anda memiliki request baru untuk izin keluar kebun dengan detail sebagai berikut:\n`;
                        message += `*ID Pemohon* : ${itemdata.id}\n`;
                        message += `*Nama* : ${itemdata.user_request}\n`;
                        message += `*Keperluan izin keluar kebun* : ${itemdata.keperluan}\n`;
                        message += `*Lokasi yang di tuju* : ${itemdata.lokasi_tujuan}\n`;
                        message += `*Tanggal keluar peminta Izin* : ${itemdata.tanggal_keluar}\n`;
                        message += `*Tanggal kembali peminta Izin* : ${itemdata.tanggal_kembali}\n`;
                        message += `Silahkan Repply Pesan ini kemudian balas ya/tidak\n`;
                        message += `Generated by Digital Architect SRS bot`;
                        await sock.sendMessage(itemdata.no_hp + "@s.whatsapp.net", { text: message });  
                    } else if (itemdata.status === 'send_approved') {
                        let message = `*Izin Keluar Kebun Anda Telah Disetujui*\n\n`;
                        message += `Hallo Selamat Siang Pak/Ibu ${itemdata.user_request},\n\n`;
                        message += `Kami ingin menginformasikan bahwa permintaan izin keluar kebun Anda telah disetujui.\n\n`;
                        message += `Berikut adalah detail izin Anda:\n`;
                        message += `*Nama Pemohon*: ${itemdata.user_request}\n`;
                        message += `*Tanggal Keluar*: ${itemdata.tanggal_keluar}\n`;
                        message += `*Tanggal Kembali*: ${itemdata.tanggal_kembali}\n`;
                        message += `*Keperluan*: ${itemdata.keperluan}\n`;
                        message += `*Lokasi Tujuan*: ${itemdata.lokasi_tujuan}\n\n`;
                        message += `Harap selalu berhati-hati selama perjalanan dan pastikan untuk mengikuti protokol keamanan yang berlaku. Kami mendoakan agar Anda tiba dengan selamat di tujuan dan kembali ke kebun dengan kondisi sehat dan aman.\n\n`;
                        message += `Jika ada pertanyaan lebih lanjut, jangan ragu untuk menghubungi kami.\n\n`;
                        message += `Terima kasih,\n`;
                        message += `Tim Digital Architect SRS Bot`;
                        await sock.sendMessage(itemdata.no_hp + "@s.whatsapp.net", { text: message });

                        try {
                            const response = await axios.post('http://qc-apps2.test/api/updatenotifijin', {
                                id_data: itemdata.id,
                                id_atasan: itemdata.id_atasan,
                                answer: 'ya',
                            });
                        } catch (error) {
                            console.log("Error approving:", error);
                        }
                    } else if (itemdata.status === 'rejected') {
                        let message = `*Izin Keluar Kebun Anda Telah Ditolak*\n\n`;
                        message += `Hallo Selamat Siang Pak/Ibu ${itemdata.user_request},\n\n`;
                        message += `Kami ingin menginformasikan bahwa permintaan izin keluar kebun Anda telah ditolak dikarenakan :.\n\n`;
                        message += `*Alasan ditolak*: ${itemdata.alasan}\n`;
                        message += `Jika ada pertanyaan lebih lanjut, jangan ragu untuk menghubungi kami.\n\n`;
                        message += `Terima kasih,\n`;
                        message += `Tim Digital Architect SRS Bot`;
                        await sock.sendMessage(itemdata.no_hp + "@s.whatsapp.net", { text: message });

                        try {
                        
                            const response = await axios.post('http://qc-apps2.test/api/updatenotifijin', {
                                id_data: itemdata.id,
                                id_atasan: '3',
                                answer: 'tidak',
                            });
                            console.log(response);
                        } catch (error) {
                            console.log("Error approving:", error);
                        }
                    }
                } else {
                    let message = `Aplikasi Surat ijin kebun Nomor HP kosong untuk : ${itemdata.id}\n`;
                    message += `Haraf di update nama atasan ${itemdata.atasan_nama}\n`;
                    await sock.sendMessage('120363205553012899'  + "@g.us", { text: message });
                }
            }
        } else {
            console.log('Data kosong');
        }
        return response;
    } catch (error) {
        console.error('Error:', error);
    }
}

// end surat izin 
async function downloadFile(fileUrl, destinationPath) {
    const file = fs.createWriteStream(destinationPath);

    return new Promise((resolve, reject) => {
        https.get(fileUrl, function(response) {
            response.pipe(file);
            file.on('finish', function() {
                file.close(() => {
                    console.log(`File downloaded successfully: ${destinationPath}`);
                    resolve();
                });
            });
        }).on('error', function(err) {
            fs.unlink(destinationPath, () => {}); // Delete the file if there is an error
            console.error('Error downloading the file:', err);
            reject(err);
        });
    });
}


async function get_mill_data() {
    try {
        // const response = await axios.get('http://qc-apps2.test/api/getdatamill');
        const response = await axios.get('https://qc-apps.srs-ssms.com/api/getdatamill');
        const data = response.data;
        const noWa_grading = '120363204285862734@g.us' 
        // const noWa_grading = '120363164751475851@g.us'

        if (data.status === '200' && data.data && data.data.length > 0) {
            const result = data.data;

            for (const itemdata of result) {
                // for (const fileName of itemdata.foto) {
                //     const trimmedFileName = fileName.trim(); // Ensure no leading/trailing spaces
                //     const fileUrl = `https://mobilepro.srs-ssms.com/storage/app/public/qc/grading_mill/${trimmedFileName}`;
                //     const destinationPath = path.join(__dirname, 'uploads', trimmedFileName);

                //     // Download the file
                //     await new Promise((resolve, reject) => {
                //         const file = fs.createWriteStream(destinationPath);
                //         https.get(fileUrl, function(response) {
                //             response.pipe(file);
                //             file.on('finish', function() {
                //                 file.close(() => {
                //                     console.log('File downloaded successfully:', destinationPath);
                //                     resolve(); // Resolve the promise after the file is downloaded
                //                 });
                //             });
                //         }).on('error', function(err) {
                //             fs.unlink(destinationPath, () => {}); // Delete the file if there is an error
                //             console.error('Error downloading the file:', err);
                //             reject(err); // Reject the promise if there is an error
                //         });
                //     });

                //     const messageOptions = {
                //         image: {
                //             url: destinationPath
                //         },
                //     };

                //     await sock.sendMessage(noWa_grading, messageOptions);

                //     // Remove the image file after sending
                //     fs.unlink(destinationPath, (err) => {
                //         if (err) {
                //             console.error('Error unlinking the file:', err);
                //         } else {
                //             console.log('File removed successfully:', destinationPath);
                //         }
                //     });
                // }
                // Update the data mill after processing each itemdata
                await axios.post('https://qc-apps.srs-ssms.com/api/updatedatamill', { id: itemdata.id });
                let pemanen_tanpabrondol = itemdata.pemanen_list_tanpabrondol?.tanpaBrondol_list || [];
                let pemanen_kurangbrondol = itemdata.pemanen_list_kurangbrondol?.kurangBrondol_list || [];
                
                let message = `*Berikut Hasil Grading Total ${itemdata.estate} ${itemdata.afdeling}*:\n`;
                message += `*Ripeness*: ${itemdata.Ripeness} jjg (${itemdata.percentase_ripenes}%)\n`;
                message += `*Unripe*: ${itemdata.Unripe} jjg (${itemdata.persenstase_unripe}%)\n`;
                message += `•0 brondol: ${itemdata.nol_brondol} jjg (${itemdata.persentase_nol_brondol}%)\n`;
                pemanen_tanpabrondol.forEach((item, index) => {
                    message += `${index + 1}. No. Pemanen : ${item.no_pemanen} = ${item.tanpaBrondol} jjg\n`;
                });
                message += `•< brondol: ${itemdata.kurang_brondol} jjg (${itemdata.persentase_brondol}%)\n`;
                pemanen_kurangbrondol.forEach((item, index) => {
                    message += `${index + 1}. No. Pemanen : ${item.no_pemanen} = ${item.kurangBrondol} jjg\n`;
                });
                message += `*Overripe*:  ${itemdata.Overripe} jjg ( ${itemdata.persentase_overripe}%)\n`;
                message += `*Empty bunch*: ${itemdata.empty_bunch} jjg (${itemdata.persentase_empty_bunch}%)\n`;
                message += `*Rotten bunch*: ${itemdata.rotten_bunch} jjg (${itemdata.persentase_rotten_bunce}%)\n`;
                message += `*Abnormal*: ${itemdata.Abnormal} jjg (${itemdata.persentase_abnormal}%)\n`;
                message += `*Dirt*: ${itemdata.Dirt} Kg ( ${itemdata.persentase}%)\n`
                message += `*Loose Fruit*: ${itemdata.loose_fruit} Kg (${itemdata.persentase_lose_fruit}%)\n\n`;
                message += `Jumlah janjang di Grading: ${itemdata.jjg_grading} jjg\n`;
                message += `Jumlah janjang di SPB:  ${itemdata.jjg_spb} jjg\n`;
                message += `Jumlah Selisih janjang: ${itemdata.jjg_selisih} jjg ( ${itemdata.persentase_selisih}%)\n`;
                message += `Generated by Digital Architech SRS bot`;
                // await sock.sendMessage(noWa_grading, { text: message });
              
                const fileUrl = `https://qc-apps.srs-ssms.com/storage/${itemdata.filename_pdf}`;
                const destinationPath = `./uploads/${itemdata.filename_pdf}`;
    
                const file = fs.createWriteStream(destinationPath);
    
                await new Promise((resolve, reject) => {
                    https.get(fileUrl, function(response) {
                        response.pipe(file);
                        file.on('finish', function() {
                            file.close(() => {
                                console.log('File downloaded successfully.');
                                resolve(); // Resolve the promise after the file is downloaded
                            });
                        });
                    }).on('error', function(err) {
                        fs.unlink(destinationPath, () => {}); // Delete the file if there is an error
                        console.error('Error downloading the file:', err);
                        reject(err); // Reject the promise if there is an error
                    });
                });
                const messageOptions = {
                    document: {
                        url: destinationPath,
                        caption: 'ini caption'
                    },
                    fileName: 'Laporan Grading Mill'
                };
            
                // Send the PDF file
                await sock.sendMessage(noWa_grading, messageOptions);
                await sock.sendMessage(noWa_grading, { text: message });

                // Unlink the file after sending
                fs.unlink(destinationPath, (err) => {
                    if (err) {
                        console.error('Error unlinking the file:', err);
                        
                    }
                });
            }
        } else {
            console.log('data kosong');
        }
        return response;
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

// end grading mill 



//end bot notifikasi surat ijin

const userIotChoice = {};
const botIotPrompt = {};
const handleIotInput = async (noWa, text) => {
    const resetUserState = async () => {
        await sock.sendMessage(noWa, { text: 'Waktu Anda telah habis. Silakan mulai kembali dengan mengetikkan !iot.' });
        delete userIotChoice[noWa];
        delete botIotPrompt[noWa];
        if (timeoutHandles[noWa]) {
            clearTimeout(timeoutHandles[noWa]);
            delete timeoutHandles[noWa];
        }
    };

    const setUserTimeout = () => {
        if (timeoutHandles[noWa]) {
            clearTimeout(timeoutHandles[noWa]);
        }
        timeoutHandles[noWa] = setTimeout(resetUserState, 60 * 1000);
    };

    if (!userIotChoice[noWa]) {
        userIotChoice[noWa] = 'estate';
        botIotPrompt[noWa] = { attempts: 0 };
        await sock.sendMessage(noWa, { text: 'Masukkan estate' });
        setUserTimeout();
    } else {
        setUserTimeout(); // Reset timeout with every interaction
        const step = userIotChoice[noWa];

        if (step === 'estate') {
            botIotPrompt[noWa].estate = text;
            try {
                const response = await axios.post('https://qc-apps.srs-ssms.com/api/inputiotdata', {
                    estate: botIotPrompt[noWa].estate,
                    type: 'check_estate',
                });
                let responses = response.data.data;

                // console.log(responses);
                await sock.sendMessage(noWa, { text: 'Mohon tunggu, server sedang melakukan validasi.' });
                
                let message = 'Pilih list afdeling, Masukan angka saja\n';
                let options = [];

                Object.keys(responses).forEach((key, index) => {
                    responses[key].forEach((item) => {
                        options.push(item);
                        message += `${options.length}. ${item.nama}\n`;
                    });
                });

                message += `${options.length + 1}. Afd tidak tersedia dalam daftar.\n`;
                message += `${options.length + 2}. Coba masukan afd kembali\n`;

                botIotPrompt[noWa].afdelingOptions = options;
                userIotChoice[noWa] = 'afdeling';
                await sock.sendMessage(noWa, { text: message });
                           
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    await sock.sendMessage(noWa, { text: 'Terjadi error tidak terduga' });
                    delete userIotChoice[noWa];
                    delete botIotPrompt[noWa];
                    clearTimeout(timeoutHandles[noWa]);
                    delete timeoutHandles[noWa];
                } else {
                    await sock.sendMessage(noWa, { text: 'Terjadi kesalahan saat mengirim data. Mohon coba lagi.' });
                    delete userIotChoice[noWa];
                    delete botIotPrompt[noWa];
                    clearTimeout(timeoutHandles[noWa]);
                    delete timeoutHandles[noWa];
                }
            }

          
        } else if (step === 'afdeling') {
            const chosenIndex = parseInt(text) - 1;
            const options = botIotPrompt[noWa].afdelingOptions;
         
            if (isNaN(chosenIndex) || !options || chosenIndex < 0 || chosenIndex >= options.length + 2) {
                await sock.sendMessage(noWa, { text: 'Pilihan tidak valid. Silakan masukkan nomor yang sesuai:' });
                return;
            } else {
                botIotPrompt[noWa].afdeling = chosenIndex < options.length ? options[chosenIndex].nama : null;
                botIotPrompt[noWa].afdeling_id = chosenIndex < options.length ? options[chosenIndex].afdeling_id : null;
                botIotPrompt[noWa].estate_id = chosenIndex < options.length ? options[chosenIndex].est_id : null;
                botIotPrompt[noWa].estate_nama = chosenIndex < options.length ? options[chosenIndex].est : null;
                userIotChoice[noWa] = 'curah_hujan';
                await sock.sendMessage(noWa, { text: 'Masukkan curah hujan (harap angka saja)' });
            }
               
       
        } else if (step === 'curah_hujan') {
            const curahHujan = parseFloat(text);
            if (isNaN(curahHujan)) {
                await sock.sendMessage(noWa, { text: 'Curah hujan tidak valid. Masukkan angka saja.' });
                return;
            }
            botIotPrompt[noWa].curahHujan = curahHujan;
            userIotChoice[noWa] = 'confirm';
            await sock.sendMessage(noWa, {
                text: `*HARAP CROSSCHECK DATA ANDA TERLEBIH DAHULU*:
                \nAfdeling ID: ${botIotPrompt[noWa].afdeling_id}
                \nEstate: ${botIotPrompt[noWa].estate_nama}
                \nCurah Hujan: ${botIotPrompt[noWa].curahHujan}
                \nApakah semua data sudah sesuai? (ya/tidak)`
            });
        } else if (step === 'confirm') {
            if (text.toLowerCase() === 'ya') {
                try {
                    const response = await axios.post('https://qc-apps.srs-ssms.com/api/inputiotdata', {
                        afdeling_id: botIotPrompt[noWa].afdeling_id,
                        estate_id: botIotPrompt[noWa].estate_id,
                        curahHujan: botIotPrompt[noWa].curahHujan,
                        estate: botIotPrompt[noWa].estate_nama,
                        afdeling: botIotPrompt[noWa].afdeling,
                        type: 'input',
                    });

                    const responses = response.data;
                    const responseKey = Object.keys(responses)[0];

                  
                    await sock.sendMessage(noWa, { text: 'Mohon tunggu, server sedang melakukan validasi...' });
                    if (responseKey === "error_validasi") {
                        await sock.sendMessage(noWa, { text: `Data gagal diverifikasi, karena: ${responses[responseKey]}` });
                    } else {
                        await sock.sendMessage(noWa, { text: 'Data berhasil dimasukan ke dalam database' });
                    }
                } catch (error) {
                    // Log the entire error object for more details
                    console.log(error);
                
                    // Log specific properties of the error object
                    console.log('Error message:', error.message);
                    console.log('Error stack:', error.stack);
                    
                    if (error.response) {
                        console.log('Error response data:', error.response.data);
                        console.log('Error response status:', error.response.status);
                        console.log('Error response headers:', error.response.headers);
                    }
                
                    // Handle the 404 status code specifically
                    if (error.response && error.response.status === 404) {
                        await sock.sendMessage(noWa, { text: 'Terjadi kesalahan saat mengirim data. Silakan coba lagi.' });
                    }
                }
                
            } else if (text.toLowerCase() === 'tidak') {
                await sock.sendMessage(noWa, { text: 'Silakan coba lagi untuk input dengan mengetikkan !iot.' });
            } else {
                await sock.sendMessage(noWa, { text: 'Pilihan tidak valid. Silakan jawab dengan "ya" atau "tidak":' });
                return;
            }

            delete userIotChoice[noWa];
            delete botIotPrompt[noWa];
            clearTimeout(timeoutHandles[noWa]);
            delete timeoutHandles[noWa];
        } else {
            await sock.sendMessage(noWa, { text: 'Pilihan tidak valid. Silakan masukkan nomor yang sesuai:' });
        }
    }
};

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
    sock.ev.on("messages.upsert", async function handleUpsert({ messages, type }) {
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
    
                        if (conversation.includes('Ijin baru perlu di approved')) {
                            const idPemohonStartIndex = conversation.indexOf('*ID Pemohon* : ') + '*ID Pemohon* : '.length;
                            const idPemohonEndIndex = conversation.indexOf('\n', idPemohonStartIndex);
                            const idPemohon = conversation.substring(idPemohonStartIndex, idPemohonEndIndex).trim();
                            const [id, idAtasan] = idPemohon.split('/').map(part => part.trim());
                            const namaStartIndex = conversation.indexOf('*Nama* : ') + '*Nama* : '.length;
                            const namaEndIndex = conversation.indexOf('\n', namaStartIndex);
                            const nama = conversation.substring(namaStartIndex, namaEndIndex).trim();
                            
                            // console.log(nama);
                            if (respon_atasan.toLowerCase() !== 'ya' && respon_atasan.toLowerCase() !== 'tidak') {
                                await sock.sendMessage(noWa, { text: "Harap hanya balas ya atau tidak" }, { quoted: message });
                            } else if (respon_atasan.toLowerCase() === 'ya') {
                                try {
                                    const response = await axios.post('http://qc-apps2.test/api/updatenotifijin', {
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
                                let message = `*Alasan ijin di tolak?*:\n`;
                                message += `*ID Pemohon* : ${id}/${idAtasan}\n`;
                                message += `*Nama* : ${nama}\n`;
                                message += `Silahkan Repply Pesan ini untuk memberikan alasan izin di tolak\n`;
                                await sock.sendMessage(noWa, { text: message });  
                            }
                            
                        }else if (conversation.includes('Alasan ijin di tolak')) {
                            const idPemohonStartIndex = conversation.indexOf('*ID Pemohon* : ') + '*ID Pemohon* : '.length;
                            const idPemohonEndIndex = conversation.indexOf('\n', idPemohonStartIndex);
                            const idPemohon = conversation.substring(idPemohonStartIndex, idPemohonEndIndex).trim();
                            const [id, idAtasan] = idPemohon.split('/').map(part => part.trim());
                            try {
                                const response = await axios.post('http://qc-apps2.test/api/updatenotifijin', {
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
                        } 
                        else {
                            console.log('pesan lainnya');
                        }
                    }
                }
    
                if (message.key.remoteJid.endsWith('@g.us')) {
                    // if (lowerCaseMessage && lowerCaseMessage.startsWith("!tarik")) {
                    //     // Extract the estate name from the command
                    //     const estateCommand = lowerCaseMessage.replace("!tarik", "").trim();
                    //     const estate = estateCommand.toUpperCase(); // Convert to uppercase for consistency
    
                    //     // Check if the estate name is valid
                    //     if (!estate) {
                    //         await sock.sendMessage(noWa, { text: 'Mohon masukkan nama estate setelah perintah !tarik dilanjutkan dengan singkatan nama Estate.\n-Contoh !tarikkne = Untuk Estate KNE dan seterusnya' }, { quoted: message });
                    //         return;
                    //     }
    
                    //     const apiUrl = 'http://qc-apps2.test//api/getdatacron';
                    //     try {
                    //         const response = await axios.get(apiUrl);
                    //         const dataestate = response.data;
                    //         const matchingTasks = dataestate.filter(task => task.estate === estate);
    
                    //         if (matchingTasks.length > 0) {
                    //             const { estate: estateFromMatchingTask, group_id, wilayah: folder } = matchingTasks[0];
                    //             await sock.sendMessage(noWa, { text: 'Mohon tunggu laporan sedang di proses' }, { quoted: message });
                    //             const result = await sendtaksasiest(estateFromMatchingTask, group_id, folder);
    
                    //             if (result === 'success') {
                    //                 console.log('success');
                    //                 break;
                    //             } else {
                    //                 await sock.sendMessage(noWa, { text: 'Terjadi kesalahan saat mengirim taksasi. Silakan Hubungi Tim D.A.' }, { quoted: message });
                    //                 break;
                    //             }
                    //         } else {
                    //             await sock.sendMessage(noWa, { text: 'Estate yang anda masukan tidak tersedia di database. Silahkan Ulangi dan Cek Kembali' }, { quoted: message });
                    //             break;
                    //         }
                    //     } catch (error) {
                    //         console.error('Error fetching data:', error.message);
                    //         break;
                    //     }
                    // } else if (lowerCaseMessage === "!menu") {
                    //     await sock.sendMessage(noWa, { text: "Perintah Bot Yang tersida \n1 = !tarik (Menarik Estate yang di pilih untuk di generate ke dalam grup yang sudah di tentukan) \n2.!getgrup (Menampilkan semua isi list group yang ada) \n3.!cast (melakukan broadcast pesan ke semua grup taksasi) \n4.!restart (Merestart Service Bot)" }, { quoted: message });
                    //     break;
                    // } else if (lowerCaseMessage === "!getgrup") {
                    //     let getGroups = await sock.groupFetchAllParticipating();
                    //     let groups = Object.values(await sock.groupFetchAllParticipating());
                    //     let datagrup = []; // Initialize an empty array to store group information
    
                    //     for (let group of groups) {
                    //         datagrup.push(`id_group: ${group.id} || Nama Group: ${group.subject}`);
                    //     }
    
                    //     await sock.sendMessage(noWa, { text: `List ${datagrup.join('\n')}` }, { quoted: message });
    
                    //     break;
                    // } else if (lowerCaseMessage === "!cast") {
                    //     // Send a message asking for the broadcast message
                    //     await sock.sendMessage(noWa, { text: "Masukan Kata kata yang ingin di broadcast ke dalam group?" }, { quoted: message });
    
                    //     // Define a function to handle the response
                    //     async function handleBroadcast({ messages: responseMessages }) {
                    //         let messageSent = false; // Flag to track if the message has been sent
    
                    //         for (const responseMessage of responseMessages) {
                    //             if (!responseMessage.key.fromMe && responseMessage.key.remoteJid === noWa) {
                    //                 // Get the broadcast message from the user's response
                    //                 const broadcastMessage = responseMessage.message.conversation;
    
                    //                 // Get the participating groups
                    //                 let groups = Object.values(await sock.groupFetchAllParticipating());
                    //                 let datagrup = groups.map((group) => ({
                    //                     id_group: group.id,
                    //                     nama: group.subject,
                    //                 }));
    
                    //                 let groupdont = [
                    //                     '120363200959267322@g.us',
                    //                     '120363164661400702@g.us',
                    //                     '120363214741096436@g.us',
                    //                     '120363158376501304@g.us',
                    //                 ];
    
                    //                 // Send a message indicating that the broadcast is being processed
                    //                 await sock.sendMessage(noWa, { text: 'Mohon Tunggu, Broadcast Sedang Di Proses' }, { quoted: message });
    
                    //                 // Set a timer for 60 seconds (1 minute)
                    //                 const timer = setTimeout(async () => {
                    //                     if (!messageSent) {
                    //                         // If the message hasn't been sent within the time limit, notify the user
                    //                         await sock.sendMessage(noWa, { text: 'Waktu habis! Silahkan coba kembali.' }, { quoted: message });
                    //                     }
                    //                 }, 60000); // 60 seconds in milliseconds
    
                    //                 // Send the broadcast message to groups
                    //                 for (const group of datagrup) {
                    //                     if (!groupdont.includes(group.id_group)) {
                    //                         await sock.sendMessage(group.id_group, { text: broadcastMessage });
                    //                         console.log(group.id_group, { text: broadcastMessage });
                    //                         messageSent = true; // Update the flag since the message has been sent
                    //                     }
                    //                 }
    
                    //                 // Clear the timer since the message has been sent or the timer has expired
                    //                 clearTimeout(timer);
    
                    //                 // Send a message indicating that the broadcast message has been sent to all groups
                    //                 await sock.sendMessage(noWa, { text: 'Broadcast Pesan sudah di kirim Kesemua Grup' }, { quoted: message });
    
                    //                 // Turn off the event listener for handling broadcast messages
                    //                 sock.ev.off("messages.upsert", handleBroadcast);
                    //                 break;
                    //             }
                    //         }
                    //     }
    
                    //     // Listen for the user's response to the broadcast message
                    //     sock.ev.on("messages.upsert", handleBroadcast);
                    // }
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
                            await handleijinmsg(noWa, lowerCaseMessage);
                        }
                    } else if (userchoice[noWa]) {
                        // Continue the ijin process if it has already started
                        await handleijinmsg(noWa, text);
                    }
                    // else if (lowerCaseMessage === "!iot") {
                    //     if (!userIotChoice[noWa]) {
                    //         await handleIotInput(noWa, lowerCaseMessage);
                    //     }
                    // } else if (userIotChoice[noWa]) {
                    //     // Continue the input process if it has already started
                    //     await handleIotInput(noWa, text);
                    // }
                    else {
                        // Handle other messages
                        console.log('message comming to number');
                        // await handleMessage(noWa, lowerCaseMessage, messages);
                    }
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


async function sendhistorycron(estate,id) {
    try {
        // const apiUrl = 'http://ssms-qc.test/api/recordcronjob';
        const apiUrl = 'https://qc-apps.srs-ssms.com/api/recordcronjob';
        
        // Create the form data with variables estate and datetime
        const formData = new FormData();
        formData.append('est', estate); 

        // Get the current date and time in the Jakarta timezone using Luxon
        const dateTime = DateTime.now().setZone('Asia/Jakarta').toISO(); 

        formData.append('datetime', dateTime); 
        formData.append('id', id); 
        // Send the POST request with form data
        const response = await axios.post(apiUrl, formData);

        // Handle the response if needed
        console.log("Response:", response.data);
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}




// Function to fetch data from API and save as JSON
async function fetchDataAndSaveAsJSON() {
    try {
        // const apiUrl = 'http://ssms-qc.test/api/getdatacron';
        const apiUrl = 'https://qc-apps.srs-ssms.com/api/getdatacron';
        const response = await axios.get(apiUrl);
        //  console.log('ada');
        // Save response data as JSON
        fs.writeFile('data.json', JSON.stringify(response.data, null, 2), err => {
            if (err) {
                console.error('Error saving data:', err);
            } else {
                console.log('Data saved as data.json');
            }
        });
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

async function sendfailcronjob() {
    try {
        // const apiUrl = 'http://ssms-qc.test/api/checkcronjob';
        const apiUrl = 'https://qc-apps.srs-ssms.com/api/checkcronjob';
        const response = await axios.get(apiUrl);

        let data = response.data.cronfail; 

        if (data.length === 0) {
            console.log('nodata');   
        } else {
            for (const task of data) {
                try {
                    // await sock.sendMessage(task.group_id, { text: `Cronjob ${task.estate}`});
                    await checkAndDeleteFiles(); 
                    // await Generatedmapsest(task.estate, datetimeValue);
                    await generatemapstaksasi(task.estate, datetimeValue);
                    await GenDefaultTaksasi(task.estate);
                    await sendPdfToGroups(task.wilayah, task.group_id);
                    await sendhistorycron(task.estate, task.id);
                } catch (error) {
                    console.error('Error performing task in cronjob:', error);
                }
            }
        }

    } catch (error) {
        console.error("Error fetching data:", error);
    }
}



app.get("/getdataapi", async (req, res) => {
    try {
        const result = await maintencweget();

        // console.log(result);
        if (result.status === 200) {
            res.status(200).json({
                status: true,
                response: "Task Success"
            });
        } else {
            res.status(500).json({
                status: false,
                response: result.message || "Internal Server Error"
            });
        }
    } catch (error) {
        console.error("Error sending files:", error);
        res.status(500).json({
            status: false,
            response: error.message || "Internal Server Error"
        });
    }
});

// untuk aplikasi web maintenance


// untuk aplikasi web maintence 
async function maintencweget() {
    try {
        const getStatus = await axios.get('https://qc-apps.srs-ssms.com/api/sendwamaintence');
        const dataress = getStatus.data;

        if (!Array.isArray(dataress)) {
            return {
                status: 200,
                message: "No pending messages found or invalid response format"
            };
        }

        for (const item of dataress) {
            const { id, data } = item;
            const messageData = data[0]; // Assuming there is always one item in the data array
            const numberWA = formatPhoneNumber(messageData.sending_number) + "@s.whatsapp.net";
            // console.log(`Sending message to: ${numberWA}`);

            if (isConnected) {
                let msg_request = `You have a new request from *${messageData.nama_client}*\n.Details of the request:\n- **Request Date:** *${messageData.date_req}*\n- **Equipment Requested:** *${messageData.equipment}*\n- **Request Location:** *${messageData.location}*\nPlease check the details on the request page\n.\n\nThank you.`;

                try {
                    await sock.sendMessage(numberWA, { text: msg_request });
                    // console.log(`Message sent to ${numberWA}`);
                } catch (error) {
                    // console.log(`Failed to send message to ${numberWA}:`, error);
                }
               
                await axios.post('https://qc-apps.srs-ssms.com/api/changestatusmaintence', { id: id[0] });
                await delay(15000)
            } else {
                console.log('WhatsApp is not connected.');
            }
        }

        return {
            status: 200,
            message: "Messages sent successfully"
        };
    } catch (error) {
        console.log('An error occurred:', error);
        return {
            status: 500,
            message: "An error occurred while processing messages"
        };
    }
}


// all cron 

// cron.schedule('0 * * * *', async () => {
//     try {
//         // console.log('Running message history');
//         await statusHistory(); // Call the function to check history and send message
//     } catch (error) {
//         console.error('Error in cron job:', error);
//     }
// }, {
//     scheduled: true,
//     timezone: 'Asia/Jakarta' // Set the timezone according to your location
// });

// cron.schedule('*/1 * * * *', async () => {
//     await sendMessagesBasedOnData();
//     await maintencweget();
// }, {
//     scheduled: true,
//     timezone: 'Asia/Jakarta'
// });

// cron.schedule('0 * * * *', async () => {
//     try {
//         await statusAWS(); // Call the function to check AWS status and send message
//     } catch (error) {
//         console.error('Error in cron job:', error);
//     }
// }, {
//     scheduled: true,
//     timezone: 'Asia/Jakarta' // Set the timezone according to your location
// });

// cron.schedule('*/10 * * * *', async () => {
//     await sendfailcronjob();
// }, {
//     scheduled: true,
//     timezone: 'Asia/Jakarta'
// });
// cron.schedule('0 7 * * *', async () => {
//     exec('pm2 restart bot_da', (error, stdout, stderr) => {
//         if (error) {
//             console.error(`Error restarting app: ${error.message}`);
//             return;
//         }
//         if (stderr) {
//             console.error(`Restart error: ${stderr}`);
//             return;
//         }
//         console.log(`App restarted: ${stdout}`);
//     });
// }, {
//     scheduled: true,
//     timezone: 'Asia/Jakarta'
// });
// cron.schedule('*/5 * * * *', async () => {
//     await getNotifications();
// }, {
//     scheduled: true,
//     timezone: 'Asia/Jakarta'
// });



connectToWhatsApp()
    .catch(err => console.log("unexpected error: " + err))
server.listen(port, () => {
    console.log("Server Berjalan pada Port : " + port);
});
