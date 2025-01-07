const axios = require('axios');
const cronJobSettings = require('../services/CronJobSettings');
const logger = require('../services/logger');
const pusherService = require('../services/pusher');
const settings = require('../web/data/settings.json');
const credentials = settings.general.credentials;
const groups = settings.general.groups;
const url = settings.general.url;
const { isProgramActive } = require('../utils/programHelper');
const path = require('path');
const fs = require('fs');

class GeneralProgram {
  constructor() {
    this.running = false;
    this.userchoiceSnoozeBotPengawasanOperator = {};
    this.configSnoozeBotPengawasanOperator = {};
    this.timeoutHandles = {};
    if (!global.queue) {
      global.queue = require('../services/queue');
    }
    this.CHANNEL_NAME = 'my-channel';
    this.CHANNEL_NAME_2 = 'operator-missing';
    this.EVENT_NAME = 'item-requested';
    this.EVENT_NAME_2 = 'item-approved';
    this.EVENT_NAME_3 = 'item-rejected';
    this.CHANNEL_PYTHON = 'python';
    this.pusherWatcher = null;
    this.pusherWatcher2 = null;
    this.pusherWatcher3 = null;
    this.pusherWatcherPython = null;
    this.imagePathizinkebun = path.join(
      process.cwd(),
      'src',
      'web',
      'public',
      'assets',
      'images',
      'izinkebun'
    );
  }

  static async init() {
    try {
      if (!isProgramActive('general')) {
        return 'General program not started: Status is not active';
      }
      logger.info.whatsapp('Initializing General Program');
      const instance = new GeneralProgram();
      await global.queue.init();
      return instance;
    } catch (error) {
      logger.error.whatsapp('Error initializing General Program:', error);
      throw error;
    }
  }

  start() {
    if (!this.running) {
      this.running = true;
      this.pusherWatcher = pusherService.getDataPusher(
        this.CHANNEL_NAME,
        this.EVENT_NAME,
        'general',
        (data) => {
          this.handleBotManagementGudang_requested(data);
        }
      );
      this.pusherWatcher2 = pusherService.getDataPusher(
        this.CHANNEL_NAME,
        this.EVENT_NAME_2,
        'general',
        (data) => {
          this.handleBotManagementGudang_approved(data);
        }
      );
      this.pusherWatcher3 = pusherService.getDataPusher(
        this.CHANNEL_NAME,
        this.EVENT_NAME_3,
        'general',
        (data) => {
          this.handleBotManagementGudang_rejected(data);
        }
      );
      this.pusherWatcherPython = pusherService.getDataPusher(
        this.CHANNEL_NAME_2,
        this.EVENT_NAME_2,
        'general',
        (data) => {
          this.handlePython(data);
        }
      );
      logger.info.whatsapp('General program started');
    }
  }

  stop() {
    if (this.running) {
      this.running = false;
      this.userchoiceSnoozeBotPengawasanOperator = {};
      this.configSnoozeBotPengawasanOperator = {};
      if (this.pusherWatcher) {
        this.pusherWatcher.stop();
        this.pusherWatcher = null;
      }
      if (this.pusherWatcher2) {
        this.pusherWatcher2.stop();
        this.pusherWatcher2 = null;
      }
      if (this.pusherWatcher3) {
        this.pusherWatcher3.stop();
        this.pusherWatcher3 = null;
      }
      if (this.pusherWatcherPython) {
        this.pusherWatcherPython.stop();
        this.pusherWatcherPython = null;
      }
      logger.info.whatsapp('General program stopped');
    }
  }

