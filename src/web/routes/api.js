const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');

const dashboardController = new DashboardController(global.io);

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

module.exports = router;
