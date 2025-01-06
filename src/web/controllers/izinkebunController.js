const logger = require('../../services/logger');

class IzinKebunController {
  constructor(io) {
    this.io = io;
    this.program = null;
  }

  setProgram(program) {
    this.program = program;
  }

  getStatus(req, res) {
    try {
      if (!this.program) {
        return res.json({ running: false });
      }
      res.json({ running: this.program.running });
    } catch (error) {
      logger.error.izinkebun('Error getting status:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async startProgram(req, res) {
    try {
      if (!this.program) {
        return res.status(400).json({ error: 'Program not initialized' });
      }
      this.program.start();
      this.io.emit('izinkebun:status', { running: true });
      res.json({ success: true });
    } catch (error) {
      logger.error.izinkebun('Error starting program:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async stopProgram(req, res) {
    try {
      if (!this.program) {
        return res.status(400).json({ error: 'Program not initialized' });
      }
      this.program.stop();
      this.io.emit('izinkebun:status', { running: false });
      res.json({ success: true });
    } catch (error) {
      logger.error.izinkebun('Error stopping program:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = IzinKebunController;
