const axios = require('axios');
const cron = require('node-cron');
const logger = require('../services/logger');
const cronJobSettings = require('../services/CronJobSettings');

class GradingProgram {
  constructor() {
    // WhatsApp group IDs
    this.groups = {
      default: '120363164751475851@g.us',
      SYM: '6281397270799-1635156024@g.us',
      SGM: '6282257572112-1635223872@g.us',
      SLM: '6281397270799-1565316655@g.us',
      NBM: '6285655573821-1566449850@g.us',
      MLM: '120363332857987276@g.us',
      NKM: '120363046524351245@g.us',
      SCM: '120363332360538214@g.us',
      SKM: '120363283953366418@g.us',
    };

    this.credentials = {
      email: 'j',
      password: 'j',
    };

    this.runJobsSchedule = null;
    this.getDataSchedule = null;

    // Initialize cron jobs
    this.init();
  }

  async init() {
    await cronJobSettings.init();
    this.initCronJobs();
  }

  initCronJobs() {
    // Stop existing cron jobs if they exist
    if (this.runJobsSchedule) {
      this.runJobsSchedule.stop();
    }
    if (this.getDataSchedule) {
      this.getDataSchedule.stop();
    }

    const settings = cronJobSettings.getSettings('grading');
    const timezone = cronJobSettings.settings.timezone;

    logger.info('Initializing cron jobs with settings:', settings);

    // Run Jobs Mill cron
    this.runJobsSchedule = cron.schedule(
      settings.runJobsMill,
      async () => {
        try {
          logger.info('Running mill jobs cron');
          await this.runJobsMill();
        } catch (error) {
          logger.error('Error in runJobsMill cron:', error);
        }
      },
      {
        scheduled: true,
        timezone,
      }
    );

    // Get Mill Data cron
    this.getDataSchedule = cron.schedule(
      settings.getMillData,
      async () => {
        try {
          logger.info('Running get mill data cron');
          await this.getMillData();
        } catch (error) {
          logger.error('Error in getMillData cron:', error);
        }
      },
      {
        scheduled: true,
        timezone,
      }
    );

    logger.info('Cron jobs initialized successfully');
  }

  // Method to update cron settings
  updateCronSettings(newSettings) {
    this.cronSettings = {
      ...this.cronSettings,
      ...newSettings,
    };
    // Reinitialize cron jobs with new settings
    this.initCronJobs();
  }

  async runJobsMill() {
    try {
      const response = await axios.get(
        'https://management.srs-ssms.com/api/getdatamill',
        { params: this.credentials }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching mill data:', error);
      throw error;
    }
  }

  async getMillData() {
    try {
      const response = await axios.get(
        'https://management.srs-ssms.com/api/getdatamilljobs',
        { params: this.credentials }
      );

      const { data, id_jobs, pdf_name, image_name } = response.data;

      if (!data || data.length === 0) {
        console.log('No mill data available to process');
        return;
      }

      for (const itemdata of data) {
        const message = this.formatGradingMessage(itemdata);
        const targetGroup = this.groups[itemdata.mill] || this.groups.default;

        try {
          // Add to global queue
          global.queue.push({
            type: 'send_image',
            data: {
              to: targetGroup,
              image: itemdata.collage_url,
              caption: message,
            },
          });

          global.queue.push({
            type: 'send_document',
            data: {
              to: targetGroup,
              document: itemdata.pdf_url,
              filename: `${itemdata.tanggal_judul}(${itemdata.waktu_grading_judul})-Grading ${itemdata.mill}-${itemdata.estate}${itemdata.afdeling}.pdf`,
              caption: `${itemdata.tanggal_judul}(${itemdata.waktu_grading_judul})-Grading ${itemdata.mill}-${itemdata.estate}${itemdata.afdeling}.pdf`,
            },
          });
        } catch (error) {
          // You'll need to implement or import catcherror
          await catcherror(
            itemdata.id,
            'error_sending_message',
            'bot_grading_mill'
          );
        }
      }

      if (id_jobs.length > 0 && pdf_name.length > 0) {
        global.queue.push({
          type: 'update_data_mill',
          data: { id: id_jobs, pdf_name, image_name },
        });
      }
    } catch (error) {
      console.log('Error fetching data:', error);
    }
  }

  formatGradingMessage(itemdata) {
    // ... [keeping the same formatting logic] ...
    // I'll skip this for brevity, but it should be the same as your original code
  }

  async updateDataMill(data) {
    try {
      const response = await axios.post(
        'https://management.srs-ssms.com/api/updatedatamill',
        {
          ...this.credentials,
          id: data.id,
          pdf_name: data.pdf_name,
          image_name: data.image_name,
        }
      );
      console.log('Cleanup successful:', response.data);
    } catch (updateError) {
      console.error('Error cleaning up data:', updateError);
      throw updateError;
    }
  }
}

module.exports = new GradingProgram();
