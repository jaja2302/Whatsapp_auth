const puppeteer = require('puppeteer');
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { DateTime } = require('luxon');
const Pusher = require('pusher-js/node');
const {
  userchoice,
  botpromt,
  timeoutHandles,
  userIotChoice,
  botIotPrompt,
  userchoiceSnoozeBotPengawasanOperator,
  choiceSnoozeBotPengawasanOperator,
  userTalsasiChoice,
  botTaksasi,
  configSnoozeBotPengawasanOperator,
} = require('./state');
const moment = require('moment-timezone');
const { text } = require('express');
const { exec } = require('child_process');
const { type } = require('os');
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Adding 1 because getMonth() returns zero-based index
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get the current date
const today = new Date();

const datetimeValue = formatDate(today);
const idgroup = '120363205553012899@g.us';
const idgroup_testing = '120363204285862734@g.us';
const idgroup_da = '120363303562042176@g.us';

function formatPhoneNumber(phoneNumber) {
  if (phoneNumber.startsWith('08')) {
    return '628' + phoneNumber.substring(2);
  } else {
    return phoneNumber;
  }
}

// function kirim notifkasi edit nilai qc
let now = new Date();
let hour = now.getHours();
let greeting;

if (hour >= 4 && hour < 12) {
  greeting = 'Selamat Pagi';
} else if (hour >= 12 && hour < 15) {
  greeting = 'Selamat Siang';
} else if (hour >= 15 && hour < 18) {
  greeting = 'Selamat Sore';
} else {
  greeting = 'Selamat Malam';
}
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
function writeLatestId(id) {
  try {
    fs.writeFileSync('latest_id.txt', id.toString()); // Write the ID to the file
  } catch (err) {
    console.error('Error writing latest ID:', err);
  }
}
async function statusHistory(sock) {
  try {
    // Get the latest ID from the file
    let latestId = readLatestId();

    // Fetch new data from the API using the latest ID
    const response = await axios.get(
      'https://qc-apps.srs-ssms.com/api/history',
      {
        params: {
          id: latestId, // Change the parameter name to "id"
        },
      }
    );
    const numberData = response.data;

    if (Array.isArray(numberData) && numberData.length > 0) {
      for (const data of numberData) {
        const maxId = Math.max(...response.data.map((item) => item.id));
        writeLatestId(maxId);

        const pesankirim = data.menu;
        const groupId = '120363205553012899@g.us'; // Update with your actual group ID
        let existIdGroup = await sock.groupMetadata(groupId);
        // console.log(existIdGroup.id);
        // console.log("isConnected");

        if (existIdGroup?.id || (existIdGroup && existIdGroup[0]?.id)) {
          await sock.sendMessage(groupId, {
            text: `User ${data.nama_user} melakukan ${data.menu} pada ${data.tanggal}`,
          });
          console.log('Message sent successfully.');
        } else {
          console.log(`ID Group ${groupId} tidak terdaftar.`);
        }
        break;
      }
    } else {
      console.log('No data or invalid data received from the API.');
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    // Handle the error accordingly
  }
}
//end func

// function send notif ke pelanggan bot smartlabs

async function sendMessagesBasedOnData(sock) {
  try {
    const response = await axios.get(
      'https://qc-apps.srs-ssms.com/api/getmsgsmartlabs'
    );
    const numberData = response.data;

    if (numberData.data === 'kosong') {
      // Send a specific message when data is "kosong"

      console.log('Smartlabs Kosong'); // Log the result for debugging
    } else {
      // Process the data array as usual
      for (const data of numberData.data) {
        const numberWA = data.penerima + '@s.whatsapp.net';
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

        let chatContent;
        if (data.type === 'input') {
          chatContent = `Yth. Pelanggan Setia Lab CBI,\n\nSampel anda telah kami terima dengan no surat *${data.no_surat}*. \nprogress saat ini: *${data.progres}*. Progress anda dapat dilihat di website https://smartlab.srs-ssms.com/tracking_sampel dengan kode tracking sample : *${data.kodesample}*\nTerima kasih telah mempercayakan sampel anda untuk dianalisa di Lab kami.`;
        } else {
          chatContent = `Yth. Pelanggan Setia Lab CBI,\n\nProgress Sampel anda telah *Terupdate* dengan no surat *${data.no_surat}*. \nProgress saat ini: *${data.progres}*. Progress anda dapat dilihat di website https://smartlab.srs-ssms.com/tracking_sampel dengan kode tracking sample : *${data.kodesample}*\nTerima kasih telah mempercayakan sampel anda untuk dianalisa di Lab kami.`;
        }

        const message = `${greeting}\n${chatContent}`;
        const result = await sock.sendMessage(numberWA, { text: message });

        console.log('Message sent: smartlab', data.id); // Log the result for debugging
        await deletemsg(data.id); // Ensure this function is defined elsewhere in your code
      }
    }
  } catch (error) {
    console.error('Error fetching data or sending messages:', error); // Log the error if any occurs
  }
}

async function deletemsg(idmsg) {
  try {
    const response = await axios.post(
      'https://qc-apps.srs-ssms.com/api/deletemsgsmartlabs',
      {
        id: idmsg,
      }
    );

    let responses = response.data;
    console.log(`Message ID '${idmsg}' deleted successfully.`);
  } catch (error) {
    console.log(`Error deleting message ID '${idmsg}':`, error);
  }
}
//end func
// function send notifikasi bot web maintence

async function maintencweget(sock) {
  try {
    const getStatus = await axios.get(
      'https://qc-apps.srs-ssms.com/api/sendwamaintence'
    );
    const dataress = getStatus.data;

    if (!Array.isArray(dataress)) {
      return {
        status: 200,
        message: 'No pending messages found or invalid response format',
      };
    }

    for (const item of dataress) {
      const { id, data } = item;
      const messageData = data[0]; // Assuming there is always one item in the data array
      const numberWA =
        formatPhoneNumber(messageData.sending_number) + '@s.whatsapp.net';
      let msg_request = `You have a new request from *${messageData.nama_client}*\n.Details of the request:\n- **Request Date:** *${messageData.date_req}*\n- **Equipment Requested:** *${messageData.equipment}*\n- **Request Location:** *${messageData.location}*\nPlease check the details on the request page\n.\n\nThank you.`;

      try {
        await sock.sendMessage(numberWA, { text: msg_request });
        // console.log(`Message sent to ${numberWA}`);
      } catch (error) {
        // console.log(`Failed to send message to ${numberWA}:`, error);
      }

      await axios.post(
        'https://qc-apps.srs-ssms.com/api/changestatusmaintence',
        { id: id[0] }
      );
      await delay(15000);
    }

    return {
      status: 200,
      message: 'Messages sent successfully',
    };
  } catch (error) {
    console.log('An error occurred:', error);
    return {
      status: 500,
      message: 'An error occurred while processing messages',
    };
  }
}

// function send status bot aws

async function statusAWS(sock) {
  try {
    const response = await axios.get(
      'https://srs-ssms.com/iot/notif_wa_last_online_device.php'
    );
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

// endfunction

// function bot taksasi

async function deleteFile(filename, folder) {
  try {
    const response = await axios.head(
      `https://srs-ssms.com/whatsapp_bot/deletebot.php?filename=${filename}&path=${folder}`
    );

    if (response.status === 200) {
      await axios.get(
        `https://srs-ssms.com/whatsapp_bot/deletebot.php?filename=${filename}&path=${folder}`
      );
      console.log(
        `File '${filename}' in folder '${folder}' deleted successfully.`
      );
    } else if (response.status === 404) {
      console.log(
        `File '${filename}' in folder '${folder}' doesn't exist. Skipping deletion.`
      );
    } else {
      console.log(
        `Unexpected status code ${response.status} received. Skipping deletion.`
      );
    }
  } catch (error) {
    console.log(
      `Error checking or deleting file '${filename}' in folder '${folder}':`,
      error.message
    );
    await sock.sendMessage(idgroup, {
      text: 'Error checking or deleting file',
    });
  }
}
async function checkAndDeleteFiles() {
  let attempts = 0;
  const maxAttempts = 5;
  const retryDelay = 3000; // 3 seconds in milliseconds

  while (attempts < maxAttempts) {
    try {
      const getStatus = await axios.get(
        'https://srs-ssms.com/whatsapp_bot/checkfolderstatus.php'
      );
      const { data: folderStatus } = getStatus;

      if (Array.isArray(folderStatus) && folderStatus.length > 0) {
        for (const file of folderStatus) {
          if (
            file.hasOwnProperty('wilayah') &&
            file.hasOwnProperty('filename')
          ) {
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
        console.log(
          `Retrying attempt ${attempts} after ${retryDelay / 1000} seconds`
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } else {
        console.error(
          `Max retry attempts (${maxAttempts}) reached. Exiting retry loop.`
        );
        throw error; // Throw the error after max attempts are reached
      }
    }
  }
}

async function generatemapstaksasi(est, datetime) {
  let attempts = 0;
  let uploadSuccess = false;

  while (attempts < 2 && !uploadSuccess) {
    try {
      const browser = await puppeteer.launch({
        // executablePath: '../chrome-win/chrome.exe',
        headless: 'new',
      });
      const page = await browser.newPage();

      // Listen for console events and check for the success message
      page.on('console', (msg) => {
        if (msg.text() === 'Upload successfully gan') {
          uploadSuccess = true;
        }
      });

      await page.goto(
        `https://srs-ssms.com/rekap_pdf/convert_taksasi_pdf_get.php?datetime=${datetime}&estate=${est}`
      );
      await page.title();

      // Delay for 15 seconds before checking the success flag
      await new Promise((resolve) => setTimeout(resolve, 10000));

      if (uploadSuccess) {
        console.log('Upload successful after', attempts + 1, 'attempts');
        await page.close();
        await browser.close();
        return {
          body: {}, // Provide your response body here
          cookies: {}, // Provide your cookies object here
          response: 'success',
        };
      } else {
        console.log('Upload not successful, retrying...');
        await page.close();
        await browser.close();
        attempts++;
      }
    } catch (error) {
      console.error('Attempt', attempts + 1, 'failed with error:', error);
      attempts++;
    }
  }

  if (!uploadSuccess) {
    console.error('Upload failed after 5 attempts');
    return { error: 'Upload failed after maximum attempts' };
  }
}

async function sendtaksasiest(estate, group_id, folder, sock) {
  try {
    await checkAndDeleteFiles();
    await generatemapstaksasi(estate, datetimeValue);
    await GenDefaultTaksasi(estate, sock);
    await sendPdfToGroups(folder, group_id, sock);

    return 'success';
  } catch (error) {
    console.log(error);
    return 'error';
  }
}

async function checkAndDeleteFiles() {
  let attempts = 0;
  const maxAttempts = 5;
  const retryDelay = 3000; // 3 seconds in milliseconds

  while (attempts < maxAttempts) {
    try {
      const getStatus = await axios.get(
        'https://srs-ssms.com/whatsapp_bot/checkfolderstatus.php'
      );
      const { data: folderStatus } = getStatus;

      if (Array.isArray(folderStatus) && folderStatus.length > 0) {
        for (const file of folderStatus) {
          if (
            file.hasOwnProperty('wilayah') &&
            file.hasOwnProperty('filename')
          ) {
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
        console.log(
          `Retrying attempt ${attempts} after ${retryDelay / 1000} seconds`
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } else {
        console.error(
          `Max retry attempts (${maxAttempts}) reached. Exiting retry loop.`
        );
        throw error; // Throw the error after max attempts are reached
      }
    }
  }
}

async function GenDefaultTaksasi(est, sock) {
  let attempts = 0;
  const maxAttempts = 5;
  const retryDelay = 3000; // 3 seconds in milliseconds

  while (attempts < maxAttempts) {
    try {
      const response = await axios.get(
        `https://srs-ssms.com/rekap_pdf/pdf_taksasi_folder.php?est=${est.toLowerCase()}`
      );
      await sock.sendMessage(idgroup, {
        text: `Pdf berhasil di generate ${est}`,
      });
      return response;
    } catch (error) {
      console.error('Error fetching data:', error);
      attempts++;
      if (attempts < maxAttempts) {
        console.log(`Retrying attempt ${attempts} for ${est}`);
        await sock.sendMessage(idgroup, {
          text: `Mengulang Generate PDF ${est}`,
        });
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } else {
        await sock.sendMessage(idgroup, {
          text: `Sudah Max Generate PDF ${est} Gagal`,
        });
        throw error; // Throw the error after max attempts are reached
      }
    }
  }
}

async function GenDefaultTaksasinew(est, datetime, sock) {
  let attempts = 0;
  const maxAttempts = 5;
  const retryDelay = 3000; // 3 seconds in milliseconds

  while (attempts < maxAttempts) {
    try {
      const response = await axios.get(
        `https://srs-ssms.com/rekap_pdf/pdf_taksasi_folder.php?est=${est.toLowerCase()}&datetime=${datetime}`
      );
      await sock.sendMessage(idgroup, {
        text: `Pdf berhasil di generate ${est}`,
      });
      return response;
    } catch (error) {
      console.error('Error fetching data:', error);
      attempts++;
      if (attempts < maxAttempts) {
        console.log(`Retrying attempt ${attempts} for ${est}`);
        await sock.sendMessage(idgroup, {
          text: `Mengulang Generate PDF ${est}`,
        });
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } else {
        await sock.sendMessage(idgroup, {
          text: `Sudah Max Generate PDF ${est} Gagal`,
        });
        throw error; // Throw the error after max attempts are reached
      }
    }
  }
}

async function senddata(groupID, destinationPath, fileName, sock) {
  const pesankirim = fileName;

  const messageOptions = {
    document: {
      url: destinationPath,
      caption: pesankirim,
    },
    fileName: fileName,
    caption: 'Dikirim oleh *ROBOT*,jangan balas pesan',
  };

  // Send the PDF file
  await sock.sendMessage(groupID, messageOptions);
  // await sock.sendMessage(groupID, { text: 'Ini pesan dari robot' })
  // Unlink the file after sending
  fs.unlink(destinationPath, (err) => {
    if (err) {
      console.error('Error unlinking the file:', err);
    }
  });
}

async function sendPdfToGroups(folder, groupID, sock) {
  try {
    const response = await axios.get(
      `https://srs-ssms.com/whatsapp_bot/taksasiScan.php?folder=${folder}`
    );

    // Accessing the response data
    const files = response.data;

    if (!files || files.length === 0) {
      // return res.status(200).json({
      //     status: false,
      //     response: "Folder is empty"
      // });
      await sock.sendMessage(idgroup, { text: 'Folder is empty' });
      console.log('empty');
    }

    for (const key in files) {
      if (Object.hasOwnProperty.call(files, key)) {
        const fileName = files[key];
        const fileUrl = `https://srs-ssms.com/whatsapp_bot/taksasi/${folder}/${fileName}`;
        const destinationPath = `./uploads/${fileName}`;

        const file = fs.createWriteStream(destinationPath);

        await new Promise((resolve, reject) => {
          https
            .get(fileUrl, function (response) {
              response.pipe(file);
              file.on('finish', function () {
                file.close(() => {
                  console.log('File downloaded successfully.');
                  resolve(); // Resolve the promise after the file is downloaded
                });
              });
            })
            .on('error', function (err) {
              fs.unlink(destinationPath, () => {}); // Delete the file if there is an error
              console.error('Error downloading the file:', err);
              reject(err); // Reject the promise if there is an error
            });
        });

        await senddata(groupID, destinationPath, fileName, sock);
        await deleteFile(fileName, folder);
      }
    }
    await sock.sendMessage(idgroup, {
      text: 'Laporan berhasil di kirim ke grup',
    });
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

async function sendhistorycron(estate, id) {
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
    console.log('Response:', response.data);
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}
async function sendfailcronjob(sock) {
  try {
    const apiUrl = 'https://qc-apps.srs-ssms.com/api/checkcronjob';
    const response = await axios.get(apiUrl);

    let data = response.data.cronfail;
    // console.log(sock);
    if (data.length === 0) {
      console.log('nodata');
    } else {
      for (const task of data) {
        try {
          await checkAndDeleteFiles();
          await generatemapstaksasi(task.estate, datetimeValue);
          await GenDefaultTaksasi(task.estate, sock);
          await sendPdfToGroups(task.wilayah, task.group_id, sock);
          await sendhistorycron(task.estate, task.id, sock);
        } catch (error) {
          console.error('Error performing task in cronjob:', error);
        }
      }
    }
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}
const timeoutHandlestaksasi = {};
const handleTaksasi = async (noWa, text, sock) => {
  const resetUserState = async () => {
    await sock.sendMessage(noWa, {
      text: 'Waktu Anda telah habis. Silakan mulai kembali dengan mengetikkan !taksasi.',
    });
    delete userTalsasiChoice[noWa];
    delete botTaksasi[noWa];
    if (timeoutHandlestaksasi[noWa]) {
      clearTimeout(timeoutHandlestaksasi[noWa]);
      delete timeoutHandlestaksasi[noWa];
    }
  };

  const setUserTimeout = () => {
    if (timeoutHandlestaksasi[noWa]) {
      clearTimeout(timeoutHandlestaksasi[noWa]);
    }
    timeoutHandlestaksasi[noWa] = setTimeout(resetUserState, 60 * 1000);
  };

  if (!userTalsasiChoice[noWa]) {
    userTalsasiChoice[noWa] = 'tanggal';
    botTaksasi[noWa] = { attempts: 0 };
    await sock.sendMessage(noWa, {
      text: 'Masukkan Tanggal (Format: Hari-Bulan-Tahun) Contoh : (20-02-2024)',
    });
    setUserTimeout();
  } else {
    setUserTimeout(); // Reset timeout with every interaction
    const step = userTalsasiChoice[noWa];

    if (step === 'tanggal') {
      botTaksasi[noWa].tanggal = text;
      const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
      if (!dateRegex.test(text)) {
        await sock.sendMessage(noWa, {
          text: 'Tanggal tidak sesuai, harap masukkan kembali (Format: Hari-Bulan-Tahun):',
        });
        return;
      }

      const [day, month, year] = text.split('-').map(Number);
      if (month < 1 || month > 12 || day < 1 || day > 31) {
        await sock.sendMessage(noWa, {
          text: 'Tanggal atau bulan tidak valid. Harap masukkan kembali (Format: Hari-Bulan-Tahun):',
        });
        return;
      }

      const inputDate = new Date(year, month - 1, day);
      if (
        inputDate.getDate() !== day ||
        inputDate.getMonth() !== month - 1 ||
        inputDate.getFullYear() !== year
      ) {
        await sock.sendMessage(noWa, {
          text: 'Tanggal tidak valid. Harap masukkan kembali (Format: Hari-Bulan-Tahun):',
        });
        return;
      }

      botTaksasi[noWa].date = text;
      userTalsasiChoice[noWa] = 'estate';
      await sock.sendMessage(noWa, {
        text: 'Harap masukkan Estate apa saja dengan format setiap estate diakhiri dengan (/) contoh: kne/sce/nbe',
      });
    } else if (step === 'estate') {
      const estates = text.split('/').filter(Boolean); // Split input by '/' and filter out empty strings
      botTaksasi[noWa].estates = estates;

      // Validate the input format
      if (!text.includes('/')) {
        await sock.sendMessage(noWa, {
          text: 'Format tidak sesuai. Harap masukkan estate dengan pemisah / contoh: kne/sce/nbe',
        });
        return;
      }

      try {
        const apiUrl = 'https://qc-apps.srs-ssms.com/api/getdatacron';
        const response = await axios.get(apiUrl);

        if (Array.isArray(response.data)) {
          const apiEstates = response.data.map((item) =>
            item.estate.toLowerCase()
          ); // Extract estate values from API response and convert to lowercase

          // Find available estates
          const availableEstates = estates.filter((estate) =>
            apiEstates.includes(estate.toLowerCase())
          ); // Convert user input to lowercase before comparing

          if (availableEstates.length === 0) {
            await sock.sendMessage(noWa, {
              text: 'Masukan nama estate yang benar!',
            });
          } else {
            const dataestate = response.data;

            for (const estate of availableEstates) {
              const matchingTasks = dataestate.filter(
                (task) => task.estate.toLowerCase() === estate.toLowerCase()
              );

              if (matchingTasks.length > 0) {
                const {
                  estate: estateFromMatchingTask,
                  group_id,
                  wilayah: folder,
                } = matchingTasks[0];
                await sock.sendMessage(noWa, {
                  text: `Estate ${estateFromMatchingTask} sedang di proses`,
                });
                await checkAndDeleteFiles();
                await generatemapstaksasi(
                  estateFromMatchingTask,
                  botTaksasi[noWa].tanggal
                );
                await GenDefaultTaksasinew(
                  estateFromMatchingTask,
                  botTaksasi[noWa].tanggal,
                  sock
                );
                await sendPdfToGroups(folder, group_id, sock);
              }
            }
          }
        } else {
          throw new Error('Invalid API response structure');
        }
      } catch (error) {
        console.log('Error fetching data:', error.message);
        await sock.sendMessage(noWa, {
          text: 'There was an error checking the estate availability. Please try again later.',
        });
      }

      // Send a thank you message with the estates entered
      // await sock.sendMessage(noWa, { text: `Terima kasih. Estate yang Anda masukkan adalah: ${estates.join(', ')}` });

      // Reset all states
      delete userTalsasiChoice[noWa];
      delete botTaksasi[noWa];
      if (timeoutHandlestaksasi[noWa]) {
        clearTimeout(timeoutHandlestaksasi[noWa]);
        delete timeoutHandlestaksasi[noWa];
      }
    } else {
      await sock.sendMessage(noWa, {
        text: 'Pilihan tidak valid. Silakan masukkan nomor yang sesuai:',
      });
    }
  }
};

// endfunction

// function bot pengawasan operator AI
async function handleBotDailyPengawasanOperatorAI(sock) {
  try {
    const response = await axios.get(
      'https://srs-ssms.com/op_monitoring/get_data_daily_pengawasan.php'
    );

    const data = response.data;
    const group_id_bot_pengawasan = '120363321959291717@g.us';

    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1); // Subtract one day
    const formattedDate = yesterday.toLocaleDateString('id-ID', options);

    if (response.status === 200 && data[0]) {
      for (const itemdata of data) {
        const location = itemdata.location; // Access the location property
        const machine_id = itemdata.machine_id; // Access the location property
        const uptime = itemdata.uptime; // Access the uptime property
        await axios.post(
          'https://srs-ssms.com/op_monitoring/change_status_bot_daily.php',
          new URLSearchParams({ id: machine_id })
        );

        let message = `*Berikut Rekap Durasi Pengawasan Operator di ${location} ${formattedDate}*:\n`;
        let totalSeconds = 0;

        if (uptime.length > 0) {
          for (const uptimeObj of uptime) {
            const { area, time } = uptimeObj;
            const [hours, minutes, seconds] = time.split(':').map(Number);
            // Ensure each part is two digits
            const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            message += `- ${area}: ${formattedTime}\n`;

            // Only add to the total if the area is not "No Person"
            if (area !== 'Total Unattended') {
              totalSeconds += hours * 3600 + minutes * 60 + seconds;
            }
          }

          // Convert total seconds back to hours, minutes, and seconds
          const totalHours = Math.floor(totalSeconds / 3600);
          const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
          const totalFinalSeconds = totalSeconds % 60;
          const totalFormattedTime = `${String(totalHours).padStart(2, '0')}:${String(totalMinutes).padStart(2, '0')}:${String(totalFinalSeconds).padStart(2, '0')}`;

          message += `*Total Waktu Semua Area ${totalFormattedTime}*\n`;
        } else {
          message += `_Tidak ada record durasi pengawasan pada hari tersebut_\n`;
        }
        message += `\nGenerated by Digital Architect SRS bot`;
        await sock.sendMessage(group_id_bot_pengawasan, { text: message });
      }
    } else {
      console.log('data kosong');
    }
    return response;
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

async function triggerStatusPCPengawasanOperatorAI(sock) {
  try {
    const response = await axios.get(
      'https://srs-ssms.com/op_monitoring/check_last_online.php'
    );
    const now = new Date();
    const data = response.data;

    for (const item of data) {
      // Parse the last_online date
      const lastOnline = new Date(item.last_online);

      // Add 3 hours to the last_online date
      const threeHoursLater = new Date(
        lastOnline.getTime() + 3 * 60 * 60 * 1000
      );

      function formatDateIndonesian(date) {
        const options = {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Asia/Jakarta',
        };
        return date.toLocaleDateString('id-ID', options).replace(/,/g, '');
      }

      // Check if the current time is greater than threeHoursLater
      if (now > threeHoursLater && parseInt(item.reset_pc_mati)>=0) {
        const formattedDate = formatDateIndonesian(lastOnline);

        let message = `*Last Online PC dari Machine id ${item.id} mati sejak ${formattedDate}*:\n`;
        message += `\nGenerated by Digital Architect SRS bot`;

        await sock.sendMessage(item.group_id_wa, { text: message });

        // Send the POST request to update_trigger_bot_mati.php
        try {
          const updateResponse = await axios.post(
            'https://srs-ssms.com/op_monitoring/update_trigger_bot_mati.php',
            new URLSearchParams({ machineId: item.id })
          );
          console.log(updateResponse.data);
        } catch (updateError) {
          console.error(
            `Error updating reset_pc_mati Machine ID ${item.id}:`,
            updateError.message
          );
        }
      }
    }
    return response;
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

async function handleBotLaporanHarianFleetManagement(sock) {
  try {
    const response = await axios.get(
      'https://srs-ssms.com/aplikasi_traksi/botLaporanHarianP2H.php'
    );

    const data = response.data;
    const group_id_bot_fleetmanagement = '120363264196563911@g.us';

    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };

    const today = new Date();
    const formattedDate = today.toLocaleDateString('id-ID', options);

    if (response.status === 200 && data) {
      let message = `*Berikut Pelaporan P2H Fleet Management ${formattedDate}*:\n`;
      message += `Jumlah driver yang melaporkan : ${data['driver_melapor']}\n`;
      message += `Jumlah unit yang rusak : ${data['unit_rusak']}\n`;
      message += `Jumlah unit siap kerja : ${data['unit_tidak_rusak']}\n`;

      message += `\n_Generated by Digital Architect SRS bot_`;

      await sock.sendMessage(group_id_bot_fleetmanagement, { text: message });
    } else {
      console.log('data kosong');
    }
    return response;
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

async function handleBotLaporanHarianFleetManagement(sock) {
  try {
    const response = await axios.get(
      'https://srs-ssms.com/aplikasi_traksi/botLaporanHarianP2H.php'
    );

    const data = response.data;
    const group_id_bot_fleetmanagement = '120363264196563911@g.us';

    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };

    const today = new Date();
    const formattedDate = today.toLocaleDateString('id-ID', options);

    if (response.status === 200 && data) {
      let message = `*Berikut Pelaporan P2H Fleet Management ${formattedDate}*:\n`;
      message += `Jumlah driver yang melaporkan : ${data['driver_melapor']}\n`;
      message += `Jumlah unit yang rusak : ${data['unit_rusak']}\n`;
      message += `Jumlah unit siap kerja : ${data['unit_tidak_rusak']}\n`;

      message += `\n_Generated by Digital Architect SRS bot_`;

      await sock.sendMessage(group_id_bot_fleetmanagement, { text: message });
    } else {
      console.log('data kosong');
    }
    return response;
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

// function bot grading mill

async function get_mill_data(sock) {
  try {
    const response = await axios.get(
      'https://qc-apps.srs-ssms.com/api/getdatamill'
    );
    const data = response.data;
    // const noWa_grading = '120363204285862734@g.us'  grup testing
    const noWa_grading = '120363164751475851@g.us';

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
        await axios.post('https://qc-apps.srs-ssms.com/api/updatedatamill', {
          id: itemdata.id,
        });
        let pemanen_tanpabrondol =
          itemdata.pemanen_list_tanpabrondol?.tanpaBrondol_list || [];
        let pemanen_kurangbrondol =
          itemdata.pemanen_list_kurangbrondol?.kurangBrondol_list || [];

        let message = `*Berikut Hasil Grading Total ${itemdata.estate} ${itemdata.afdeling}*:\n`;
        message += `*Tanggal*: ${itemdata.Tanggal}\n`;
        message += `*Jam*: ${itemdata.waktu_grading}\n`;
        message += `*Ripeness*: ${itemdata.Ripeness} jjg (${itemdata.percentase_ripenes}%)\n`;
        message += `*Unripe*: ${itemdata.Unripe} jjg (${itemdata.persenstase_unripe}%)\n`;
        message += `•0 brondol: ${itemdata.nol_brondol} jjg (${itemdata.persentase_nol_brondol}%)\n`;
        pemanen_tanpabrondol.forEach((item, index) => {
          message += `${index + 1}. No. Pemanen : ${item.no_pemanen} = ${
            item.tanpaBrondol
          } jjg\n`;
        });
        message += `•< brondol: ${itemdata.kurang_brondol} jjg (${itemdata.persentase_brondol}%)\n`;
        pemanen_kurangbrondol.forEach((item, index) => {
          message += `${index + 1}. No. Pemanen : ${item.no_pemanen} = ${
            item.kurangBrondol
          } jjg\n`;
        });
        message += `*Overripe*:  ${itemdata.Overripe} jjg ( ${itemdata.persentase_overripe}%)\n`;
        message += `*Empty bunch*: ${itemdata.empty_bunch} jjg (${itemdata.persentase_empty_bunch}%)\n`;
        message += `*Rotten bunch*: ${itemdata.rotten_bunch} jjg (${itemdata.persentase_rotten_bunce}%)\n`;
        message += `*Abnormal*: ${itemdata.Abnormal} jjg (${itemdata.persentase_abnormal}%)\n`;
        message += `*Dirt*: ${itemdata.Dirt} Kg ( ${itemdata.persentase}%)\n`;
        message += `*Loose Fruit*: ${itemdata.loose_fruit} Kg (${itemdata.persentase_lose_fruit}%)\n\n`;
        message += `Jumlah janjang di Grading: ${itemdata.jjg_grading} jjg\n`;
        message += `Jumlah janjang di SPB:  ${itemdata.jjg_spb} jjg\n`;
        message += `Jumlah Selisih janjang: ${itemdata.jjg_selisih} jjg ( ${itemdata.persentase_selisih}%)\n`;
        // message += `Apps Versi: ${itemdata.appvers}\n`;
        // message += `Android Versi: ${itemdata.os_version}\n`;
        // message += `Merek HP: ${itemdata.phone_version}\n`;
        message += `Generated by Digital Architect SRS bot`;
        // await sock.sendMessage(noWa_grading, { text: message });

        const fileUrl = `https://qc-apps.srs-ssms.com/storage/${itemdata.filename_pdf}`;
        const destinationPath = `./uploads/${itemdata.filename_pdf}`;

        const file = fs.createWriteStream(destinationPath);

        await new Promise((resolve, reject) => {
          https
            .get(fileUrl, function (response) {
              response.pipe(file);
              file.on('finish', function () {
                file.close(() => {
                  console.log('File downloaded successfully.');
                  resolve(); // Resolve the promise after the file is downloaded
                });
              });
            })
            .on('error', function (err) {
              fs.unlink(destinationPath, () => {}); // Delete the file if there is an error
              console.error('Error downloading the file:', err);
              reject(err); // Reject the promise if there is an error
            });
        });
        const messageOptions = {
          document: {
            url: destinationPath,
            caption: 'ini caption',
          },
          fileName: `${itemdata.tanggal_judul}(${itemdata.waktu_grading_judul})-Grading ${itemdata.mill}-${itemdata.estate}${itemdata.afdeling}`,
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

// end function

// function surat izin bot

async function getuserinfo(user) {
  try {
    // Fetch data from the API using the provided name
    const response = await axios.post(
      'https://qc-apps.srs-ssms.com/api/getuserinfo',
      {
        nama: user,
      }
    );
    // const response = await axios.post('https://qc-apps.srs-ssms.com/api/getuserinfo', {
    //     nama: user
    // });

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
async function checkatasan(nama_atasansatu) {
  try {
    const response = await axios.post(
      'https://qc-apps.srs-ssms.com/api/getnamaatasan',
      {
        nama: nama_atasansatu,
      }
    );
    // const response = await axios.post('https://qc-apps.srs-ssms.com/api/getnamaatasan', {
    //     nama: nama_atasansatu
    // });

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

const handleTimeout = (noWa, sock) => {
  if (timeoutHandles[noWa]) {
    clearTimeout(timeoutHandles[noWa]);
  }

  timeoutHandles[noWa] = setTimeout(
    async () => {
      console.log(`Timeout triggered for ${noWa}`);
      await sock.sendMessage(noWa, {
        text: 'Waktu Anda telah habis. Silakan mulai kembali dengan mengetikkan !izin.',
      });
      delete userchoice[noWa];
      delete botpromt[noWa];
      delete timeoutHandles[noWa];
    },
    5 * 60 * 1000
  );

  // console.log(`Timeout set for ${noWa}`);
};

const handleijinmsg = async (noWa, text, sock) => {
  if (!userchoice[noWa]) {
    userchoice[noWa] = 'name';
    botpromt[noWa] = { attempts: 0 };
    await sock.sendMessage(noWa, {
      text: 'Anda dapat membatalkan kapan saja permintaan izin dengan menjawab batal pada pertanyaan.',
    });

    await sock.sendMessage(noWa, {
      text: 'Silakan masukkan *nama lengkap anda* atau *nama depan Anda* untuk pencarian di database.Balas batal untuk membatalkan.',
    });

    handleTimeout(noWa, sock);
  } else {
    handleTimeout(noWa, sock); // Reset timeout with every interaction
    const step = userchoice[noWa];

    if (step === 'name') {
      if (text.toLowerCase() === 'batal') {
        await sock.sendMessage(noWa, {
          text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
        });
        delete userchoice[noWa];
        delete botpromt[noWa];
        clearTimeout(timeoutHandles[noWa]);
        delete timeoutHandles[noWa];
        return;
      }
      botpromt[noWa].name = text;
      userchoice[noWa] = 'check_user';
      await sock.sendMessage(noWa, {
        text: 'Memeriksa nama pengguna di database...',
      });

      const result = await getuserinfo(text);

      // console.log(result);
      if (result.message && result.message === 'Nama User tidak ditemukan') {
        botpromt[noWa].attempts += 1;
        if (botpromt[noWa].attempts >= 3) {
          await sock.sendMessage(noWa, {
            text: 'Anda telah mencoba 3 kali. Silakan coba lagi nanti.',
          });
          delete userchoice[noWa];
          delete botpromt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
        } else {
          await sock.sendMessage(noWa, {
            text: 'Pengguna tidak ditemukan di database. Harap masukkan ulang:',
          });
          userchoice[noWa] = 'name';
        }
      } else if (result !== null && result.length > 0) {
        botpromt[noWa].user_id_option = result;

        let message =
          'Silakan pilih pengguna dari daftar berikut ,*HARAP MASUKAN ANGKA SAJA DARI PILIHAN TERSEDIA*:\n';
        result.forEach((item, index) => {
          message += `${index + 1}. ${item.nama} (${item.departemen})\n`;
        });
        message += `${
          result.length + 1
        }. Pengguna tidak tersedia dalam daftar.\n`;
        message += `${result.length + 2}. Coba masukan nama kembali`;

        userchoice[noWa] = 'choose_name';
        await sock.sendMessage(noWa, { text: message });
      }
    } else if (step === 'choose_name') {
      if (text.toLowerCase() === 'batal') {
        await sock.sendMessage(noWa, {
          text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
        });
        delete userchoice[noWa];
        delete botpromt[noWa];
        clearTimeout(timeoutHandles[noWa]);
        delete timeoutHandles[noWa];
        return;
      }
      const chosenIndex = parseInt(text) - 1;
      const options = botpromt[noWa].user_id_option;

      if (
        isNaN(chosenIndex) ||
        !options ||
        chosenIndex < 0 ||
        chosenIndex >= options.length + 2
      ) {
        await sock.sendMessage(noWa, {
          text: 'Pilihan tidak valid. Silakan masukkan nomor yang sesuai:',
        });
        return;
      }

      if (chosenIndex === options.length) {
        await sock.sendMessage(noWa, {
          text: 'Nama tidak tersedia.Silakan hubungi admin Digital Architect untuk penambahan nama.',
        });
        delete userchoice[noWa];
        delete botpromt[noWa];
        clearTimeout(timeoutHandles[noWa]);
        delete timeoutHandles[noWa];
      } else if (chosenIndex === options.length + 1) {
        userchoice[noWa] = 'name';
        await sock.sendMessage(noWa, {
          text: 'Silakan masukkan *nama lengkap anda* atau *nama depan Anda* untuk pencarian di database.',
        });
      } else {
        try {
          const response = await axios.post(
            'https://qc-apps.srs-ssms.com/api/formdataizin',
            {
              name: options[chosenIndex].id,
              type: 'check_user',
              no_hp: noWa,
            }
          );
          let responses = response.data;

          const responseKey = Object.keys(responses)[0];

          // console.log(responses);
          await sock.sendMessage(noWa, {
            text: 'Mohon tunggu, server sedang melakukan validasi.',
          });
          if (responseKey === 'error_validasi') {
            await sock.sendMessage(noWa, {
              text: `Verifikasi data gagal karena: ${responses[responseKey]}`,
            });
            await sock.sendMessage(noWa, {
              text: `Session Berakhir, Silahkan Izin Ulang dengan perintah !izin`,
            });
            delete userchoice[noWa];
            delete botpromt[noWa];
            clearTimeout(timeoutHandles[noWa]);
            delete timeoutHandles[noWa];
          } else {
            botpromt[noWa].user_nama = options[chosenIndex].nama;
            botpromt[noWa].user_nama_id = options[chosenIndex].id;
            userchoice[noWa] = 'location';
            await sock.sendMessage(noWa, {
              text: 'Mohon tentukan *LOKASI* yang akan Anda kunjungi untuk pengajuan izin.',
            });
          }
        } catch (error) {
          if (error.response && error.response.status === 404) {
            console.log(error);

            await sock.sendMessage(noWa, {
              text: 'Terjadi error tidak terduga',
            });
            delete userchoice[noWa];
            delete botpromt[noWa];
            clearTimeout(timeoutHandles[noWa]);
            delete timeoutHandles[noWa];
          } else {
            await sock.sendMessage(noWa, {
              text: 'Terjadi kesalahan saat mengirim data. Mohon coba lagi.',
            });
            delete userchoice[noWa];
            delete botpromt[noWa];
            clearTimeout(timeoutHandles[noWa]);
            delete timeoutHandles[noWa];
          }
        }
      }
    } else if (step === 'location') {
      if (text.toLowerCase() === 'batal') {
        await sock.sendMessage(noWa, {
          text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
        });
        delete userchoice[noWa];
        delete botpromt[noWa];
        clearTimeout(timeoutHandles[noWa]);
        delete timeoutHandles[noWa];
        return;
      }
      botpromt[noWa].location = text;
      userchoice[noWa] = 'kendaraan';
      await sock.sendMessage(noWa, {
        text: 'Harap masukkan jenis kendaraan *UNTUK KELUAR KEBUN*',
      });
    } else if (step === 'kendaraan') {
      if (text.toLowerCase() === 'batal') {
        await sock.sendMessage(noWa, {
          text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
        });
        delete userchoice[noWa];
        delete botpromt[noWa];
        clearTimeout(timeoutHandles[noWa]);
        delete timeoutHandles[noWa];
        return;
      }
      botpromt[noWa].kendaraan = text;
      userchoice[noWa] = 'plat_nomor';
      await sock.sendMessage(noWa, {
        text: 'Harap masukkan Plat nomor Kendaraan *UNTUK KELUAR KEBUN*, Anda bisa melewatkan pertanyaan ini dengan menjawab *skip*',
      });
    } else if (step === 'plat_nomor') {
      if (text.toLowerCase() === 'batal') {
        await sock.sendMessage(noWa, {
          text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
        });
        delete userchoice[noWa];
        delete botpromt[noWa];
        clearTimeout(timeoutHandles[noWa]);
        delete timeoutHandles[noWa];
        return;
      }

      if (text.toLowerCase() === 'skip') {
        botpromt[noWa].plat_nomor = text.toLowerCase();
      } else {
        botpromt[noWa].plat_nomor = text.toUpperCase();
      }
      userchoice[noWa] = 'date';
      await sock.sendMessage(noWa, {
        text: 'Harap masukkan tanggal *UNTUK KELUAR KEBUN* dengan format (DD-MM-YYYY)(23-02-2024) yang benar:',
      });
    } else if (step === 'date') {
      if (text.toLowerCase() === 'batal') {
        await sock.sendMessage(noWa, {
          text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
        });
        delete userchoice[noWa];
        delete botpromt[noWa];
        clearTimeout(timeoutHandles[noWa]);
        delete timeoutHandles[noWa];
        return;
      }
      const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
      if (!dateRegex.test(text)) {
        await sock.sendMessage(noWa, {
          text: 'Tanggal Tidak sesuai harap masukkan kembali (Format:Hari-Bulan-Tahun):',
        });
        return;
      }

      const [day, month, year] = text.split('-').map(Number);

      if (month < 1 || month > 12 || day < 1 || day > 31) {
        await sock.sendMessage(noWa, {
          text: 'Tanggal atau bulan tidak valid. Harap masukkan kembali (Format:Hari-Bulan-Tahun):',
        });
        return;
      }

      const inputDate = new Date(year, month - 1, day);
      if (
        inputDate.getDate() !== day ||
        inputDate.getMonth() !== month - 1 ||
        inputDate.getFullYear() !== year
      ) {
        await sock.sendMessage(noWa, {
          text: 'Tanggal tidak valid. Harap masukkan kembali (Format:Hari-Bulan-Tahun):',
        });
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (inputDate < today) {
        await sock.sendMessage(noWa, {
          text: 'Tanggal Tidak boleh di masa lalu. Harap masukkan tanggal yang valid (Format:Hari-Bulan-Tahun):',
        });
        return;
      }

      botpromt[noWa].date = text;
      userchoice[noWa] = 'jam_keluar';
      await sock.sendMessage(noWa, {
        text: 'Mohon masukan waktu *jam keluar* dari kebun dengan format (HH:MM)(10:00):',
      });
    } else if (step === 'jam_keluar') {
      if (text.toLowerCase() === 'batal') {
        await sock.sendMessage(noWa, {
          text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
        });
        delete userchoice[noWa];
        delete botpromt[noWa];
        clearTimeout(timeoutHandles[noWa]);
        delete timeoutHandles[noWa];
        return;
      }
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(text)) {
        await sock.sendMessage(noWa, {
          text: 'Waktu tidak valid. Harap masukkan waktu dalam format 24 jam (HH:MM), contoh: 11:00 atau 23:30',
        });
        return;
      }
      botpromt[noWa].jam_keluar = text;
      userchoice[noWa] = 'date_2';
      await sock.sendMessage(noWa, {
        text: 'Harap masukkan tanggal *UNTUK KEMBALI* dengan format (DD-MM-YYYY)(23-02-2024) yang benar:',
      });
    } else if (step === 'date_2') {
      if (text.toLowerCase() === 'batal') {
        await sock.sendMessage(noWa, {
          text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
        });
        delete userchoice[noWa];
        delete botpromt[noWa];
        clearTimeout(timeoutHandles[noWa]);
        delete timeoutHandles[noWa];
        return;
      }
      const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
      if (!dateRegex.test(text)) {
        await sock.sendMessage(noWa, {
          text: 'Tanggal Tidak sesuai harap masukkan kembali (Format:Hari-Bulan-Tahun):',
        });
        return;
      }

      const [day, month, year] = text.split('-').map(Number);

      if (month < 1 || month > 12 || day < 1 || day > 31) {
        await sock.sendMessage(noWa, {
          text: 'Tanggal atau bulan tidak valid. Harap masukkan kembali (Format:Hari-Bulan-Tahun):',
        });
        return;
      }

      const inputDate = new Date(year, month - 1, day);
      if (
        inputDate.getDate() !== day ||
        inputDate.getMonth() !== month - 1 ||
        inputDate.getFullYear() !== year
      ) {
        await sock.sendMessage(noWa, {
          text: 'Tanggal tidak valid. Harap masukkan kembali (Format:Hari-Bulan-Tahun):',
        });
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (inputDate < today) {
        await sock.sendMessage(noWa, {
          text: 'Tanggal Tidak boleh di masa lalu. Harap masukkan tanggal yang valid (Format:Hari-Bulan-Tahun):',
        });
        return;
      }

      botpromt[noWa].date_2 = text;
      userchoice[noWa] = 'jam_kembali';
      await sock.sendMessage(noWa, {
        text: 'Mohon masukan waktu *jam kembali* ke kebun dengan format (HH:MM)(10:00):',
      });
    } else if (step === 'jam_kembali') {
      if (text.toLowerCase() === 'batal') {
        await sock.sendMessage(noWa, {
          text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
        });
        delete userchoice[noWa];
        delete botpromt[noWa];
        clearTimeout(timeoutHandles[noWa]);
        delete timeoutHandles[noWa];
        return;
      }
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(text)) {
        await sock.sendMessage(noWa, {
          text: 'Waktu tidak valid. Harap masukkan waktu dalam format 24 jam (HH:MM), contoh: 11:00 atau 23:30',
        });
        return;
      }
      botpromt[noWa].jam_kembali = text;
      userchoice[noWa] = 'needs';
      await sock.sendMessage(noWa, {
        text: 'Mohon jelaskan keperluan Anda untuk keluar dari kebun:',
      });
    } else if (step === 'needs') {
      if (text.toLowerCase() === 'batal') {
        await sock.sendMessage(noWa, {
          text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
        });
        delete userchoice[noWa];
        delete botpromt[noWa];
        clearTimeout(timeoutHandles[noWa]);
        delete timeoutHandles[noWa];
        return;
      }
      botpromt[noWa].needs = text;
      userchoice[noWa] = 'atasan_satu';
      await sock.sendMessage(noWa, {
        text: 'Silakan masukkan nama lengkap *ATASAN PERTAMA* atau nama depan untuk pencarian didatabase',
      });
    } else if (step === 'atasan_satu') {
      if (text.toLowerCase() === 'batal') {
        await sock.sendMessage(noWa, {
          text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
        });
        delete userchoice[noWa];
        delete botpromt[noWa];
        clearTimeout(timeoutHandles[noWa]);
        delete timeoutHandles[noWa];
        return;
      }
      botpromt[noWa].atasan_satu = text;
      const nama_atasansatu = text;
      const result = await checkatasan(nama_atasansatu);

      if (result.message && result.message === 'Nama Atasan tidak ditemukan') {
        botpromt[noWa].attempts = (botpromt[noWa].attempts || 0) + 1;
        if (botpromt[noWa].attempts >= 3) {
          await sock.sendMessage(noWa, {
            text: 'Anda sudah melakukan percobaan 3 kali. Silahkan coba kembali nanti.',
          });
          delete userchoice[noWa];
          delete botpromt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
        } else {
          await sock.sendMessage(noWa, {
            text: 'Nama Atasan Tidak ditemukan di database. Harap input ulang:',
          });
        }
      } else if (result && result.length > 0) {
        botpromt[noWa].atasan_options_satu = result;

        let message =
          'Pilih Nama Atasan Pertama.*HARAP MASUKAN ANGKA SAJA DARI PILIHAN TERSEDIA*:\n';
        result.forEach((item, index) => {
          message += `${index + 1}. ${item.nama} (${item.departemen})\n`;
        });
        message += `${
          result.length + 1
        }. Nama tidak tersedia di dalam pilihan\n`;
        message += `${result.length + 2}. Coba masukan nama kembali`;

        userchoice[noWa] = 'choose_atasan_satu';
        await sock.sendMessage(noWa, { text: message });
      } else {
        await sock.sendMessage(noWa, {
          text: 'Nama Atasan Tidak ditemukan di database. Harap input ulang:',
        });
      }
    } else if (step === 'choose_atasan_satu') {
      if (text.toLowerCase() === 'batal') {
        await sock.sendMessage(noWa, {
          text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
        });
        delete userchoice[noWa];
        delete botpromt[noWa];
        clearTimeout(timeoutHandles[noWa]);
        delete timeoutHandles[noWa];
        return;
      }
      const chosenIndex = parseInt(text) - 1;
      const options = botpromt[noWa].atasan_options_satu;

      if (
        isNaN(chosenIndex) ||
        !options ||
        chosenIndex < 0 ||
        chosenIndex >= options.length + 2
      ) {
        botpromt[noWa].attempts = (botpromt[noWa].attempts || 0) + 1;
        if (botpromt[noWa].attempts >= 3) {
          await sock.sendMessage(noWa, {
            text: 'Anda sudah melakukan percobaan 3 kali. Silahkan coba kembali nanti.',
          });
          delete userchoice[noWa];
          delete botpromt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
          return;
        } else {
          await sock.sendMessage(noWa, {
            text: 'Pilihan tidak valid. Silakan masukkan nomor yang sesuai:',
          });
          return;
        }
      }

      if (chosenIndex === options.length) {
        await sock.sendMessage(noWa, {
          text: 'Nama Atasan tidak tersedia. Silakan hubungi admin Digital Architect untuk penambahan nama atasan.',
        });
        delete userchoice[noWa];
        delete botpromt[noWa];
        clearTimeout(timeoutHandles[noWa]);
        delete timeoutHandles[noWa];
      } else if (chosenIndex === options.length + 1) {
        userchoice[noWa] = 'atasan_satu';
        await sock.sendMessage(noWa, {
          text: 'Silakan masukkan nama lengkap atasan *PERTAMA* atau nama depan untuk pencarian didatabase',
        });
      } else {
        botpromt[noWa].atasan_satu = options[chosenIndex].nama;
        botpromt[noWa].atasan_satu_id = options[chosenIndex].id;
        delete botpromt[noWa].atasan_options_satu;

        userchoice[noWa] = 'atasan_dua';
        // botpromt[noWa] = { attempts: 0 };
        await sock.sendMessage(noWa, {
          text: 'Silakan masukkan nama lengkap *ATASAN KEDUA* atau nama depan untuk pencarian didatabase',
        });
      }
    } else if (step === 'atasan_dua') {
      if (text.toLowerCase() === 'batal') {
        await sock.sendMessage(noWa, {
          text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
        });
        delete userchoice[noWa];
        delete botpromt[noWa];
        clearTimeout(timeoutHandles[noWa]);
        delete timeoutHandles[noWa];
        return;
      }
      botpromt[noWa].atasan_dua = text;
      const nama_atasandua = text;
      const result = await checkatasan(nama_atasandua);
      if (result.message && result.message === 'Nama Atasan tidak ditemukan') {
        botpromt[noWa].attempts += 1;
        if (botpromt[noWa].attempts >= 3) {
          await sock.sendMessage(noWa, {
            text: 'Anda sudah melakukan percobaan *3 kali*. Silahkan coba kembali nanti.',
          });
          delete userchoice[noWa];
          delete botpromt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
        } else {
          await sock.sendMessage(noWa, {
            text: 'Nama Atasan Tidak ditemukan di database. Harap input ulang:',
          });
        }
      } else if (result !== null && result.length > 0) {
        botpromt[noWa].atasan_options_dua = result;

        let message =
          'Pilih Nama Atasan kedua , *HARAP MASUKAN ANGKA SAJA DARI PILIHAN TERSEDIA*:\n';
        result.forEach((item, index) => {
          message += `${index + 1}. ${item.nama} (${item.departemen})\n`;
        });
        message += `${
          result.length + 1
        }. Nama tidak tersedia di dalam pilihan\n`;
        message += `${result.length + 2}. Coba masukan nama kembali`;

        userchoice[noWa] = 'choose_atasan_dua';
        await sock.sendMessage(noWa, { text: message });
      } else {
        await sock.sendMessage(noWa, {
          text: 'Nama Atasan Tidak ditemukan di database. Harap input ulang:',
        });
      }
    } else if (step === 'choose_atasan_dua') {
      const chosenIndex = parseInt(text) - 1;
      const options = botpromt[noWa].atasan_options_dua;

      if (
        isNaN(chosenIndex) ||
        !options ||
        chosenIndex < 0 ||
        chosenIndex >= options.length + 2
      ) {
        botpromt[noWa].attempts = (botpromt[noWa].attempts || 0) + 1;
        if (botpromt[noWa].attempts >= 3) {
          await sock.sendMessage(noWa, {
            text: 'Anda sudah melakukan percobaan 3 kali. Silahkan coba kembali nanti.',
          });
          delete userchoice[noWa];
          delete botpromt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
          return;
        } else {
          await sock.sendMessage(noWa, {
            text: 'Pilihan tidak valid. Silakan masukkan nomor atasan 2 yang sesuai:',
          });
          return;
        }
      }
      if (chosenIndex === options.length) {
        await sock.sendMessage(noWa, {
          text: 'Nama Atasan tidak tersedia.Silakan hubungi admin Digital Architect untuk penambahan nama.',
        });
        delete userchoice[noWa];
        delete botpromt[noWa];
        clearTimeout(timeoutHandles[noWa]);
        delete timeoutHandles[noWa];
      } else if (chosenIndex === options.length + 1) {
        userchoice[noWa] = 'atasan_dua';
        await sock.sendMessage(noWa, {
          text: 'Silakan masukkan nama lengkap atasan *KEDUA* atau nama depan untuk pencarian didatabase',
        });
      } else if (!isNaN(chosenIndex) && options && options[chosenIndex]) {
        botpromt[noWa].atasan_dua = options[chosenIndex].nama;
        botpromt[noWa].atasan_dua_id = options[chosenIndex].id;
        delete botpromt[noWa].atasan_options_dua;

        userchoice[noWa] = 'confirm';
        await sock.sendMessage(noWa, {
          text: `*HARAP CROSSCHECK DATA ANDA TERLEBIH DAHULU*:
                        \nNama: ${botpromt[noWa].user_nama}
                        \nTujuan: ${botpromt[noWa].location}
                        \nKendaraan: ${botpromt[noWa].kendaraan}
                        \nPlat Nomor: ${botpromt[noWa].plat_nomor}
                        \nTanggal Izin Keluar: ${botpromt[noWa].date}
                        \nTanggal Kembali: ${botpromt[noWa].date_2}
                        \nJam Keluar: ${botpromt[noWa].jam_keluar}
                        \nJam Kembali: ${botpromt[noWa].jam_kembali}
                        \nKeperluan: ${botpromt[noWa].needs}
                        \nAtasan Satu: ${botpromt[noWa].atasan_satu}
                        \nAtasan Dua: ${botpromt[noWa].atasan_dua}
                        \nApakah semua data sudah sesuai? (ya/tidak)`,
        });
      } else {
        await sock.sendMessage(noWa, {
          text: 'Pilihan tidak valid. Silakan masukkan pilihan yang sesuai:',
        });
        return;
      }
    } else if (step === 'confirm') {
      if (text.toLowerCase() === 'ya') {
        userchoice[noWa] = 'disclamer_user';
        await sock.sendMessage(noWa, {
          text: `*Disclamer Harap di baca dengan seksama apakah anda setuju atau tidak*:
                    \n- Izin kebun diberikan dengan tujuan yang telah ditentukan dan harus digunakan sesuai dengan ketentuan yang berlaku.
                    \n- Pemberi izin tidak bertanggung jawab atas cedera, kerugian, atau kerusakan yang timbul dari kecelakaan, baik yang diakibatkan oleh kelalaian sendiri maupun orang lain.
                    \n- Izin kebun dapat dibatalkan sewaktu-waktu oleh pemberi izin jika ditemukan pelanggaran terhadap ketentuan yang berlaku.\n\nApakah Anda setuju dengan disclaimer ini? (ya/tidak)`,
        });
      } else if (text.toLowerCase() === 'tidak') {
        await sock.sendMessage(noWa, {
          text: 'Silakan coba lagi untuk input dengan mengetikkan !izin.',
        });
      } else {
        await sock.sendMessage(noWa, {
          text: 'Pilihan tidak valid. Silakan jawab dengan "ya" atau "tidak":',
        });
        return;
      }
    } else if (step === 'disclamer_user') {
      if (text.toLowerCase() === 'ya') {
        try {
          const response = await axios.post(
            'https://management.srs-ssms.com/api/formdataizin',
            {
              name: botpromt[noWa].user_nama_id,
              tujuan: botpromt[noWa].location,
              pergi: botpromt[noWa].date,
              kembali: botpromt[noWa].date_2,
              keperluan: botpromt[noWa].needs,
              atasan_satu: botpromt[noWa].atasan_satu_id,
              atasan_dua: botpromt[noWa].atasan_dua_id,
              kendaraan: botpromt[noWa].kendaraan,
              plat_nomor: botpromt[noWa].plat_nomor,
              jam_keluar: botpromt[noWa].jam_keluar,
              jam_kembali: botpromt[noWa].jam_kembali,
              no_hp: noWa,
              email: 'j',
              password: 'j',
            }
          );

          let responses = response.data;

          const responseKey = Object.keys(responses)[0];

          // console.log(responses);
          await sock.sendMessage(noWa, {
            text: 'Mohon Tunggu server melakukan validasi.....',
          });
          if (responseKey === 'error_validasi') {
            await sock.sendMessage(noWa, {
              text: `Data gagal diverifikasi, Karena: ${responses[responseKey]}`,
            });
          } else {
            await sock.sendMessage(noWa, {
              text: 'Permohonan izin berhasil dikirim dan sedang menunggu persetujuan dari atasan. Harap tunggu notifikasi selanjutnya atau cek perkembangan di website: https://izin-kebun.srs-ssms.com/.',
            });
          }
        } catch (error) {
          if (error.response && error.response.status === 404) {
            await sock.sendMessage(noWa, {
              text: 'Nama Atasan tidak ditemukan di database. Harap input ulang.',
            });
          } else {
            console.error('Error fetching data:', error);
            await sock.sendMessage(noWa, {
              text: 'Terjadi kesalahan saat mengirim data. Silakan coba lagi.',
            });
          }
        }

        // await sock.sendMessage(noWa, { text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.' });
        delete userchoice[noWa];
        delete botpromt[noWa];
        clearTimeout(timeoutHandles[noWa]);
        delete timeoutHandles[noWa];
      } else if (text.toLowerCase() === 'tidak') {
        await sock.sendMessage(noWa, {
          text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
        });
        delete userchoice[noWa];
        delete botpromt[noWa];
        clearTimeout(timeoutHandles[noWa]);
        delete timeoutHandles[noWa];
      } else {
        await sock.sendMessage(noWa, {
          text: 'Pilihan tidak valid. Silakan jawab dengan "ya" atau "tidak":',
        });
        return;
      }
    } else {
      await sock.sendMessage(noWa, {
        text: 'Silahkan coba kembali dengan mengetikan perintah !izin:',
      });
      delete userchoice[noWa];
      delete botpromt[noWa];
      clearTimeout(timeoutHandles[noWa]);
      delete timeoutHandles[noWa];
    }
  }
};
async function getNotifications(sock) {
  try {
    // const response = await axios.get('http://qc-apps2.test/api/getnotifijin');
    const response = await axios.get(
      'https://qc-apps.srs-ssms.com/api/getnotifijin'
    );
    const data = response.data;
    // console.log(data);
    if (data.status === '200' && data.data && data.data.length > 0) {
      const result = data.data;
      // console.log("Data ada");
      // console.log(data);
      for (const itemdata of result) {
        if (itemdata.no_hp) {
          const exists = await sock.onWhatsApp(itemdata.no_hp);
          if (exists?.jid || (exists && exists[0]?.jid)) {
            if (itemdata.status === 'approved') {
              let message = `*Izin baru perlu di approved*:\n`;
              message += `Hallo Selamat Siang Bapak/Ibu ${itemdata.atasan_nama}\n`;
              message += `Anda memiliki request baru untuk izin keluar kebun dengan detail sebagai berikut:\n`;
              message += `*ID Pemohon* : ${itemdata.id}\n`;
              message += `*Nama* : ${itemdata.user_request}\n`;
              message += `*Keperluan izin keluar kebun* : ${itemdata.keperluan}\n`;
              message += `*Lokasi yang dituju* : ${itemdata.lokasi_tujuan}\n`;
              message += `*Tanggal keluar izin* : ${itemdata.tanggal_keluar} ${itemdata.jam_keluar}\n`;
              message += `*Tanggal kembali izin* : ${itemdata.tanggal_kembali} ${itemdata.jam_kembali}\n`;
              message += `Silahkan Reply Pesan ini kemudian balas ya/tidak\n`;
              message += `Generated by Digital Architect SRS Bot`;
              await sock.sendMessage(itemdata.no_hp + '@s.whatsapp.net', {
                text: message,
              });
              // Check if the user's phone number is set and send a message to the user
              if (itemdata.no_hp_user) {
                let userMessage = `*Izin Keluar Kebun Anda Telah Di setujui Atasan Pertama*\n\n`;
                userMessage += `Hallo Selamat Siang Bapak/Ibu ${itemdata.user_request},\n\n`;
                userMessage += `Kami ingin menginformasikan bahwa permintaan izin keluar kebun Anda telah Disetuji :\n\n`;
                userMessage += `Silahkan tunggu notifikasi  berikutnya untuk persetujuan dari atasan kedua.\n\n`;
                userMessage += `Terima kasih,\n`;
                userMessage += `Tim Digital Architect SRS Bot`;

                await sock.sendMessage(
                  itemdata.no_hp_user + '@s.whatsapp.net',
                  { text: userMessage }
                );
              }
            } else if (itemdata.status === 'send_approved') {
              let message = `*Izin Keluar Kebun Anda Telah Disetujui Atasan Kedua*\n\n`;
              message += `Hallo Selamat Siang Bapak/Ibu ${itemdata.nama_user},\n\n`;
              message += `Kami ingin menginformasikan bahwa permintaan izin keluar kebun Anda telah disetujui.\n\n`;
              message += `Berikut adalah detail izin Anda:\n`;
              message += `*Nama Pemohon*: ${itemdata.nama_user}\n`;
              message += `*Tanggal keluar izin* : ${itemdata.tanggal_keluar} ${itemdata.jam_keluar}\n`;
              message += `*Tanggal kembali izin* : ${itemdata.tanggal_kembali} ${itemdata.jam_kembali}\n`;
              message += `*Keperluan*: ${itemdata.keperluan}\n`;
              message += `*Lokasi Tujuan*: ${itemdata.lokasi_tujuan}\n\n`;
              message += `Harap selalu berhati-hati selama perjalanan dan pastikan untuk mengikuti protokol keamanan yang berlaku. Kami mendoakan agar Anda tiba dengan selamat di tujuan dan kembali ke kebun dengan kondisi sehat dan aman.\n\n`;
              message += `Jika ada pertanyaan lebih lanjut, jangan ragu untuk menghubungi kami.\n\n`;
              message += `Atau kunjungi web kami di :https://izin-kebun.srs-ssms.com \n\n`;
              message += `Terima kasih,\n`;
              message += `Tim Digital Architect SRS Bot`;

              // kirim pdf
              try {
                // const genpdf = await axios.get('http://qc-apps2.test/api/generatePdfIzinKebun', {
                const genpdf = await axios.get(
                  'https://izin-kebun.srs-ssms.com/api/generatePdfIzinKebun',
                  {
                    params: {
                      user: 'j',
                      pw: 'j',
                      id: itemdata.id,
                    },
                  }
                );
                // console.log(genpdf.data.filename);

                const fileUrl = `https://izin-kebun.srs-ssms.com/public/storage/files/${genpdf.data.filename}`;
                const destinationPath = `./uploads/${itemdata.filename_pdf}`;

                const file = fs.createWriteStream(destinationPath);

                await new Promise((resolve, reject) => {
                  https
                    .get(fileUrl, function (response) {
                      response.pipe(file);
                      file.on('finish', function () {
                        file.close(() => {
                          console.log('File downloaded successfully.');
                          resolve(); // Resolve the promise after the file is downloaded
                        });
                      });
                    })
                    .on('error', function (err) {
                      fs.unlink(destinationPath, () => {}); // Delete the file if there is an error
                      console.error('Error downloading the file:', err);
                      reject(err); // Reject the promise if there is an error
                    });
                });
                const messageOptions = {
                  document: {
                    url: destinationPath,
                    caption: 'ini caption',
                  },
                  fileName: 'Surat Izin Kebun',
                };
                await sock.sendMessage(
                  itemdata.no_hp + '@s.whatsapp.net',
                  messageOptions
                );

                try {
                  const unlinkpdf = await axios.get(
                    'https://izin-kebun.srs-ssms.com/api/deletePdfIzinKebun',
                    {
                      params: {
                        user: 'j',
                        pw: 'j',
                        filename: genpdf.data.filename,
                      },
                    }
                  );
                } catch (error) {
                  console.log('Error unlinkpdf PDF:', error);
                }
              } catch (error) {
                console.log('Error generating PDF:', error);
              }

              await sock.sendMessage(itemdata.no_hp + '@s.whatsapp.net', {
                text: message,
              });

              try {
                // const response = await axios.post('http://qc-apps2.test/api/updatenotifijin', {
                const response = await axios.post(
                  'https://qc-apps.srs-ssms.com/api/updatenotifijin',
                  {
                    id_data: itemdata.id,
                    id_atasan: itemdata.id_atasan,
                    answer: 'ya',
                  }
                );
              } catch (error) {
                console.log('Error approving:', error);
              }
            } else if (itemdata.status === 'rejected') {
              let message = `*Izin Keluar Kebun Anda Telah Ditolak*\n\n`;
              message += `Hallo Selamat Siang Bapak/Ibu ${itemdata.user_request},\n\n`;
              message += `Kami ingin menginformasikan bahwa permintaan izin keluar kebun Anda telah ditolak dikarenakan :\n\n`;
              message += `*Alasan ditolak*: ${itemdata.alasan}\n`;
              message += `Jika ada pertanyaan lebih lanjut, jangan ragu untuk menghubungi kami.\n\n`;
              message += `Terima kasih,\n`;
              message += `Tim Digital Architect SRS Bot`;
              await sock.sendMessage(itemdata.no_hp + '@s.whatsapp.net', {
                text: message,
              });

              try {
                // const response = await axios.post('http://qc-apps2.test/api/updatenotifijin', {
                const response = await axios.post(
                  'https://qc-apps.srs-ssms.com/api/updatenotifijin',
                  {
                    id_data: itemdata.id,
                    id_atasan: '3',
                    answer: 'tidak',
                  }
                );
                console.log(response);
              } catch (error) {
                console.log('Error approving:', error);
              }
            }
          } else {
            let message = `Aplikasi Surat izin kebun Nomor HP tidak bisa di chat : ${itemdata.id}\n`;
            message += `Haraf di update nomor hp ${itemdata.no_hp}\n`;
            await sock.sendMessage('120363205553012899' + '@g.us', {
              text: message,
            });
          }
        } else {
          let message = `Aplikasi Surat izin kebun Nomor HP kosong untuk : ${itemdata.id}\n`;
          message += `Haraf di update nama atasan ${itemdata.atasan_nama}\n`;
          await sock.sendMessage('120363205553012899' + '@g.us', {
            text: message,
          });
        }
      }
    } else {
      console.log('Data kosong');
      console.log(data);
    }
    return response;
  } catch (error) {
    console.error('Error:', error);
  }
}
// end function

// function crud input iot

const handleIotInput = async (noWa, text, sock) => {
  if (!userIotChoice[noWa]) {
    userIotChoice[noWa] = 'estate';
    botIotPrompt[noWa] = { attempts: 0 };
    await sock.sendMessage(noWa, { text: 'Masukkan estate' });
    handleTimeout(noWa, sock);
  } else {
    handleTimeout(noWa, sock);
    const step = userIotChoice[noWa];

    if (step === 'estate') {
      botIotPrompt[noWa].estate = text;
      try {
        const response = await axios.post(
          'https://qc-apps.srs-ssms.com/api/inputiotdata',
          {
            estate: botIotPrompt[noWa].estate,
            type: 'check_estate',
          }
        );
        let responses = response.data.data;

        // console.log(responses);
        await sock.sendMessage(noWa, {
          text: 'Mohon tunggu, server sedang melakukan validasi.',
        });

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
          console.log(error);

          await sock.sendMessage(noWa, { text: 'Terjadi error tidak terduga' });
          delete userIotChoice[noWa];
          delete botIotPrompt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
        } else {
          await sock.sendMessage(noWa, {
            text: 'Terjadi kesalahan saat mengirim data. Mohon coba lagi.',
          });
          delete userIotChoice[noWa];
          delete botIotPrompt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
        }
      }
    } else if (step === 'afdeling') {
      const chosenIndex = parseInt(text) - 1;
      const options = botIotPrompt[noWa].afdelingOptions;

      if (
        isNaN(chosenIndex) ||
        !options ||
        chosenIndex < 0 ||
        chosenIndex >= options.length + 2
      ) {
        await sock.sendMessage(noWa, {
          text: 'Pilihan tidak valid. Silakan masukkan nomor yang sesuai:',
        });
        return;
      } else {
        botIotPrompt[noWa].afdeling =
          chosenIndex < options.length ? options[chosenIndex].nama : null;
        botIotPrompt[noWa].afdeling_id =
          chosenIndex < options.length
            ? options[chosenIndex].afdeling_id
            : null;
        botIotPrompt[noWa].estate_id =
          chosenIndex < options.length ? options[chosenIndex].est_id : null;
        botIotPrompt[noWa].estate_nama =
          chosenIndex < options.length ? options[chosenIndex].est : null;
        userIotChoice[noWa] = 'curah_hujan';
        await sock.sendMessage(noWa, {
          text: 'Masukkan curah hujan (harap angka saja)',
        });
      }
    } else if (step === 'curah_hujan') {
      const curahHujan = parseFloat(text);
      if (isNaN(curahHujan)) {
        await sock.sendMessage(noWa, {
          text: 'Curah hujan tidak valid. Masukkan angka saja.',
        });
        return;
      }
      botIotPrompt[noWa].curahHujan = curahHujan;
      userIotChoice[noWa] = 'confirm';
      await sock.sendMessage(noWa, {
        text: `*HARAP CROSSCHECK DATA ANDA TERLEBIH DAHULU*:
                \nAfdeling ID: ${botIotPrompt[noWa].afdeling_id}
                \nEstate: ${botIotPrompt[noWa].estate_nama}
                \nCurah Hujan: ${botIotPrompt[noWa].curahHujan}
                \nApakah semua data sudah sesuai? (ya/tidak)`,
      });
    } else if (step === 'confirm') {
      if (text.toLowerCase() === 'ya') {
        try {
          const response = await axios.post(
            'https://qc-apps.srs-ssms.com/api/inputiotdata',
            {
              afdeling_id: botIotPrompt[noWa].afdeling_id,
              estate_id: botIotPrompt[noWa].estate_id,
              curahHujan: botIotPrompt[noWa].curahHujan,
              estate: botIotPrompt[noWa].estate_nama,
              afdeling: botIotPrompt[noWa].afdeling,
              type: 'input',
            }
          );

          const responses = response.data;
          const responseKey = Object.keys(responses)[0];

          await sock.sendMessage(noWa, {
            text: 'Mohon tunggu, server sedang melakukan validasi...',
          });
          if (responseKey === 'error_validasi') {
            await sock.sendMessage(noWa, {
              text: `Data gagal diverifikasi, karena: ${responses[responseKey]}`,
            });
          } else {
            await sock.sendMessage(noWa, {
              text: 'Data berhasil dimasukan ke dalam database',
            });
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
            await sock.sendMessage(noWa, {
              text: 'Terjadi kesalahan saat mengirim data. Silakan coba lagi.',
            });
          }
        }
      } else if (text.toLowerCase() === 'tidak') {
        await sock.sendMessage(noWa, {
          text: 'Silakan coba lagi untuk input dengan mengetikkan !iot.',
        });
      } else {
        await sock.sendMessage(noWa, {
          text: 'Pilihan tidak valid. Silakan jawab dengan "ya" atau "tidak":',
        });
        return;
      }

      delete userIotChoice[noWa];
      delete botIotPrompt[noWa];
      clearTimeout(timeoutHandles[noWa]);
      delete timeoutHandles[noWa];
    } else {
      await sock.sendMessage(noWa, {
        text: 'Pilihan tidak valid. Silakan masukkan nomor yang sesuai:',
      });
    }
  }
};

// end function

//function chatting snooze bot pengawasan operator ai
const handleChatSnoozePengawasanOperatorAi = async (
  noWa,
  text,
  sock,
  waUser
) => {
  if (!userchoiceSnoozeBotPengawasanOperator[noWa]) {
    handleTimeout(noWa, sock);
    if (text.startsWith('!snooze ')) {
      userchoiceSnoozeBotPengawasanOperator[noWa] = 'machine';
      const response = await axios.get(
        'https://srs-ssms.com/op_monitoring/get_list_machine.php'
      );

      const data = response.data;
      const activeDevices = data.filter((device) => device.status === '1');

      const deviceList = activeDevices
        .map((device, index) => `${index + 1}. ${device.name}`)
        .join('\n');
      configSnoozeBotPengawasanOperator[noWa] = {
        ...configSnoozeBotPengawasanOperator[noWa], // Spread the existing properties
        devices: activeDevices, // Add the devices property
      };

      await sock.sendMessage(noWa, {
        text: `Pilih Machine CCTV yang akan di snooze (ketik nomor):\n${deviceList}`,
      });
      handleTimeout(noWa, sock);
    } else {
      await sock.sendMessage(noWa, {
        text: text,
      });
    }
  } else {
    handleTimeout(noWa, sock);
    const step = userchoiceSnoozeBotPengawasanOperator[noWa];
    if (step === 'machine') {
      const selectedDeviceIndex = parseInt(text, 10) - 1;
      const devices = configSnoozeBotPengawasanOperator[noWa].devices;

      if (
        isNaN(selectedDeviceIndex) ||
        selectedDeviceIndex < 0 ||
        selectedDeviceIndex >= devices.length
      ) {
        await sock.sendMessage(noWa, {
          text: 'Pilihan tidak valid. Mohon ketik nomor yang sesuai dengan daftar mesin.',
        });
        return;
      }

      const selectedDevice = devices[selectedDeviceIndex];

      configSnoozeBotPengawasanOperator[noWa].machine_id = text;
      let machineId = text;
      configSnoozeBotPengawasanOperator[noWa].no_hp = waUser;

      try {
        await sock.sendMessage(noWa, {
          text: 'Mohon tunggu sedang melakukan update konfigurasi Operator Pengawasai AI',
        });
        console.log(configSnoozeBotPengawasanOperator[noWa]);
        const response = await axios.post(
          'https://srs-ssms.com/op_monitoring/update_snooze_machine_bot.php',
          new URLSearchParams({
            description: configSnoozeBotPengawasanOperator[noWa].datetime,
            hour: configSnoozeBotPengawasanOperator[noWa].hour,
            machine_id: selectedDevice.id,
            no_hp: configSnoozeBotPengawasanOperator[noWa].no_hp,
          })
        );

        let responses = response.data;

        if (responses.status === 1) {
          const response = await axios.get(
            'https://srs-ssms.com/op_monitoring/get_list_machine.php',
            {
              params: {
                machine_id: machineId,
              },
            }
          );

          const data = response.data;
          await sock.sendMessage(noWa, {
            text: `Konfigurasi berhasil disimpan untuk ${data[0].name}\n`,
          });
          delete configSnoozeBotPengawasanOperator[noWa];
          delete userchoiceSnoozeBotPengawasanOperator[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
        } else if (responses.status === 0) {
          await sock.sendMessage(noWa, {
            text: 'Terjadi kesalahan saat update konfigurasi. Mohon coba lagi!',
          });
          delete configSnoozeBotPengawasanOperator[noWa];
          delete userchoiceSnoozeBotPengawasanOperator[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
        }
      } catch (error) {
        if (error.response && error.response.status === 404) {
          await sock.sendMessage(noWa, { text: 'Terjadi error tidak terduga' });
          delete configSnoozeBotPengawasanOperator[noWa];
          delete userchoiceSnoozeBotPengawasanOperator[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
        } else {
          await sock.sendMessage(noWa, {
            text: 'Terjadi kesalahan saat mengirim data. Mohon coba lagi.',
          });
          delete configSnoozeBotPengawasanOperator[noWa];
          delete userchoiceSnoozeBotPengawasanOperator[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
        }
      }
    }
  }
};

// functiopn update status online bot
const updatePCStatus = async () => {
  try {
    const response = await axios.post(
      'https://qc-apps.srs-ssms.com/api/updatestatusbot',
      {
        pc_id: 'pc_ho',
        status: 'online',
      }
    );
    console.log('Status updated:', response.data);
  } catch (error) {
    console.error('Error updating status:', error);
  }
};

// end function

async function restartbot(namabot) {
  exec(`pm2 restart ${namabot}`, (error, stdout, stderr) => {
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

// bot management gudang
async function botmanagementgudang(sock, msg) {
  try {
    const response = await axios.get(
      'https://management.srs-ssms.com/api/getorder_gudang',
      {
        params: {
          email: 'j',
          password: 'j',
        },
      }
    );

    const data = response.data;
    // console.log(data);

    if (data.length > 0) {
      // Assuming data is the array directly
      for (const itemdata of data) {
        if (itemdata.status === 'notif_atasan_pemilik') {
          let message = `*Permintaan barang perlu di review*:\n`;
          message += `Hallo Selamat Siang Bapak/Ibu ${itemdata.nama_atasan_pemilik}\n`;
          message += `Anda memiliki request baru untuk permintaan barang dengan detail sebagai berikut:\n`;
          message += `*ID* : ${itemdata.id_data}\n`;
          message += `*Nama pemohon* : ${itemdata.id_pemohon}\n`;
          message += `*Departement pemohon* : ${itemdata.nama_departement_pemohon}\n`;
          message += `*Barang diminta* : ${itemdata.nama_barang} (${itemdata.nama_lain})\n`;
          message += `*Jumlah diminta* : ${itemdata.jumlah}\n`;
          message += `*tanggal_pengajuan* : ${itemdata.tanggal_pengajuan}\n`;
          message += `Silahkan Reply Pesan ini kemudian balas ya/tidak untuk approval\n`;
          message += `Generated by Digital Architect SRS Bot`;
          await sock.sendMessage(
            itemdata.nomor_hp_atasan_pemilik + '@s.whatsapp.net',
            {
              text: message,
            }
          );
        } else if (itemdata.status === 'notif_pemohon_success') {
          let message = `*Permintaan barang disetujui*:\n`;
          message += `Hallo Selamat Siang Bapak/Ibu ${itemdata.id_pemohon}\n`;
          message += `Permintaan barang dengan detail sebagai berikut telah disetujui:\n`;
          message += `*ID* : ${itemdata.id_data}\n`;
          message += `*Nama atasan departement* : ${itemdata.nama_atasan_pemilik}\n`;
          message += `*Departement pengajuan* : ${itemdata.nama_departement_pemilik}\n`;
          message += `*Barang diminta* : ${itemdata.nama_barang} (${itemdata.nama_lain})\n`;
          message += `*Jumlah diminta* : ${itemdata.jumlah}\n`;
          message += `*tanggal_pengajuan* : ${itemdata.tanggal_pengajuan}\n`;
          message += `Generated by Digital Architect SRS Bot`;
          await sock.sendMessage(
            itemdata.nomor_hp_atasan_pemilik + '@s.whatsapp.net',
            {
              text: message,
            }
          );
        } else if (itemdata.status === 'notif_pemohon_failed') {
          let message = `*Permintaan barang ditolak*:\n`;
          message += `Hallo Selamat Siang Bapak/Ibu ${itemdata.id_pemohon}\n`;
          message += `Permintaan barang dengan detail sebagai berikut telah disetujui:\n`;
          message += `*ID* : ${itemdata.id_data}\n`;
          message += `*Nama atasan departement* : ${itemdata.nama_atasan_pemilik}\n`;
          message += `*Departement pengajuan* : ${itemdata.nama_departement_pemilik}\n`;
          message += `*Barang diminta* : ${itemdata.nama_barang} (${itemdata.nama_lain})\n`;
          message += `*Jumlah diminta* : ${itemdata.jumlah}\n`;
          message += `*tanggal_pengajuan* : ${itemdata.tanggal_pengajuan}\n`;
          message += `Generated by Digital Architect SRS Bot`;
          await sock.sendMessage(
            itemdata.nomor_hp_atasan_pemilik + '@s.whatsapp.net',
            {
              text: message,
            }
          );
        } else {
          console.log('tidak ada data');
        }
      }
    } else {
      console.log('Data kosong management gudang');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

//bot kirim laporan ke group izin kebun
async function Report_group_izinkebun(sock) {
  try {
    // Fetch data from the API
    const response = await axios.get(
      // 'http://127.0.0.1:8000/api/get_reportdata_suratizin',
      'https://management.srs-ssms.com/api/get_reportdata_suratizin',
      {
        params: {
          email: 'j',
          password: 'j',
        },
      }
    );

    const data = response.data;

    // Check if the PDF exists in the response
    if (data.pdf) {
      try {
        // Decode the base64 PDF and prepare it for sending
        const pdfBuffer = Buffer.from(data.pdf, 'base64');
        const pdfFilename = data.filename || 'Invoice.pdf';
        const messageOptions = {
          document: pdfBuffer,
          mimetype: 'application/pdf',
          fileName: pdfFilename,
          caption: 'Laporan Izin Kebun',
        };

        // Send the PDF as a document via WhatsApp
        await sock.sendMessage(idgroup_da, messageOptions);
        console.log('PDF sent successfully!');
      } catch (sendError) {
        console.error('Error sending PDF:', sendError.message);
      }
    } else {
      console.log('PDF not found in the API response.');
    }

    // try {
    //   // Update the status for all IDs at once
    //   const updateResponse = await axios.post(
    //     // 'http://127.0.0.1:8000/api/update_status_report_group_izin',
    //     'https://management.srs-ssms.com/api/update_status_report_group_izin',
    //     {
    //       id: data.id, // Pass the array of IDs directly
    //       email: 'j',
    //       password: 'j',
    //     }
    //   );

    //   // If status update is successful, send a confirmation message
    //   if (updateResponse.status === 200) {
    //     // await sock.sendMessage(idgroup_da, { text: data.message });
    //     console.log('Status updated and message sent successfully!');
    //   } else {
    //     console.error(
    //       'Failed to update status, response status:',
    //       updateResponse.status
    //     );
    //   }
    // } catch (updateError) {
    //   console.error('Error updating status:', updateError.message);
    // }

    // Return the message if needed
    return data.message;
  } catch (error) {
    console.error('Error fetching data from API:', error.message);
    throw error;
  }
}

// bot baru untuk taksasi
async function Generateandsendtaksasi(sock) {
  try {
    const response = await axios.get(
      'https://management.srs-ssms.com/api/get_crontab_data',
      {
        params: {
          email: 'j',
          password: 'j',
        },
      }
    );
    const data = response.data.data;
    for (const item of data) {
      await generatemapstaksasi(item.estate, datetimeValue);

      try {
        const { data: responseData } = await axios.get(
          `https://smart-app.srs-ssms.com/api/exportPdfTaksasi/${item.estate}/${datetimeValue}`
        );

        if (responseData.base64_pdf) {
          const pdfBuffer = Buffer.from(responseData.base64_pdf, 'base64');
          const pdfFilename = `Rekap Taksasi ${item.estate} ${datetimeValue}.pdf`;
          let captions = `Laporan Taksasi Perlu persetujuan sebelum diterbitkan\n`;
          captions += `\nID : ${item.id}`;
          captions += `\nEstate : ${item.estate}`;
          captions += `\nTanggal : ${datetimeValue}`;
          captions += `Harap hanya membalas pesan ini dengan jawaban ya atau tidak`;
          captions += `\n\nTerima kasih`;
          const messageOptions = {
            document: pdfBuffer,
            mimetype: 'application/pdf',
            fileName: pdfFilename,
            caption: captions,
          };

          await sock.sendMessage(item.new_group, messageOptions);

          console.log('PDF sent successfully!');
        } else {
          console.log('PDF not found in the API response.');
        }
      } catch (error) {
        console.error('Error sending PDF:', error.message);
      }
    }
  } catch (error) {
    console.error('Error fetching data from API:', error.message);
    throw error;
  }
}

async function Sendverificationtaksasi(sock) {
  try {
    const response = await axios.get(
      'https://management.srs-ssms.com/api/send_verification_pdf',
      {
        params: {
          email: 'j',
          password: 'j',
        },
      }
    );
    const responseMessage = response.data.message;

    // Handle the case when no data is found
    if (responseMessage === 'Tidak ada data yang ditemukan') {
      console.log('No data found in the API response.');
      return; // Stop execution if no data is found
    }

    const data = response.data.data;
    for (const item of data) {
      await generatemapstaksasi(item.estate, datetimeValue);

      try {
        const { data: responseData } = await axios.get(
          `https://smart-app.srs-ssms.com/api/exportPdfTaksasi/${item.estate}/${datetimeValue}`
        );

        if (responseData.base64_pdf) {
          const pdfBuffer = Buffer.from(responseData.base64_pdf, 'base64');
          const pdfFilename = `Rekap Taksasi ${item.estate} ${datetimeValue}.pdf`;
          const messageOptions = {
            document: pdfBuffer,
            mimetype: 'application/pdf',
            fileName: pdfFilename,
            caption: 'Pesan otomatis, harap jangan membalas pesan ini',
          };

          await sock.sendMessage(item.new_group, messageOptions);

          console.log('PDF sent successfully!');
        } else {
          console.log('PDF not found in the API response.');
        }
      } catch (error) {
        console.error('Error sending PDF:', error.message);
      }
    }
  } catch (error) {
    console.error('Error fetching data from API:', error.message);
    throw error;
  }
}

// websocket
const pusher = new Pusher('b193dcd8922273835547', {
  cluster: 'ap1',
  encrypted: true,
});

// app_id = "1841216"
// key = "b193dcd8922273835547"
// secret = "5e39e309c9ee6a995b84"
// cluster = "ap1"

const channel = pusher.subscribe('my-channel');
const channelPython = pusher.subscribe('operator-missing');

const setupCronJobs = (sock) => {
  const isConnected = () => {
    return sock.user;
  };
  if (isConnected) {
    //   untuk wasecond
    // cron.schedule(
    //   '0 * * * *',
    //   async () => {
    //     try {
    //       // console.log('Running message history');
    //       await statusHistory(sock); // Call the function to check history and send message
    //     } catch (error) {
    //       console.error('Error in cron job:', error);
    //     }
    //   },
    //   {
    //     scheduled: true,
    //     timezone: 'Asia/Jakarta', // Set the timezone according to your location
    //   }
    // );
    // cron.schedule(
    //   '*/1 * * * *',
    //   async () => {
    //     await sendMessagesBasedOnData(sock);
    //     console.log('cronjob');
    //     // await maintencweget(sock);
    //   },
    //   {
    //     scheduled: true,
    //     timezone: 'Asia/Jakarta',
    //   }
    // );
    // cron.schedule(
    //   '0 * * * *',
    //   async () => {
    //     try {
    //       await statusAWS(sock); // Call the function to check AWS status and send message
    //     } catch (error) {
    //       console.error('Error in cron job:', error);
    //     }
    //   },
    //   {
    //     scheduled: true,
    //     timezone: 'Asia/Jakarta', // Set the timezone according to your location
    //   }
    // );
    // cron.schedule(
    //   '0 9 * * *',
    //   async () => {
    //     try {
    //       await statusAWS(sock); // Call the function to check AWS status and send message
    //     } catch (error) {
    //       console.error('Error in cron job:', error);
    //     }
    //   },
    //   {
    //     scheduled: true,
    //     timezone: 'Asia/Jakarta', // Set the timezone according to your location
    //   }
    // );
    // cron.schedule(
    //   '0 9 * * * *',
    //   async () => {
    //     await handleBotDailyPengawasanOperatorAI(sock);
    //   },
    //   {
    //     scheduled: true,
    //     timezone: 'Asia/Jakarta',
    //   }
    // );
    // untuk  pc ardiono
    // cron.schedule(
    //   '0 */30 * * * *',
    //   async () => {
    //     try {
    //       let response = await axios.get(
    //         'https://qc-apps.srs-ssms.com/api/checkPcStatus'
    //       );
    //       // Assuming the response data has the structure { message: "All PCs are online" }
    //       if (response.data.message === 'All PCs are online') {
    //         console.log('All PCs are online');
    //       } else {
    //         await sendfailcronjob(sock);
    //         await get_mill_data(sock);
    //       }
    //     } catch (error) {
    //       console.error('Error fetching the status:', error);
    //     }
    //   },
    //   {
    //     scheduled: true,
    //     timezone: 'Asia/Jakarta',
    //   }
    // );
    // WebSocket pusher untuk bot grading
    // untuk pc di ho boootroot
    cron.schedule(
      '0 9 * * *',
      async () => {
        await handleBotLaporanHarianFleetManagement(sock);
        await handleBotDailyPengawasanOperatorAI(sock);
      },
      {
        scheduled: true,
        timezone: 'Asia/Jakarta',
      }
    );
    cron.schedule(
      '*/10 * * * *',
      async () => {
        await sendfailcronjob(sock);
      },
      {
        scheduled: true,
        timezone: 'Asia/Jakarta',
      }
    );
    cron.schedule(
      '*/5 * * * *',
      async () => {
        // await getNotifications(sock);
        await get_mill_data(sock);
      },
      {
        scheduled: true,
        timezone: 'Asia/Jakarta',
      }
    );
    cron.schedule(
      '*/15 * * * *',
      async () => {
        await updatePCStatus();
        await triggerStatusPCPengawasanOperatorAI(sock);
      },
      {
        scheduled: true,
        timezone: 'Asia/Jakarta',
      }
    );
    channel.bind('item-requested', async (eventData) => {
      // Log the full event data to debug the structure
      // console.log(eventData);
      if (!eventData || !eventData.data || !eventData.data.bot_data) {
        console.log('Event data, data, or bot_data is undefined.');
        return;
      }
      const dataitem = eventData.data.bot_data;
      if (!dataitem.nama_atasan_pemilik) {
        console.log('nama_atasan_pemilik is undefined.');
        return;
      }
      let message = `*Permintaan barang perlu di review*:\n`;
      message += `Hallo Selamat Siang Bapak/Ibu ${dataitem.nama_atasan_pemilik}\n`;
      message += `Anda memiliki request baru dengan detail sebagai berikut:\n`;
      message += `*ID* : ${dataitem.id_data}\n`;
      message += `*Nama pemohon* : ${dataitem.id_pemohon}\n`;
      message += `*Departement pemohon* : ${dataitem.nama_departement_pemohon}\n`;
      message += `*Nama barang* : ${dataitem.nama_barang} (${dataitem.nama_lain})\n`;
      message += `*Jumlah* : ${dataitem.jumlah}\n`;
      message += `*Tanggal pengajuan* : ${dataitem.tanggal_pengajuan}\n`;
      message += `Silahkan Reply Pesan ini kemudian balas ya/tidak untuk approval\n`;
      message += `Generated by Digital Architect SRS Bot`;
      await sock.sendMessage(dataitem.send_to + '@s.whatsapp.net', {
        text: message,
      });
      try {
        const response = await axios.post(
          'https://management.srs-ssms.com/api/changestatusbot',
          // 'http://127.0.0.1:8000/api/changestatusbot',
          {
            id: dataitem.id_data,
            type: 'send_to_pemilik',
            email: 'j',
            password: 'j',
          }
        );
        let responses = response.data;
      } catch (error) {
        console.log('Error approving:', error);
      }
    });
    channel.bind('item-approved', async (eventData) => {
      // Log the full event data to debug the structure
      console.log(eventData);
      if (!eventData || !eventData.data || !eventData.data.bot_data) {
        console.log('Event data, data, or bot_data is undefined.');
        return;
      }
      const dataitem = eventData.data.bot_data;
      if (!dataitem.nama_atasan_pemilik) {
        console.log('nama_atasan_pemilik is undefined.');
        return;
      }
      let message = `*Permintaan barang disetujui*:\n`;
      message += `Hallo Selamat Siang Bapak/Ibu ${dataitem.id_pemohon}\n`;
      message += `Permintaan barang dengan detail sebagai berikut telah disetujui:\n`;
      message += `*ID* : ${dataitem.id_data}\n`;
      message += `*Nama atasan departement* : ${dataitem.nama_atasan_pemilik}\n`;
      message += `*Departement pengajuan* : ${dataitem.nama_departement_pemilik}\n`;
      message += `*Nama barang* : ${dataitem.nama_barang} (${dataitem.nama_lain})\n`;
      message += `*Jumlah* : ${dataitem.jumlah}\n`;
      message += `*Tanggal pengajuan* : ${dataitem.tanggal_pengajuan}\n`;
      message += `Generated by Digital Architect SRS Bot`;
      await sock.sendMessage(dataitem.send_to + '@s.whatsapp.net', {
        text: message,
      });
      try {
        const response = await axios.post(
          'https://management.srs-ssms.com/api/changestatusbot',
          // 'http://127.0.0.1:8000/api/changestatusbot',
          {
            email: 'j',
            password: 'j',
            id: dataitem.id_data,
            type: 'else',
          }
        );
        let responses = response.data;
      } catch (error) {
        console.log('Error approving:', error);
      }
    });
    channel.bind('item-rejected', async (eventData) => {
      // Log the full event data to debug the structure
      // console.log(eventData);
      if (!eventData || !eventData.data || !eventData.data.bot_data) {
        console.log('Event data, data, or bot_data is undefined.');
        return;
      }
      const dataitem = eventData.data.bot_data;
      if (!dataitem.nama_atasan_pemilik) {
        console.log('nama_atasan_pemilik is undefined.');
        return;
      }
      let message = `*Permintaan barang ditolak*:\n`;
      message += `Hallo Selamat Siang Bapak/Ibu ${dataitem.id_pemohon}\n`;
      message += `Permintaan barang dengan detail sebagai berikut telah ditolak:\n`;
      message += `*ID* : ${dataitem.id_data}\n`;
      message += `*Nama atasan departement* : ${dataitem.nama_atasan_pemilik}\n`;
      message += `*Departement pengajuan* : ${dataitem.nama_departement_pemilik}\n`;
      message += `*Nama barang* : ${dataitem.nama_barang} (${dataitem.nama_lain})\n`;
      message += `*Jumlah* : ${dataitem.jumlah}\n`;
      message += `*Tanggal pengajuan* : ${dataitem.tanggal_pengajuan}\n`;
      message += `*Alasan di tolak* : ${dataitem.alasan}\n`;
      message += `Generated by Digital Architect SRS Bot`;
      await sock.sendMessage(dataitem.send_to + '@s.whatsapp.net', {
        text: message,
      });
      try {
        const response = await axios.post(
          // "http://127.0.0.1:8000/api/changestatusbot",
          'https://management.srs-ssms.com/api/changestatusbot',
          {
            email: 'j',
            password: 'j',
            id: dataitem.id_data,
            type: 'else',
          }
        );
        let responses = response.data;
      } catch (error) {
        console.log('Error approving:', error);
      }
    });
    channelPython.bind('python', async (eventData) => {
      group_id = '120363321959291717@g.us';
      hourMissing = eventData.date;
      lokasiCCTV = eventData.location;
      fileName = eventData.fileName;
      const fs = require('fs');
      const axios = require('axios');
      let message = `Tidak ada aktivitas di *${lokasiCCTV}* pada  *${hourMissing}*`;
      try {
        const response = await axios.get(
          `https://srs-ssms.com/op_monitoring/get_screenshot_file.php?filename=${fileName}`
        );
        const base64Image = response.data;
        const buffer = Buffer.from(base64Image, 'base64');
        const filePath = `./uploads/${fileName}`;
        fs.writeFileSync(filePath, buffer);
        const messageOptions = {
          image: {
            url: filePath,
          },
          caption: message,
        };
        await sock
          .sendMessage(group_id, messageOptions)
          .then((result) => {
            if (fs.existsSync(filePath)) {
              fs.unlink(filePath, (err) => {
                if (err && err.code == 'ENOENT') {
                  // file doens't exist
                  console.info("File doesn't exist, won't remove it.");
                } else if (err) {
                  console.error('Error occurred while trying to remove file.');
                }
              });
            }
          })
          .catch((err) => {
            res.status(500).json({
              status: false,
              response: err,
            });
            console.log('pesan gagal terkirim');
          });
      } catch (error) {
        console.error('Error fetching base64 image:', error);
      }
    });
    channel.bind('izinkebunnotif', async (itemdata) => {
      try {
        if (!itemdata || !itemdata.data) {
          console.log('itemdata is undefined or missing data property.');
          return;
        }
        const data = itemdata.data;
        let errormsg = 'Error mengirim notifikasi izin keluar kebun\n';
        errormsg += `*ID Pemohon* : ${data.id}\n`;
        errormsg += `*Nama* : ${data.nama_user}\n`;
        errormsg += `Error mengirim ke nomor ${data.nama_atasan_1}\n`;
        if (data.type === 'send_atasan_satu') {
          let message = `*Izin baru perlu di approved*:\n`;
          message += `Hallo Selamat Siang Bapak/Ibu ${data.nama_atasan_1}\n`;
          message += `Anda memiliki request baru untuk izin keluar kebun dengan detail sebagai berikut:\n`;
          message += `*ID Pemohon* : ${data.id}\n`;
          message += `*Nama* : ${data.nama_user}\n`;
          message += `*Keperluan izin keluar kebun* : ${data.keperluan}\n`;
          message += `*Lokasi yang dituju* : ${data.lokasi_tujuan}\n`;
          message += `*Tanggal keluar izin* : ${data.tanggal_keluar}\n`;
          message += `*Tanggal kembali izin* : ${data.tanggal_kembali}\n`;
          message += `Silahkan Reply Pesan ini kemudian balas ya/tidak\n`;
          message += `Generated by Digital Architect SRS Bot`;
          try {
            await axios.post('https://management.srs-ssms.com/api/addons', {
              id: data.id_db,
              type: 'atasan1',
              email: 'j',
              password: 'j',
            });
            await sock.sendMessage(`${data.send_to}@s.whatsapp.net`, {
              text: message,
            });
          } catch (error) {
            if (
              error.code === 'ECONNRESET' ||
              'Request failed with status code 500'
            ) {
              console.log('Connection reset. Retrying up to 5 times...');
              // Implement retry logic here, with a maximum of 5 attempts
              for (let attempt = 1; attempt <= 5; attempt++) {
                try {
                  await axios.post(
                    'https://management.srs-ssms.com/api/addons',
                    {
                      id: data.id_db,
                      type: 'atasan1',
                      email: 'j',
                      password: 'j',
                    }
                  );
                  console.log('Retry successful');
                  break;
                } catch (retryError) {
                  if (attempt === 5) {
                    await sock.sendMessage(idgroup, {
                      text: errormsg + '\n' + retryError.message,
                    });
                    console.log(
                      'Max retries reached. Unable to complete the request.'
                    );
                  } else {
                    console.log(`Retrying... Attempt ${attempt}`);
                  }
                }
              }
            } else {
              await sock.sendMessage(idgroup, {
                text: errormsg + '\n' + error.message,
              });
              console.log('Error:', error.message);
            }
          }
        } else if (data.type === 'send_atasan_dua') {
          let message = `*Izin baru perlu di approved*:\n`;
          message += `Hallo Selamat Siang Bapak/Ibu ${data.nama_atasan_2}\n`;
          message += `Anda memiliki request baru untuk izin keluar kebun dengan detail sebagai berikut:\n`;
          message += `*ID Pemohon* : ${data.id}\n`;
          message += `*Nama* : ${data.nama_user}\n`;
          message += `*Keperluan izin keluar kebun* : ${data.keperluan}\n`;
          message += `*Lokasi yang dituju* : ${data.lokasi_tujuan}\n`;
          message += `*Tanggal keluar izin* : ${data.tanggal_keluar}\n`;
          message += `*Tanggal kembali izin* : ${data.tanggal_kembali}\n`;
          message += `Silahkan Reply Pesan ini kemudian balas ya/tidak\n`;
          message += `Generated by Digital Architect SRS Bot`;
          let userMessage = `*Izin Keluar Kebun Anda Telah Disetujui Atasan Pertama*\n\n`;
          userMessage += `Hallo Selamat Siang Bapak/Ibu ${data.nama_user},\n\n`;
          userMessage += `Kami ingin menginformasikan bahwa permintaan izin keluar kebun Anda telah Disetujui.\n\n`;
          userMessage += `Silahkan tunggu notifikasi  berikutnya untuk persetujuan dari atasan kedua.\n\n`;
          userMessage += `Terima kasih,\n`;
          userMessage += `Tim Digital Architect SRS Bot`;
          try {
            await axios.post('https://management.srs-ssms.com/api/addons', {
              id: data.id_db,
              type: 'atasan2',
              email: 'j',
              password: 'j',
            });
            await sock.sendMessage(`${data.send_to}@s.whatsapp.net`, {
              text: message,
            });
            await sock.sendMessage(data.no_hp_user + '@s.whatsapp.net', {
              text: userMessage,
            });
          } catch (error) {
            if (
              error.code === 'ECONNRESET' ||
              'Request failed with status code 500'
            ) {
              console.log('Connection reset. Retrying up to 5 times...');
              // Implement retry logic here, with a maximum of 5 attempts
              for (let attempt = 1; attempt <= 5; attempt++) {
                try {
                  await axios.post(
                    'https://management.srs-ssms.com/api/addons',
                    {
                      id: data.id_db,
                      type: 'atasan2',
                      email: 'j',
                      password: 'j',
                    }
                  );
                  console.log('Retry successful');
                  break;
                } catch (retryError) {
                  if (attempt === 5) {
                    await sock.sendMessage(idgroup, {
                      text: errormsg + '\n' + retryError.message,
                    });
                    console.log(
                      'Max retries reached. Unable to complete the request.'
                    );
                  } else {
                    console.log(`Retrying... Attempt ${attempt}`);
                  }
                }
              }
            } else {
              await sock.sendMessage(idgroup, {
                text: errormsg + '\n' + error.message,
              });
              console.log('Error:', error.message);
            }
          }
        } else if (data.type === 'send_user') {
          let message = ''; // Initialize the message variable here
          if (data.status === 'approved') {
            message += `*Izin Keluar Kebun Anda Telah Disetujui*\n\n`;
            message += `Hallo Selamat Siang Bapak/Ibu ${data.nama_user},\n\n`;
            message += `Kami ingin menginformasikan bahwa permintaan izin keluar kebun Anda telah disetujui.\n\n`;
            message += `Berikut adalah detail izin Anda:\n`;
            message += `*Nama Pemohon*: ${data.nama_user}\n`;
            message += `*Tanggal keluar izin* : ${data.tanggal_keluar}\n`;
            message += `*Tanggal kembali izin* : ${data.tanggal_kembali}\n`;
            message += `*Keperluan*: ${data.keperluan}\n`;
            message += `*Lokasi Tujuan*: ${data.lokasi_tujuan}\n\n`;
            message += `Harap selalu berhati-hati selama perjalanan dan pastikan untuk mengikuti protokol keamanan yang berlaku. Kami mendoakan agar Anda tiba dengan selamat di tujuan dan kembali ke kebun dengan kondisi sehat dan aman.\n\n`;
            message += `Jika ada pertanyaan lebih lanjut, jangan ragu untuk menghubungi kami.\n\n`;
            message += `Atau kunjungi web kami di :https://izin-kebun.srs-ssms.com \n\n`;
            message += `Terima kasih,\n`;
            message += `Tim Digital Architect SRS Bot`;
            try {
              // const genpdf = await axios.get('http://qc-apps2.test/api/generatePdfIzinKebun', {
              const genpdf = await axios.get(
                'https://izin-kebun.srs-ssms.com/api/generatePdfIzinKebun',
                // 'http://qc-apps2.test/api/generatePdfIzinKebun',
                {
                  params: {
                    user: 'j',
                    pw: 'j',
                    id: data.id_db,
                  },
                }
              );
              // console.log(genpdf.data.filename);
              const fileUrl = `https://izin-kebun.srs-ssms.com/public/storage/files/${genpdf.data.filename}`;
              const destinationPath = `./uploads/${itemdata.filename_pdf}`;
              const file = fs.createWriteStream(destinationPath);
              await new Promise((resolve, reject) => {
                https
                  .get(fileUrl, function (response) {
                    response.pipe(file);
                    file.on('finish', function () {
                      file.close(() => {
                        console.log('File downloaded successfully.');
                        resolve(); // Resolve the promise after the file is downloaded
                      });
                    });
                  })
                  .on('error', function (err) {
                    fs.unlink(destinationPath, () => {}); // Delete the file if there is an error
                    console.error('Error downloading the file:', err);
                    reject(err); // Reject the promise if there is an error
                  });
              });
              const messageOptions = {
                document: {
                  url: destinationPath,
                  caption: 'ini caption',
                },
                fileName: 'Surat Izin Kebun',
              };
              await sock.sendMessage(
                data.send_to + '@s.whatsapp.net',
                messageOptions
              );
              try {
                const unlinkpdf = await axios.get(
                  'https://izin-kebun.srs-ssms.com/api/deletePdfIzinKebun',
                  {
                    params: {
                      user: 'j',
                      pw: 'j',
                      filename: genpdf.data.filename,
                    },
                  }
                );
              } catch (error) {
                console.log('Error unlinkpdf PDF:', error);
              }
            } catch (error) {
              console.log('Error generating PDF:', error);
            }
          } else if (data.status === 'rejected') {
            message += `*Izin Keluar Kebun Anda Telah Ditolak*\n\n`;
            message += `Hallo Selamat Siang Bapak/Ibu ${data.nama_user},\n\n`;
            message += `Kami ingin menginformasikan bahwa permintaan izin keluar kebun Anda telah ditolak dikarenakan :\n\n`;
            message += `*Alasan ditolak*: ${data.response}\n`;
            message += `Jika ada pertanyaan lebih lanjut, jangan ragu untuk menghubungi kami.\n\n`;
            message += `Terima kasih,\n`;
            message += `Tim Digital Architect SRS Bot`;
          } else {
            console.log('Unknown status:', data.type);
            return;
          }
          console.log('send_user');
          try {
            await axios.post('https://management.srs-ssms.com/api/addons', {
              id: data.id_db,
              type: 'user',
              email: 'j',
              password: 'j',
            });
            await sock.sendMessage(`${data.send_to}@s.whatsapp.net`, {
              text: message,
            });
          } catch (error) {
            console.log(error);
            if (
              error.code === 'ECONNRESET' ||
              error.message.includes('Request failed with status code 500')
            ) {
              console.log('Connection reset. send_user');
              // Implement retry logic here, with a maximum of 5 attempts
              for (let attempt = 1; attempt <= 5; attempt++) {
                try {
                  await axios.post(
                    'https://management.srs-ssms.com/api/addons',
                    {
                      id: data.id_db,
                      type: 'user',
                      email: 'j',
                      password: 'j',
                    }
                  );
                  console.log('Retry successful');
                  break;
                } catch (retryError) {
                  if (attempt === 5) {
                    await sock.sendMessage(idgroup, {
                      text: message + '\n' + retryError.message, // Use the message here
                    });
                    console.log('Max retries reached. send_user.');
                  } else {
                    console.log(`Retrying... Attempt ${attempt}`);
                  }
                }
              }
            } else {
              await sock.sendMessage(idgroup, {
                text: message + '\n' + error.message, // Use the message here
              });
              console.log('Error send_user:', error.message);
            }
          }
        } else if (data.type === 'send_atasan_tiga') {
          let message = `*Izin baru perlu di approved*:\n`;
          message += `Hallo Selamat Siang Bapak/Ibu ${data.nama_atasan_3}\n`;
          message += `Anda memiliki request baru untuk izin keluar kebun dengan detail sebagai berikut:\n`;
          message += `*ID Pemohon* : ${data.id}\n`;
          message += `*Nama* : ${data.nama_user}\n`;
          message += `*Keperluan izin keluar kebun* : ${data.keperluan}\n`;
          message += `*Lokasi yang dituju* : ${data.lokasi_tujuan}\n`;
          message += `*Tanggal keluar izin* : ${data.tanggal_keluar}\n`;
          message += `*Tanggal kembali izin* : ${data.tanggal_kembali}\n`;
          message += `Silahkan Reply Pesan ini kemudian balas ya/tidak\n`;
          message += `Generated by Digital Architect SRS Bot`;
          let userMessage = `*Izin Keluar Kebun Anda Telah Di setujui Atasan Kedua*\n\n`;
          userMessage += `Hallo Selamat Siang Bapak/Ibu ${data.nama_user},\n\n`;
          userMessage += `Kami ingin menginformasikan bahwa permintaan izin keluar kebun Anda telah Disetuji :\n\n`;
          userMessage += `Silahkan tunggu notifikasi  berikutnya untuk persetujuan dari atasan ketiga.\n\n`;
          userMessage += `Terima kasih,\n`;
          userMessage += `Tim Digital Architect SRS Bot`;
          try {
            await axios.post('https://management.srs-ssms.com/api/addons', {
              id: data.id_db,
              type: 'atasan3',
              email: 'j',
              password: 'j',
            });
            await sock.sendMessage(`${data.send_to}@s.whatsapp.net`, {
              text: message,
            });
            await sock.sendMessage(data.no_hp_user + '@s.whatsapp.net', {
              text: userMessage,
            });
          } catch (error) {
            if (
              error.code === 'ECONNRESET' ||
              'Request failed with status code 500'
            ) {
              console.log('Connection reset. Retrying up to 5 times...');
              // Implement retry logic here, with a maximum of 5 attempts
              for (let attempt = 1; attempt <= 5; attempt++) {
                try {
                  await axios.post(
                    'https://management.srs-ssms.com/api/addons',
                    {
                      id: data.id_db,
                      type: 'atasan3',
                      email: 'j',
                      password: 'j',
                    }
                  );
                  console.log('Retry successful');
                  break;
                } catch (retryError) {
                  if (attempt === 5) {
                    await sock.sendMessage(idgroup, {
                      text: errormsg + '\n' + retryError.message,
                    });
                    console.log(
                      'Max retries reached. Unable to complete the request.'
                    );
                  } else {
                    console.log(`Retrying... Attempt ${attempt}`);
                  }
                }
              }
            } else {
              await sock.sendMessage(idgroup, {
                text: errormsg + '\n' + error.message,
              });
              console.log('Error:', error.message);
            }
          }
        } else {
          console.log('Unknown status:', data.type);
          return;
        }
      } catch (globalError) {
        await sock.sendMessage(idgroup, {
          text: errormsg + '\n' + globalError.message,
        });
        console.log('Unexpected error:', globalError);
      }
    });
    channel.bind('Smartlabsnotification', async (itemdata) => {
      if (!itemdata || !itemdata.data) {
        console.log('Event data, data, or bot_data is undefined.');
        return;
      }
      // Loop through each item in the data array
      itemdata.data.forEach(async (dataitem) => {
        let message = `*${greeting}*:\n`;
        message += `Yth. Pelanggan Setia Lab CBI\n`;
        if (dataitem.type === 'input') {
          message += `Progress Sampel anda telah kami terima dengan:\n`;
        } else {
          message += `Progress Sampel anda telah Terupdate dengan:\n`;
        }
        message += `*No. Surat* : ${dataitem.no_surat}\n`;
        message += `*Departemen* : ${dataitem.nama_departemen}\n`;
        message += `*Jenis Sampel* : ${dataitem.jenis_sampel}\n`;
        message += `*Jumlah Sampel* : ${dataitem.jumlah_sampel}\n`;
        message += `*Progress saat ini* : ${dataitem.progresss}\n`;
        message += `Progress anda dapat dilihat di website:https://smartlab.srs-ssms.com\n`;
        message += `Dengan kode tracking  *${dataitem.kodesample}*\n`;
        message += `Terima kasih telah mempercayakan sampel anda untuk dianalisa di Lab kami.\n`;
        console.log(message);
        await sock.sendMessage(`${dataitem.penerima}@s.whatsapp.net`, {
          text: message,
        });
        if (dataitem.asal === 'Eksternal') {
          const response = await axios.get(
            'https://management.srs-ssms.com/api/invoices_smartlabs',
            {
              params: {
                email: 'j',
                password: 'j',
                id_data: dataitem.id_invoice,
              },
            }
          );
          const responseData = response.data;
          if (responseData.pdf) {
            // Step 2: Decode the base64 PDF
            const pdfBuffer = Buffer.from(responseData.pdf, 'base64');
            const pdfFilename = responseData.filename || 'Invoice.pdf';
            // Step 3: Send the PDF as a document via WhatsApp
            const messageOptions = {
              document: pdfBuffer,
              mimetype: 'application/pdf',
              fileName: pdfFilename,
              caption: 'Invoice Smartlabs',
            };
            await sock.sendMessage(
              dataitem.penerima + '@s.whatsapp.net',
              messageOptions
            );
            console.log('PDF sent successfully!');
          } else {
            console.log('PDF not found in the API response.');
          }
        }
      });
    });
    channel.bind('notifkasirapidresponse', async (arrayData) => {
      if (!arrayData?.data) {
        console.log('Event data, data, or bot_data is undefined.');
        return;
      }
      const itemdata = arrayData.data;
      // Define the sendMessage function here
      const sendMessage = async (verifikator, name, id_verifikator) => {
        const message =
          `*${greeting}*:\n` +
          `Yth. Bapak/ibu ${name}\n` +
          `Anda memiliki permintaan untuk meverifikasi data dari rekomendator ${itemdata.rekomendator} dalam aplikasi rapid respons. Dengan rincian\n` +
          `*Doc ID* : ${itemdata.id}/${id_verifikator}\n` +
          `*Estate* : ${itemdata.estate}\n` +
          `*Afdeling* : ${itemdata.afdeling}\n` +
          `*Blok* : ${itemdata.blok}\n` +
          `*Baris* : ${itemdata.baris}\n` +
          `*Masalah* : ${itemdata.masalah}\n` +
          `*Catatan* : ${itemdata.catatan}\n` +
          `Silahkan Repply pesan ini dengan kata kunci "Ya" untuk menerima permintaan verifikasi. Jika anda tidak dapat melakukan verifikasi, silahkan reply pesan ini dengan kata kunci "Tidak" untuk menolak permintaan verifikasi. \n` +
          `Detail dapat anda periksa di website : https://rapidresponse.srs-ssms.com \n`;
        await sock.sendMessage(`${verifikator}@s.whatsapp.net`, {
          text: message,
        });
        // console.log(message);
      };
      try {
        const { data: responseData } = await axios.get(
          'https://management.srs-ssms.com/api/generate_pdf_rapidresponse',
          {
            params: {
              email: 'j',
              password: 'j',
              id: itemdata.id,
            },
          }
        );
        if (responseData.pdf) {
          const pdfBuffer = Buffer.from(responseData.pdf, 'base64');
          const pdfFilename = responseData.filename || 'Invoice.pdf';
          const messageOptions = {
            document: pdfBuffer,
            mimetype: 'application/pdf',
            fileName: pdfFilename,
            caption: 'Rapid Response Approval',
          };
          // Send the PDF
          await sock.sendMessage(
            `${itemdata.verifikator1}@s.whatsapp.net`,
            messageOptions
          );
          await sock.sendMessage(
            `${itemdata.verifikator2}@s.whatsapp.net`,
            messageOptions
          );
          console.log('PDF sent successfully!');
        } else {
          console.log('PDF not found in the API response.');
        }
        // Send the text message
        await sendMessage(
          itemdata.verifikator1,
          itemdata.nama_verifikator1,
          itemdata.id_verifikator1
        );
        if (itemdata.verifikator2 !== itemdata.verifikator1) {
          await sendMessage(
            itemdata.verifikator2,
            itemdata.nama_verifikator2,
            itemdata.id_verifikator2
          );
        }
      } catch (error) {
        console.error('Error sending PDF:', error);
      }
    });
    cron.schedule(
      '0 12 * * 6',
      async () => {
        await Report_group_izinkebun(sock);
      },
      {
        scheduled: true,
        timezone: 'Asia/Jakarta',
      }
    );
    cron.schedule(
      '0 14 * * *', // Runs at 14:00 every day
      async () => {
        await Generateandsendtaksasi(sock);
      },
      {
        scheduled: true,
        timezone: 'Asia/Jakarta',
      }
    );
    cron.schedule(
      '0 17 * * *', // Runs at 14:00 every day
      async () => {
        await Sendverificationtaksasi(sock);
      },
      {
        scheduled: true,
        timezone: 'Asia/Jakarta',
      }
    );
  } else {
    console.log('WhatsApp belum terhubung');
  }
};

module.exports = {
  sendtaksasiest,
  setupCronJobs,
  handleijinmsg,
  getNotifications,
  handleIotInput,
  handleChatSnoozePengawasanOperatorAi,
  handleTaksasi,
  restartbot,
  get_mill_data,
  handleBotDailyPengawasanOperatorAI,
  botmanagementgudang,
  triggerStatusPCPengawasanOperatorAI,
  handleBotLaporanHarianFleetManagement,
  Report_group_izinkebun,
  Generateandsendtaksasi,
};
