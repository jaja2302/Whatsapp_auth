const axios = require('axios');
const cronJobSettings = require('../services/CronJobSettings');
const logger = require('../services/logger');
const pusherService = require('../services/pusher');
const settings = require('../web/data/settings.json');
const credentials = settings.grading.credentials;
const groups = settings.grading.groups;

class GradingProgram {
  constructor() {
    this.running = false;
    this.CHANNEL_NAME = 'my-channel';
    this.EVENT_NAME = 'gradingmillpdf'; // event name untuk grading
    this.pusherWatcher = null;
    if (!global.queue) {
      global.queue = require('../services/queue');
    }
  }

  static async init() {
    try {
      logger.info.grading('Initializing grading program');
      const instance = new GradingProgram();
      await global.queue.init();
      return instance;
    } catch (error) {
      logger.error.grading('Error initializing grading program:', error);
      throw error;
    }
  }

  start() {
    if (!this.running) {
      this.running = true;

      this.pusherWatcher = pusherService.getDataPusher(
        this.CHANNEL_NAME,
        this.EVENT_NAME,
        'grading',
        (data) => {
          if (!this.running) {
            logger.info.grading('Ignoring event: Program is stopped');
            return;
          }
          logger.info.grading('Received grading notification:', data);
          this.handleGradingNotification(data);
        }
      );

      logger.info.grading('Grading program started');
    }
  }

  stop() {
    if (this.running) {
      this.running = false;
      if (this.pusherWatcher) {
        this.pusherWatcher.stop();
        this.pusherWatcher = null;
      }
      logger.info.grading('Grading program stopped');
    }
  }

  handleGradingNotification(data) {
    logger.info.grading('Processing grading notification');

    if (data.data && data.data.length > 0) {
      const groups = cronJobSettings.getSettings('grading.groups') || {};

      for (const itemdata of data.data) {
        try {
          const message = this.formatGradingMessage(itemdata);
          const targetGroup = this.getTargetGroup(itemdata.mill, groups);

          if (targetGroup) {
            global.queue.push({
              type: 'send_document',
              data: {
                to: targetGroup,
                document: itemdata.pdf_url,
                filename: `${itemdata.tanggal_judul}(${itemdata.waktu_grading_judul})-Grading ${itemdata.mill}-${itemdata.estate}${itemdata.afdeling}.pdf`,
                caption: message,
              },
            });
          }
        } catch (error) {
          logger.error.grading('Error processing grading item:', error);
        }
      }
    }
  }

  async runJobsMill() {
    try {
      logger.info.grading('Fetching mill data...');
      const credentials =
        cronJobSettings.getSettings('grading.credentials') || {};
      const response = await axios.get('http://erpda.test/api/getdatamill', {
        params: credentials,
      });
      logger.info.grading('Mill data fetched successfully');
      return response.data;
    } catch (error) {
      logger.error.grading(
        'Error fetching mill data:',
        error.response?.data || error.message
      );
      throw error;
    }
  }

