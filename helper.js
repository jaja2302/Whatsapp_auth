const puppeteer = require('puppeteer');
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { DateTime } = require('luxon');

const { channel, channelPython } = require('./utils/pusher');
const {
  Report_group_izinkebun,
  catcherror,
  Fail_send_pdf,
  reminder_izin_kebun,
} = require('./utils/izinkebun/helper');
const {
  sendfailcronjob,
  Generateandsendtaksasi,
  Sendverificationtaksasi,
} = require('./utils/taksasi/taksasihelper');
const {
  get_mill_data,
  run_jobs_mill,
} = require('./utils/grading/gradinghelper');
const { pingGoogle, sendSummary } = require('./utils/rekap_harian_uptime');
const {
  get_iot_weatherstation,
  get_iot_weatherstation_data_gap,
} = require('./utils/iot/iothelper');
const { get_outstadingdata } = require('./utils/marcom/marcomhelper');
const {
  timeoutHandles,
  userIotChoice,
  botIotPrompt,
  userchoiceSnoozeBotPengawasanOperator,
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
const idgroup_testing = '120363204285862734@g.us';
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
        queue.push({
          type: 'send_message',
          data: { to: numberWA, message: msg_request },
        });
        // await sock.sendMessage(numberWA, { text: msg_request });
        // console.log(`Message sent to ${numberWA}`);
      } catch (error) {
        console.log(`Failed to send message to ${numberWA}:`, error);
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

async function statusAWS() {
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
          queue.push({
            type: 'send_message',
            data: { to: idgroup_testing, message: item.message },
          });
          // await sock.sendMessage(item.group_id, { text: item.message });
          // await sock.sendMessage(item.group_id, { text: item.message });
          // console.log(item.group_id, { text: item.message });
        }
      }
    }
  } catch (error) {
    console.log(`Error fetching files: aws`, error);
  }
}

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
        queue.push({
          type: 'send_message',
          data: { to: group_id_bot_pengawasan, message: message },
        });
        // await sock.sendMessage(group_id_bot_pengawasan, { text: message });
      }
    } else {
      console.log('data kosong');
    }
    return response;
  } catch (error) {
    console.log('Error fetching data:', error);
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
      if (now > threeHoursLater && parseInt(item.reset_pc_mati) >= 0) {
        const formattedDate = formatDateIndonesian(lastOnline);

        let message = `*Last Online PC dari Machine id ${item.id} mati sejak ${formattedDate}*:\n`;
        message += `\nGenerated by Digital Architect SRS bot`;
        queue.push({
          type: 'send_message',
          data: { to: item.group_id_wa, message: message },
        });
        // await sock.sendMessage(item.group_id_wa, { text: message });

        // Send the POST request to update_trigger_bot_mati.php
        try {
          const updateResponse = await axios.post(
            'https://srs-ssms.com/op_monitoring/update_trigger_bot_mati.php',
            new URLSearchParams({ machineId: item.id })
          );
          console.log(updateResponse.data);
        } catch (updateError) {
          console.log(
            `Error updating reset_pc_mati Machine ID ${item.id}:`,
            updateError.message
          );
        }
      }
    }
    return response;
  } catch (error) {
    console.log('Error fetching data:', error);
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
      queue.push({
        type: 'send_message',
        data: { to: group_id_bot_fleetmanagement, message: message },
      });
      // await sock.sendMessage(group_id_bot_fleetmanagement, { text: message });
    } else {
      console.log('data kosong');
    }
    return response;
  } catch (error) {
    console.log('Error fetching data:', error);
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
      queue.push({
        type: 'send_message',
        data: { to: group_id_bot_fleetmanagement, message: message },
      });
      // await sock.sendMessage(group_id_bot_fleetmanagement, { text: message });
    } else {
      console.log('data kosong');
    }
    return response;
  } catch (error) {
    console.log('Error fetching data:', error);
  }
}

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
        // console.log(configSnoozeBotPengawasanOperator[noWa]);
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
    // console.log('Status updated:', response.data);
  } catch (error) {
    console.log('Error updating status:', error);
  }
};

// end function

async function restartbot(namabot) {
  exec(`pm2 restart ${namabot}`, (error, stdout, stderr) => {
    if (error) {
      // console.log(`Error restarting app: ${error.message}`);
      return;
    }
    if (stderr) {
      console.log(`Restart error: ${stderr}`);
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
          queue.push({
            type: 'send_message',
            data: {
              to: itemdata.nomor_hp_atasan_pemilik + '@s.whatsapp.net',
              message: message,
            },
          });
          // await sock.sendMessage(
          //   itemdata.nomor_hp_atasan_pemilik + '@s.whatsapp.net',
          //   {
          //     text: message,
          //   }
          // );
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
          queue.push({
            type: 'send_message',
            data: {
              to: itemdata.nomor_hp_atasan_pemilik + '@s.whatsapp.net',
              message: message,
            },
          });
          // await sock.sendMessage(
          //   itemdata.nomor_hp_atasan_pemilik + '@s.whatsapp.net',
          //   {
          //     text: message,
          //   }
          // );
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
          queue.push({
            type: 'send_message',
            data: {
              to: itemdata.nomor_hp_atasan_pemilik + '@s.whatsapp.net',
              message: message,
            },
          });
          // await sock.sendMessage(
          //   itemdata.nomor_hp_atasan_pemilik + '@s.whatsapp.net',
          //   {
          //     text: message,
          //   }
          // );
        } else {
          // console.log('tidak ada data');
        }
      }
    } else {
      // console.log('Data kosong management gudang');
    }
  } catch (error) {
    console.log('Error management gudang:', error);
  }
}

