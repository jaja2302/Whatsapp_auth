const Pusher = require('pusher-js/node');
const logger = require('./logger');

class PusherService {
  constructor() {
    this.pusher = new Pusher('b193dcd8922273835547', {
      cluster: 'ap1',
      encrypted: true,
    });

    this.channels = new Map();

    // Add connection status logging
    this.pusher.connection.bind('connected', () => {
      logger.info.whatsapp('Pusher Connected');
    });

    this.pusher.connection.bind('error', (err) => {
      logger.error.whatsapp('Pusher Connection Error:', err);
    });
  }

  subscribeToChannel(channelName, program) {
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName);
    }

    const channel = this.pusher.subscribe(channelName);

    // Add channel subscription logging
    channel.bind('pusher:subscription_succeeded', () => {
      logger.info[program](`Successfully subscribed to ${channelName}`);
    });

    channel.bind('pusher:subscription_error', (err) => {
      logger.error[program](`Error subscribing to ${channelName}:`, err);
    });

    this.channels.set(channelName, channel);
    return channel;
  }

  getChannel(channelName) {
    return this.channels.get(channelName);
  }
}

// Create singleton instance
const pusherService = new PusherService();

module.exports = pusherService;
