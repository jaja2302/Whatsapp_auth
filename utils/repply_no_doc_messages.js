const axios = require('axios');
require('dotenv').config();

const userApprovalState = new Map();

async function verifcationJobVacancy(noWa, sock, message) {
  try {
    // Get the quoted message
    const quotedMsg =
      message?.message?.extendedTextMessage?.contextInfo?.quotedMessage
        ?.conversation ||
      message?.message?.extendedTextMessage?.contextInfo?.quotedMessage
        ?.extendedTextMessage?.text;

    if (!quotedMsg) {
      await sock.sendMessage(noWa, {
        text: 'Mohon reply pesan persetujuan job vacancy yang valid',
      });
      return;
    }

    // Extract Nama Jabatan using regex
    const namaJabatanMatch = quotedMsg.match(/Nama Jabatan : (.*?) \((\d+)\)/);

    if (!namaJabatanMatch) {
      await sock.sendMessage(noWa, {
        text: 'Format pesan tidak valid',
      });
      return;
    }

    const [_, namaJabatan, idJabatan] = namaJabatanMatch;
    const response = message?.message?.extendedTextMessage?.text;

    // Validate response format (salary, date)
    const responseMatch = response?.match(/^(\d+),\s*(\d{4}-\d{2}-\d{2})$/);

    if (!responseMatch) {
      await sock.sendMessage(noWa, {
        text: `*PERSETUJUAN JOB VACANCY*\nNama Jabatan : ${namaJabatan} (${idJabatan})\n\nFormat tidak valid. Mohon reply pesan ini dengan format: gaji, tahun-bulan-tanggal\nContoh: 5000000, 2025-01-31`,
      });
      return;
    }

    const [__, salary, deadline] = responseMatch;

    // Validate date format
    const deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate.getTime())) {
      await sock.sendMessage(noWa, {
        text: `*PERSETUJUAN JOB VACANCY*\nNama Jabatan : ${namaJabatan} (${idJabatan})\n\nFormat tanggal tidak valid. Gunakan format: YYYY-MM-DD\nContoh: 5000000, 2025-01-31`,
      });
      return;
    }

    const apiToken = process.env.API_TOKEN?.trim();
    if (!apiToken) {
      console.error('API Token not found in environment variables');
    }

    try {
      const response = await axios.post(
        'http://127.0.0.1:8000/api/verification-job-vacancy',
        {
          id: idJabatan,
          gaji: salary,
          deadline: deadline,
          user_number: noWa,
        },
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );

      // Send success message
      await sock.sendMessage(noWa, {
        text: `*PERSETUJUAN JOB VACANCY*\nNama Jabatan : ${namaJabatan} (${idJabatan})\n\n${response.data.message || 'Persetujuan job vacancy berhasil diproses'}`,
      });
    } catch (apiError) {
      console.error('API Error:', apiError);
      await sock.sendMessage(noWa, {
        text: `*PERSETUJUAN JOB VACANCY*\nNama Jabatan : ${namaJabatan} (${idJabatan})\n\n${apiError.response?.data?.message || 'Terjadi kesalahan saat memproses persetujuan'}`,
      });
    }
  } catch (error) {
    console.error('Error in verifcationJobVacancy:', error);
    await sock.sendMessage(noWa, {
      text: 'Terjadi kesalahan dalam memproses permintaan',
    });
  }
}

const handleReplyNoDocMessage = async (
  conversation,
  noWa,
  sock,
  respon_atasan,
  message
) => {
  // Cek apakah user sedang dalam proses approval
  const state = userApprovalState.get(noWa);
  if (state) {
    await verifcationJobVacancy(noWa, sock, message, true);
    return;
  }

  if (conversation.includes('Permintaan Persetujuan Izin Baru')) {
    const idPemohonStartIndex =
      conversation.indexOf('ID Pemohon: ') + 'ID Pemohon: '.length;
    const idPemohonEndIndex = conversation.indexOf('\n', idPemohonStartIndex);
    const idPemohon = conversation
      .substring(idPemohonStartIndex, idPemohonEndIndex)
      .trim();

    // Splitting ID Pemohon into id and idAtasan
    const [id, idAtasan] = idPemohon.split('/').map((part) => part.trim());

    // Extracting Nama Pemohon
    const namaStartIndex =
      conversation.indexOf('Nama Pemohon: ') + 'Nama Pemohon: '.length;
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
        // const response = await axios.post('http://qc-apps2.test/api/updatenotifijin', {
        const response = await axios.post(
          'https://management.srs-ssms.com/api/updatenotifijin',
          // 'http://127.0.0.1:8000/api/updatenotifijin',
          {
            id_data: id,
            id_atasan: idAtasan,
            answer: 'ya',
            email: 'j',
            password: 'j',
            response: respon_atasan,
          }
        );
        let responses = response.data;
        await sock.sendMessage(noWa, {
          text: responses.message,
        });
      } catch (error) {
        // console.log(error);

        await sock.sendMessage(noWa, {
          text: error.response.data.message ?? 'Terjadi kesalahan',
        });
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
          email: 'j',
          password: 'j',
          response: respon_atasan,
        }
      );
      let responses = response.data;
      await sock.sendMessage(noWa, {
        text: responses.message,
      });
    } catch (error) {
      // console.log(error);

      await sock.sendMessage(noWa, {
        text: error.response.data.message ?? 'Terjadi kesalahan',
      });
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
  } else if (conversation.includes('*PERSETUJUAN JOB VACANCY*')) {
    await verifcationJobVacancy(noWa, sock, message);
  }
};

module.exports = {
  handleReplyNoDocMessage,
};
