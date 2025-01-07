const cronJobRunner = require('../../services/CronJobRunner');
const cronJobSettings = require('../../services/CronJobSettings');
const logger = require('../../services/logger');

class IzinKebunController {
  constructor(io) {
    this.io = io;
    this.program = null;
  }

  setProgram(program) {
    this.program = program;
  }

  async getCronSettings(req, res) {
    try {
      const settings = await cronJobSettings.loadSettings('izinkebun');
      const intervals = cronJobSettings.getAvailableIntervals();
      const cronSettings = settings.cronjobs || {};

      logger.info.izinkebun('Izin Kebun cron settings fetched successfully');
      res.json({
        success: true,
        data: {
          settings: cronSettings,
          intervals,
        },
      });
    } catch (error) {
      logger.error.izinkebun('Error getting cron settings:', error);
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

      const currentSettings = await cronJobSettings.loadSettings('izinkebun');
      const updatedSettings = {
        ...currentSettings,
        cronjobs: {
          ...currentSettings.cronjobs,
          [jobName]: schedule,
        },
      };

      await cronJobSettings.updateSettings('izinkebun', updatedSettings);
      await cronJobRunner.updateJobSchedule('izinkebun', jobName, schedule);

      logger.info.izinkebun('Izin Kebun cron settings updated successfully');
      res.json({
        success: true,
        message: 'Cron settings updated and applied successfully',
      });
    } catch (error) {
      logger.error.izinkebun('Error updating cron settings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getCronJobStatus(req, res) {
    try {
      const status = await cronJobRunner.getProgramJobStatus('izinkebun');
      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error.izinkebun('Error getting cron job status:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async startJob(req, res) {
    try {
      const { jobName } = req.params;
      await cronJobRunner.startJob('izinkebun', jobName);
      logger.info.izinkebun(`Job ${jobName} started successfully`);
      res.json({
        success: true,
        message: `Job ${jobName} started successfully`,
      });
    } catch (error) {
      logger.error.izinkebun(
        `Error starting job ${req.params.jobName}:`,
        error
      );
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async stopJob(req, res) {
    try {
      const { jobName } = req.params;
      await cronJobRunner.stopJob('izinkebun', jobName);
      logger.info.izinkebun(`Job ${jobName} stopped successfully`);
      res.json({
        success: true,
        message: `Job ${jobName} stopped successfully`,
      });
    } catch (error) {
      logger.error.izinkebun(
        `Error stopping job ${req.params.jobName}:`,
        error
      );
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = IzinKebunController;