  // fleet management
  async handleChatSnoozePengawasanOperatorAi(noWa, text, sock, waUser) {
    if (!this.userchoiceSnoozeBotPengawasanOperator[noWa]) {
      handleTimeout(noWa, sock);
      if (text.startsWith('!snooze ')) {
        this.userchoiceSnoozeBotPengawasanOperator[noWa] = 'machine';
        const response = await axios.get(
          'https://srs-ssms.com/op_monitoring/get_list_machine.php'
        );

        const data = response.data;
        const activeDevices = data.filter((device) => device.status === '1');

        const deviceList = activeDevices
          .map((device, index) => `${index + 1}. ${device.name}`)
          .join('\n');
        this.configSnoozeBotPengawasanOperator[noWa] = {
          ...this.configSnoozeBotPengawasanOperator[noWa], // Spread the existing properties
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
      const step = this.userchoiceSnoozeBotPengawasanOperator[noWa];
      if (step === 'machine') {
        const selectedDeviceIndex = parseInt(text, 10) - 1;
        const devices = this.configSnoozeBotPengawasanOperator[noWa].devices;

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

        this.configSnoozeBotPengawasanOperator[noWa].machine_id = text;
        let machineId = text;
        this.configSnoozeBotPengawasanOperator[noWa].no_hp = waUser;

        try {
          await sock.sendMessage(noWa, {
            text: 'Mohon tunggu sedang melakukan update konfigurasi Operator Pengawasai AI',
          });
          // console.log(configSnoozeBotPengawasanOperator[noWa]);
          let urlsearchparams = new URLSearchParams({
            description: this.configSnoozeBotPengawasanOperator[noWa].datetime,
            hour: this.configSnoozeBotPengawasanOperator[noWa].hour,
            machine_id: selectedDevice.id,
            no_hp: this.configSnoozeBotPengawasanOperator[noWa].no_hp,
          });

          logger.info.whatsapp('urlsearchparams', urlsearchparams);

          //   const response = await axios.post(
          //     'https://srs-ssms.com/op_monitoring/update_snooze_machine_bot.php',
          //     urlsearchparams
          //   );

          //   let responses = response.data;

          //   if (responses.status === 1) {
          //     const response = await axios.get(
          //       'https://srs-ssms.com/op_monitoring/get_list_machine.php',
          //       {
          //         params: {
          //           machine_id: machineId,
          //         },
          //       }
          //     );

          //     const data = response.data;
          //     await sock.sendMessage(noWa, {
          //       text: `Konfigurasi berhasil disimpan untuk ${data[0].name}\n`,
          //     });
          //     delete this.configSnoozeBotPengawasanOperator[noWa];
          //     delete this.userchoiceSnoozeBotPengawasanOperator[noWa];
          //     clearTimeout(timeoutHandles[noWa]);
          //     delete timeoutHandles[noWa];
          //   } else if (responses.status === 0) {
          //     await sock.sendMessage(noWa, {
          //       text: 'Terjadi kesalahan saat update konfigurasi. Mohon coba lagi!',
          //     });
          //     delete this.configSnoozeBotPengawasanOperator[noWa];
          //     delete this.userchoiceSnoozeBotPengawasanOperator[noWa];
          //     clearTimeout(timeoutHandles[noWa]);
          //     delete timeoutHandles[noWa];
          //   }
        } catch (error) {
          if (error.response && error.response.status === 404) {
            await sock.sendMessage(noWa, {
              text: 'Terjadi error tidak terduga',
            });
            delete this.configSnoozeBotPengawasanOperator[noWa];
            delete this.userchoiceSnoozeBotPengawasanOperator[noWa];
            clearTimeout(timeoutHandles[noWa]);
            delete timeoutHandles[noWa];
          } else {
            await sock.sendMessage(noWa, {
              text: 'Terjadi kesalahan saat mengirim data. Mohon coba lagi.',
            });
            delete this.configSnoozeBotPengawasanOperator[noWa];
            delete this.userchoiceSnoozeBotPengawasanOperator[noWa];
            clearTimeout(timeoutHandles[noWa]);
            delete timeoutHandles[noWa];
          }
        }
      }
    }
  }

  async handleBotDailyPengawasanOperatorAI() {
    try {
      const response = await axios.get(url.url_get_data_daily_pengawasan);
      const data = response.data;
      const group_id_bot_pengawasan = groups.group_id_bot_pengawasan;

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
            url.url_change_status_bot_daily,
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
          global.queue.push({
            type: 'send_message',
            data: { to: group_id_bot_pengawasan, message: message },
          });
          logger.info.whatsapp(
            'handleBotDailyPengawasanOperatorAI success terkirim'
          );
          return { success: true, message: message };
        }
      } else {
        logger.info.whatsapp('handleBotDailyPengawasanOperatorAI data kosong');
        return { success: false, message: 'data kosong' };
      }
    } catch (error) {
      logger.error.whatsapp(
        'handleBotDailyPengawasanOperatorAI error:' + error
      );
      return { success: false, message: 'Error fetching data:' + error };
    }
  }

