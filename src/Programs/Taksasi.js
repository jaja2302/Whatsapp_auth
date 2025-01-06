const axios = require('axios');
const { DateTime } = require('luxon');
const logger = require('../services/logger');
const pusherService = require('../services/pusher');
const puppeteer = require('puppeteer');
const settings = require('../web/data/settings.json');
const cronjobSettings = require('../services/CronJobSettings');
class TaksasiProgram {
  constructor() {
    this.running = false;
    this.CHANNEL_NAME = 'my-channel';
    this.EVENT_NAME = 'taksasinotification'; // event name untuk taksasi
    this.pusherWatcher = null;
    if (!global.queue) {
      global.queue = require('../services/queue');
    }
  }

  static async init() {
    try {
      logger.info.taksasi('Initializing taksasi program');
      const instance = new TaksasiProgram();
      await global.queue.init();
      return instance;
    } catch (error) {
      logger.error.taksasi('Error initializing taksasi program:', error);
      throw error;
    }
  }

  start() {
    if (!this.running) {
      this.running = true;

      this.pusherWatcher = pusherService.getDataPusher(
        this.CHANNEL_NAME,
        this.EVENT_NAME,
        'taksasi',
        (data) => {
          if (!this.running) {
            logger.info.taksasi('Ignoring event: Program is stopped');
            return;
          }
          logger.info.taksasi('Received taksasi notification:', data);
          this.handleTaksasiNotification(data);
        }
      );

      logger.info.taksasi('Taksasi program started');
    }
  }

  stop() {
    if (this.running) {
      this.running = false;
      if (this.pusherWatcher) {
        this.pusherWatcher.stop();
        this.pusherWatcher = null;
      }
      logger.info.taksasi('Taksasi program stopped');
    }
  }

  getLocalDateTime() {
    try {
      const jakartaTime = DateTime.now().setZone('Asia/Jakarta');
      return jakartaTime.toFormat('yyyy-LL-dd');
    } catch (error) {
      logger.error.taksasi('Error getting local datetime:', error);
      return null;
    }
  }

  async generatemapstaksasi(est, datetime) {
    let attempts = 0;
    let uploadSuccess = false;

    while (attempts < 2 && !uploadSuccess) {
      try {
        const browser = await puppeteer.launch({
          headless: true,
        });
        const page = await browser.newPage();

        page.on('console', (msg) => {
          if (msg.text() === 'Upload successfully gan') {
            uploadSuccess = true;
          }
        });

        await page.goto(
          `https://management.srs-ssms.com/api/generateMaps/${est}/${datetime}`
        );
        await page.title();

        await new Promise((resolve) => setTimeout(resolve, 10000));

        await page.close();
        await browser.close();

        if (uploadSuccess) {
          return {
            status: 200,
            message: `Maps berhasil generate untuk ${est}`,
          };
        }

        attempts++;
      } catch (error) {
        logger.error.taksasi(`Attempt ${attempts + 1} failed:`, error);
        attempts++;
      }
    }

    return {
      status: 500,
      message: 'Maps gagal generate',
    };
  }

  async sendtaksasiest(estate, group_id, taskid, tanggal) {
    try {
      const newdate =
        tanggal === 'null' || tanggal === null
          ? this.getLocalDateTime()
          : tanggal;

      await this.generatemapstaksasi(estate, newdate);

      try {
        const { data: responseData } = await axios.get(
          `https://management.srs-ssms.com/api/exportPdfTaksasiNew/${estate}/${newdate}`
        );

        if (responseData.base64_pdf) {
          const pdfBuffer = Buffer.from(responseData.base64_pdf, 'base64');
          const pdfFilename = `Rekap Taksasi ${estate} ${newdate}.pdf`;
          let captions = `Dikirim oleh ROBOT,jangan balas pesan\n`;

          global.queue.push({
            type: 'send_document',
            data: {
              to: group_id,
              filename: pdfFilename,
              document: pdfBuffer,
              caption: captions,
            },
          });

          if (taskid !== null && taskid !== 'null') {
            const apiUrl = 'https://qc-apps.srs-ssms.com/api/recordcronjob';
            const formData = new FormData();
            formData.append('est', estate);
            const dateTime = DateTime.now().setZone('Asia/Jakarta').toISO();
            formData.append('datetime', dateTime);
            formData.append('id', taskid);
            await axios.post(apiUrl, formData);
          }

          return {
            status: 200,
            message: `PDF taksasi ${estate} Berhasil dikirim`,
          };
        } else {
          return {
            status: 404,
            message: `PDF taksasi Tidak Ditemukan`,
          };
        }
      } catch (error) {
        logger.error.taksasi('Error sending PDF:', error);
        return {
          status: 500,
          message: `Error sending PDF: ${error.message}`,
        };
      }
    } catch (error) {
      return {
        status: 500,
        message: 'Gagal mengirim taksasi',
      };
    }
  }

  async sendfailcronjob() {
    try {
      // const apiUrl = 'http://qc-apps2.test/api/checkcronjob';
      const apiUrl = 'https://qc-apps.srs-ssms.com/api/checkcronjob';
      const response = await axios.get(apiUrl);

      let data = response.data.cronfail;
      logger.info.taksasi('Cronjob fail:', data);
      // console.log(data);
      // if (data.length === 0) {
      //   return {
      //     status: 200,
      //     message: 'TIdak ada Fail Cronjob',
      //   };
      // } else {
      //   for (const task of data) {
      //     try {
      //       await sendtaksasiest(
      //         task.estate,
      //         task.group_id,
      //         'null',
      //         sock,
      //         task.id,
      //         'null'
      //       );
      //       // Task completed successfully
      //     } catch (error) {
      //       // Handle error here if needed
      //       console.log(error);
      //       return {
      //         status: 500,
      //         message: 'Mengirim fail Cronjob gagal',
      //       };
      //     }
      //   }
      // }
      return {
        status: 200,
        message: 'Menggirim Fail Cronjob Berhasil',
      };
    } catch (error) {
      return {
        status: 500,
        message: 'Mengirim fail Cronjob gagal',
      };
    }
  }

  async handleTaksasiNotification(data) {
    logger.info.taksasi('Processing taksasi notification:', data);
    // const groups = cronjobSettings.getSettings('taksasi.groups') || {};
    // for (const itemdata of data.data) {
    //   const targetGroup = this.getTargetGroup(itemdata.mill, groups);
    // }
    // Implement notification handling logic here
    // This will depend on the structure of your taksasi notifications
  }
}

module.exports = TaksasiProgram;
