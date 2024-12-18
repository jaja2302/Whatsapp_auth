const fs = require('fs').promises;
const path = require('path');
const fsSync = require('fs');

class MessageQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.queuePath = path.join(__dirname, '../data/message_queue.json');
    this.failedPath = path.join(__dirname, '../data/failed_messages.json');

    // Create data directory if it doesn't exist
    const dir = path.dirname(this.queuePath);
    if (!fsSync.existsSync(dir)) {
      fsSync.mkdirSync(dir, { recursive: true });
    }

    // Initialize queue
    this.init().catch(console.error);
  }

  async init() {
    try {
      await this.loadQueue();
      console.log('Queue initialized successfully');
    } catch (error) {
      console.error('Queue initialization error:', error);
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
      console.log(`Loaded ${this.queue.length} messages from queue`);
    } catch (error) {
      console.error('Error loading queue:', error);
      this.queue = [];
    }
  }

  async saveQueue() {
    try {
      await fs.writeFile(this.queuePath, JSON.stringify(this.queue, null, 2));
    } catch (error) {
      console.error('Error saving queue:', error);
    }
  }

  async addMessage(message) {
    try {
      const messageItem = {
        id: Date.now().toString(),
        message,
        attempts: 0,
        status: 'pending',
        timestamp: new Date().toISOString(),
      };

      this.queue.push(messageItem);
      await this.saveQueue();

      if (!this.processing) {
        this.processQueue();
      }

      return messageItem.id;
    } catch (error) {
      console.error('Error adding message to queue:', error);
      throw error;
    }
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    console.log('Processing queue...');

    try {
      while (this.queue.length > 0) {
        const item = this.queue[0];

        if (item.status === 'failed' && item.attempts >= 3) {
          await this.handleFailedMessage(item);
          this.queue.shift();
          continue;
        }

        try {
          if (global.sock?.user) {
            await this.sendMessage(item);
            this.queue.shift();
          } else {
            console.log('WhatsApp not connected, pausing queue processing');
            break;
          }
        } catch (error) {
          console.error(`Error processing message ${item.id}:`, error);
          item.attempts += 1;
          item.status = 'failed';
          item.error = error.message;

          if (item.attempts >= 3) {
            await this.handleFailedMessage(item);
            this.queue.shift();
          }
        }

        // Add delay between messages to prevent flooding
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } finally {
      this.processing = false;
      await this.saveQueue();
    }
  }

  async sendMessage(item) {
    try {
      const { message } = item;

      if (!message.jid) {
        throw new Error('No JID specified in message');
      }

      await global.sock.sendMessage(message.jid, message.content);

      console.log(`Message ${item.id} sent successfully`);
      return true;
    } catch (error) {
      console.error(`Error sending message ${item.id}:`, error);
      throw error;
    }
  }

  async handleFailedMessage(item) {
    try {
      const failedMessages = fsSync.existsSync(this.failedPath)
        ? JSON.parse(await fs.readFile(this.failedPath, 'utf8'))
        : [];

      failedMessages.push({
        ...item,
        failedAt: new Date().toISOString(),
      });

      await fs.writeFile(
        this.failedPath,
        JSON.stringify(failedMessages, null, 2)
      );
    } catch (error) {
      console.error('Error handling failed message:', error);
    }
  }

  // API Methods
  getQueueStatus() {
    return {
      total: this.queue.length,
      pending: this.queue.filter((item) => item.status === 'pending').length,
      failed: this.queue.filter((item) => item.status === 'failed').length,
      processing: this.processing,
    };
  }

  async clearQueue() {
    this.queue = [];
    await this.saveQueue();
    return { success: true, message: 'Queue cleared successfully' };
  }

  async retryFailedMessages() {
    try {
      if (!fsSync.existsSync(this.failedPath)) {
        return { success: true, message: 'No failed messages to retry' };
      }

      const failedMessages = JSON.parse(
        await fs.readFile(this.failedPath, 'utf8')
      );

      for (const message of failedMessages) {
        message.attempts = 0;
        message.status = 'pending';
        this.queue.push(message);
      }

      await fs.writeFile(this.failedPath, '[]');
      await this.saveQueue();

      if (!this.processing) {
        this.processQueue();
      }

      return {
        success: true,
        message: `Queued ${failedMessages.length} messages for retry`,
      };
    } catch (error) {
      console.error('Error retrying failed messages:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create and export a single instance
const messageQueue = new MessageQueue();
module.exports = messageQueue;
