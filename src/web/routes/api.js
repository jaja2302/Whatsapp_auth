const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');
const GradingController = require('../controllers/gradingController');
const logger = require('../../services/logger');

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
router.get('/grading/mill-status', (req, res) => {
  logger.debug.grading('Getting mill status');
  gradingController.getMillStatus(req, res);
});

router.post('/grading/fetch-mill-data', (req, res) => {
  logger.info.grading('Fetch mill data request received');
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

module.exports = router;
