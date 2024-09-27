const axios = require('axios');
const fs = require('fs');
const cron = require('node-cron');
const idgroup = '120363205553012899@g.us';
const idgroup_testing = '120363204285862734@g.us';
const idgroup_da = '120363303562042176@g.us';
let logFile = 'log_uptime_downtime_pc_ho.txt';
const { basename } = require('path');
const { readFileSync } = require('fs');
// Format date for logging
function formatDate(date) {
  return date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
}

async function pingGoogle() {
  const now = new Date();
  try {
    const response = await axios.get('https://www.google.com');
    if (response.status === 200) {
      fs.appendFileSync(logFile, `${formatDate(now)} - SUCCESS\n`);
    } else {
      fs.appendFileSync(logFile, `${formatDate(now)} - FAILURE\n`);
    }
  } catch (error) {
    fs.appendFileSync(logFile, `${formatDate(now)} - FAILURE\n`);
  }
}

async function sendSummary(sock) {
  const now = new Date();
  const logs = readFileSync(logFile, 'utf-8');
  const lines = logs.split('\n').filter(Boolean);
  let uptime = 0,
    downtime = 0;
  const downTimes = [];

  lines.forEach((line) => {
    const [time, status] = line.split(' - ');
    if (status === 'SUCCESS')
      uptime += 5; // Each success represents 5 minutes of uptime
    else {
      downtime += 5;
      downTimes.push(time);
    }
  });

  const messageContent =
    `Log Summary for ${now.toDateString()}:\n` +
    `Uptime: ${uptime} minutes\n` +
    `Downtime: ${downtime} minutes\n` +
    `Downtimes occurred at: ${downTimes.join(', ')}`;

  try {
    // Send the summary as a text message
    await sock.sendMessage(idgroup, { text: messageContent });

    // Send the log file as a document
    await sock.sendMessage(idgroup, {
      document: { url: logFile }, // Path to the log file
      mimetype: 'text/plain',
      fileName: basename(logFile), // File name derived from the path
    });
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
  }

  // Clear log file for the next day
  fs.writeFileSync(logFile, '');
}
module.exports = {
  pingGoogle,
  sendSummary,
};
