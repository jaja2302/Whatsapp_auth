const cron = require('node-cron');
const axios = require('axios');
const cronJobSettings = require('../services/CronJobSettings');
const logger = require('../services/logger');
const { channel } = require('../services/pusher');
const settings = require('../web/data/settings.json');
const credentials = settings.grading.credentials;
const groups = settings.grading.groups;

class GradingProgram {
  constructor() {
    this.runJobsSchedule = null;
    this.getDataSchedule = null;
    this.initBroadcastListener();
    if (!global.queue) {
      global.queue = require('../services/queue');
    }
  }

  static async init() {
    try {
      logger.info.grading('Initializing grading program');
      const instance = new GradingProgram();
      await global.queue.init();
      await instance.initCronJobs();
      return instance;
    } catch (error) {
      logger.error.grading('Error initializing grading program:', error);
      throw error;
    }
  }

  async initCronJobs() {
    // Stop existing cron jobs if they exist
    if (this.runJobsSchedule) {
      this.runJobsSchedule.stop();
    }
    if (this.getDataSchedule) {
      this.getDataSchedule.stop();
    }

    const settings = cronJobSettings.getSettings('grading');
    const timezone = cronJobSettings.settings.timezone || 'Asia/Jakarta';

    this.runJobsSchedule = cron.schedule(
      settings.runJobsMill,
      async () => {
        try {
          await this.runJobsMill();
        } catch (error) {
          logger.error.grading('Error in runJobsMill cron:', error);
        }
      },
      {
        scheduled: true,
        timezone,
      }
    );

    this.getDataSchedule = cron.schedule(
      settings.getMillData,
      async () => {
        try {
          await this.getMillData();
        } catch (error) {
          logger.error.grading('Error in getMillData cron:', error);
        }
      },
      {
        scheduled: true,
        timezone,
      }
    );

    logger.info.grading('Cron jobs initialized successfully');
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

      // if (id_jobs.length > 0 && pdf_name.length > 0) {
      //   await this.updateDataMill({ id: id_jobs, pdf_name, image_name });
      // }

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

  async updateDataMill(data) {
    try {
      logger.info.grading('Updating mill data...');
      const response = await axios.post(
        'http://erpda.test/api/updatedatamill',
        {
          ...credentials,
          id: data.id,
          pdf_name: data.pdf_name,
          image_name: data.image_name,
        }
      );
      logger.info.grading('Mill data updated successfully');
      return response.data;
    } catch (error) {
      logger.error.grading(
        'Error updating mill data:',
        error.response?.data || error.message
      );
      throw error;
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

  initBroadcastListener() {
    channel.bind('gradingmillpdf', async (data) => {
      logger.info.grading(
        `Broadcast Grading received: ${JSON.stringify(data)}`
      );

      if (data.data && data.data.length > 0) {
        const groups = cronJobSettings.getSettings('grading.groups') || {};

        for (const itemdata of data.data) {
          try {
            const message = this.formatGradingMessage(itemdata);
            const targetGroup = this.getTargetGroup(itemdata.mill);

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
            logger.error.grading('Error in broadcast_grading_mill:', error);
            // If you want to keep the error catching functionality:
            // await catcherror(itemdata.id, 'error_sending_message', 'bot_grading_mill');
          }
        }
      }
    });
  }
}

module.exports = GradingProgram;
