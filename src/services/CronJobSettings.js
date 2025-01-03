const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const { log } = require('console');

class CronJobSettings {
  constructor() {
    this.settingsPath = path.join(__dirname, '../web/data/settings.json');
    this.settings = {};
    this.intervals = {
      '1 minute': '*/1 * * * *',
      '5 minutes': '*/5 * * * *',
      '10 minutes': '*/10 * * * *',
      '15 minutes': '*/15 * * * *',
      '30 minutes': '*/30 * * * *',
      '1 hour': '0 * * * *',
      '2 hours': '0 */2 * * *',
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

  async loadSettings(program) {
    try {
      const data = await fs.readFile(this.settingsPath, 'utf8');
      this.settings = JSON.parse(data);

      // Log the specific program settings
      // console.log(this.settings[program]);

      logger.info.whatsapp(`Settings for ${program} loaded successfully`);

      // Return the settings for the given program, or an empty object if not found
      return this.settings[program] || {};
    } catch (error) {
      if (error.code === 'ENOENT') {
        await this.saveSettings(program, {});
        logger.info.whatsapp(
          `Created new settings file with defaults for ${program}`
        );
        return {};
      } else {
        logger.error.whatsapp(`Error loading settings for ${program}:`, error);
        throw error;
      }
    }
  }

  async saveSettings(program, settings) {
    try {
      await this.loadSettings(); // Ensure settings are loaded
      this.settings[program] = settings;
      await fs.writeFile(
        this.settingsPath,
        JSON.stringify(this.settings, null, 2)
      );
      logger.info.grading(`Settings for ${program} saved successfully`);
    } catch (error) {
      logger.error.grading(`Error saving settings for ${program}:`, error);
      throw error;
    }
  }

  async updateSettings(program, newSettings) {
    try {
      const currentSettings = await this.loadSettings(program);
      const updatedSettings = {
        ...currentSettings,
        ...newSettings,
      };
      await this.saveSettings(program, updatedSettings);
      return updatedSettings;
    } catch (error) {
      logger.error.grading(`Error updating settings for ${program}:`, error);
      throw error;
    }
  }

  getAvailableIntervals() {
    return this.intervals;
  }

  getAvailableTimezones() {
    return this.timezones;
  }

  isValidCronPattern(pattern) {
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
