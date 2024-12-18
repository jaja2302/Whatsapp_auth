const express = require('express');
const router = express.Router();
const programController = require('../controllers/programController');
const queueController = require('../controllers/queueController');
const cron = require('node-cron');
const GradingMill = require('../programs/grading/gradingMill');
const GRADING_TYPES = require('../programs/grading/types');
const messageQueue = require('../../../utils/queue');

// API routes
router.get('/status', programController.getStatus);
router.post('/programs/:programName', programController.runProgram);
router.get('/logs/:programName', programController.getProgramLogs);
router.post('/whatsapp/disconnect', programController.disconnectWhatsApp);
router.post('/whatsapp/reconnect', programController.reconnectWhatsApp);
router.get('/handlers', programController.getHandlerStates);
router.post('/handlers', programController.updateHandlerState);
router.get('/queue/status', queueController.getQueueStatus);
router.post('/queue/toggle', queueController.toggleQueue);
router.post('/queue/retry/:jobId', queueController.retryJob);
router.post('/mill/toggle', programController.toggleMillProgram);
router.get('/mill/status', (req, res) =>
  programController.getMillProgramStatus(req, res)
);
router.post('/mill/:program/run', programController.runMillProgram);
router.post('/queue/type/toggle', queueController.toggleQueueType);
router.post('/programs/schedule', programController.scheduleProgram);
router.get('/programs/schedules', programController.getProgramSchedules);
router.delete('/programs/schedule/:id', programController.deleteSchedule);

router.post('/mill/schedule', async (req, res) => {
  try {
    const { program, cronExpression } = req.body;
    await programController.updateSchedule(program, cronExpression);

    // Save to schedules.json
    await programController.saveSchedules();

    res.json({
      success: true,
      message: `Schedule updated for ${program}`,
    });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Add message to queue
router.post('/message/queue', async (req, res) => {
  try {
    const messageId = await messageQueue.addMessage(req.body);
    res.json({ success: true, messageId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get queue status
router.get('/message/queue/status', (req, res) => {
  const status = messageQueue.getQueueStatus();
  res.json({ success: true, status });
});

// Clear queue
router.post('/message/queue/clear', async (req, res) => {
  const result = await messageQueue.clearQueue();
  res.json(result);
});

// Retry failed messages
router.post('/message/queue/retry', async (req, res) => {
  const result = await messageQueue.retryFailedMessages();
  res.json(result);
});

module.exports = router;
