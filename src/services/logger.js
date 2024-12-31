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

    // Create methods for each log level
    ['info', 'error', 'warn', 'debug'].forEach((level) => {
      this[level] = {
        // Create source-specific logging methods
        grading: (message, ...args) =>
          this.broadcast(level, 'grading', message, ...args),
        whatsapp: (message, ...args) =>
          this.broadcast(level, 'whatsapp', message, ...args),
        general: (message, ...args) =>
          this.broadcast(level, 'general', message, ...args),
        // Add more sources as needed
        // another: (message, ...args) => this.broadcast(level, 'another', message, ...args)
      };
    });
  }

  broadcast(level, source, message, ...args) {
    // Log to terminal
    this.pino[level](message, ...args);

    // Format the message for web display
    const formattedMessage =
      args.length > 0 ? `${message} ${args.join(' ')}` : message;

    // Broadcast to web clients if socket.io is available
    if (global.io) {
      global.io.emit(`log-${source}`, {
        timestamp: new Date().toLocaleTimeString(),
        message: formattedMessage,
        level,
      });
    }
  }
}

// Create singleton instance
const logger = new Logger();
global.logger = logger;

module.exports = logger;
