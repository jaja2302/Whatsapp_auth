const pino = require('pino');

class Logger {
  constructor() {
    this.pino = pino({
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  broadcast(level, message, ...args) {
    // Log to terminal
    this.pino[level](message, ...args);

    // Format the message for web display
    const formattedMessage =
      args.length > 0 ? `${message} ${args.join(' ')}` : message;

    // Broadcast to web clients if socket.io is available
    if (global.io) {
      global.io.emit('log', {
        timestamp: new Date().toLocaleTimeString(),
        message: formattedMessage,
        level,
      });
    }
  }

  info(message, ...args) {
    this.broadcast('info', message, ...args);
  }

  error(message, ...args) {
    this.broadcast('error', message, ...args);
  }

  warn(message, ...args) {
    this.broadcast('warn', message, ...args);
  }

  debug(message, ...args) {
    this.broadcast('debug', message, ...args);
  }
}

// Create singleton instance
const logger = new Logger();
global.logger = logger;

module.exports = logger;
