const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class CronJobSettings {
  constructor() {
    this.settingsPath = path.join(__dirname, '../web/data/settings.json');
    this.settings = {
      timezone: 'Asia/Jakarta',
      grading: {
        runJobsMill: '*/5 * * * *', // Every 5 minutes
        getMillData: '*/5 * * * *', // Every 5 minutes
      },
    };
    this.intervals = {
      '5 minutes': '*/5 * * * *',
      '10 minutes': '*/10 * * * *',
      '15 minutes': '*/15 * * * *',
      '30 minutes': '*/30 * * * *',
      '1 hour': '0 * * * *',
      '2 hours': '0 */2 * * *',
      '3 hours': '0 */3 * * *',
      '4 hours': '0 */4 * * *',
      '6 hours': '0 */6 * * *',
      '12 hours': '0 */12 * * *',
      '24 hours': '0 0 * * *',
    };
    this.timezones = [
      'Asia/Jakarta',
      'Asia/Singapore',
      'Asia/Kuala_Lumpur',
      'UTC',
    ];
  }

  async loadSettings() {
    try {
      const data = await fs.readFile(this.settingsPath, 'utf8');
      this.settings = JSON.parse(data);
      logger.info.grading('Settings loaded successfully');
    } catch (error) {
      if (error.code === 'ENOENT') {
        // If file doesn't exist, create it with default settings
        await this.saveSettings(this.settings);
        logger.info.grading('Created new settings file with defaults');
      } else {
        logger.error.grading('Error loading settings:', error);
        throw error;
      }
    }
  }

  async saveSettings(settings) {
    try {
      await fs.writeFile(this.settingsPath, JSON.stringify(settings, null, 2));
      this.settings = settings;
      logger.info.grading('Settings saved successfully');
    } catch (error) {
      logger.error.grading('Error saving settings:', error);
      throw error;
    }
  }

  getSettings(program) {
    return this.settings[program] || {};
  }

  getAvailableIntervals() {
    return this.intervals;
  }

  getAvailableTimezones() {
    return this.timezones;
  }

  async updateSettings(path, newSettings) {
    try {
      await this.loadSettings();

      // Handle nested paths (e.g., 'grading.groups')
      const parts = path.split('.');
      let current = this.settings;

      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }

      current[parts[parts.length - 1]] = newSettings;

      await this.saveSettings(this.settings);
      return current[parts[parts.length - 1]];
    } catch (error) {
      logger.error.grading('Error updating settings:', error);
      throw error;
    }
  }

  isValidCronPattern(pattern) {
    // Check if pattern is one of our predefined intervals
    return Object.values(this.intervals).includes(pattern);
  }
}

// Create singleton instance
const cronJobSettings = new CronJobSettings();

// Initialize settings on startup
cronJobSettings.loadSettings().catch((error) => {
  logger.error.grading('Error initializing settings:', error);
});

module.exports = cronJobSettings;
