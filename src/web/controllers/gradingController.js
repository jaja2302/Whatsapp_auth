const cronJobSettings = require('../../services/CronJobSettings');
const logger = require('../../services/logger');
const GradingProgram = require('../../Programs/Grading');
const gradingProgram = new GradingProgram();
class GradingController {
  constructor(io) {
    this.io = io;
    this.gradingProgram = null;
  }

  async fetchMillData(req, res) {
    try {
      const data = await gradingProgram.getMillData();
      res.json(data);
    } catch (error) {
      // logger.error.grading('Error fetching mill data: ada', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateCronSettings(req, res) {
    try {
      const settings = req.body || {};
      const { timezone, ...newSettings } = settings;

      if (timezone) {
        await cronJobSettings.updateSettings('timezone', timezone);
      }

      if (Object.keys(newSettings).length > 0) {
        await cronJobSettings.updateSettings('grading', newSettings);
      }

      res.json({
        success: true,
        message: 'Cron settings updated successfully',
      });
    } catch (error) {
      logger.error.grading('Error updating cron settings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getCronSettings(req, res) {
    try {
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
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateGroupSettings(req, res) {
    try {
      const { groups } = req.body;
      await cronJobSettings.updateSettings('grading.groups', groups);
      res.json({
        success: true,
        message: 'Group settings updated successfully',
        data: groups,
      });
    } catch (error) {
      logger.error.grading('Error updating group settings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getGroupSettings(req, res) {
    try {
      const settings = cronJobSettings.getSettings('grading');
      res.json({
        success: true,
        data: settings.groups || {},
      });
    } catch (error) {
      logger.error.grading('Error getting group settings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = GradingController;
