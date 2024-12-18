const { updatestatus_sock_vbot } = require('./izinkebun/helper');
const { updateDataMill } = require('./grading/gradinghelper');
const fs = require('fs').promises;
const path = require('path');
const stream = require('stream');
const https = require('https');

// Increase the default max listeners for Readable streams
stream.Readable.defaultMaxListeners = 15;

const RATE_LIMIT_DELAY = 3000; // 3 seconds
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_MESSAGES_PER_WINDOW = 15; // Adjust as needed

class Queue {
  constructor() {
    this.items = [];
    this.processing = false;
    this.paused = false;
    this.filePath = path.join(__dirname, 'queue_list.json');
    this.maxRetries = 3;
    this.messagesSentTimestamps = [];
    this.failedJobsPath = path.join(__dirname, 'failed_jobs.json');
    this.pausedTypes = new Set(); // Track paused types

    // Load queue immediately
    this.loadFromDisk().catch(console.error);

    // Check for new items and save queue periodically (every 30 seconds)
    setInterval(async () => {
      await this.reloadQueue();
      await this.saveToFile();
    }, 30000);

    // Save queue on process exit
    process.on('SIGINT', async () => {
      console.log('Saving queue before exit...');
      await this.saveToFile();
      process.exit();
    });

    process.on('SIGTERM', async () => {
      console.log('Saving queue before exit...');
      await this.saveToFile();
      process.exit();
    });

    // Add this line to get access to io
    this.io = global.io;
  }

  emitLog(message, type = 'info') {
    if (this.io) {
      this.io.emit('server-log', { message, type });
    }
    console.log(message); // Keep console logging
  }

  async saveToFile() {
    try {
      // Create a backup of the current file if it exists
      try {
        const exists = await fs
          .access(this.filePath)
          .then(() => true)
          .catch(() => false);
        if (exists) {
          await fs.copyFile(this.filePath, `${this.filePath}.backup`);
        }
      } catch (error) {
        console.error('Error creating backup:', error);
      }

      // Save current queue
      await fs.writeFile(this.filePath, JSON.stringify(this.items, null, 2));
      console.log('Queue saved to disk');
      this.emitLog('Queue saved to disk', 'info');
    } catch (error) {
      console.error('Error saving queue to disk:', error);
      this.emitLog(`Error saving queue to disk: ${error}`, 'error');
    }
  }

