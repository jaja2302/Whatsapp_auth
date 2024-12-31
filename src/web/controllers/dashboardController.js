const {
  connectToWhatsApp,
  disconnectAndClearAuth,
} = require('../../services/whatsappService');
const queue = require('../../services/queue');
const logger = require('../../services/logger');

class DashboardController {
  constructor(io) {
    this.io = io;
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      logger.info.whatsapp('Client connected');

      // Send initial status with reconnection state
      const { connected, reconnecting } =
        require('../../services/whatsappService').isConnected();
      socket.emit('connection-status', {
        whatsappConnected: connected,
        queueStatus: this.getQueueStatus(),
        reconnecting: reconnecting,
      });

      socket.on('disconnect', () => {
        logger.info.whatsapp('Client disconnected');
      });
    });
  }

  getQueueStatus() {
    return {
      isPaused: global.queue?.paused || true,
      total: global.queue?.queue.length || 0,
      completed: global.queue?.completed || 0,
      failed: global.queue?.failed || 0,
    };
  }

  async disconnectWhatsApp(req, res) {
    try {
      const success = await disconnectAndClearAuth();

      // Notify all connected clients
      this.io.emit('connection-status', {
        whatsappConnected: false,
        queueStatus: this.getQueueStatus(),
        reconnecting: false,
      });

      // Clear QR code
      this.io.emit('clear-qr');

      logger.info.whatsapp('WhatsApp disconnected and auth cleared');

      res.json({
        success: true,
        message:
          'WhatsApp disconnected and auth cleared. You will need to scan QR code again to reconnect.',
      });
    } catch (error) {
      logger.error.whatsapp('Disconnect error:', error);
      res.status(500).json({
        success: false,
        error:
          'Disconnection failed, but session was cleared. Please try reconnecting.',
      });
    }
  }

  async reconnectWhatsApp(req, res) {
    try {
      // If already connected, disconnect first
      if (global.sock) {
        await disconnectAndClearAuth();
      }

      // Notify clients we're starting connection
      this.io.emit('connection-status', {
        whatsappConnected: false,
        queueStatus: this.getQueueStatus(),
        reconnecting: true,
      });

      logger.info.whatsapp('Initializing new WhatsApp connection');
      await connectToWhatsApp();

      res.json({
        success: true,
        message:
          'Initializing new WhatsApp connection. Please wait for QR code.',
      });
    } catch (error) {
      logger.error.whatsapp('Reconnect error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getStatus(req, res) {
    try {
      const status = {
        whatsappConnected: !!global.sock?.user,
        queueStatus: this.getQueueStatus(),
      };
      res.json(status);
    } catch (error) {
      logger.error.whatsapp('Status check error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async startQueue(req, res) {
    try {
      queue.resume();
      logger.info.whatsapp('Queue started');

      this.io.emit('connection-status', {
        whatsappConnected: !!global.sock?.user,
        queueStatus: {
          isPaused: false,
          total: queue.queue.length,
          completed: queue.completed,
          failed: queue.failed,
        },
        reconnecting: false,
      });

      res.json({ success: true, message: 'Queue started successfully' });
    } catch (error) {
      logger.error.whatsapp('Error starting queue:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async pauseQueue(req, res) {
    try {
      queue.pause();
      logger.info.whatsapp('Queue paused');

      this.io.emit('connection-status', {
        whatsappConnected: !!global.sock?.user,
        queueStatus: {
          isPaused: true,
          total: queue.queue.length,
          completed: queue.completed,
          failed: queue.failed,
        },
        reconnecting: false,
      });

      res.json({ success: true, message: 'Queue paused successfully' });
    } catch (error) {
      logger.error.whatsapp('Error pausing queue:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = DashboardController;
