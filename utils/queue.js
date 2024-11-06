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
    this.filePath = path.join(__dirname, 'queue_backup.json');
    this.maxRetries = 3;
    this.messagesSentTimestamps = [];
    this.loadFromDisk();
  }

  async saveToFile() {
    try {
      await fs.writeFile(this.filePath, JSON.stringify(this.items, null, 2));
      console.log('Queue saved to disk');
    } catch (error) {
      console.error('Error saving queue to disk:', error);
    }
  }

  async loadFromDisk() {
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      this.items = JSON.parse(data);
      console.log(`Queue loaded from disk, items: ${this.items.length}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error loading queue from disk:', error);
        // Try to recover corrupted data
        try {
          const data = await fs.readFile(this.filePath, 'utf8');
          const cleanedData = data.replace(/[^\x20-\x7E]/g, '');
          this.items = JSON.parse(cleanedData);
          console.log(`Queue recovered from disk, items: ${this.items.length}`);
        } catch (recoverError) {
          console.error('Failed to recover queue data:', recoverError);
          this.items = [];
        }
      } else {
        console.log(
          'No existing queue file found. Starting with an empty queue.'
        );
        this.items = [];
      }
    }
  }

  push(task) {
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
    console.log('Queue processing paused');
  }

  resume() {
    this.paused = false;
    console.log('Queue processing resumed');
    this.process();
  }

  async process() {
    if (this.processing || this.items.length === 0 || this.paused) return;

    this.processing = true;
    const task = this.items[0];

    try {
      await this.executeTask(task);
      console.log(`Task completed: ${task.type}`);
      this.items.shift();
    } catch (error) {
      console.error(`Error processing task (${task.type}):`, error);
      task.retries = (task.retries || 0) + 1;
      if (task.retries <= this.maxRetries) {
        console.log(
          `Retrying task: ${task.type} (Attempt ${task.retries}/${this.maxRetries})`
        );
        this.items.push(this.items.shift());
      } else {
        console.log(
          `Skipping task: ${task.type} after ${this.maxRetries} failed attempts`
        );
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
        await updateDataMill(task.data.id, task.data.credentials);
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
}

module.exports = Queue;
