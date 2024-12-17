const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const { connectToWhatsApp } = require('../../services/whatsappService');

class ProgramController {
  async getStatus(req, res) {
    try {
      const status = {
        whatsappConnected: !!global.sock?.user,
        activePrograms: {
          taksasi: true,
          smartlabs: true,
          iot: true,
          grading: true,
        },
      };
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async runProgram(req, res) {
    try {
      const { programName } = req.params;
      let result;

      switch (programName) {
        case 'taksasi':
          result = await Generateandsendtaksasi();
          break;
        case 'smartlabs':
          result = await helperfunctionSmartlabs();
          break;
        // Add other program cases
        default:
          throw new Error('Program not found');
      }

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getProgramLogs(req, res) {
    try {
      const { programName } = req.params;
      // Implement log retrieval logic
      res.json({ logs: [] });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async disconnectWhatsApp(req, res) {
    try {
      if (global.sock) {
        await global.sock.logout();
        await global.sock.end();
        global.sock = null;

        // Delete the Baileys auth info directory
        const authPath = path.join(process.cwd(), 'baileys_auth_info');
        if (fs.existsSync(authPath)) {
          rimraf.sync(authPath);
          console.log('Deleted Baileys auth info');
        }

        res.json({
          success: true,
          message: 'WhatsApp disconnected successfully',
        });
      } else {
        res.json({ success: false, message: 'WhatsApp is not connected' });
      }
    } catch (error) {
      // Even if there's an error during logout, try to delete auth files
      try {
        const authPath = path.join(process.cwd(), 'baileys_auth_info');
        if (fs.existsSync(authPath)) {
          rimraf.sync(authPath);
          console.log('Deleted Baileys auth info');
        }
      } catch (deleteError) {
        console.error('Error deleting auth files:', deleteError);
      }

      res.status(500).json({ success: false, error: error.message });
    }
  }

  async reconnectWhatsApp(req, res) {
    try {
      // First check if there's any existing connection
      if (global.sock) {
        await global.sock.end();
        global.sock = null;
      }

      // Create a new connection
      try {
        await connectToWhatsApp();
        res.json({
          success: true,
          message:
            'Initializing new WhatsApp connection. Please wait for QR code.',
        });
      } catch (connError) {
        console.error('Connection error:', connError);
        res.status(500).json({
          success: false,
          message: 'Failed to initialize WhatsApp connection',
          error: connError.message,
        });
      }
    } catch (error) {
      console.error('Reconnection error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reconnect',
        error: error.message,
      });
    }
  }
}

module.exports = new ProgramController();
