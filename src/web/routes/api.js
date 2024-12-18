const express = require('express');
const router = express.Router();
const programController = require('../controllers/programController');
const queueController = require('../controllers/queueController');
const cron = require('node-cron');
const GradingMill = require('../programs/grading/gradingMill');
const GRADING_TYPES = require('../programs/grading/types');

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
router.get('/mill/status', programController.getMillProgramStatus);
router.post('/mill/:program/run', async (req, res) => {
  try {
    const { program } = req.params;

    if (program === GRADING_TYPES.GET_MILL_DATA) {
      await GradingMill.getMillData(global.sock);
    } else if (program === GRADING_TYPES.RUN_JOBS_MILL) {
      await GradingMill.runJobsMill();
    } else {
      throw new Error('Invalid program specified');
    }

    res.json({ success: true, message: `${program} executed successfully` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/queue/type/toggle', queueController.toggleQueueType);
router.post('/programs/schedule', programController.scheduleProgram);
router.get('/programs/schedules', programController.getProgramSchedules);
router.delete('/programs/schedule/:id', programController.deleteSchedule);

router.post('/mill/schedule', async (req, res) => {
  try {
    const { program, cronExpression } = req.body;

    // Stop existing schedule if it exists
    if (global.millCronJobs && global.millCronJobs[program]) {
      global.millCronJobs[program].stop();
    }

    // Create new schedule
    global.millCronJobs = global.millCronJobs || {};
    global.millCronJobs[program] = cron.schedule(
      cronExpression,
      async () => {
        try {
          if (program === GRADING_TYPES.GET_MILL_DATA) {
            await GradingMill.getMillData(global.sock);
          } else if (program === GRADING_TYPES.RUN_JOBS_MILL) {
            await GradingMill.runJobsMill();
          }
        } catch (error) {
          console.error(`Error executing ${program}:`, error);
          if (global.queue) {
            global.queue.emitLog(
              `Error in scheduled job ${program}: ${error.message}`,
              'error'
            );
          }
        }
      },
      {
        scheduled: true,
        timezone: 'Asia/Jakarta',
      }
    );

    // Save the schedule
    const id = `mill_${program}`;
    const schedule = {
      id,
      program,
      cronExpression,
    };

    // Add to program controller schedules
    if (programController.schedules) {
      programController.schedules.set(id, schedule);
      await programController.saveSchedules();
    } else {
      throw new Error('Program controller schedules not initialized');
    }

    res.json({
      success: true,
      message: `Updated ${program} schedule to ${cronExpression}`,
    });
  } catch (error) {
    console.error('Error updating mill schedule:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
