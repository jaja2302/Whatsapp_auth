const fs = require('fs').promises;
const chokidar = require('chokidar');
const path = require('path');
const stream = require('stream');
const https = require('https');
const logger = require('./logger');
const axios = require('axios');

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
    this.paused = false;
    this.processing = false;
    this.currentSave = Promise.resolve();
    this.filePath = path.join(__dirname, '../web/data/message_queue.json');
    this.failedJobsPath = path.join(__dirname, '../web/data/failed_jobs.json');
    this.queueStatePath = path.join(__dirname, '../web/data/queue_state.json');
    this.maxRetries = 3;
    this.messagesSentTimestamps = [];

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
      // Load queue state first
      await this.loadQueueState();
      // Then load queue items
      await this.loadFromDisk();

      // Start processing queue if not paused and there are items
      if (!this.paused && this.queue.length > 0) {
        logger.info.whatsapp(
          `Starting queue processing for ${this.queue.length} items`
        );
        this.processQueue();
      }

      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async loadQueueState() {
    try {
      // Check if file exists
      try {
        await fs.access(this.queueStatePath);
      } catch (error) {
        // If file doesn't exist, create directory if needed
        const dir = path.dirname(this.queueStatePath);
        await fs.mkdir(dir, { recursive: true });

        // Create default state file with running state
        await fs.writeFile(
          this.queueStatePath,
          JSON.stringify({ paused: false }, null, 2)
        );

        logger.info.whatsapp(
          'Created new queue state file with default state (running)'
        );
      }

      // Read the state file
      const data = await fs.readFile(this.queueStatePath, 'utf8');
      const state = JSON.parse(data);
      this.paused = state.paused;
      logger.info.whatsapp(
        `Queue state loaded: ${this.paused ? 'paused' : 'running'}`
      );
    } catch (error) {
      // If any error occurs, use default state (paused)
      logger.error.whatsapp('Error loading queue state:', error);
      this.paused = true;
      await this.saveQueueState();
    }
  }

  async saveQueueState() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.queueStatePath);
      await fs.mkdir(dir, { recursive: true });

      // Save state
      await fs.writeFile(
        this.queueStatePath,
        JSON.stringify({ paused: this.paused }, null, 2)
      );
      logger.info.whatsapp(
        `Queue state saved: ${this.paused ? 'paused' : 'running'}`
      );
    } catch (error) {
      logger.error.whatsapp('Error saving queue state:', error);
    }
  }

  async loadFromDisk() {
    if (this.processing) {
      logger.info.whatsapp('Queue load already in progress, skipping...');
      return;
    }

    this.processing = true;
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      const loadedQueue = JSON.parse(data);

      if (!Array.isArray(loadedQueue)) {
        throw new Error('Invalid queue format');
      }

      this.queue = loadedQueue;
      logger.info.whatsapp(
        `Queue loaded from disk, total items: ${this.queue.length}`
      );
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info.whatsapp('No existing queue file, starting fresh');
        this.queue = [];
      } else {
        logger.error.whatsapp('Error loading queue from disk:', error);
        throw error;
      }
    } finally {
      this.processing = false;
    }
  }

  async saveToFile() {
    // Instead of throwing error, wait for current save to complete
    this.currentSave = this.currentSave.then(async () => {
      try {
        // Ensure queue is an array
        if (!Array.isArray(this.queue)) {
          this.queue = [];
        }

        const tempPath = `${this.filePath}.tmp`;
        const jsonContent = JSON.stringify(this.queue, null, 2) + '\n';

        // Write to temporary file first
        await fs.writeFile(tempPath, jsonContent, 'utf8');

        // Atomic rename
        await fs.rename(tempPath, this.filePath);

        logger.info.whatsapp('Queue saved to disk successfully');
      } catch (error) {
        logger.error.whatsapp('Error saving queue to disk:', error);
        // Don't throw here, just log the error
      }
    });

    return this.currentSave; // Return the promise
  }

  pause() {
    this.paused = true;
    this.saveQueueState();
  }

  resume() {
    this.paused = false;
    this.saveQueueState();
    if (!this.processing) {
      this.processQueue();
    }
  }

  async processQueue() {
    // Don't process if paused, already processing, or queue is empty
    if (this.paused || this.processing || this.queue.length === 0) return;

    // Check WhatsApp connection before starting to process
    if (!(await isWhatsAppConnected())) {
      logger.info.whatsapp(
        'WhatsApp not connected, delaying queue processing...'
      );
      setTimeout(() => this.processQueue(), 5000); // Check again in 5 seconds
      return;
    }

    this.processing = true;
    try {
      const item = this.queue[0];

      logger.info.whatsapp(
        `Processing queue item: ${item.type} (Program: ${item.program || 'unknown'})`
      );

      try {
        // Double-check connection before executing task
        if (!(await isWhatsAppConnected())) {
          throw new Error('WhatsApp connection lost during processing');
        }

        const success = await this.executeTask(item);

        if (success) {
          this.completed++;
          logger.info.whatsapp(
            `Successfully processed ${item.type} from program ${item.program || 'unknown'}`
          );
          this.queue.shift();
        } else {
          throw new Error('Task execution returned false');
        }
      } catch (error) {
        logger.error.whatsapp(
          `Error processing queue item from program ${item.program || 'unknown'}:`,
          error
        );

        // If error is due to WhatsApp connection, don't mark as failed
        if (error.message.includes('WhatsApp')) {
          logger.info.whatsapp(
            'Queue processing paused due to WhatsApp connection issue'
          );
          return; // Exit without removing the item from queue
        }

        this.failed++;
        await this.saveFailedJob(this.queue[0]);
        this.queue.shift();
      }

      await this.saveToFile();

      logger.info.whatsapp(
        `Queue status - Remaining: ${this.queue.length}, Completed: ${this.completed}, Failed: ${this.failed}, Current Program: ${item.program || 'unknown'}`
      );
    } finally {
      this.processing = false;
      if (!this.paused && this.queue.length > 0) {
        // Only schedule next processing if WhatsApp is connected
        if (await isWhatsAppConnected()) {
          setTimeout(() => this.processQueue(), 5000);
        } else {
          logger.info.whatsapp(
            'Queue processing paused until WhatsApp reconnects'
          );
        }
      }
    }
  }

  async executeTask(task) {
    // Check WhatsApp connection before executing any task
    if (!(await isWhatsAppConnected())) {
      throw new Error('WhatsApp is not connected');
    }

    await this.applyRateLimit();

    try {
      logger.info.whatsapp(`Executing task: ${task.type}`);

      switch (task.type) {
        case 'send_document':
          return await this.sendDocument(
            task.data.to,
            task.data.filename,
            task.data.document,
            task.data.caption
          );

        case 'send_image':
          return await this.sendImage(
            task.data.to,
            task.data.image,
            task.data.caption
          );

        case 'send_message':
          return await this.sendMessage(task.data.to, task.data.message);

        // Add other task types as needed
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
    } catch (error) {
      logger.error.whatsapp(`Failed to execute task ${task.type}:`, error);
      throw error;
    }
  }

  async sendMessage(to, message) {
    const result = await global.sock.sendMessage(to, { text: message });
    if (!result || !result.key) {
      throw new Error('Failed to send WhatsApp message');
    }
    logger.info.whatsapp(`Message sent successfully to ${to}`);
    return result;
  }

  async sendImage(to, image, caption) {
    let imageBuffer;

    try {
      // Check if image is a URL
      if (
        typeof image === 'string' &&
        (image.startsWith('http://') || image.startsWith('https://'))
      ) {
        imageBuffer = await this.downloadFile(image);
      }
      // Check if image is base64
      else if (typeof image === 'string') {
        imageBuffer = Buffer.from(image, 'base64');
      }
      // Check if image is already a Buffer
      else if (Buffer.isBuffer(image)) {
        imageBuffer = image;
      } else {
        throw new Error(
          'Invalid image parameter. Expected a URL, base64 string, or Buffer object.'
        );
      }

      const result = await global.sock.sendMessage(to, {
        image: imageBuffer,
        caption: caption,
      });

      if (!result || !result.key) {
        throw new Error('Failed to send WhatsApp image');
      }

      logger.info.whatsapp(`Image sent successfully to ${to}`);
      return true;
    } catch (error) {
      throw new Error(`Failed to send WhatsApp image: ${error.message}`);
    }
  }

  async sendDocument(to, filename, document, caption) {
    let documentBuffer;

    try {
      // Check if document is a URL
      if (
        typeof document === 'string' &&
        (document.startsWith('http://') || document.startsWith('https://'))
      ) {
        documentBuffer = await this.downloadFile(document);
      }
      // Check if document is base64
      else if (typeof document === 'string') {
        documentBuffer = Buffer.from(document, 'base64');
      }
      // Check if document is already a Buffer
      else if (Buffer.isBuffer(document)) {
        documentBuffer = document;
      } else {
        throw new Error(
          'Invalid document parameter. Expected a URL, base64 string, or Buffer object.'
        );
      }

      const result = await global.sock.sendMessage(to, {
        document: documentBuffer,
        mimetype: 'application/pdf',
        fileName: filename || 'document.pdf',
        caption: caption,
      });

      if (!result || !result.key) {
        throw new Error('Failed to send WhatsApp document');
      }

      logger.info.whatsapp(`Document sent successfully to ${to}`);
      return true;
    } catch (error) {
      logger.error.whatsapp('Error sending document:', error);
      throw new Error(`Failed to send document: ${error.message}`);
    }
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
      logger.info.whatsapp(`Rate limit reached. Waiting for ${timeToWait}ms`);
      await new Promise((resolve) => setTimeout(resolve, timeToWait));
    }

    this.messagesSentTimestamps.push(now);
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
  }

  async saveFailedJob(job) {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.failedJobsPath);
      await fs.mkdir(dir, { recursive: true });

      // Read existing failed jobs or create new array
      let failedJobs = [];
      try {
        const data = await fs.readFile(this.failedJobsPath, 'utf8');
        failedJobs = JSON.parse(data);
      } catch (error) {
        // File doesn't exist or is corrupted, start with empty array
      }

      // Add new failed job with timestamp and ensure program is included
      failedJobs.push({
        ...job,
        program: job.program || 'unknown', // Include program in failed jobs
        failed_at: new Date().toISOString(),
      });

      // Save failed jobs
      await fs.writeFile(
        this.failedJobsPath,
        JSON.stringify(failedJobs, null, 2)
      );

      logger.info.whatsapp(
        `Failed job saved to failed_jobs: ${job.type} (Program: ${job.program || 'unknown'})`
      );
    } catch (error) {
      logger.error.whatsapp('Error saving failed job:', error);
    }
  }

  getStatus() {
    // Group queue items by program
    const programCounts = this.queue.reduce((acc, item) => {
      const program = item.program || 'unknown';
      acc[program] = (acc[program] || 0) + 1;
      return acc;
    }, {});

    return {
      isPaused: this.paused,
      total: this.queue.length,
      completed: this.completed,
      failed: this.failed,
      byProgram: programCounts, // Add program-specific counts
    };
  }

  setupFileWatcher() {
    const watcher = chokidar.watch(this.filePath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });

    watcher.on('change', async () => {
      logger.info.whatsapp(
        'Queue file changed, waiting for current operations to complete...'
      );
      await this.currentSave; // Wait for any ongoing saves to complete
      await this.loadFromDisk();
    });
  }

  async push(item) {
    try {
      logger.info.whatsapp(
        `Adding new item to queue: ${item.type} (Program: ${item.program || 'unknown'})`
      );

      if (!Array.isArray(this.queue)) {
        this.queue = [];
      }

      // Ensure program field exists
      if (!item.program) {
        item.program = 'unknown';
      }

      this.queue.push(item);
      await this.saveToFile();

      if (!this.paused && !this.processing) {
        setTimeout(() => this.processQueue(), 100);
      }

      return this.queue.length;
    } catch (error) {
      logger.error.whatsapp('Error in push operation:', error);
      throw error;
    }
  }

  onWhatsAppReconnect() {
    if (!this.paused && this.queue.length > 0 && !this.processing) {
      logger.info.whatsapp(
        'WhatsApp reconnected, resuming queue processing...'
      );
      this.processQueue();
    }
  }
}

// Initialize queue as a singleton
const queue = MessageQueue.getInstance();
module.exports = queue;

async function isWhatsAppConnected() {
  return !!global.sock?.user && global.sock.ws.readyState === 1;
}
