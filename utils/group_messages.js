const userchoiceSnoozeBotPengawasanOperator = {};
const configSnoozeBotPengawasanOperator = {};
const userTalsasiChoice = {};
const {
  handleTaksasi,
  sendtaksasiest,
  sendfailcronjob,
} = require('./taksasi/taksasihelper.js');
const { handleChatSnoozePengawasanOperatorAi } = require('../helper.js');
const { get_mill_data } = require('./grading/gradinghelper.js');
const {
  Report_group_izinkebun,
  Fail_send_pdf,
} = require('./izinkebun/helper.js');
const axios = require('axios');
const handleGroupMessage = async (
  lowerCaseMessage,
  noWa,
  text,
  sock,
  message
) => {
  if (lowerCaseMessage && lowerCaseMessage.startsWith('!tarik')) {
    const estateCommand = lowerCaseMessage.replace('!tarik', '').trim();
    const estate = estateCommand.toUpperCase(); // Convert to uppercase for consistency
    // Check if the estate name is valid
    if (!estate) {
      await sock.sendMessage(
        noWa,
        {
          text: 'Mohon masukkan nama estate setelah perintah !tarik dilanjutkan dengan singkatan nama Estate.\n-Contoh !tarikkne = Untuk Estate KNE dan seterusnya',
        },
        { quoted: message }
      );
      return;
    }
    // const apiUrl = 'http://qc-apps2.test/api/getdatacron';
    const apiUrl = 'https://qc-apps.srs-ssms.com/api/getdatacron';
    try {
      const response = await axios.get(apiUrl);
      const dataestate = response.data;
      const matchingTasks = dataestate.filter((task) => task.estate === estate);
      if (matchingTasks.length > 0) {
        const {
          estate: estateFromMatchingTask,
          group_id,
          wilayah: folder,
          id,
        } = matchingTasks[0];
        await sock.sendMessage(
          noWa,
          { text: 'Mohon tunggu laporan sedang di proses' },
          { quoted: message }
        );
        const result = await sendtaksasiest(
          estateFromMatchingTask,
          group_id,
          folder,
          sock,
          id,
          'null'
        );
        await sock.sendMessage(
          noWa,
          {
            text: result.message,
          },
          { quoted: message }
        );
      } else {
        await sock.sendMessage(
          noWa,
          {
            text: 'Estate yang anda masukan tidak tersedia di database. Silahkan Ulangi dan Cek Kembali',
          },
          { quoted: message }
        );
      }
    } catch (error) {
      console.log('Error fetching data:', error.message);
    }
  } else if (lowerCaseMessage && lowerCaseMessage.startsWith('!taksasi')) {
    // console.log(lowerCaseMessage);
    await sock.sendMessage(
      noWa,
      {
        text: 'Mohon tunggu Taksasi sedang di proses',
      },
      { quoted: message }
    );
    let respon = await handleTaksasi(lowerCaseMessage, sock);
    await sock.sendMessage(
      noWa,
      {
        text: respon.message,
      },
      { quoted: message }
    );
  } else if (lowerCaseMessage === '!menu') {
    await sock.sendMessage(
      noWa,
      {
        text: 'Perintah Bot Yang tersedia \n1 = !tarik (Menarik Estate yang di pilih untuk di generate ke dalam grup yang sudah di tentukan) \n2.!getgrup (Menampilkan semua isi list group yang ada) \n3.!cast (melakukan broadcast pesan ke semua grup taksasi) \n4.!taksasi = Menarik Banyak laporar taksasi sekaligus berdasarkan waktu yang di pilih\n5.!laporan izinkebun Menarik laporan izin kebun (Harap gunakan hanya di hari sabtu atau minggu)!\n6.failcronjob = Mrnjalankan semua fail cronjob yang ada di server\n7.!failizinkebun = Mengirip pdf yang gagal terkirim izin kebun\n8.!failgrading kirim ulang grading mill fail',
      },
      { quoted: message }
    );
  } else if (lowerCaseMessage === '!failgrading') {
    await sock.sendMessage(
      noWa,
      {
        text: 'Tunggu Sebentar sedang di proses',
      },
      { quoted: message }
    );

    await get_mill_data(sock);
    await sock.sendMessage(
      noWa,
      {
        text: 'Berhasil di kirim',
      },
      { quoted: message }
    );
  } else if (lowerCaseMessage === '!failcronjob') {
    await sock.sendMessage(
      noWa,
      {
        text: 'Mohon tunggu sedang mengcek fail cronjob.',
      },
      { quoted: message }
    );
    let response = await sendfailcronjob(sock);
    // console.log(response);

    // Send the message
    await sock.sendMessage(
      noWa,
      {
        text: response.message,
      },
      { quoted: message }
    );
  } else if (lowerCaseMessage === '!failizinkebun') {
    await sock.sendMessage(
      noWa,
      {
        text: 'Mohon tunggu sedang mengcek fail izin kebun.',
      },
      { quoted: message }
    );
    let response = await Fail_send_pdf();
    console.log(response);

    await sock.sendMessage(
      noWa,
      {
        text: response.message,
      },
      { quoted: message }
    );
  } else if (lowerCaseMessage === '!getgrup') {
    let getGroups = await sock.groupFetchAllParticipating();
    let groups = Object.values(await sock.groupFetchAllParticipating());
    let datagrup = []; // Initialize an empty array to store group information
    for (let group of groups) {
      datagrup.push(`id_group: ${group.id} || Nama Group: ${group.subject}`);
    }
    await sock.sendMessage(
      noWa,
      { text: `List ${datagrup.join('\n')}` },
      { quoted: message }
    );
  } else if (lowerCaseMessage === '!format snooze') {
    await sock.sendMessage(
      noWa,
      {
        text: 'Contoh Option Snooze Bot : \n1).!snooze 27-08-2024 s/d 29-08-2024 (Opsi snooze range tanggal) \n2).!snooze 27-08-2024 (Opsi snooze selama 24 jam) \n3).!snooze 27-08-2024 04:00 - 12.00 (Opsi menyesuaikan range jam)',
      },
      { quoted: message }
    );
  } else if (lowerCaseMessage.includes('!snooze')) {
    const snoozeContent = lowerCaseMessage.substring('!snooze '.length).trim();
    // Regex patterns for different options
    const dateRangePattern =
      /^(\d{1,2}-\d{1,2}-\d{4})\s*s\/d\s*(\d{1,2}-\d{1,2}-\d{4})$/;
    const singleDatePattern = /^(\d{1,2}-\d{1,2}-\d{4})$/;
    const dateTimeRangePattern =
      /^(\d{1,2}-\d{1,2}-\d{4})\s(\d{2}[:.]\d{2})\s*-\s*(\d{2}[:.]\d{2})$/;
    const now = new Date();
    // Helper function to parse date and time into a Date object
    const parseDateTime = (date, time = '00:00') => {
      const [day, month, year] = date.split('-').map(Number);
      const [hour, minute] = time.split(/[:.]/).map(Number);
      return new Date(year, month - 1, day, hour, minute);
    };
    if (dateRangePattern.test(snoozeContent)) {
      const matches = snoozeContent.match(dateRangePattern);
      const startDate = matches[1];
      const endDate = matches[2];
      const startDateTime = parseDateTime(startDate);
      const endDateTime = parseDateTime(endDate);
      if (startDateTime <= now || endDateTime <= now) {
        let text = 'Format tanggal dan waktu harus setelah waktu saat ini.';
        await handleChatSnoozePengawasanOperatorAi(noWa, text, sock);
      } else {
        const differenceInMillis = endDateTime - startDateTime;
        const differenceInHours = differenceInMillis / (1000 * 60 * 60);
        configSnoozeBotPengawasanOperator[noWa] = {
          datetime: `${startDate} s/d ${endDate}`,
          hour: differenceInHours,
        };
        await handleChatSnoozePengawasanOperatorAi(noWa, text, sock);
      }
    } else if (singleDatePattern.test(snoozeContent)) {
      const matches = snoozeContent.match(singleDatePattern);
      const singleDate = matches[1];
      const singleDateTime = parseDateTime(singleDate);
      if (singleDateTime <= now) {
        let text = 'Format tanggal dan waktu harus setelah waktu saat ini.';
        await handleChatSnoozePengawasanOperatorAi(noWa, text, sock);
      } else {
        configSnoozeBotPengawasanOperator[noWa] = {
          datetime: singleDate,
          hour: 24,
        };
        await handleChatSnoozePengawasanOperatorAi(noWa, text, sock);
      }
    } else if (dateTimeRangePattern.test(snoozeContent)) {
      const matches = snoozeContent.match(dateTimeRangePattern);
      const date = matches[1];
      const startTime = matches[2];
      const endTime = matches[3];
      const startDateTime = parseDateTime(date, startTime);
      const endDateTime = parseDateTime(date, endTime);
      if (startDateTime <= now) {
        let text = 'Format tanggal dan waktu harus setelah waktu saat ini.';
        await handleChatSnoozePengawasanOperatorAi(noWa, text, sock);
      } else {
        const differenceInHours =
          (endDateTime - startDateTime) / (1000 * 60 * 60);
        configSnoozeBotPengawasanOperator[noWa] = {
          datetime: `${date} ${startTime} - ${endTime}`,
          hour: differenceInHours,
        };
        await handleChatSnoozePengawasanOperatorAi(noWa, text, sock);
      }
    } else {
      // Invalid format
      await sock.sendMessage(
        noWa,
        {
          text: 'Terdapat kesalahan pada input format. Mohon untuk menggunakan format inputan berikut:\n1).!snooze 27-08-2024 s/d 29-08-2024\n2).!snooze 27-08-2024\n3).!snooze 27-08-2024 04:00 - 12:00',
        },
        { quoted: message }
      );
      return;
    }
  } else if (userchoiceSnoozeBotPengawasanOperator[noWa]) {
    let waUser = message.key.participant;
    let phoneNumber = waUser.replace(/[^0-9]/g, '');
    // Replace the first 3 digits (if they are '628') with '08'
    if (phoneNumber.length >= 3) {
      phoneNumber = phoneNumber.replace(/^628/, '08');
    }
    await handleChatSnoozePengawasanOperatorAi(noWa, text, sock, phoneNumber);
  } else if (lowerCaseMessage === '!laporan izinkebun') {
    await Report_group_izinkebun(sock);
  }
};

module.exports = {
  handleGroupMessage,
};
