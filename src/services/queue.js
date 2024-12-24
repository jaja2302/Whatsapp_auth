const fs = require('fs').promises;
const chokidar = require('chokidar');
const path = require('path');
const stream = require('stream');
const https = require('https');

// Increase the default max listeners for Readable streams
stream.Readable.defaultMaxListeners = 15;

// Rate limiting constants
const RATE_LIMIT_DELAY = 3000; // 3 seconds
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_MESSAGES_PER_WINDOW = 15;

class MessageQueue {
  constructor() {
    this.queue = [];
    this.completed = 0;
    this.failed = 0;
    this.paused = true;
    this.processing = false;
    this.messagesSentTimestamps = [];
    this.maxRetries = 3;
    this.filePath = path.join(__dirname, '../web/data/message_queue.json');
    this.failedJobsPath = path.join(__dirname, '../web/data/failed_jobs.json');

    // Setup file watcher
    this.setupFileWatcher();
  }

  static getInstance() {
    if (!global.messageQueue) {
      global.messageQueue = new MessageQueue();
    }
    return global.messageQueue;
  }

  async init() {
    try {
      await this.loadFromDisk();
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async loadFromDisk() {
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      const newQueue = JSON.parse(data);

      // Compare with current queue to avoid duplicate processing
      const currentIds = new Set(
        this.queue.map((item) => JSON.stringify(item))
      );
      const newItems = newQueue.filter(
        (item) => !currentIds.has(JSON.stringify(item))
      );

      if (newItems.length > 0) {
        this.queue.push(...newItems);
        global.logger?.info(`Added ${newItems.length} new items to queue`);
      }

      global.logger?.info(
        `Queue loaded from disk, total items: ${this.queue.length}`
      );
    } catch (error) {
      if (error.code !== 'ENOENT') {
        global.logger?.error('Error loading queue from disk:', error);
      }
      this.queue = [];
    }
  }

  async saveToFile() {
    try {
      await fs.writeFile(this.filePath, JSON.stringify(this.queue, null, 2));
      global.logger?.info('Queue saved to disk');
    } catch (error) {
      global.logger?.error('Error saving queue to disk:', error);
    }
  }

  pause() {
    this.paused = true;
    global.logger?.info('Queue paused');
  }

  resume() {
    this.paused = false;
    global.logger?.info('Queue resumed');
    this.processQueue();
  }

  async processQueue() {
    if (this.paused || this.processing || this.queue.length === 0) return;

    this.processing = true;
    try {
      const item = this.queue[0];
      await this.executeTask(item);
      this.queue.shift();
      this.completed++;
      await this.saveToFile();
      global.logger?.info(
        `Processed queue item. Remaining: ${this.queue.length}`
      );
    } catch (error) {
      global.logger?.error('Error processing queue item:', error);
      this.failed++;
      await this.saveFailedJob(this.queue[0]);
    } finally {
      this.processing = false;
      if (!this.paused && this.queue.length > 0) {
        setTimeout(() => this.processQueue(), RATE_LIMIT_DELAY);
      }
    }
  }

  async executeTask(task) {
    if (!global.sock || !global.sock.user) {
      throw new Error('WhatsApp connection is not established');
    }

    await this.applyRateLimit();

    switch (task.type) {
      case 'send_message':
        await this.sendMessage(task.data.to, task.data.message);
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
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  async sendMessage(to, message) {
    const result = await global.sock.sendMessage(to, { text: message });
    if (!result || !result.key) {
      throw new Error('Failed to send WhatsApp message');
    }
    global.logger?.info(`Message sent successfully to ${to}`);
    return result;
  }

  async sendImage(to, image, caption) {
    let imageBuffer = await this.getFileBuffer(image);
    const result = await global.sock.sendMessage(to, {
      image: imageBuffer,
      caption: caption,
    });
    if (!result || !result.key) {
      throw new Error('Failed to send WhatsApp image');
    }
    global.logger?.info(`Image sent successfully to ${to}`);
    return result;
  }

  async sendDocument(to, filename, document, caption) {
    let documentBuffer = await this.getFileBuffer(document);
    const result = await global.sock.sendMessage(to, {
      document: documentBuffer,
      mimetype: 'application/pdf',
      fileName: filename || 'document.pdf',
      caption: caption,
    });
    if (!result || !result.key) {
      throw new Error('Failed to send WhatsApp document');
    }
    global.logger?.info(`Document sent successfully to ${to}`);
    return result;
  }

  async getFileBuffer(file) {
    if (
      typeof file === 'string' &&
      (file.startsWith('http://') || file.startsWith('https://'))
    ) {
      return await this.downloadFile(file);
    } else if (typeof file === 'string') {
      return Buffer.from(file, 'base64');
    } else if (Buffer.isBuffer(file)) {
      return file;
    }
    throw new Error(
      'Invalid file parameter. Expected URL, base64 string, or Buffer.'
    );
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

  async applyRateLimit() {
    const now = Date.now();
    this.messagesSentTimestamps = this.messagesSentTimestamps.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW
    );

    if (this.messagesSentTimestamps.length >= MAX_MESSAGES_PER_WINDOW) {
      const oldestTimestamp = this.messagesSentTimestamps[0];
      const timeToWait = RATE_LIMIT_WINDOW - (now - oldestTimestamp);
      await new Promise((resolve) => setTimeout(resolve, timeToWait));
    }

    this.messagesSentTimestamps.push(now);
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
  }

  async saveFailedJob(task) {
    try {
      let failedJobs = [];
      try {
        const data = await fs.readFile(this.failedJobsPath, 'utf8');
        failedJobs = JSON.parse(data);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          global.logger?.error('Error reading failed jobs file:', error);
        }
      }

      task.failedAt = new Date().toISOString();
      failedJobs.push(task);

      await fs.writeFile(
        this.failedJobsPath,
        JSON.stringify(failedJobs, null, 2)
      );
      global.logger?.info(`Failed job saved: ${task.type}`);
    } catch (error) {
      global.logger?.error('Error saving failed job:', error);
    }
  }

  getStatus() {
    return {
      isPaused: this.paused,
      total: this.queue.length,
      completed: this.completed,
      failed: this.failed,
    };
  }

  setupFileWatcher() {
    const watcher = chokidar.watch(this.filePath, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100,
      },
    });

    watcher.on('change', async (path) => {
      global.logger?.info('Queue file changed, reloading...');
      await this.loadFromDisk();

      // Update web clients with new queue status
      if (global.io) {
        global.io.emit('connection-status', {
          whatsappConnected: !!global.sock?.user,
          queueStatus: this.getStatus(),
          reconnecting: false,
        });
      }

      // Start processing if queue is not paused
      if (!this.paused) {
        this.processQueue();
      }
    });

    watcher.on('error', (error) => {
      global.logger?.error('Error watching queue file:', error);
    });
  }
}

// Initialize queue as a singleton
const queue = MessageQueue.getInstance();
module.exports = queue;
