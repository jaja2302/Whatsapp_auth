const {
  handleijinmsg,
  runfunction,
  userchoice,
  sendImageWithCaption,
} = require('./izinkebun/helper');
const axios = require('axios');
const { handleIotInput } = require('../helper');
const userIotChoice = {};
const handlePrivateMessage = async (lowerCaseMessage, noWa, text, sock) => {
  if (lowerCaseMessage === '!izin') {
    // Start the ijin process only if it's not already started
    if (!userchoice[noWa]) {
      await handleijinmsg(noWa, lowerCaseMessage, sock);
    }
  } else if (userchoice[noWa]) {
    // Continue the ijin process if it has already started
    await handleijinmsg(noWa, text, sock);
  } else if (lowerCaseMessage === '!iot') {
    if (!userIotChoice[noWa]) {
      await handleIotInput(noWa, lowerCaseMessage, sock);
    }
  } else if (userIotChoice[noWa]) {
    // Continue the input process if it has already started
    await handleIotInput(noWa, text, sock);
  } else {
    if (lowerCaseMessage === 'ya') {
      const imagePath = './img/step1.jpeg';
      const imagePath2 = './img/step2.jpeg';
      const caption = 'Harap balas pesan dengan cara tekan/tahan pesan di atas';
      const caption2 =
        'Lalu balas *ya* untuk menyetujui izin di atas, atau balas *tidak* untuk menolak izin di atas.\n\nAtau balas *ya semua* tanpa menekan/menahan pesan di atas untuk menyetujui semua izin atas persetujuan anda.';

      await sendImageWithCaption(sock, noWa, imagePath, caption);
      await sendImageWithCaption(sock, noWa, imagePath2, caption2);
    } else if (lowerCaseMessage === 'tidak') {
      const imagePath = './img/step1.jpeg';
      const imagePath2 = './img/step2.jpeg';
      const caption = 'Harap balas pesan dengan cara tekan/tahan pesan di atas';
      const caption2 =
        'Lalu balas *tidak* untuk menyetujui izin di atas, atau balas *ya* untuk menerima izin di atas.\n\nAtau balas *tidak semua* tanpa menekan/menahan pesan di atas untuk menolak semua izin atas persetujuan anda.';

      await sendImageWithCaption(sock, noWa, imagePath, caption);
      await sendImageWithCaption(sock, noWa, imagePath2, caption2);
    } else if (lowerCaseMessage === 'ya semua') {
      try {
        const response = await axios.post(
          'https://management.srs-ssms.com/api/getizinverifinew',
          {
            email: 'j',
            password: 'j',
            no_hp: noWa,
            jawaban: 'ya',
          }
        );
        let responses = response.data;
        if (Array.isArray(responses.messages)) {
          const allMessages = responses.messages.join('\n');
          await sock.sendMessage(noWa, {
            text: `${allMessages}`,
          });
        } else {
          await sock.sendMessage(noWa, {
            text: `${responses.message}`,
          });
        }
      } catch (error) {
        if (error.response) {
          await sock.sendMessage(noWa, {
            text: `${error.response.data.message || 'Something went wrong'}`,
          });
        } else if (error.request) {
          await sock.sendMessage(noWa, {
            text: 'No response from the server. Please try again later.',
          });
        } else {
          await sock.sendMessage(noWa, {
            text: `Error: ${error.message}`,
          });
        }
      }
    } else if (lowerCaseMessage === 'tidak semua') {
      try {
        const response = await axios.post(
          'https://management.srs-ssms.com/api/getizinverifinew',
          {
            email: 'j',
            password: 'j',
            no_hp: noWa,
            jawaban: 'tidak',
          }
        );
        let responses = response.data;
        if (Array.isArray(responses.messages)) {
          const allMessages = responses.messages.join('\n');
          await sock.sendMessage(noWa, {
            text: `${allMessages}`,
          });
        } else {
          await sock.sendMessage(noWa, {
            text: `${responses.message}`,
          });
        }
      } catch (error) {
        if (error.response) {
          await sock.sendMessage(noWa, {
            text: `${error.response.data.message || 'Something went wrong'}`,
          });
        } else if (error.request) {
          await sock.sendMessage(noWa, {
            text: 'No response from the server. Please try again later.',
          });
        } else {
          await sock.sendMessage(noWa, {
            text: `Error: ${error.message}`,
          });
        }
      }
    }
  }
};

module.exports = {
  handlePrivateMessage,
};