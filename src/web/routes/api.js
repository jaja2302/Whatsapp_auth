const express = require('express');
const router = express.Router();
const programController = require('../controllers/programController');

// API routes
router.get('/status', programController.getStatus);
router.post('/programs/:programName', programController.runProgram);
router.get('/logs/:programName', programController.getProgramLogs);
router.post('/whatsapp/disconnect', programController.disconnectWhatsApp);
router.post('/whatsapp/reconnect', programController.reconnectWhatsApp);

module.exports = router;
