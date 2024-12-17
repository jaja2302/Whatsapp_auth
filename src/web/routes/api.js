const express = require('express');
const router = express.Router();
const programController = require('../controllers/programController');
const queueController = require('../controllers/queueController');

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

module.exports = router;
