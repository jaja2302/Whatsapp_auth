const axios = require('axios');

// const API_BASE_URL = 'http://erpda.test/api';
const API_BASE_URL = 'https://management.srs-ssms.com/api';
const BOT_ID = '1'; // Replace with a unique identifier for this bot

const RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds
const MAX_MESSAGES_PER_WINDOW = 10; // Maximum number of messages per minute
const RATE_LIMIT_DELAY = 1000; // 1 second delay between messages
const POLL_INTERVAL = 5000; // Poll every 5 seconds
const { updatestatus_sock_vbot } = require('./izinkebun/helper');
const { updateDataMill } = require('./grading/gradinghelper');

class Queue {
  constructor(botId) {
    this.botId = botId;
    this.processing = false;
    this.paused = false;
    this.messagesSentTimestamps = [];
    this.currentTaskId = null;
    this.stuckTaskCheckInterval = null;
    this.pollInterval = null;
  }

  async push(task) {
    try {
      await axios.post(`${API_BASE_URL}/add-task`, {
        type: task.type,
        data: task.data,
      });
      console.log(`Task added to queue: ${task.type}`);
    } catch (error) {
      console.error('Error adding task to queue:', error);
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
  }

  async process() {
    if (this.processing || this.paused) {
      console.log(
        `Queue processing skipped. Processing: ${this.processing}, Paused: ${this.paused}`
      );
      return;
    }

    this.processing = true;

    try {
      const response = await axios.get(`${API_BASE_URL}/next-task`, {
        params: { bot_id: this.botId },
      });

      if (response.data && response.data.task_id) {
        const task = response.data.payload;
        this.currentTaskId = response.data.task_id;
        console.log(`Processing task: ${task.type}`, task);

        try {
          await this.executeTask(task);
          await this.completeTask(this.currentTaskId, true);
          console.log(`Task completed: ${task.type}`);
        } catch (error) {
          console.error(`Error processing task (${task.type}):`, error);
          await this.handleTaskError(response.data);
        }
        this.currentTaskId = null;
      }
    } catch (error) {
      console.error(
        'Error fetching next task:',
        error.response ? error.response.data : error.message
      );
    }

    this.processing = false;
    // Instead of setTimeout, we'll use the pollInterval
  }

  async handleTaskError(taskData) {
    if (taskData.retry_count < 3) {
      console.log(
        `Retrying task: ${taskData.payload.type} (Attempt ${taskData.retry_count + 1}/3)`
      );
      await this.completeTask(this.currentTaskId, false);
    } else {
      console.log(
        `Marking task as failed: ${taskData.payload.type} after 3 failed attempts`
      );
      await this.completeTask(this.currentTaskId, false, true);
    }
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
    } else {
      throw new Error(
        'Invalid image parameter. Expected a base64 string or Buffer object.'
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
        params: { bot_id: this.botId },
      });
      console.log('Current queue state:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching queue state:', error);
    }
  }

  startStuckTaskCheck() {
    this.stuckTaskCheckInterval = setInterval(
      () => {
        this.processStuckTasks();
      },
      5 * 60 * 1000
    ); // Check every 5 minutes
  }

  stopStuckTaskCheck() {
    if (this.stuckTaskCheckInterval) {
      clearInterval(this.stuckTaskCheckInterval);
      this.stuckTaskCheckInterval = null;
    }
  }

  async processStuckTasks() {
    try {
      const response = await axios.get(`${API_BASE_URL}/next-stuck-task`);
      if (response.data && response.data.task_id) {
        const task = response.data.payload;
        console.log(`Processing stuck task: ${task.type}`);

        try {
          await this.executeTask(task);
          await this.completeTask(response.data.task_id, true);
          console.log(`Stuck task completed: ${task.type}`);
        } catch (error) {
          console.error(`Error processing stuck task (${task.type}):`, error);
          await this.completeTask(response.data.task_id, false);
        }
      }
    } catch (error) {
      console.error('Error fetching stuck task:', error);
    }
  }

  async addTestTask(type, data) {
    console.log(`Adding test task: ${type}`, data);
    await this.push({ type, data });
    console.log('Test task added. Starting processing...');
    this.process();
  }

  async resetStuckTasks() {
    try {
      const response = await axios.post(`${API_BASE_URL}/reset-stuck-tasks`);
      console.log('Stuck tasks reset:', response.data.message);
    } catch (error) {
      console.error('Error resetting stuck tasks:', error.message);
    }
  }

  async sendHeartbeat() {
    try {
      await axios.post(`${API_BASE_URL}/bot-heartbeat`, { bot_id: this.botId });
    } catch (error) {
      console.error('Error sending heartbeat:', error);
    }
  }

  startHeartbeat() {
    setInterval(() => this.sendHeartbeat(), 30000); // Send heartbeat every 30 seconds
  }

  startPolling() {
    this.pollInterval = setInterval(() => this.process(), POLL_INTERVAL);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async initialize() {
    await this.resetStuckTasks();
    this.resume(); // This now starts the polling
    this.startStuckTaskCheck();
    this.startHeartbeat();
  }
}

module.exports = Queue;
