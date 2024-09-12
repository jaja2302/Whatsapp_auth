const axios = require('axios');
const handleReplyNoDocMessage = async (conversation, noWa, sock) => {
  if (conversation.includes('Permintaan Persetujuan Izin Baru')) {
    const idPemohonStartIndex =
      conversation.indexOf('*ID Pemohon*: ') + '*ID Pemohon*: '.length;
    const idPemohonEndIndex = conversation.indexOf('\n', idPemohonStartIndex);
    const idPemohon = conversation
      .substring(idPemohonStartIndex, idPemohonEndIndex)
      .trim();

    // Splitting ID Pemohon into id and idAtasan
    const [id, idAtasan] = idPemohon.split('/').map((part) => part.trim());

    // Extracting Nama Pemohon
    const namaStartIndex =
      conversation.indexOf('*Nama Pemohon*: ') + '*Nama Pemohon*: '.length;
    const namaEndIndex = conversation.indexOf('\n', namaStartIndex);
    const nama = conversation.substring(namaStartIndex, namaEndIndex).trim();
    // console.log(conversation);
    // console.log(idAtasan);

    if (
      respon_atasan.toLowerCase() !== 'ya' &&
      respon_atasan.toLowerCase() !== 'tidak'
    ) {
      await sock.sendMessage(
        noWa,
        { text: 'Harap hanya balas ya atau tidak' },
        { quoted: message }
      );
    } else if (respon_atasan.toLowerCase() === 'ya') {
      try {
        const response = await axios.post(
          // 'http://127.0.0.1:8000/api/updatenotifijin',
          'https://management.srs-ssms.com/api/updatenotifijin',
          {
            id_data: id,
            id_atasan: idAtasan,
            answer: 'ya',
            email: 'j',
            password: 'j',
            response: respon_atasan,
          }
        );

        // Check if status code is 2xx range (success)
        if (response.status >= 200 && response.status < 300) {
          let responses = response.data;
          console.log(`test: ${respon_atasan}`);

          await sock.sendMessage(noWa, {
            text: 'Permintaan berhasil diperbaharui',
          });

          await sock.sendMessage(noWa, {
            text: responses.message,
          });
        } else {
          // If status code is not in 2xx range, throw an error
          throw new Error(
            `API Error: ${response.status} - ${response.statusText}`
          );
        }
      } catch (error) {
        console.error('Error occurred:', error.message || error); // Log specific error message
      }
    } else if (respon_atasan.toLowerCase() === 'tidak') {
      let message = `*Alasan izin di tolak?*:\n`;
      message += `*ID Pemohon* : ${id}/${idAtasan}\n`;
      message += `*Nama* : ${nama}\n`;
      message += `Silahkan Reply Pesan ini untuk memberikan alasan izin di tolak\n`;
      await sock.sendMessage(noWa, { text: message });
    }
  } else if (conversation.includes('Alasan izin di tolak')) {
    const idPemohonStartIndex =
      conversation.indexOf('*ID Pemohon* : ') + '*ID Pemohon* : '.length;
    const idPemohonEndIndex = conversation.indexOf('\n', idPemohonStartIndex);
    const idPemohon = conversation
      .substring(idPemohonStartIndex, idPemohonEndIndex)
      .trim();
    const [id, idAtasan] = idPemohon.split('/').map((part) => part.trim());
    try {
      // const response = await axios.post('http://qc-apps2.test/api/updatenotifijin', {
      const response = await axios.post(
        'https://management.srs-ssms.com/api/updatenotifijin',
        // 'http://127.0.0.1:8000/api/updatenotifijin',
        {
          id_data: id,
          id_atasan: idAtasan,
          answer: 'tidak',
          response: respon_atasan,
          email: 'j',
          password: 'j',
        }
      );
      let responses = response.data;
      console.log(responses);

      await sock.sendMessage(noWa, {
        text: 'Izin keluar kebun berhasil di perbaharui',
      });
      await sock.sendMessage(noWa, {
        text: responses.message,
      });
    } catch (error) {
      console.log('Error approving:', error);
    }
  } else if (conversation.includes('*Permintaan barang perlu di review*:')) {
    const idPemohonStartIndex =
      conversation.indexOf('*ID* : ') + '*ID* : '.length;
    const idPemohonEndIndex = conversation.indexOf('\n', idPemohonStartIndex);
    const idPemohon = conversation
      .substring(idPemohonStartIndex, idPemohonEndIndex)
      .trim();
    const [id] = idPemohon.split('/').map((part) => part.trim());
    if (
      respon_atasan.toLowerCase() !== 'ya' &&
      respon_atasan.toLowerCase() !== 'tidak'
    ) {
      await sock.sendMessage(
        noWa,
        { text: 'Harap hanya balas ya atau tidak' },
        { quoted: message }
      );
    } else if (respon_atasan.toLowerCase() === 'ya') {
      try {
        const response = await axios.post(
          // 'http://127.0.0.1:8000/api/acceptedoreder',
          'https://management.srs-ssms.com/api/acceptedoreder',
          {
            email: 'j',
            password: 'j',
            id: id,
          }
        );
        let responses = response.data;
        await sock.sendMessage(noWa, {
          text: `${responses.message}`,
        });
      } catch (error) {
        console.log('Error approving:', error);
      }
    } else if (respon_atasan.toLowerCase() === 'tidak') {
      let message = `*Alasan request barang di tolak?*:\n`;
      message += `*ID* : ${id}\n`;
      message += `Silahkan *wajib* Reply Pesan ini dengan membalas *skip* untuk menolak tanpa alasan. Atau berikan alasan menolak request ini?\n`;
      await sock.sendMessage(noWa, { text: message });
    }
  } else if (conversation.includes('Alasan request barang di tolak')) {
    // console.log('disni');
    const idPemohonStartIndex =
      conversation.indexOf('*ID* : ') + '*ID* : '.length;
    const idPemohonEndIndex = conversation.indexOf('\n', idPemohonStartIndex);
    const idPemohon = conversation
      .substring(idPemohonStartIndex, idPemohonEndIndex)
      .trim();
    const [id] = idPemohon.split('/').map((part) => part.trim());
    console.log(respon_atasan);
    try {
      // const response = await axios.post('http://qc-apps2.test/api/updatenotifijin', {
      const response = await axios.post(
        'https://management.srs-ssms.com/api/rejectedoreder',
        {
          email: 'j',
          password: 'j',
          id: id,
          alasan: respon_atasan,
        }
      );
      let responses = response.data;
      await sock.sendMessage(noWa, {
        text: `${responses.message}`,
      });
    } catch (error) {
      console.log('Error approving:', error);
    }
  }
};

module.exports = {
  handleReplyNoDocMessage,
};
