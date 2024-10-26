const axios = require('axios');
const { updatestatus_sock_vbot } = require('./izinkebun/helper');
const { updateDataMill } = require('./grading/gradinghelper');

const API_BASE_URL = 'https://management.srs-ssms.com/api';
const BOT_ID = '1'; // Replace with a unique identifier for this bot
// jojok
const RATE_LIMIT_DELAY = 3000; // 3 seconds
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_MESSAGES_PER_WINDOW = 15; // Adjust as needed

class Queue {
  constructor() {
    this.processing = false;
    this.paused = false;
    this.maxRetries = 3;
    this.messagesSentTimestamps = [];
    this.pollInterval = null;
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
    try {
      const response = await axios.get(`${API_BASE_URL}/next-task`, {
        params: { bot_id: BOT_ID },
      });

      if (response.data && response.data.task_id) {
        const task = response.data.payload;
        try {
          await this.executeTask(task);
          await this.completeTask(response.data.task_id, true);
          console.log(`Task completed: ${task.type}`);
        } catch (error) {
          console.error(`Error processing task (${task.type}):`, error);
          if (response.data.retry_count < this.maxRetries) {
            await this.completeTask(response.data.task_id, false);
          } else {
            await this.completeTask(response.data.task_id, false, true);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching next task:', error.message);
    }

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
        await updateDataMill(task.data.id, task.data.credentials);
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
    if (typeof image === 'string') {
      imageBuffer = Buffer.from(image, 'base64');
    } else if (Buffer.isBuffer(image)) {
      imageBuffer = image;
    } else if (image && image.type === 'Buffer' && Array.isArray(image.data)) {
      imageBuffer = Buffer.from(image.data);
    } else {
      throw new Error(
        'Invalid image parameter. Expected a base64 string, Buffer object, or Buffer-like object.'
      );
    }

    const result = await global.sock
      .sendMessage(to, {
        image: imageBuffer,
        caption: caption,
      })
      .catch((error) => {
        throw new Error(`Failed to send WhatsApp image: ${error.message}`);
      });

    if (!result || !result.key) {
      throw new Error('Failed to send WhatsApp image');
    }

    console.log(`Image sent successfully to ${to}`);
    return result;
  }

  async sendDocument(to, filename, document, caption) {
    if (!Buffer.isBuffer(document)) {
      if (typeof document === 'object' && document.type === 'Buffer') {
        document = Buffer.from(document.data);
      } else {
        throw new Error(
          'Invalid document format. Expected a Buffer or Buffer-like object.'
        );
      }
    }

    const result = await global.sock
      .sendMessage(to, {
        document: document,
        mimetype: 'application/pdf', // Adjust this based on the actual document type
        fileName: filename,
        caption: caption,
      })
      .catch((error) => {
        throw new Error(`Failed to send WhatsApp document: ${error.message}`);
      });

    if (!result || !result.key) {
      throw new Error('Failed to send WhatsApp document');
    }

    console.log(`Document sent successfully to ${to}`);
    return result;
  }

  async completeTask(taskId, success, markAsFailed = false) {
    try {
      await axios.post(`${API_BASE_URL}/complete-task`, {
        task_id: taskId,
        success: success,
        mark_as_failed: markAsFailed,
      });
    } catch (error) {
      console.error('Error completing task:', error);
    }
  }

  async logQueueState() {
    try {
      const response = await axios.get(`${API_BASE_URL}/queue-state`, {
        params: { bot_id: BOT_ID },
      });
      console.log('Current queue state:', response.data);
    } catch (error) {
      console.error('Error fetching queue state:', error);
    }
  }

  startPolling() {
    this.pollInterval = setInterval(() => this.process(), 5000); // Poll every 5 seconds
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async initialize() {
    try {
      await axios.post(`${API_BASE_URL}/resetStuckTasks`);
      console.log('Stuck tasks reset');
    } catch (error) {
      console.error('Error resetting stuck tasks:', error);
    }
    this.resume();
    setInterval(() => this.sendHeartbeat(), 30000); // Send heartbeat every 30 seconds
  }

  async sendHeartbeat() {
    try {
      await axios.post(`${API_BASE_URL}/bot-heartbeat`, { bot_id: BOT_ID });
    } catch (error) {
      console.error('Error sending heartbeat:', error);
    }
  }
}

module.exports = Queue;
