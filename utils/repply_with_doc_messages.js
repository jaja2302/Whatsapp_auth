const axios = require('axios');
const handleReplyDocMessage = async (conversation, noWa, sock) => {
  const documentMessage =
    quotedMessage.documentWithCaptionMessage.message.documentMessage;
  // Handle reply to document
  if (
    conversation.includes(
      'Anda memiliki permintaan untuk meverifikasi data dari rekomendator'
    )
  ) {
    // Extract the Doc ID
    const docIdMatch = conversation.match(/\*Doc ID\* : (\d+\/\d+)/);
    if (docIdMatch) {
      const docId = docIdMatch[1];
      const [id, user_id] = docId.split('/');
      // console.log(respon_atasan.toLowerCase());
      if (respon_atasan.toLowerCase() === 'ya') {
        try {
          const response = await axios.post(
            'https://management.srs-ssms.com/api/get_approval_rapid_response',
            {
              id: id,
              user_id: user_id,
              answer: 'ya',
              email: 'j',
              password: 'j',
            }
          );
          let responses = response.data;
          await sock.sendMessage(noWa, {
            text: 'Mohon Tunggu server melakukan validasi.....',
          });
          await sock.sendMessage(noWa, {
            text: responses.message,
          });
        } catch (error) {
          console.log('Error approving:', error);
        }
      } else if (respon_atasan.toLowerCase() === 'tidak') {
        try {
          const response = await axios.post(
            'https://management.srs-ssms.com/api/get_approval_rapid_response',
            {
              id: id,
              user_id: user_id,
              answer: 'tidak',
              email: 'j',
              password: 'j',
            }
          );
          let responses = response.data;
          await sock.sendMessage(noWa, {
            text: 'Mohon Tunggu server melakukan validasi.....',
          });
          await sock.sendMessage(noWa, {
            text: responses.message,
          });
        } catch (error) {
          console.log('Error approving:', error);
        }
      } else {
        await sock.sendMessage(noWa, {
          text: 'Hanya bisa memilih ya atau tidak',
        });
      }
    } else {
      console.log('Doc ID not found in the message.');
    }
  }
};

module.exports = {
  handleReplyDocMessage,
};