// websocket

// all cronjob di sini

const setupCronJobs = (sock) => {
  const isConnected = () => {
    return sock.user;
  };
  cron.schedule(
    '*/5 * * * *',
    async () => {
      // console.log('cron job ping google');

      await pingGoogle();
      // await get_mill_data(sock);
    },
    {
      scheduled: true,
      timezone: 'Asia/Jakarta',
    }
  );
  // Send summary every day at 9 AM

  if (isConnected) {
    cron.schedule(
      '0 * * * *',
      async () => {
        try {
          console.log(
            'cron job statusAWS,statusHistory,get_iot_weatherstation'
          );

          // await statusAWS();
          // await statusHistory(sock);
          await get_iot_weatherstation();
          // await get_iot_weatherstation_data_gap(sock);
        } catch (error) {
          console.log('Error in cron job:', error);
        }
      },
      {
        scheduled: true,
        timezone: 'Asia/Jakarta', // Set the timezone according to your location
      }
    );
    cron.schedule(
      '0 9 * * *',
      async () => {
        console.log(
          'cron job handleBotLaporanHarianFleetManagement,handleBotDailyPengawasanOperatorAI,sendSummary,get_outstadingdata'
        );

        await handleBotLaporanHarianFleetManagement();
        await handleBotDailyPengawasanOperatorAI();
        await sendSummary();
        await get_outstadingdata();
      },
      {
        scheduled: true,
        timezone: 'Asia/Jakarta',
      }
    );
    cron.schedule(
      '*/10 * * * *',
      async () => {
        console.log('memulai cronjob  taksasi fail,pdf izin kebun,iot gap');
        await sendfailcronjob(sock);
        Fail_send_pdf();
      },
      {
        scheduled: true,
        timezone: 'Asia/Jakarta',
      }
    );
    cron.schedule(
      '*/1 * * * *',
      async () => {
        // console.log('cron job get_mill_data');
        await run_jobs_mill(sock);
      },
      {
        scheduled: true,
        timezone: 'Asia/Jakarta',
      }
    );
    cron.schedule(
      '*/5 * * * *',
      async () => {
        await get_mill_data(sock);
      },
      {
        scheduled: true,
        timezone: 'Asia/Jakarta',
      }
    );
    // cron.schedule(
    //   '0 7 * * 1-6', // 0 7 = Jam 07:00, 1-6 = Senin-Sabtu
    //   async () => {
    //     console.log('cron job get_mill_data');
    //     await reminder_izin_kebun(sock);
    //   },
    //   {
    //     scheduled: true,
    //     timezone: 'Asia/Jakarta',
    //   }
    // );
    cron.schedule(
      '*/15 * * * *',
      async () => {
        console.log(
          'cron job updatePCStatus,triggerStatusPCPengawasanOperatorAI'
        );
        await updatePCStatus();
        await triggerStatusPCPengawasanOperatorAI(sock);
      },
      {
        scheduled: true,
        timezone: 'Asia/Jakarta',
      }
    );
    cron.schedule(
      '30 11 * * 6', // format untuk jam 11:30 setiap Sabtu
      async () => {
        console.log('cron job Report_group_izinkebun');
        await Report_group_izinkebun(sock);
      },
      {
        scheduled: true,
        timezone: 'Asia/Jakarta',
      }
    );

    // cron.schedule(
    //   '0 14 * * *', // Runs at 14:00 every day
    //   async () => {
    //     await Generateandsendtaksasi(sock);
    //   },
    //   {
    //     scheduled: true,
    //     timezone: 'Asia/Jakarta',
    //   }
    // );
    // cron.schedule(
    //   '0 17 * * *', // Runs at 14:00 every day
    //   async () => {
    //     await Sendverificationtaksasi(sock);
    //   },
    //   {
    //     scheduled: true,
    //     timezone: 'Asia/Jakarta',
    //   }
    // );
    // websocket
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
      queue.push({
        type: 'send_message',
        data: { to: dataitem.send_to + '@s.whatsapp.net', message: message },
      });
      // await sock.sendMessage(dataitem.send_to + '@s.whatsapp.net', {
      //   text: message,
      // });
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
      queue.push({
        type: 'send_message',
        data: { to: dataitem.send_to + '@s.whatsapp.net', message: message },
      });
      // await sock.sendMessage(dataitem.send_to + '@s.whatsapp.net', {
      //   text: message,
      // });
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
      queue.push({
        type: 'send_message',
        data: { to: dataitem.send_to + '@s.whatsapp.net', message: message },
      });
      // await sock.sendMessage(dataitem.send_to + '@s.whatsapp.net', {
      //   text: message,
      // });
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
        console.log('Error approving management gudang:', error);
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
                  console.log('Error occurred while trying to remove file.');
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
        console.log('Error fetching base64 image:', error);
      }
    });
  } else {
    console.log('WhatsApp belum terhubung');
  }
};

module.exports = {
  setupCronJobs,
  handleIotInput,
  handleChatSnoozePengawasanOperatorAi,
  restartbot,
  handleBotDailyPengawasanOperatorAI,
  botmanagementgudang,
  triggerStatusPCPengawasanOperatorAI,
  handleBotLaporanHarianFleetManagement,
  statusAWS,
};
