const { updatestatus_sock_vbot } = require('./izinkebun/helper');
const { updateDataMill } = require('./grading/gradinghelper');

class Queue {
  constructor() {
    this.items = [];
    this.processing = false;
    this.paused = false;
  }

  push(task) {
    this.items.push(task);
    console.log(`Task added to queue: ${JSON.stringify(task)}`);
    if (!this.paused) {
      this.process();
    }
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.process();
  }

  async process() {
    if (this.processing || this.items.length === 0 || this.paused) return;

    this.processing = true;
    const task = this.items.shift();

    try {
      await this.executeTask(task);
      console.log(`Task completed: ${JSON.stringify(task)}`);
    } catch (error) {
      console.error('Error processing task:', error);
      this.items.unshift(task);
    }

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
        console.log('Unknown task type:', task.type);
    }
  }

  async sendWhatsAppMessage(to, message) {
    try {
      const result = await global.sock.sendMessage(to, { text: message });
      if (!result || !result.key) {
        throw new Error('Failed to send WhatsApp message');
      }
      console.log(`Message sent successfully to ${to}`);
      return result;
    } catch (error) {
      console.error(`Error sending WhatsApp message to ${to}:`, error);
      throw error;
    }
  }

  async sendWhatsAppImage(to, image, caption) {
    try {
      let imageBuffer;
      if (typeof image === 'string') {
        imageBuffer = Buffer.from(image, 'base64');
      } else if (Buffer.isBuffer(image)) {
        imageBuffer = image;
      } else {
        console.error(
          'Invalid image parameter. Expected a base64 string or Buffer object.'
        );
        return null; // Return null instead of throwing an error
      }

      const result = await global.sock.sendMessage(to, {
        image: imageBuffer,
        caption: caption,
      });

      if (!result || !result.key) {
        console.error('Failed to send WhatsApp image');
        return null; // Return null instead of throwing an error
      }

      console.log(`Image sent successfully to ${to}`);
      return result;
    } catch (error) {
      console.error(`Error sending WhatsApp image to ${to}:`, error);
      return null; // Return null instead of re-throwing the error
    }
  }

  async sendWhatsAppDocument(to, filename, document, caption) {
    try {
      let documentBuffer;
      if (typeof document === 'string') {
        // If document is a base64 string, convert it to a Buffer
        documentBuffer = Buffer.from(document, 'base64');
      } else if (Buffer.isBuffer(document)) {
        documentBuffer = document;
      } else {
        console.error(
          'Invalid document parameter. Expected a base64 string or Buffer object.'
        );
        return null; // Return null instead of throwing an error
      }

      const result = await global.sock.sendMessage(to, {
        document: documentBuffer,
        mimetype: 'application/pdf',
        fileName: filename || 'document.pdf',
        caption: caption,
      });

      if (!result || !result.key) {
        console.error('Failed to send WhatsApp document');
        return null; // Return null instead of throwing an error
      }

      console.log(`Document sent successfully to ${to}`);
      return result;
    } catch (error) {
      console.error(`Error sending WhatsApp document to ${to}:`, error);
      return null; // Return null instead of re-throwing the error
    }
  }
}

module.exports = Queue;
