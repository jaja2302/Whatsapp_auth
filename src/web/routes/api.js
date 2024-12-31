const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');
const GradingController = require('../controllers/gradingController');
const logger = require('../../services/logger');
const fs = require('fs').promises;
const path = require('path');

// Add body parser middleware
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// Log all API requests
router.use((req, res, next) => {
  logger.info.whatsapp(`API Request: ${req.method} ${req.originalUrl}`);
  next();
});

const dashboardController = new DashboardController(global.io);
const gradingController = new GradingController(global.io);

// Dashboard routes
router.get('/status', (req, res) => {
  logger.debug.whatsapp('Getting WhatsApp status');
  dashboardController.getStatus(req, res);
});

router.post('/whatsapp/reconnect', (req, res) => {
  logger.info.whatsapp('Reconnect request received');
  dashboardController.reconnectWhatsApp(req, res);
});

router.post('/whatsapp/disconnect', (req, res) => {
  logger.info.whatsapp('Disconnect request received');
  dashboardController.disconnectWhatsApp(req, res);
});

router.post('/queue/start', (req, res) => {
  logger.info.whatsapp('Queue start request received');
  dashboardController.startQueue(req, res);
});

router.post('/queue/pause', (req, res) => {
  logger.info.whatsapp('Queue pause request received');
  dashboardController.pauseQueue(req, res);
});

// Grading routes
router.get('/grading/fetch-mill-data', (req, res) => {
  // console.log(req.body, res);

  // logger.info.grading('Fetch mill data request received');
  gradingController.fetchMillData(req, res);
});

router.post('/grading/update-cron-settings', (req, res) => {
  logger.info.grading('Update cron settings request received');
  gradingController.updateCronSettings(req, res);
});

router.get('/grading/get-cron-settings', (req, res) => {
  logger.debug.grading('Getting cron settings');
  gradingController.getCronSettings(req, res);
});

// Add these new group settings routes
router.get('/grading/get-group-settings', (req, res) => {
  logger.debug.grading('Getting group settings');
  gradingController.getGroupSettings(req, res);
});

router.post('/grading/update-group-settings', (req, res) => {
  logger.info.grading('Update group settings request received');
  gradingController.updateGroupSettings(req, res);
});

// Error handling middleware
router.use((err, req, res, next) => {
  logger.error.whatsapp('API Error:', err);
  res.status(500).json({ success: false, error: err.message });
});

router.get('/whatsapp/get-participants', (req, res) => {
  logger.info.whatsapp('Get participants request received');
  dashboardController.getParticipants(req, res);
});

router.get('/failed-jobs', async (req, res) => {
  try {
    const failedJobsPath = path.join(__dirname, '../data/failed_jobs.json');
    let failedJobs = [];

    try {
      const data = await fs.readFile(failedJobsPath, 'utf8');
      failedJobs = JSON.parse(data);
    } catch (error) {
      // If file doesn't exist or is corrupted, return empty array
    }

    res.json(failedJobs);
  } catch (error) {
    logger.error.whatsapp('Error getting failed jobs:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/failed-jobs', async (req, res) => {
  try {
    const failedJobsPath = path.join(__dirname, '../data/failed_jobs.json');
    await fs.writeFile(failedJobsPath, '[]', 'utf8');
    logger.info.whatsapp('Failed jobs cleared');
    res.json({ success: true });
  } catch (error) {
    logger.error.whatsapp('Error clearing failed jobs:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
