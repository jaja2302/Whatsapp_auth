const express = require('express');
const router = express.Router();
const path = require('path');
const programController = require('../controllers/programController');

router.get('/', async (req, res) => {
  res.sendFile(path.join(__dirname, '../views/dashboard.html'));
});

// Add a new endpoint to get initial state
router.get('/initial-state', async (req, res) => {
  try {
    const schedules = await programController.getSchedulesByType('grading');
    res.json({
      success: true,
      schedules,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
