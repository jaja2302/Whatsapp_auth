const cronJobRunner = require('../../services/CronJobRunner');
const cronJobSettings = require('../../services/CronJobSettings');
const logger = require('../../services/logger');

class TaksasiController {
  constructor(io) {
    this.io = io;
  }

  async getCronSettings(req, res) {
    try {
      const program = 'taksasi';
      const settings = await cronJobSettings.loadSettings(program);
      const intervals = cronJobSettings.getAvailableIntervals();
      const cronSettings = settings.cronjobs || {};

      logger.info.taksasi('Cron settings fetched successfully');
      res.json({
        success: true,
        data: {
          settings: cronSettings,
          intervals,
        },
      });
    } catch (error) {
      logger.error.taksasi('Error getting cron settings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateCronSettings(req, res) {
    try {
      const { sendfailcronjob } = req.body;

      if (!sendfailcronjob) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
        });
      }

      const currentSettings = await cronJobSettings.loadSettings('taksasi');
      const updatedSettings = {
        ...currentSettings,
        cronjobs: {
          ...currentSettings.cronjobs,
          sendfailcronjob: sendfailcronjob,
        },
      };

      await cronJobSettings.updateSettings('taksasi', updatedSettings);
      await cronJobRunner.updateJobSchedule(
        'taksasi',
        'sendfailcronjob',
        sendfailcronjob
      );

      logger.info.taksasi('Cron settings updated successfully');
      res.json({
        success: true,
        message: 'Cron settings updated and applied successfully',
      });
    } catch (error) {
      logger.error.taksasi('Error updating cron settings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getCronJobStatus(req, res) {
    try {
      const status = await cronJobRunner.getProgramJobStatus('taksasi');
      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error.taksasi('Error getting taksasi cron job status:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async startJob(req, res) {
    try {
      const { jobName } = req.params;
      await cronJobRunner.startJob('taksasi', jobName);
      logger.info.taksasi(`Job ${jobName} started successfully`);
      res.json({
        success: true,
        message: `Job ${jobName} started successfully`,
      });
    } catch (error) {
      logger.error.taksasi(`Error starting job ${req.params.jobName}:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async stopJob(req, res) {
    try {
      const { jobName } = req.params;
      await cronJobRunner.stopJob('taksasi', jobName);
      logger.info.taksasi(`Job ${jobName} stopped successfully`);
      res.json({
        success: true,
        message: `Job ${jobName} stopped successfully`,
      });
    } catch (error) {
      logger.error.taksasi(`Error stopping job ${req.params.jobName}:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = TaksasiController;
