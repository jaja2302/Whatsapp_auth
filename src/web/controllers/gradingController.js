const cronJobRunner = require('../../services/CronJobRunner');
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
      logger.info.grading('Mill data fetched successfully:', data);
      res.json(data);
    } catch (error) {
      // logger.error.grading('Error fetching mill data: ada', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getCronSettings(req, res) {
    try {
      const program = 'grading';
      const settings = await cronJobSettings.loadSettings(program);

      const intervals = cronJobSettings.getAvailableIntervals();
      const timezones = cronJobSettings.getAvailableTimezones();

      // Mengambil cronjobs dari settings
      const cronSettings = settings.cronjobs || {};

      logger.info.grading('Cron settings fetched successfully');
      res.json({
        success: true,
        data: {
          settings: cronSettings, // Mengirim cronjobs settings
          intervals,
          timezones,
          timezone: settings.timezone,
        },
      });
    } catch (error) {
      logger.error.grading('Error getting cron settings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
  async getGroupSettings(req, res) {
    try {
      const program = 'grading';
      const settings = await cronJobSettings.loadSettings(program);

      res.json({
        success: true,
        data: settings.groups || {},
      });
      logger.info.grading('Group settings fetched successfully');
    } catch (error) {
      logger.error.grading('Error getting group settings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateCronSettings(req, res) {
    try {
      const { runJobsMill, getMillData, timezone } = req.body;

      if (!runJobsMill || !getMillData || !timezone) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
        });
      }

      // Fetch current settings
      const currentSettings = await cronJobSettings.loadSettings('grading');

      // Update the settings with new values
      const updatedSettings = {
        ...currentSettings,
        timezone: timezone,
        cronjobs: {
          ...currentSettings.cronjobs,
          runJobsMill: runJobsMill,
          getMillData: getMillData,
        },
      };

      // Save the updated settings
      await cronJobSettings.updateSettings('grading', updatedSettings);

      // Langsung update schedule untuk setiap job yang diubah
      await cronJobRunner.updateJobSchedule(
        'grading',
        'runJobsMill',
        runJobsMill
      );
      await cronJobRunner.updateJobSchedule(
        'grading',
        'getMillData',
        getMillData
      );

      logger.info.grading('Cron settings updated successfully');
      res.json({
        success: true,
        message: 'Cron settings updated and applied successfully',
      });
    } catch (error) {
      logger.error.grading('Error updating cron settings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateGroupSettings(req, res) {
    try {
      const { groups } = req.body;

      if (!groups || typeof groups !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Invalid groups data.',
        });
      }

      // Fetch existing 'grading' settings
      const currentSettings = await cronJobSettings.getSettings('grading');

      // Replace 'groups' with the new one
      const updatedSettings = {
        ...currentSettings,
        groups, // Replace the entire groups object
      };

      // Update the database
      await cronJobSettings.updateSettings('grading', updatedSettings);

      logger.info.grading('Group settings updated successfully');
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
}

module.exports = GradingController;