  async loadFromDisk() {
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      const loadedItems = JSON.parse(data);

      // Filter out items that have failedAt property and move them to failed jobs
      const activeItems = loadedItems.filter((item) => !item.failedAt);
      const failedItems = loadedItems.filter((item) => item.failedAt);

      // Save failed items to failed_jobs.json
      for (const failedItem of failedItems) {
        await this.saveFailedJob(failedItem);
      }

      this.items = activeItems;
      console.log(
        `Queue loaded from disk, active items: ${this.items.length}, failed items: ${failedItems.length}`
      );
      this.emitLog(
        `Queue loaded from disk, active items: ${this.items.length}, failed items: ${failedItems.length}`,
        'info'
      );

      // Resume processing if there are items
      if (this.items.length > 0 && !this.processing && !this.paused) {
        this.process();
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('No existing queue file found. Starting with empty queue.');
        this.items = [];
        this.emitLog(
          'No existing queue file found. Starting with empty queue.',
          'info'
        );
      } else {
        console.error('Error loading queue from disk:', error);
        // Try to load from backup
        try {
          const backupData = await fs.readFile(
            `${this.filePath}.backup`,
            'utf8'
          );
          this.items = JSON.parse(backupData);
          console.log(`Queue loaded from backup, items: ${this.items.length}`);
        } catch (backupError) {
          console.error('Failed to load from backup:', backupError);
          this.items = [];
        }
        this.emitLog(`Error loading queue from disk: ${error}`, 'error');
      }
    }
  }

  push(task) {
    // Add default type if not specified
    task.queueType = task.queueType || 'general';

    // Define a function to compare tasks
    const areTasksEqual = (task1, task2) => {
      // Compare task type
      if (task1.type !== task2.type) return false;

      // Compare essential task data, ignoring timestamps or other volatile fields
      const essentialData1 = this.getEssentialTaskData(task1.data);
      const essentialData2 = this.getEssentialTaskData(task2.data);

      return JSON.stringify(essentialData1) === JSON.stringify(essentialData2);
    };

    // Check if an identical task already exists in the queue
    const existingTask = this.items.find((item) => areTasksEqual(item, task));

    if (existingTask) {
      console.log(`Identical task already in queue: ${task.type}. Skipping.`);
      return;
    }

    this.items.push(task);
    console.log(`Task added to queue: ${task.type}`);
    this.saveToFile();
    if (!this.paused) {
      this.process();
    }
    this.emitLog(`Task added to queue: ${task.type}`, 'info');
  }

  getEssentialTaskData(data) {
    // Create a copy of the data object
    const essentialData = { ...data };

    // Remove timestamp or other volatile fields
    delete essentialData.timestamp;
    delete essentialData.addedAt;
    // Add any other fields that should be ignored in the comparison

    return essentialData;
  }

  pause() {
    this.paused = true;
    console.log('Queue paused');
    this.emitLog('Queue paused', 'warning');
  }

  resume() {
    this.paused = false;
    console.log('Queue resumed');
    if (this.items.length > 0 && !this.processing) {
      this.process();
    }
    this.emitLog('Queue resumed', 'success');
  }

  async process() {
    if (this.processing || this.items.length === 0 || this.paused) return;

    // Find first task of non-paused type
    const taskIndex = this.items.findIndex(
      (task) => !this.pausedTypes.has(task.queueType)
    );
    if (taskIndex === -1) return; // All available task types are paused

    this.processing = true;
    const task = this.items[taskIndex];

    try {
      await this.executeTask(task);
      console.log(
        `Task completed: ${task.type} (Queue type: ${task.queueType})`
      );
      this.items.splice(taskIndex, 1);
    } catch (error) {
      console.error(`Error processing task (${task.type}):`, error);
      task.retries = (task.retries || 0) + 1;
      task.error = error.message;

      if (task.retries <= this.maxRetries) {
        console.log(
          `Retrying task: ${task.type} (Attempt ${task.retries}/${this.maxRetries})`
        );
        this.items.push(this.items.shift());
      } else {
        console.log(
          `Moving task to failed jobs: ${task.type} after ${this.maxRetries} failed attempts`
        );
        await this.saveFailedJob(task);
        this.items.shift();
      }
    }

    this.saveToFile();
    this.processing = false;
    setTimeout(() => this.process(), 1000);
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
        await updateDataMill(task.data); // Pass the entire data object instead of individual fields
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
      console.log(
        `Rate limit reached. Waiting for ${timeToWait}ms before sending next message.`
      );
      await new Promise((resolve) => setTimeout(resolve, timeToWait));
    }

    this.messagesSentTimestamps.push(now);
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
  }

  async sendMessage(to, message) {
    const result = await global.sock.sendMessage(to, { text: message });
    if (!result || !result.key) {
      throw new Error('Failed to send WhatsApp message');
    }
    console.log(`Message sent successfully to ${to}`);
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

      console.log(`Image sent successfully to ${to}`);
      return result;
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

      console.log(`Document sent successfully to ${to}`);
      return result;
    } catch (error) {
      throw new Error(`Failed to send WhatsApp document: ${error.message}`);
    }
  }

  // Add helper method to download files
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

  logQueueState() {
    console.log('Current queue state:');
    if (this.items.length === 0) {
      console.log('Queue is empty');
    } else {
      this.items.forEach((task, index) => {
        console.log(`${index + 1}. Task type: ${task.type}`);
      });
    }
    console.log(`Total tasks in queue: ${this.items.length}`);
  }

  async saveFailedJob(task) {
    try {
      let failedJobs = [];
      try {
        const data = await fs.readFile(this.failedJobsPath, 'utf8');
        failedJobs = JSON.parse(data);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.error('Error reading failed jobs file:', error);
        }
      }

      task.failedAt = new Date().toISOString();
      task.error = task.error?.toString() || 'Unknown error';
      failedJobs.push(task);

      await fs.writeFile(
        this.failedJobsPath,
        JSON.stringify(failedJobs, null, 2)
      );
      console.log(`Failed job saved: ${task.type}`);
    } catch (error) {
      console.error('Error saving failed job:', error);
    }
  }

  // Add a new method to reload the queue
  async reloadQueue() {
    console.log('Reloading queue from disk...');
    await this.loadFromDisk();
  }

  // Add new method to pause/resume specific type
  pauseType(type) {
    this.pausedTypes.add(type);
    console.log(`Queue type ${type} paused`);
  }

  resumeType(type) {
    this.pausedTypes.delete(type);
    console.log(`Queue type ${type} resumed`);
    if (this.items.length > 0 && !this.processing) {
      this.process();
    }
  }
}

module.exports = Queue;
