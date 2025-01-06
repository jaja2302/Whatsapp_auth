const axios = require('axios');
const logger = require('../services/logger');
const pusherService = require('../services/pusher');
const { isProgramActive } = require('../utils/programHelper');

class IzinKebunProgram {
  constructor() {
    this.running = false;
    this.CHANNEL_NAME = 'my-channel';
    this.EVENT_NAME = 'izinkebunnotif';
    this.pusherWatcher = null;
    this.userchoice = {};
    this.botpromt = {};
    this.timeoutHandles = {};
    this.idgroup = '120363205553012899@g.us';

    if (!global.queue) {
      global.queue = require('../services/queue');
    }
  }

  static async init() {
    try {
      logger.info.izinkebun('Initializing izin kebun program');
      const instance = new IzinKebunProgram();
      await global.queue.init();
      return instance;
    } catch (error) {
      logger.error.izinkebun('Error initializing izin kebun program:', error);
      throw error;
    }
  }

  start() {
    if (!this.running) {
      this.running = true;

      this.pusherWatcher = pusherService.getDataPusher(
        this.CHANNEL_NAME,
        this.EVENT_NAME,
        'izinkebun',
        (data) => {
          if (!this.running) {
            logger.info.izinkebun('Ignoring event: Program is stopped');
            return;
          }
          logger.info.izinkebun('Received izin kebun notification:', data);
          this.handleIzinKebunNotification(data);
        }
      );

      logger.info.izinkebun('Izin kebun program started');
    }
  }

  stop() {
    if (this.running) {
      this.running = false;
      if (this.pusherWatcher) {
        this.pusherWatcher.stop();
        this.pusherWatcher = null;
      }
      logger.info.izinkebun('Izin kebun program stopped');
    }
  }

  handleTimeout(noWa, sock) {
    if (this.timeoutHandles[noWa]) {
      clearTimeout(this.timeoutHandles[noWa]);
    }

    this.timeoutHandles[noWa] = setTimeout(
      async () => {
        logger.info.izinkebun(`Timeout triggered for ${noWa}`);
        await sock.sendMessage(noWa, {
          text: 'Waktu Anda telah habis. Silakan mulai kembali dengan mengetikkan !izin.',
        });
        delete this.userchoice[noWa];
        delete this.botpromt[noWa];
        delete this.timeoutHandles[noWa];
      },
      5 * 60 * 1000
    );
  }

  async getuserinfo(user) {
    try {
      const response = await axios.post(
        'https://qc-apps.srs-ssms.com/api/getuserinfo',
        { nama: user }
      );
      return response.data.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return { message: 'Nama User tidak ditemukan' };
      }
      logger.error.izinkebun('Error fetching user info:', error);
      return null;
    }
  }

  // ... tambahkan method lain yang diperlukan seperti checkatasan, updatestatus_sock_vbot dll

  async handleIzinKebunNotification(itemdata) {
    try {
      if (!itemdata?.data) {
        logger.error.izinkebun('Invalid notification data');
        return;
      }

      const data = itemdata.data;

      // Handle different notification types
      switch (data.type) {
        case 'send_atasan_satu':
          await this.handleAtasanSatuNotification(data);
          break;
        case 'send_atasan_dua':
          await this.handleAtasanDuaNotification(data);
          break;
        // ... handle other notification types
      }
    } catch (error) {
      logger.error.izinkebun('Error handling notification:', error);
    }
  }

  // ... tambahkan method handler untuk setiap jenis notifikasi
}

module.exports = IzinKebunProgram;
