const { updatestatus_sock_vbot } = require('./izinkebun/helper');
const { updateDataMill } = require('./grading/gradinghelper');
const fs = require('fs').promises;
const path = require('path');

class Queue {
  constructor() {
    this.items = [];
    this.processing = false;
    this.paused = false;
    this.filePath = path.join(__dirname, 'queue_backup.json');
    this.loadFromDisk(); // Load queue from disk on startup
  }

  async saveToFile() {
    try {
      await fs.writeFile(this.filePath, JSON.stringify(this.items));
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
      } else {
        console.log(
          'No existing queue file found. Starting with an empty queue.'
        );
      }
    }
  }

  push(task) {
    this.items.push(task);
    console.log(`Task added to queue: ${task.type}`);
    this.saveToFile(); // Save queue to disk after adding a task
    if (!this.paused) {
      this.process();
    }
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
    const task = this.items.shift(); // Remove the task immediately

    try {
      await this.executeTask(task);
      console.log(`Task completed: ${task.type}`);
    } catch (error) {
      console.error(`Error processing task (${task.type}): ${error.message}`);
      console.log(`Skipping task: ${task.type}`);
    }

    this.saveToFile(); // Save the updated queue to disk
    this.processing = false;
    this.process(); // Process next task if available
  }

  async executeTask(task) {
    if (!global.sock || !global.sock.user) {
      throw new Error('WhatsApp connection is not established');
    }

    switch (task.type) {
      case 'send_message':
        await this.sendWhatsAppMessage(task.data.to, task.data.message);
        break;
      case 'update_status_izinkebun':
        await updatestatus_sock_vbot(task.data.id_db, task.data.type);
        break;
      case 'send_document':
        await this.sendWhatsAppDocument(
          task.data.to,
          task.data.filename,
          task.data.document,
          task.data.caption
        );
        break;
      case 'send_image':
        await this.sendWhatsAppImage(
          task.data.to,
          task.data.image,
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

  async sendWhatsAppMessage(to, message) {
    const result = await global.sock.sendMessage(to, { text: message });
    if (!result || !result.key) {
      throw new Error('Failed to send WhatsApp message');
    }
    console.log(`Message sent successfully to ${to}`);
    return result;
  }

  async sendWhatsAppImage(to, image, caption) {
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

    const result = await global.sock.sendMessage(to, {
      image: imageBuffer,
      caption: caption,
    });

    if (!result || !result.key) {
      throw new Error('Failed to send WhatsApp image');
    }

    console.log(`Image sent successfully to ${to}`);
    return result;
  }

  async sendWhatsAppDocument(to, filename, document, caption) {
    let documentBuffer;
    if (typeof document === 'string') {
      documentBuffer = Buffer.from(document, 'base64');
    } else if (Buffer.isBuffer(document)) {
      documentBuffer = document;
    } else {
      throw new Error(
        'Invalid document parameter. Expected a base64 string or Buffer object.'
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
