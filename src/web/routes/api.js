const express = require('express');
const router = express.Router();
const programController = require('../controllers/programController');
const messageQueue = require('../../services/queue');

// API routes
router.get('/status', programController.getStatus);
router.post('/programs/:programName', programController.runProgram);
router.get('/logs/:programName', programController.getProgramLogs);
router.post('/whatsapp/disconnect', programController.disconnectWhatsApp);
router.post('/whatsapp/reconnect', programController.reconnectWhatsApp);
router.get('/handlers', programController.getHandlerStates);
router.post('/handlers', programController.updateHandlerState);
router.get('/queue/status', (req, res) => {
  try {
    const status = global.queue.getStatus();
    res.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get queue status',
    });
  }
});
router.post('/mill/toggle', programController.toggleMillProgram);
router.get('/mill/status', (req, res) =>
  programController.getMillProgramStatus(req, res)
);
router.post('/mill/:program/run', programController.runMillProgram);
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

// Resume queue processing
router.post('/queue/resume', (req, res) => {
  try {
    if (!global.queue) {
      throw new Error('Queue system is not initialized');
    }
    global.queue.resume();
    res.json({
      success: true,
      message: 'Queue processing resumed',
    });
  } catch (error) {
    console.error('Error resuming queue:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to resume queue',
    });
  }
});

// Pause queue processing
router.post('/queue/pause', (req, res) => {
  try {
    if (!global.queue) {
      throw new Error('Queue system is not initialized');
    }
    global.queue.pause();
    res.json({
      success: true,
      message: 'Queue processing paused',
    });
  } catch (error) {
    console.error('Error pausing queue:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to pause queue',
    });
  }
});

// Add WhatsApp status endpoint
router.get('/whatsapp/status', (req, res) => {
  try {
    const isConnected = global.queue.checkConnection();
    res.json({
      success: true,
      connected: isConnected,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Add this new route for toggling queue
router.post('/queue/toggle', (req, res) => {
  try {
    if (!global.queue) {
      throw new Error('Queue system is not initialized');
    }

    const { pause } = req.body;
    if (pause) {
      global.queue.pause();
    } else {
      global.queue.resume();
    }

    res.json({
      success: true,
      message: `Queue ${pause ? 'paused' : 'resumed'} successfully`,
      isPaused: pause,
    });
  } catch (error) {
    console.error('Error toggling queue:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to toggle queue',
    });
  }
});

module.exports = router;
