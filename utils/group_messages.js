const userchoiceSnoozeBotPengawasanOperator = {};
const configSnoozeBotPengawasanOperator = {};
const userTalsasiChoice = {};
const {
  handleTaksasi,
  sendtaksasiest,
  sendfailcronjob,
} = require('./taksasi/taksasihelper.js');
// const { handleChatSnoozePengawasanOperatorAi } = require('../helper.js');
const { get_mill_data, run_jobs_mill } = require('./grading/gradinghelper.js');
const {
  Report_group_izinkebun,
  Fail_send_pdf,
} = require('./izinkebun/helper.js');
const axios = require('axios');

async function handleGroupMessage(message) {
  try {
    const text =
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      message.message?.imageMessage?.caption ||
      message.message?.videoMessage?.caption ||
      message.message?.documentWithCaptionMessage?.message?.documentMessage
        ?.caption ||
      ''; // Provide default empty string

    // Ensure text is a string before using startsWith
    const lowerCaseMessage = String(text).toLowerCase();

    // Rest of your group message handling logic
    if (lowerCaseMessage.startsWith('!taksasi')) {
      // Your taksasi logic
    } else if (lowerCaseMessage.startsWith('!izinkebun')) {
      // Your izinkebun logic
    }
    // ... other conditions ...
  } catch (error) {
    console.error('Error in handleGroupMessage:', error);
  }
}

module.exports = { handleGroupMessage };
