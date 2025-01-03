const pusherService = require('../services/pusher');
const queue = require('../services/queue');
const logger = require('../services/logger');

class SmartlabsProgram {
  constructor() {
    this.channel = null;
    this.running = false;
  }

  start() {
    if (!this.running) {
      this.running = true;
      this.channel = pusherService.subscribeToChannel(
        'my-channel',
        'smartlabs'
      );
      this.setupPusherBindings();
      logger.info.smartlabs('Smartlabs program started');
    }
  }

  stop() {
    if (this.running) {
      this.running = false;
      if (this.channel) {
        this.channel.unbind_all();
        pusherService.pusher.unsubscribe('my-channel');
        this.channel = null;
      }
      logger.info.smartlabs('Smartlabs program stopped');
    }
  }

  getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) return 'Selamat Pagi';
    if (hour >= 12 && hour < 15) return 'Selamat Siang';
    if (hour >= 15 && hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  }

  setupPusherBindings() {
    if (!this.channel) {
      logger.error.smartlabs('Cannot setup bindings: Channel not initialized');
      return;
    }

    logger.info.smartlabs('Setting up Pusher bindings...');

    this.channel.bind('Smartlabsnotificationtest', (data) => {
      if (!this.running) {
        logger.info.smartlabs('Ignoring event: Program is stopped');
        return;
      }
      logger.info.smartlabs('Received Pusher event:', data);
      this.handleSmartlabsNotification(data);
    });
  }

  async handleSmartlabsNotification(itemdata) {
    logger.info.smartlabs('Received Smartlabs notification:', itemdata);

    // Handle test data
    if (itemdata === 'testing' || typeof itemdata === 'string') {
      logger.info.smartlabs('Received test notification');
      return;
    }

    // Validate data structure
    if (!itemdata?.data || !Array.isArray(itemdata.data)) {
      logger.error.smartlabs('Invalid data format received:', itemdata);
      return;
    }

    // Process only if we have valid data items
    if (itemdata.data.length === 0) {
      logger.info.smartlabs('Received empty data array');
      return;
    }

    for (const dataitem of itemdata.data) {
      try {
        if (!this.validateDataItem(dataitem)) {
          logger.warn.smartlabs('Skipping invalid data item:', dataitem);
          continue;
        }
        await this.processNotificationItem(dataitem);
      } catch (error) {
        logger.error.smartlabs('Error processing notification item:', error);
      }
    }
  }

  validateDataItem(dataitem) {
    // Add validation for required fields
    const requiredFields = [
      'penerima',
      'no_surat',
      'nama_departemen',
      'jenis_sampel',
      'jumlah_sampel',
      'progresss',
      'tanggal_registrasi',
      'estimasi',
      'kodesample',
    ];

    for (const field of requiredFields) {
      if (!dataitem[field]) {
        logger.warn.smartlabs(`Missing required field: ${field}`);
        return false;
      }
    }

    return true;
  }

  async processNotificationItem(dataitem) {
    const message = this.formatMessage(dataitem);

    // Send WhatsApp message
    queue.push({
      type: 'send_message',
      data: {
        to: `${dataitem.penerima}@s.whatsapp.net`,
        message,
      },
    });

    // Handle invoice for external customers
    if (dataitem.asal === 'Eksternal') {
      await this.sendInvoice(dataitem);
    }
  }

  formatMessage(dataitem) {
    let message = `Yth. Pelanggan Setia Lab CBI ✨\n\n`;

    if (dataitem.type === 'input') {
      message += `📥 Progress Sampel anda telah kami terima dengan:\n\n`;
    } else if (dataitem.progresss === 'Rilis Sertifikat') {
      message += `*Sampel anda sudah selesai kami proses!*\n\n`;
    } else {
      message += `Progress Sampel anda telah Terupdate dengan:\n\n`;
    }

    message += `*No. Surat* : ${dataitem.no_surat}\n`;
    message += `*Departemen* : ${dataitem.nama_departemen}\n`;
    message += `*Jenis Sampel* : ${dataitem.jenis_sampel}\n`;
    message += `*Jumlah Sampel* : ${dataitem.jumlah_sampel}\n`;
    message += `*Status* : ${dataitem.progresss === 'Rilis Sertifikat' ? 'Selesai' : dataitem.progresss}\n`;
    message += `*Tanggal Registrasi* : ${new Date(dataitem.tanggal_registrasi).toLocaleDateString('id-ID')}\n`;
    message += `*Estimasi* : ${new Date(dataitem.estimasi).toLocaleDateString('id-ID')}\n\n`;

    if (dataitem.progresss === 'Rilis Sertifikat') {
      message += `📋 *Sertifikat dapat didownload dengan kode tracking:*\n*${dataitem.kodesample}*\n`;
      message += `🌐Disini : https://smartlab.srs-ssms.com\n\n`;
    } else {
      message += `🌐Progress anda dapat dilihat disini :\nhttps://smartlab.srs-ssms.com\n\n`;
      message += `Progress saat ini dapat dicek dengan kode tracking:\n*${dataitem.kodesample}*\n\n`;
    }

    message += `Terima kasih telah mempercayakan sampel anda untuk dianalisa di Lab kami.`;
    return message;
  }

  async sendInvoice(dataitem) {
    try {
      const response = await axios.get(
        'https://management.srs-ssms.com/api/invoices_smartlabs',
        {
          params: {
            email: 'j',
            password: 'j',
            id_data: dataitem.id_invoice,
          },
        }
      );

      if (response.data?.pdf) {
        const pdfBuffer = Buffer.from(response.data.pdf, 'base64');
        const pdfFilename = response.data.filename || 'Invoice.pdf';

        queue.push({
          type: 'send_document',
          data: {
            to: `${dataitem.penerima}@s.whatsapp.net`,
            document: pdfBuffer,
            mimetype: 'application/pdf',
            fileName: pdfFilename,
            caption: 'Invoice Smartlabs',
          },
        });
      } else {
        logger.error.smartlabs('PDF not found in the API response smartlab.');
      }
    } catch (error) {
      logger.error.smartlabs('Error sending invoice:', error);
    }
  }
}

module.exports = SmartlabsProgram;
