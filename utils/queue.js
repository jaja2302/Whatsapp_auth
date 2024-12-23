const axios = require('axios');
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
    this.processing = false;
    this.paused = false;
    this.maxRetries = 3;
    this.messagesSentTimestamps = [];
    this.failedJobsPath = path.join(__dirname, 'failed_jobs.json');
    this.loadFromDisk();
  }

  async push(task) {
    try {
      await axios.post(`${API_BASE_URL}/add-task`, {
        type: task.type,
        data: task.data,
      });
      console.log(`Task added to queue: ${task.type}`);
      if (!this.paused) {
        this.process();
      }
    } catch (error) {
      console.error('Error adding task to queue:', error.message);
    }
  }

  pause() {
    this.paused = true;
    this.stopPolling();
    console.log('Queue processing paused');
  }

  resume() {
    this.paused = false;
    this.startPolling();
    console.log('Queue processing resumed');
    this.process();
  }

  async process() {
    if (this.processing || this.paused) return;

    this.processing = true;
    const task = this.items[0];

    try {
      await this.executeTask(task);
      console.log(`Task completed: ${task.type}`);
      this.items.shift();
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

    try {
      await this.applyRateLimit();
    } catch (error) {
      console.error('Error applying rate limit:', error);
      // Continue with task execution even if rate limiting fails
    }

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

    // Initialize the array if it's undefined
    if (!this.messagesSentTimestamps) {
      this.messagesSentTimestamps = [];
    }

    // Filter out old timestamps
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
}

module.exports = Queue;
