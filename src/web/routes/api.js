const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');
const GradingController = require('../controllers/gradingController');

// Add body parser middleware
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

const dashboardController = new DashboardController(global.io);
const gradingController = new GradingController(global.io);

router.get('/status', (req, res) => dashboardController.getStatus(req, res));
router.post('/whatsapp/reconnect', (req, res) =>
  dashboardController.reconnectWhatsApp(req, res)
);
router.post('/whatsapp/disconnect', (req, res) =>
  dashboardController.disconnectWhatsApp(req, res)
);
router.post('/queue/start', (req, res) =>
  dashboardController.startQueue(req, res)
);
router.post('/queue/pause', (req, res) =>
  dashboardController.pauseQueue(req, res)
);

router.get('/grading/mill-status', (req, res) =>
  gradingController.getMillStatus(req, res)
);
router.post('/grading/fetch-mill-data', (req, res) =>
  gradingController.fetchMillData(req, res)
);
router.post('/grading/update-cron-settings', (req, res) =>
  gradingController.updateCronSettings(req, res)
);
router.get('/grading/get-cron-settings', (req, res) =>
  gradingController.getCronSettings(req, res)
);

module.exports = router;
