const logger = require('../../services/logger');
const fs = require('fs').promises;
const path = require('path');
const SmartlabsProgram = require('../../Programs/Smartlabs');

class SmartlabsController {
  constructor(io) {
    this.io = io;
    this.settingsPath = path.join(__dirname, '../data/settings.json');
    this.running = false;
    this.stats = {
      notificationsToday: 0,
      successRateToday: 0,
    };
    this.program = new SmartlabsProgram();
    this.loadSettings();
  }

  async loadSettings() {
    try {
      const data = await fs.readFile(this.settingsPath, 'utf8');
      const settings = JSON.parse(data);
      this.running = settings.smartlabs?.status === 'active';
      if (this.running) {
        this.program.start();
      }
      logger.info.smartlabs('Settings loaded successfully');
    } catch (error) {
      logger.error.smartlabs('Error loading settings:', error);
    }
  }

  async saveSettings() {
    try {
      const data = await fs.readFile(this.settingsPath, 'utf8');
      const settings = JSON.parse(data);

      settings.smartlabs = {
        ...settings.smartlabs,
        status: this.running ? 'active' : 'stopped',
      };

      await fs.writeFile(this.settingsPath, JSON.stringify(settings, null, 2));
      logger.info.smartlabs('Settings saved successfully');
    } catch (error) {
      logger.error.smartlabs('Error saving settings:', error);
    }
  }

  getStatus(req, res) {
    try {
      const status = {
        running: this.running,
        stats: this.stats,
      };
      res.json(status);
    } catch (error) {
      logger.error.smartlabs('Error getting status:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async startProgram(req, res) {
    try {
      this.running = true;
      await this.saveSettings();
      this.program.start();
      logger.info.smartlabs('Smartlabs program started');

      // Emit status update to all connected clients
      this.io.emit('smartlabs-status', { running: true });

      res.json({ success: true, running: true });
    } catch (error) {
      logger.error.smartlabs('Error starting program:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async stopProgram(req, res) {
    try {
      this.running = false;
      await this.saveSettings();
      this.program.stop();
      logger.info.smartlabs('Smartlabs program stopped');

      // Emit status update to all connected clients
      this.io.emit('smartlabs-status', { running: false });

      res.json({ success: true, running: false });
    } catch (error) {
      logger.error.smartlabs('Error stopping program:', error);
      res.status(500).json({ error: error.message });
    }
  }

  updateStats(success = true) {
    this.stats.notificationsToday++;
    if (success) {
      this.stats.successCount = (this.stats.successCount || 0) + 1;
    }
    this.stats.successRateToday = Math.round(
      (this.stats.successCount / this.stats.notificationsToday) * 100
    );

    // Emit stats update to all connected clients
    this.io.emit('smartlabs-stats', this.stats);
  }
}

module.exports = SmartlabsController;
