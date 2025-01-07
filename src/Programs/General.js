const axios = require('axios');
const cronJobSettings = require('../services/CronJobSettings');
const logger = require('../services/logger');
const pusherService = require('../services/pusher');
const settings = require('../web/data/settings.json');
const credentials = settings.grading.credentials;
const groups = settings.grading.groups;
const { isProgramActive } = require('../utils/programHelper');
const path = require('path');
const fs = require('fs');

class GeneralProgram {
  constructor() {
    this.running = false;
    this.userchoiceSnoozeBotPengawasanOperator = {};
    this.configSnoozeBotPengawasanOperator = {};
    this.timeoutHandles = {};
    this.idgroup = '120363384470022318@g.us';

    if (!global.queue) {
      global.queue = require('../services/queue');
    }

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
      logger.info.whatsapp('General program started');
    }
  }

  stop() {
    if (this.running) {
      this.running = false;
      this.userchoiceSnoozeBotPengawasanOperator = {};
      this.configSnoozeBotPengawasanOperator = {};
      logger.info.whatsapp('General program stopped');
    }
  }

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
}

module.exports = GeneralProgram;
