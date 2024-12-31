const winston = require('winston');

// Create a logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'queue.log' }),
    new winston.transports.Console(),
  ],
});

const queue = [];
let isProcessing = false;

function addToQueue(task, taskName) {
  const queueItem = { task, taskName, addedAt: new Date() };
  queue.push(queueItem);
  logger.info(`Task added to queue: ${taskName}`, {
    queueLength: queue.length,
  });
  processQueue();
}

async function processQueue() {
  if (isProcessing || queue.length === 0) return;

  isProcessing = true;
  const { task, taskName, addedAt } = queue.shift();

  logger.info(`Processing task: ${taskName}`, {
    queueLength: queue.length,
    waitTime: new Date() - addedAt,
  });

  try {
    await task();
    logger.info(`Task completed successfully: ${taskName}`);
  } catch (error) {
    logger.error(`Error processing task: ${taskName}`, {
      error: error.message,
    });
    queue.unshift({ task, taskName, addedAt }); // Put the task back at the beginning of the queue
  } finally {
    isProcessing = false;
    processQueue(); // Process next task
  }
}

function getQueueStatus() {
  return {
    queueLength: queue.length,
    isProcessing,
    nextTask: queue.length > 0 ? queue[0].taskName : null,
  };
}

module.exports = { addToQueue, getQueueStatus, processQueue };
