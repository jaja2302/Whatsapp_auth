const express = require('express');
const router = express.Router();
const path = require('path');

// Login page
router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/login.html'));
});

// Logout route
router.get('/logout', (req, res) => {
  res.redirect('/');
});

module.exports = router;
