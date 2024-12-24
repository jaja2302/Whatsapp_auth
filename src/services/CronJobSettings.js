const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class CronJobSettings {
  constructor() {
    this.settings = {};
    this.configPath = path.join(
      __dirname,
      '../../config/cronjob-settings.json'
    );

    // Default intervals for selection
    this.availableIntervals = {
      '1min': '*/1 * * * *',
      '5min': '*/5 * * * *',
      '10min': '*/10 * * * *',
      '15min': '*/15 * * * *',
      '30min': '*/30 * * * *',
      '1hour': '0 * * * *',
      '2hours': '0 */2 * * *',
      '4hours': '0 */4 * * *',
      '6hours': '0 */6 * * *',
      '12hours': '0 */12 * * *',
      daily: '0 0 * * *',
    };

    // Default timezones
    this.availableTimezones = [
      'Asia/Jakarta',
      'Asia/Makassar',
      'Asia/Jayapura',
    ];
  }

  async init() {
    await this.loadSettings();
  }

  async loadSettings() {
    try {
      // Check if config file exists
      try {
        await fs.access(this.configPath);
      } catch {
        // If file doesn't exist, create it with default settings
        const defaultSettings = {
          grading: {
            runJobsMill: '*/1 * * * *',
            getMillData: '*/5 * * * *',
          },
          timezone: 'Asia/Jakarta',
        };
        await this.saveSettings(defaultSettings);
      }

      // Read the config file
      const data = await fs.readFile(this.configPath, 'utf8');
      this.settings = JSON.parse(data);
      logger.info('Loaded cron job settings from file');
    } catch (error) {
      logger.error('Error loading settings:', error);
      throw error;
    }
  }

  async saveSettings(settings = this.settings) {
    try {
      // Ensure config directory exists
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });

      // Write settings to file using the provided settings or current settings
      await fs.writeFile(this.configPath, JSON.stringify(settings, null, 2));
      logger.info('Saved cron job settings to file');
    } catch (error) {
      logger.error('Error saving settings:', error);
      throw error;
    }
  }

  async updateSettings(program, newSettings) {
    try {
      // Load latest settings from file
      await this.loadSettings();

      // Update settings
      this.settings[program] = {
        ...this.settings[program],
        ...newSettings,
      };

      // Save to file
      await this.saveSettings(this.settings);

      logger.info(`Updated ${program} settings:`, this.settings[program]);

      return this.settings[program];
    } catch (error) {
      logger.error('Error updating settings:', error);
      throw error;
    }
  }

  getSettings(program) {
    return this.settings[program] || {};
  }

  getAvailableIntervals() {
    return this.availableIntervals;
  }

  getAvailableTimezones() {
    return this.availableTimezones;
  }
}

// Create and export a single instance
const cronJobSettings = new CronJobSettings();
module.exports = cronJobSettings;