  async triggerStatusPCPengawasanOperatorAI() {
    try {
      const response = await axios.get(url.url_check_last_online);
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
          global.queue.push({
            type: 'send_message',
            data: { to: item.group_id_wa, message: message },
          });

          // Send the POST request to update_trigger_bot_mati.php
          try {
            const updateResponse = await axios.post(
              url.url_update_trigger_bot_mati,
              new URLSearchParams({ machineId: item.id })
            );
            logger.info.whatsapp(
              'triggerStatusPCPengawasanOperatorAI success terkirim'
            );
          } catch (updateError) {
            logger.error.whatsapp(
              `Error updating reset_pc_mati Machine ID ${item.id}:`,
              updateError.message
            );
            return {
              success: false,
              message: 'Error updating reset_pc_mati:' + updateError.message,
            };
          }
        }
      }
      return { success: false, message: 'No data found' };
    } catch (error) {
      logger.error.whatsapp('Error fetching data:', error);
      return { success: false, message: 'Error fetching data:' + error };
    }
  }

  async handleBotLaporanHarianFleetManagement() {
    try {
      const response = await axios.get(
        url.url_bot_laporan_harian_fleet_management
      );

      const data = response.data;
      const group_id_bot_fleetmanagement = groups.group_id_bot_fleetmanagement;

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
        global.queue.push({
          type: 'send_message',
          data: { to: group_id_bot_fleetmanagement, message: message },
        });
        // await sock.sendMessage(group_id_bot_fleetmanagement, { text: message });
      } else {
        logger.info.whatsapp('data kosong');
      }
      return { success: false, message: 'No data found' };
    } catch (error) {
      logger.error.whatsapp('Error fetching data:', error);
      return { success: false, message: 'Error fetching data:' + error };
    }
  }

  async handleBotLaporanHarianFleetManagement() {
    try {
      const response = await axios.get(
        url.url_bot_laporan_harian_fleet_management
      );

      const data = response.data;
      const group_id_bot_fleetmanagement = groups.group_id_bot_fleetmanagement;

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
        global.queue.push({
          type: 'send_message',
          data: { to: group_id_bot_fleetmanagement, message: message },
        });
      } else {
        logger.info.whatsapp('data kosong');
      }
      return { success: false, message: 'No data found' };
    } catch (error) {
      logger.error.whatsapp('Error fetching data:', error);
      return { success: false, message: 'Error fetching data:' + error };
    }
  }

  // end fleet management

  async sendImageWithCaption(sock, noWa, imagePath, caption) {
    try {
      const absoluteImagePath = path.join(
        process.cwd(),
        'src',
        'web',
        'public',
        'assets',
        'images',
        imagePath
      );

      if (!fs.existsSync(absoluteImagePath)) {
        logger.error.whatsapp(`Image file not found: ${absoluteImagePath}`);
        throw new Error(`Image file not found: ${absoluteImagePath}`);
      }

      const imageBuffer = fs.readFileSync(absoluteImagePath);

      await sock.sendMessage(noWa, {
        image: imageBuffer,
        caption: caption,
      });
    } catch (error) {
      logger.error.whatsapp('Error sending image with caption:', error);
      await sock.sendMessage(noWa, {
        text: 'Sorry, there was an error sending the image.',
      });
    }
  }

  // functiopn update status online bot
  async updatePCStatus() {
    try {
      const response = await axios.post(
        'https://qc-apps.srs-ssms.com/api/updatestatusbot',
        {
          pc_id: 'pc_ho',
          status: 'online',
        }
      );
      logger.info.whatsapp('Status updated:', response.data);
      return { success: true, message: 'Status updated' };
    } catch (error) {
      logger.error.whatsapp('Error updating status:', error);
      return { success: false, message: 'Error updating status:' + error };
    }
  }

  // bot management gudang
  async botmanagementgudang() {
    try {
      const response = await axios.get(url.url_get_order_gudang, {
        params: this.credentials,
      });

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
            global.queue.push({
              type: 'send_message',
              data: {
                to: itemdata.nomor_hp_atasan_pemilik + '@s.whatsapp.net',
                message: message,
              },
            });
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
            global.queue.push({
              type: 'send_message',
              data: {
                to: itemdata.nomor_hp_atasan_pemilik + '@s.whatsapp.net',
                message: message,
              },
            });
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
            global.queue.push({
              type: 'send_message',
              data: {
                to: itemdata.nomor_hp_atasan_pemilik + '@s.whatsapp.net',
                message: message,
              },
            });
          } else {
            logger.info.whatsapp('tidak ada data sesuai bot management gudang');
          }
        }

        return {
          success: true,
          message: 'Permintaan bot management gudang berhasil dikirim',
        };
      } else {
        logger.info.whatsapp('Data kosong management gudang');
        return { success: false, message: 'No data found' };
      }
    } catch (error) {
      logger.error.whatsapp('Error management gudang:', error);
      return { success: false, message: 'Error fetching data:' + error };
    }
  }

  async handleBotManagementGudang_requested(eventData) {
    if (!eventData || !eventData.data || !eventData.data.bot_data) {
      logger.info.whatsapp('Event data, data, or bot_data is undefined.');
      return;
    }
    const dataitem = eventData.data.bot_data;
    if (!dataitem.nama_atasan_pemilik) {
      logger.info.whatsapp('nama_atasan_pemilik is undefined.');
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
    global.queue.push({
      type: 'send_message',
      data: { to: dataitem.send_to + '@s.whatsapp.net', message: message },
    });
    try {
      const response = await axios.post(
        url.url_change_status_bot_management_gudang,
        {
          id: dataitem.id_data,
          type: 'send_to_pemilik',
          email: 'j',
          password: 'j',
        }
      );
      let responses = response.data;
      logger.info.whatsapp('Response:', responses);
      return {
        success: true,
        message: 'Permintaan bot management gudang berhasil dikirim',
      };
    } catch (error) {
      logger.error.whatsapp('Error approving:', error);
      return { success: false, message: 'Error approving:' + error };
    }
  }

  async handleBotManagementGudang_approved(eventData) {
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
    global.queue.push({
      type: 'send_message',
      data: { to: dataitem.send_to + '@s.whatsapp.net', message: message },
    });
    try {
      const response = await axios.post(
        url.url_change_status_bot_management_gudang,
        {
          email: 'j',
          password: 'j',
          id: dataitem.id_data,
          type: 'else',
        }
      );
      let responses = response.data;
      logger.info.whatsapp('Response:', responses);
      return {
        success: true,
        message: 'Permintaan bot management gudang berhasil dikirim',
      };
    } catch (error) {
      logger.error.whatsapp('Error approving:', error);
      return { success: false, message: 'Error approving:' + error };
    }
  }

  async handleBotManagementGudang_rejected(eventData) {
    if (!eventData || !eventData.data || !eventData.data.bot_data) {
      logger.info.whatsapp('Event data, data, or bot_data is undefined.');
      return;
    }
    const dataitem = eventData.data.bot_data;
    if (!dataitem.nama_atasan_pemilik) {
      logger.info.whatsapp('nama_atasan_pemilik is undefined.');
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
    global.queue.push({
      type: 'send_message',
      data: { to: dataitem.send_to + '@s.whatsapp.net', message: message },
    });
    try {
      const response = await axios.post(
        url.url_change_status_bot_management_gudang,
        {
          email: 'j',
          password: 'j',
          id: dataitem.id_data,
          type: 'else',
        }
      );
      let responses = response.data;
      logger.info.whatsapp('Response:', responses);
      return {
        success: true,
        message: 'Permintaan bot management gudang berhasil dikirim',
      };
    } catch (error) {
      logger.error.whatsapp('Error approving management gudang:', error);
      return { success: false, message: 'Error approving:' + error };
    }
  }

  async handlePython(eventData) {
    group_id = groups.handlePython;
    hourMissing = eventData.date;
    lokasiCCTV = eventData.location;
    fileName = eventData.fileName;
    const fs = require('fs');
    const axios = require('axios');
    let message = `Tidak ada aktivitas di *${lokasiCCTV}* pada  *${hourMissing}*`;
    try {
      const response = await axios.get(
        url.url_get_screenshot_file + `?filename=${fileName}`
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
  }
}

module.exports = GeneralProgram;
