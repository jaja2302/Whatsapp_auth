const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');
const GradingController = require('../controllers/gradingController');
const SmartlabsController = require('../controllers/smartlabsController');
const TaksasiController = require('../controllers/taksasiController');
const IzinKebunController = require('../controllers/izinkebunController');
const IotController = require('../controllers/iotController');
const logger = require('../../services/logger');
const fs = require('fs').promises;
const path = require('path');
const GeneralController = require('../controllers/generalController');

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
const smartlabsController = new SmartlabsController(global.io);
const taksasiController = new TaksasiController(global.io);
const izinkebunController = new IzinKebunController(global.io);
const iotController = new IotController(global.io);
const generalController = new GeneralController(global.io);

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

// Add these Smartlabs routes
router.get('/smartlabs/get-status', (req, res) => {
  logger.debug.smartlabs('Getting Smartlabs status');
  smartlabsController.getStatus(req, res);
});

router.post('/smartlabs/start', (req, res) => {
  logger.info.smartlabs('Start Smartlabs program request received');
  smartlabsController.startProgram(req, res);
});

router.post('/smartlabs/stop', (req, res) => {
  logger.info.smartlabs('Stop Smartlabs program request received');
  smartlabsController.stopProgram(req, res);
});

// Taksasi routes
router.get('/taksasi/get-cron-settings', (req, res) => {
  logger.debug.taksasi('Getting cron settings');
  taksasiController.getCronSettings(req, res);
});

router.post('/taksasi/update-cron-settings', (req, res) => {
  logger.info.taksasi('Update cron settings request received');
  taksasiController.updateCronSettings(req, res);
});

router.get('/taksasi/get-cron-status', (req, res) => {
  logger.debug.taksasi('Getting cron status');
  taksasiController.getCronJobStatus(req, res);
});

// Individual job control routes for Taksasi
router.post('/taksasi/jobs/:jobName/start', (req, res) => {
  logger.info.taksasi(`Start job ${req.params.jobName} request received`);
  taksasiController.startJob(req, res);
});

router.post('/taksasi/jobs/:jobName/stop', (req, res) => {
  logger.info.taksasi(`Stop job ${req.params.jobName} request received`);
  taksasiController.stopJob(req, res);
});

// Add these new routes for taksasi program control
router.get('/taksasi/get-status', (req, res) => {
  logger.debug.taksasi('Getting Taksasi status');
  taksasiController.getStatus(req, res);
});

router.post('/taksasi/start', (req, res) => {
  logger.info.taksasi('Start Taksasi program request received');
  taksasiController.startProgram(req, res);
});

router.post('/taksasi/stop', (req, res) => {
  logger.info.taksasi('Stop Taksasi program request received');
  taksasiController.stopProgram(req, res);
});

// Izin Kebun routes
router.get('/izinkebun/get-status', (req, res) => {
  logger.debug.izinkebun('Getting Izin Kebun status');
  izinkebunController.getStatus(req, res);
});

router.post('/izinkebun/start', (req, res) => {
  logger.info.izinkebun('Start Izin Kebun program request received');
  izinkebunController.startProgram(req, res);
});

router.post('/izinkebun/stop', (req, res) => {
  logger.info.izinkebun('Stop Izin Kebun program request received');
  izinkebunController.stopProgram(req, res);
});

// Add IOT routes
router.get('/iot/get-cron-settings', (req, res) => {
  logger.debug.iot('Getting cron settings');
  iotController.getCronSettings(req, res);
});

router.post('/iot/update-cron-settings', (req, res) => {
  logger.info.iot('Update cron settings request received');
  iotController.updateCronSettings(req, res);
});

router.get('/iot/get-cron-status', (req, res) => {
  logger.debug.iot('Getting cron status');
  iotController.getCronJobStatus(req, res);
});

router.post('/iot/jobs/:jobName/start', (req, res) => {
  logger.info.iot(`Start job ${req.params.jobName} request received`);
  iotController.startJob(req, res);
});

router.post('/iot/jobs/:jobName/stop', (req, res) => {
  logger.info.iot(`Stop job ${req.params.jobName} request received`);
  iotController.stopJob(req, res);
});

router.get('/iot/fetch-weather-data', (req, res) => {
  logger.info.iot('Fetch weather data request received');
  iotController.fetchWeatherData(req, res);
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

router.get(
  '/grading/get-cron-status',
  gradingController.getCronJobStatus.bind(gradingController)
);
router.post(
  '/grading/stop-cron-jobs',
  gradingController.stopCronJobs.bind(gradingController)
);
router.post(
  '/grading/start-cron-jobs',
  gradingController.startCronJobs.bind(gradingController)
);

// Individual job control routes
router.post(
  '/grading/jobs/:jobName/start',
  gradingController.startJob.bind(gradingController)
);
router.post(
  '/grading/jobs/:jobName/stop',
  gradingController.stopJob.bind(gradingController)
);

// Generic program control routes
router.get('/program/:program/status', (req, res) => {
  dashboardController.getProgramStatus(req, res);
});

router.post('/program/:program/start', (req, res) => {
  dashboardController.startProgram(req, res);
});

router.post('/program/:program/stop', (req, res) => {
  dashboardController.stopProgram(req, res);
});

// General routes
router.get('/general/get-cron-settings', (req, res) => {
  logger.debug.whatsapp('Getting general cron settings');
  generalController.getCronSettings(req, res);
});

router.post('/general/update-cron-settings', (req, res) => {
  logger.info.whatsapp('Update general cron settings request received');
  generalController.updateCronSettings(req, res);
});

router.get('/general/get-cron-status', (req, res) => {
  logger.debug.whatsapp('Getting general cron status');
  generalController.getCronJobStatus(req, res);
});

router.post('/general/jobs/:jobName/start', (req, res) => {
  logger.info.whatsapp(
    `Start general job ${req.params.jobName} request received`
  );
  generalController.startJob(req, res);
});

router.post('/general/jobs/:jobName/stop', (req, res) => {
  logger.info.whatsapp(
    `Stop general job ${req.params.jobName} request received`
  );
  generalController.stopJob(req, res);
});

// Izin Kebun routes
router.get('/izinkebun/get-cron-settings', (req, res) => {
  logger.debug.izinkebun('Getting izinkebun cron settings');
  izinkebunController.getCronSettings(req, res);
});

router.post('/izinkebun/update-cron-settings', (req, res) => {
  logger.info.izinkebun('Update izinkebun cron settings request received');
  izinkebunController.updateCronSettings(req, res);
});

router.get('/izinkebun/get-cron-status', (req, res) => {
  logger.debug.izinkebun('Getting izinkebun cron status');
  izinkebunController.getCronJobStatus(req, res);
});

router.post('/izinkebun/jobs/:jobName/start', (req, res) => {
  logger.info.izinkebun(
    `Start izinkebun job ${req.params.jobName} request received`
  );
  izinkebunController.startJob(req, res);
});

router.post('/izinkebun/jobs/:jobName/stop', (req, res) => {
  logger.info.izinkebun(
    `Stop izinkebun job ${req.params.jobName} request received`
  );
  izinkebunController.stopJob(req, res);
});

module.exports = router;