  async getMillData() {
    try {
      logger.info.grading('Fetching mill jobs data...');
      const response = await axios.get(
        'http://erpda.test/api/getdatamilljobs',
        {
          params: credentials,
        }
      );

      const { data, id_jobs, pdf_name, image_name } = response.data;

      if (!data || data.length === 0) {
        logger.info.grading('No mill data available to process');
        return { success: true, message: 'No mill data to process' };
      }

      logger.info.grading(`Processing ${data.length} mill data items`);

      if (!global.queue) {
        throw new Error('Message queue is not initialized');
      }

      for (const itemdata of data) {
        const message = this.formatGradingMessage(itemdata);
        const targetGroup = this.getTargetGroup(itemdata.mill, groups);

        if (targetGroup) {
          logger.info.grading(
            `Adding message to queue for group ${targetGroup}`
          );

          if (itemdata.collage_url) {
            global.queue.push({
              type: 'send_image',
              data: {
                to: targetGroup,
                image: itemdata.collage_url,
                caption: message,
              },
            });
          }

          if (itemdata.pdf_url) {
            global.queue.push({
              type: 'send_document',
              data: {
                to: targetGroup,
                document: itemdata.pdf_url,
                filename: `${itemdata.tanggal_judul}(${itemdata.waktu_grading_judul})-Grading ${itemdata.mill}-${itemdata.estate}${itemdata.afdeling}.pdf`,
                caption: `${itemdata.tanggal_judul}(${itemdata.waktu_grading_judul})-Grading ${itemdata.mill}-${itemdata.estate}${itemdata.afdeling}.pdf`,
              },
            });
          }
        } else {
          logger.warn.grading(
            `No target group found for mill: ${itemdata.mill}`
          );
        }
      }

      if (!global.queue.paused) {
        global.queue.processQueue();
      }

      return {
        success: true,
        message: `Successfully processed ${data.length} mill data items`,
      };
    } catch (error) {
      logger.error.grading('Error in getMillData:', error);
      return { success: false, message: error.message };
    }
  }

  getTargetGroup(mill, groups) {
    if (!groups) return '';
    return groups[mill] || groups.default || '';
  }

  formatGradingMessage(itemdata) {
    let message = `*Berikut Hasil Grading Total ${itemdata.estate} ${itemdata.afdeling}*:\n`;
    message += `*Tanggal*: ${itemdata.Tanggal}\n`;
    message += `*Jam*: ${itemdata.waktu_grading}\n`;
    message += `*Ripeness*: ${itemdata.Ripeness} jjg (${itemdata.percentase_ripenes}%)\n`;
    message += `*Unripe*: ${itemdata.Unripe} jjg (${itemdata.persenstase_unripe}%)\n`;
    message += `•0 brondol: ${itemdata.nol_brondol} jjg (${itemdata.persentase_nol_brondol}%)\n`;

    itemdata.pemanen_list_tanpabrondol?.tanpaBrondol_list?.forEach(
      (item, index) => {
        message += `${index + 1}. No. Pemanen : ${item.no_pemanen} = ${item.tanpaBrondol} jjg\n`;
      }
    );

    message += `•< brondol: ${itemdata.kurang_brondol} jjg (${itemdata.persentase_brondol}%)\n`;

    itemdata.pemanen_list_kurangbrondol?.kurangBrondol_list?.forEach(
      (item, index) => {
        message += `${index + 1}. No. Pemanen : ${item.no_pemanen} = ${item.kurangBrondol} jjg\n`;
      }
    );

    message += `*Overripe*:  ${itemdata.Overripe} jjg (${itemdata.persentase_overripe}%)\n`;
    message += `*Empty bunch*: ${itemdata.empty_bunch} jjg (${itemdata.persentase_empty_bunch}%)\n`;
    message += `*Rotten bunch*: ${itemdata.rotten_bunch} jjg (${itemdata.persentase_rotten_bunce}%)\n`;
    message += `*Abnormal*: ${itemdata.Abnormal} jjg (${itemdata.persentase_abnormal}%)\n`;
    message += `*Dirt*: ${itemdata.Dirt} Kg (${itemdata.persentase}%)\n`;
    message += `*Loose Fruit*: ${itemdata.loose_fruit} Kg (${itemdata.persentase_lose_fruit}%)\n\n`;
    message += `Jumlah janjang di Grading: ${itemdata.jjg_grading} jjg\n`;
    message += `Jumlah janjang di SPB: ${itemdata.jjg_spb} jjg\n`;
    message += `Jumlah Selisih janjang: ${itemdata.jjg_selisih} jjg (${itemdata.persentase_selisih}%)\n`;

    if (itemdata.update_by !== null) {
      message += `Laporan diperbaharui\n`;
      message += `*Telah diedit oleh*: ${itemdata.status_edit}\n`;
    }
    message += `Generated by Digital Architect SRS bot`;

    return message;
  }
}

module.exports = GradingProgram;
