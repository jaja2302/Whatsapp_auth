const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const { log } = require('console');

class CronJobSettings {
  constructor() {
    this.settingsPath = path.join(__dirname, '../web/data/settings.json');
    this.settings = {};
    this.intervals = this.generateIntervals();
    this.timezones = [
      'Asia/Jakarta',
      'Asia/Singapore',
      'Asia/Kuala_Lumpur',
      'UTC',
    ];
  }

  generateIntervals() {
    const intervals = {};

    // Add minute-based intervals
    [1, 5, 10, 15, 30].forEach((min) => {
      intervals[`${min} minute${min > 1 ? 's' : ''}`] = `*/${min} * * * *`;
    });

    // Add hour-based intervals
    [1, 2, 4, 6, 12, 24].forEach((hour) => {
      if (hour === 24) {
        intervals[`${hour} hours`] = `0 0 * * *`;
      } else if (hour === 1) {
        intervals[`${hour} hour`] = `0 * * * *`;
      } else {
        intervals[`${hour} hours`] = `0 */${hour} * * *`;
      }
    });

    // Add every hour of the day
    for (let hour = 0; hour < 24; hour++) {
      const formattedHour = hour.toString().padStart(2, '0');
      intervals[`Every day at ${formattedHour}:00`] = `0 ${hour} * * *`;

      // Add half-hour intervals
      intervals[`Every day at ${formattedHour}:30`] = `30 ${hour} * * *`;

      // Add quarter-hour intervals
      intervals[`Every day at ${formattedHour}:15`] = `15 ${hour} * * *`;
      intervals[`Every day at ${formattedHour}:45`] = `45 ${hour} * * *`;
    }

    // Add specific weekday options
    const weekdays = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };

    // Add common business hours for each weekday
    Object.entries(weekdays).forEach(([day, num]) => {
      [9, 10, 11, 13, 14, 15, 16, 17].forEach((hour) => {
        const formattedHour = hour.toString().padStart(2, '0');
        intervals[`Every ${day} at ${formattedHour}:00`] =
          `0 ${hour} * * ${num}`;
        intervals[`Every ${day} at ${formattedHour}:30`] =
          `30 ${hour} * * ${num}`;
      });
    });

    // Add first day of month options
    [0, 6, 9, 12, 15, 18].forEach((hour) => {
      const formattedHour = hour.toString().padStart(2, '0');
      intervals[`First day of month at ${formattedHour}:00`] =
        `0 ${hour} 1 * *`;
    });

    // Add last day of month options
    [0, 6, 9, 12, 15, 18].forEach((hour) => {
      const formattedHour = hour.toString().padStart(2, '0');
      intervals[`Last day of month at ${formattedHour}:00`] = `0 ${hour} L * *`;
    });

    // Add specific combinations that are commonly used
    const commonTimes = {
      'Every weekday at 09:00': '0 9 * * 1-5',
      'Every weekday at 17:00': '0 17 * * 1-5',
      'Every weekend at 10:00': '0 10 * * 0,6',
      'Every Monday and Thursday at 09:00': '0 9 * * 1,4',
      'Every Tuesday and Friday at 14:00': '0 14 * * 2,5',
      'First Monday of month at 09:00': '0 9 1-7 * 1',
      'Last Friday of month at 15:00': '0 15 L * 5',
    };

    return { ...intervals, ...commonTimes };
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
