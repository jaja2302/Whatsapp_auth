const cronJobRunner = require('../../services/CronJobRunner');
const cronJobSettings = require('../../services/CronJobSettings');
const logger = require('../../services/logger');

class GeneralController {
  constructor(io) {
    this.io = io;
  }

  async getCronSettings(req, res) {
    try {
      const settings = await cronJobSettings.loadSettings('general');
      const intervals = cronJobSettings.getAvailableIntervals();
      const cronSettings = settings.cronjobs || {};

      logger.info.whatsapp('General cron settings fetched successfully');
      res.json({
        success: true,
        data: {
          settings: cronSettings,
          intervals,
        },
      });
    } catch (error) {
      logger.error.whatsapp('Error getting general cron settings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateCronSettings(req, res) {
    try {
      const { jobName, schedule } = req.body;

      if (!jobName || !schedule) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
        });
      }

      const currentSettings = await cronJobSettings.loadSettings('general');
      const updatedSettings = {
        ...currentSettings,
        cronjobs: {
          ...currentSettings.cronjobs,
          [jobName]: schedule,
        },
      };

      await cronJobSettings.updateSettings('general', updatedSettings);
      await cronJobRunner.updateJobSchedule('general', jobName, schedule);

      logger.info.whatsapp('General cron settings updated successfully');
      res.json({
        success: true,
        message: 'Cron settings updated and applied successfully',
      });
    } catch (error) {
      logger.error.whatsapp('Error updating general cron settings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getCronJobStatus(req, res) {
    try {
      const status = await cronJobRunner.getProgramJobStatus('general');
      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error.whatsapp('Error getting general cron job status:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async startJob(req, res) {
    try {
      const { jobName } = req.params;
      await cronJobRunner.startJob('general', jobName);
      logger.info.whatsapp(`General job ${jobName} started successfully`);
      res.json({
        success: true,
        message: `Job ${jobName} started successfully`,
      });
    } catch (error) {
      logger.error.whatsapp(
        `Error starting general job ${req.params.jobName}:`,
        error
      );
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async stopJob(req, res) {
    try {
      const { jobName } = req.params;
      await cronJobRunner.stopJob('general', jobName);
      logger.info.whatsapp(`General job ${jobName} stopped successfully`);
      res.json({
        success: true,
        message: `Job ${jobName} stopped successfully`,
      });
    } catch (error) {
      logger.error.whatsapp(
        `Error stopping general job ${req.params.jobName}:`,
        error
      );
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = GeneralController;
