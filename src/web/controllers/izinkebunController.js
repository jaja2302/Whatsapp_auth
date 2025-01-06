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
}

module.exports = IzinKebunController;
