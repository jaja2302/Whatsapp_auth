const Pusher = require('pusher-js/node');
const logger = require('./logger');

class PusherService {
  constructor() {
    this.pusher = new Pusher('b193dcd8922273835547', {
      cluster: 'ap1',
      encrypted: true,
    });

    this.channels = new Map();
    this.eventCallbacks = new Map();

    this.pusher.connection.bind('connected', () => {
      logger.info.whatsapp('🟢 Pusher Connected');
    });

    this.pusher.connection.bind('error', (err) => {
      logger.error.whatsapp('🔴 Pusher Connection Error:', err);
    });
  }

  // Simplified subscribe method - hanya mengembalikan channel
  subscribeToChannel(channelName) {
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName);
    }

    const channel = this.pusher.subscribe(channelName);
    this.channels.set(channelName, channel);
    return channel;
  }

  // Method untuk mendapatkan channel yang sudah ada
  getChannel(channelName) {
    return this.channels.get(channelName);
  }

  // Method untuk unsubscribe
  unsubscribeFromChannel(channelName) {
    if (this.channels.has(channelName)) {
      this.pusher.unsubscribe(channelName);
      this.channels.delete(channelName);
    }
  }

  // Method global untuk mendapatkan data pusher
  getDataPusher(channelName, eventName, program, callback) {
    const channel = this.subscribeToChannel(channelName);
    const eventKey = `${channelName}:${eventName}`;

    // Handle subscription success
    channel.bind('pusher:subscription_succeeded', () => {
      logger.info[program](`✅ ${program} connected to ${channelName}`);

      // Bind specific event
      channel.bind(eventName, (data) => {
        logger.info[program](`📥 Received ${program} event:`, data);
        callback(data);
      });

      logger.info[program](`👀 Watching ${eventName} on ${channelName}`);
    });

    // Simpan callback untuk keperluan cleanup
    this.eventCallbacks.set(eventKey, callback);

    return {
      stop: () => {
        channel.unbind(eventName);
        this.eventCallbacks.delete(eventKey);
        logger.info[program](`Stopped watching ${eventName} on ${channelName}`);
      },
    };
  }
}

const pusherService = new PusherService();
module.exports = pusherService;
