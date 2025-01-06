const cronJobRunner = require('../../services/CronJobRunner');
const cronJobSettings = require('../../services/CronJobSettings');
const logger = require('../../services/logger');
const IotProgram = require('../../Programs/Iot');
const iotProgram = new IotProgram();

class IotController {
  constructor(io) {
    this.io = io;
  }

  async getCronSettings(req, res) {
    try {
      const settings = await cronJobSettings.loadSettings('iot');
      const intervals = cronJobSettings.getAvailableIntervals();
      const timezones = cronJobSettings.getAvailableTimezones();

      const cronSettings = settings.cronjobs || {};

      logger.info.iot('Cron settings fetched successfully');
      res.json({
        success: true,
        data: {
          settings: cronSettings,
          intervals,
          timezones,
          timezone: settings.timezone,
        },
      });
    } catch (error) {
      logger.error.iot('Error getting cron settings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateCronSettings(req, res) {
    try {
      const {
        get_iot_weatherstation,
        get_iot_weatherstation_data_gap,
        get_data_harian_aws,
        timezone,
      } = req.body;

      const currentSettings = await cronJobSettings.loadSettings('iot');
      const updatedSettings = {
        ...currentSettings,
        timezone: timezone,
        cronjobs: {
          ...currentSettings.cronjobs,
          get_iot_weatherstation,
          get_iot_weatherstation_data_gap,
          get_data_harian_aws,
        },
      };

      await cronJobSettings.updateSettings('iot', updatedSettings);

      // Update schedules
      await cronJobRunner.updateJobSchedule(
        'iot',
        'get_iot_weatherstation',
        get_iot_weatherstation
      );
      await cronJobRunner.updateJobSchedule(
        'iot',
        'get_iot_weatherstation_data_gap',
        get_iot_weatherstation_data_gap
      );
      await cronJobRunner.updateJobSchedule(
        'iot',
        'get_data_harian_aws',
        get_data_harian_aws
      );

      logger.info.iot('Cron settings updated successfully');
      res.json({
        success: true,
        message: 'Cron settings updated and applied successfully',
      });
    } catch (error) {
      logger.error.iot('Error updating cron settings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getCronJobStatus(req, res) {
    try {
      const status = await cronJobRunner.getProgramJobStatus('iot');
      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error.iot('Error getting IOT cron job status:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async startJob(req, res) {
    try {
      const { jobName } = req.params;
      await cronJobRunner.startJob('iot', jobName);
      logger.info.iot(`Job ${jobName} started successfully`);
      res.json({
        success: true,
        message: `Job ${jobName} started successfully`,
      });
    } catch (error) {
      logger.error.iot(`Error starting job ${req.params.jobName}:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async stopJob(req, res) {
    try {
      const { jobName } = req.params;
      await cronJobRunner.stopJob('iot', jobName);
      logger.info.iot(`Job ${jobName} stopped successfully`);
      res.json({
        success: true,
        message: `Job ${jobName} stopped successfully`,
      });
    } catch (error) {
      logger.error.iot(`Error stopping job ${req.params.jobName}:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async fetchWeatherData(req, res) {
    try {
      const response = await iotProgram.get_iot_weatherstation();

      if (response.error) {
        return res.status(400).json({
          success: false,
          message: response.message || 'IOT program error',
        });
      }

      res.json({ success: true, message: response });
    } catch (error) {
      logger.error.iot('Error fetching weather data:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = IotController;
