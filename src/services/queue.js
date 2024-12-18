const fs = require('fs').promises;
const path = require('path');
const fsSync = require('fs');
const winston = require('winston');
const stream = require('stream');
const https = require('https');
const { updatestatus_sock_vbot } = require('../web/programs/izinkebun/helper');
const { updateDataMill } = require('../web/programs/grading/gradingMill');
const { connectToWhatsApp } = require('./whatsappService');
const chokidar = require('chokidar');

// Increase the default max listeners for Readable streams
stream.Readable.defaultMaxListeners = 15;

// Rate limiting constants
const RATE_LIMIT_DELAY = 3000; // 3 seconds
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_MESSAGES_PER_WINDOW = 15;

// Add WebSocket constants at the top
const WS_READY_STATES = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
};

class MessageQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.paused = true;
    this.completed = 0;
    this.failed = 0;
    this.maxRetries = 3;
    this.messagesSentTimestamps = [];
    this._io = null;

    // Update paths to match your structure
    this.queuePath = path.join(__dirname, '../web/data/message_queue.json');
    this.failedPath = path.join(__dirname, '../web/data/failed_messages.json');

    // Logger setup
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'queue.log' }),
        new winston.transports.Console(),
      ],
    });

    // Create data directory if it doesn't exist
    const dir = path.dirname(this.queuePath);
    if (!fsSync.existsSync(dir)) {
      fsSync.mkdirSync(dir, { recursive: true });
    }

    // Initialize queue
    this.init().catch((err) => {
      console.error('Queue initialization error:', err);
    });

    // Set up file watcher
    this.setupFileWatcher();

    // Track WhatsApp connection state
    this.whatsappConnected = false;
    this.setupWhatsAppListeners();

    // Add logging methods
    this.emitLog = (message, type = 'info') => {
      const logMessage = {
        timestamp: new Date().toISOString(),
        message,
        type,
      };

      // Log to Winston
      this.logger[type](message);

      // Emit to Socket.IO if available
      if (this._io) {
        this._io.emit('log', logMessage);
      }

      return logMessage;
    };
  }

  get io() {
    return this._io;
  }

  setIO(io) {
    this._io = io;
    this.logger.info('Socket.IO initialized for queue');
  }

  async init() {
    try {
      await this.loadQueue();
      this.logger.info('Queue initialized successfully');
      if (!this.paused) {
        this.processQueue();
      }
    } catch (error) {
      this.logger.error('Queue initialization error:', error);
    }
  }

  async loadQueue() {
    try {
      if (fsSync.existsSync(this.queuePath)) {
        const data = await fs.readFile(this.queuePath, 'utf8');
        this.queue = JSON.parse(data || '[]');
      } else {
        this.queue = [];
        await this.saveQueue();
      }
      this.logger.info(`Loaded ${this.queue.length} messages from queue`);
    } catch (error) {
      this.logger.error('Error loading queue:', error);
      this.queue = [];
    }
  }

  async saveQueue() {
    try {
      await fs.writeFile(this.queuePath, JSON.stringify(this.queue, null, 2));
    } catch (error) {
      this.logger.error('Error saving queue:', error);
    }
  }

  async handleFailedMessage(task) {
    try {
      let failedMessages = [];
      if (fsSync.existsSync(this.failedPath)) {
        const data = await fs.readFile(this.failedPath, 'utf8');
        failedMessages = JSON.parse(data || '[]');
      }

      // Add failed task with additional information
      failedMessages.push({
        ...task,
        failedAt: new Date().toISOString(),
        error: task.error || 'Unknown error',
      });

      await fs.writeFile(
        this.failedPath,
        JSON.stringify(failedMessages, null, 2)
      );
      this.logger.info(`Failed message saved: ${task.type}`);
    } catch (error) {
      this.logger.error('Error handling failed message:', error);
    }
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0 || this.paused) {
      return;
    }

    this.processing = true;
    this.logger.info('Processing queue...');

    try {
      while (this.queue.length > 0 && !this.paused) {
        // Thorough connection check
        const isConnected = await this.checkConnection();
        if (!isConnected) {
          this.logger.info('WhatsApp connection not ready - Pausing queue');
          this.pause();
          break;
        }

        const task = this.queue[0];

        try {
          // Add delay between tasks
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Execute task with timeout
          await Promise.race([
            this.executeTask(task),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Task timeout')), 30000)
            ),
          ]);

          // Task successful
          this.queue.shift();
          this.completed++;
          await this.saveQueue();
          this.emitStatus();
        } catch (error) {
          this.logger.error(`Error processing task ${task.type}:`, error);

          // Handle connection errors
          if (
            error.message.includes('Connection') ||
            error.message.includes('timeout')
          ) {
            const reconnected = await this.reconnectIfNeeded();
            if (!reconnected) {
              this.pause();
              break;
            }
          }

          // Handle task retry
          task.attempts = (task.attempts || 0) + 1;
          if (task.attempts >= this.maxRetries) {
            await this.handleFailedMessage(task);
            this.queue.shift();
            this.failed++;
          } else {
            // Move to end of queue for retry
            this.queue.push(this.queue.shift());
            await new Promise((resolve) => setTimeout(resolve, 5000)); // Delay before retry
          }

          await this.saveQueue();
          this.emitStatus();
        }
      }
    } finally {
      this.processing = false;
      this.emitStatus();
    }
  }

  async executeTask(task) {
    if (!this.isWhatsAppConnected()) {
      throw new Error('WhatsApp connection is not established');
    }

    await this.applyRateLimit();

    switch (task.type) {
      case 'send_message':
        await this.sendMessage(task.data.to, task.data.message);
        break;
      case 'update_status_izinkebun':
        await updatestatus_sock_vbot(task.data.id_db, task.data.type);
        break;
      case 'send_image':
        await this.sendImage(task.data.to, task.data.image, task.data.caption);
        break;
      case 'send_document':
        await this.sendDocument(
          task.data.to,
          task.data.filename,
          task.data.document,
          task.data.caption
        );
        break;
      case 'update_data_mill':
        await updateDataMill(task.data);
        break;
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  async applyRateLimit() {
    const now = Date.now();
    this.messagesSentTimestamps = this.messagesSentTimestamps.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW
    );

    if (this.messagesSentTimestamps.length >= MAX_MESSAGES_PER_WINDOW) {
      const oldestTimestamp = this.messagesSentTimestamps[0];
      const timeToWait = RATE_LIMIT_WINDOW - (now - oldestTimestamp);
      this.logger.info(`Rate limit reached. Waiting for ${timeToWait}ms`);
      await new Promise((resolve) => setTimeout(resolve, timeToWait));
    }

    this.messagesSentTimestamps.push(now);
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
  }

  // Message sending methods
  async sendMessage(to, message) {
    const result = await global.sock.sendMessage(to, { text: message });
    if (!result || !result.key) {
      throw new Error('Failed to send WhatsApp message');
    }
    this.logger.info(`Message sent successfully to ${to}`);
    return result;
  }

  async sendImage(to, image, caption) {
    let imageBuffer = await this.getMediaBuffer(image);
    const result = await global.sock.sendMessage(to, {
      image: imageBuffer,
      caption: caption,
    });

    if (!result || !result.key) {
      throw new Error('Failed to send WhatsApp image');
    }
    return result;
  }

  async sendDocument(to, filename, document, caption) {
    let documentBuffer = await this.getMediaBuffer(document);
    const result = await global.sock.sendMessage(to, {
      document: documentBuffer,
      mimetype: 'application/pdf',
      fileName: filename || 'document.pdf',
      caption: caption,
    });

    if (!result || !result.key) {
      throw new Error('Failed to send WhatsApp document');
    }
    return result;
  }

  async getMediaBuffer(media) {
    if (
      typeof media === 'string' &&
      (media.startsWith('http://') || media.startsWith('https://'))
    ) {
      return await this.downloadFile(media);
    } else if (typeof media === 'string') {
      return Buffer.from(media, 'base64');
    } else if (Buffer.isBuffer(media)) {
      return media;
    }
    throw new Error('Invalid media format');
  }

  async downloadFile(url) {
    return new Promise((resolve, reject) => {
      https
        .get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(
              new Error(`Failed to download file: ${response.statusCode}`)
            );
            return;
          }

          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => resolve(Buffer.concat(chunks)));
          response.on('error', reject);
        })
        .on('error', reject);
    });
  }

  // Queue control methods
  pause() {
    try {
      this.paused = true;
      this.logger.info('Queue processing paused');
      this.emitStatus();
    } catch (error) {
      this.logger.error('Error pausing queue:', error);
      throw error;
    }
  }

  resume() {
    try {
      // Force a thorough connection check before resuming
      const isConnected = this.isWhatsAppConnected();

      if (!isConnected) {
        throw new Error(
          'Cannot resume: WhatsApp connection is not established'
        );
      }

      this.paused = false;
      this.logger.info('Queue processing resumed');
      this.processQueue();
      this.emitStatus();
    } catch (error) {
      this.logger.error('Error resuming queue:', error);
      throw error;
    }
  }

  getStatus() {
    const active = this.queue.reduce((acc, item) => {
      const type = item.type || 'unknown';
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push({
        id: item.id || Date.now().toString(),
        type: type,
        processing: item.status === 'processing',
        retries: item.attempts || 0,
        timestamp: item.timestamp || new Date().toISOString(),
      });
      return acc;
    }, {});

    return {
      active,
      failed: [], // Implement if needed
      isPaused: this.paused,
      stats: {
        total: this.queue.length,
        completed: this.completed,
        failed: this.failed,
        pending: this.queue.filter(
          (item) => !item.status || item.status === 'pending'
        ).length,
      },
    };
  }

  emitStatus() {
    if (this._io) {
      this._io.emit('queueStatus', {
        isPaused: this.paused,
        stats: this.getStatus().stats,
      });
    }
  }

  setupWhatsAppListeners() {
    // Listen for WhatsApp connection events
    if (global.ev) {
      global.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
          this.whatsappConnected = true;
          this.logger.info('WhatsApp connected - Queue ready');
        } else if (connection === 'close') {
          this.whatsappConnected = false;
          this.logger.info('WhatsApp disconnected - Pausing queue');
          this.pause();
        }
      });
    }
  }

  isWhatsAppConnected() {
    try {
      // Check if sock exists and has required properties
      if (!global.sock) {
        this.logger.debug('WhatsApp sock does not exist');
        return false;
      }

      // Check if WhatsApp is actually connected
      const isConnected =
        global.sock.user &&
        global.sock.ws.readyState === global.sock.ws.OPEN &&
        typeof global.sock.sendMessage === 'function';

      this.logger.debug('WhatsApp connection status:', {
        hasUser: !!global.sock.user,
        wsState: global.sock.ws?.readyState,
        canSend: typeof global.sock.sendMessage === 'function',
        isConnected,
      });

      return isConnected;
    } catch (error) {
      this.logger.error('Error checking WhatsApp connection:', error);
      return false;
    }
  }

  async checkConnection() {
    try {
      if (!global.sock) {
        this.logger.debug('WhatsApp socket not initialized');
        return false;
      }

      // Check basic connection state
      const isConnected =
        global.sock.user &&
        global.sock.ws.readyState === global.sock.ws.OPEN &&
        typeof global.sock.sendMessage === 'function';

      if (!isConnected) {
        this.logger.debug('Basic connection check failed');
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error checking connection:', error);
      return false;
    }
  }

  // Add method to log with different levels
  logInfo(message) {
    return this.emitLog(message, 'info');
  }

  logError(message) {
    return this.emitLog(message, 'error');
  }

  logWarning(message) {
    return this.emitLog(message, 'warn');
  }

  async reconnectIfNeeded() {
    try {
      if (!global.sock || !global.sock.isConnected()) {
        this.logger.info('Attempting to reconnect WhatsApp...');
        await connectToWhatsApp();

        // Wait for connection to stabilize
        await new Promise((resolve) => setTimeout(resolve, 5000));

        return global.sock && global.sock.isConnected();
      }
      return true;
    } catch (error) {
      this.logger.error('Reconnection failed:', error);
      return false;
    }
  }

  async saveToFile() {
    try {
      await this.saveQueue(); // Assuming saveQueue saves the current queue state to a file
      this.logger.info('Queue saved to file successfully');
    } catch (error) {
      this.logger.error('Error saving queue to file:', error);
    }
  }

  setupFileWatcher() {
    const watcher = chokidar.watch(this.queuePath, {
      persistent: true,
      ignoreInitial: true,
    });

    watcher.on('change', async () => {
      this.logger.info(
        'Detected change in message_queue.json, reloading queue...'
      );
      await this.loadQueue();
      if (!this.paused) {
        this.processQueue();
      }
    });
  }
}

// Create and export a SINGLE instance
const messageQueue = new MessageQueue();
module.exports = messageQueue;
