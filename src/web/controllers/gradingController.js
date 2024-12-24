const GradingProgram = require('../../Programs/Grading');
const cronJobSettings = require('../../services/CronJobSettings');
const logger = require('../../services/logger');

class GradingController {
  constructor(io) {
    this.io = io;
  }

  async fetchMillData(req, res) {
    try {
      await GradingProgram.getMillData();
      res.json({ success: true, message: 'Mill data fetch initiated' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getMillStatus(req, res) {
    try {
      const status = await GradingProgram.runJobsMill();
      res.json({ success: true, data: status });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateCronSettings(req, res) {
    try {
      // Add logging to debug request body
      logger.info('Received request body:', req.body);

      // Handle case where req.body might be undefined
      const settings = req.body || {};
      const { timezone, ...newSettings } = settings;

      logger.info('Updating cron settings with:', newSettings);

      // Update timezone if provided
      if (timezone) {
        await cronJobSettings.updateSettings('timezone', timezone);
      }

      // Update grading settings if we have any
      if (Object.keys(newSettings).length > 0) {
        await cronJobSettings.updateSettings('grading', newSettings);
      }

      // Reinitialize cron jobs
      await GradingProgram.init();

      logger.info('Cron settings updated successfully');

      res.json({
        success: true,
        message: 'Cron settings updated successfully',
      });
    } catch (error) {
      logger.error('Error updating cron settings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getCronSettings(req, res) {
    try {
      // Reload settings from file
      await cronJobSettings.loadSettings();

      const settings = cronJobSettings.getSettings('grading');
      const intervals = cronJobSettings.getAvailableIntervals();
      const timezones = cronJobSettings.getAvailableTimezones();

      res.json({
        success: true,
        data: {
          settings,
          intervals,
          timezones,
          timezone: cronJobSettings.settings.timezone,
        },
      });
    } catch (error) {
      logger.error('Error getting cron settings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = GradingController;
