const axios = require('axios');
const TaksasiProgram = require('../Programs/Taksasi');
const GradingProgram = require('../Programs/Grading');
const logger = require('./logger');
const GeneralProgram = require('../Programs/General');
const IzinkebunProgram = require('../Programs/Izinkebun');
const IotProgram = require('../Programs/Iot');

class MessageUpsert {
  constructor() {
    this.userIotChoice = {};
    this.userchoice = {};
    this.userchoiceSnoozeBotPengawasanOperator = {};
    this.configSnoozeBotPengawasanOperator = {};
    this.userTalsasiChoice = {};
    this.userIzinkebunChoice = {};
  }

  static async init() {
    const instance = new MessageUpsert();
    instance.taksasiProgram = await TaksasiProgram.init();
    instance.gradingProgram = await GradingProgram.init();
    instance.generalProgram = await GeneralProgram.init();
    instance.izinkebunProgram = await IzinkebunProgram.init();
    instance.iotProgram = await IotProgram.init();
    return instance;
  }

  async handleGroupMessage(lowerCaseMessage, noWa, text, sock, message) {
    if (lowerCaseMessage && lowerCaseMessage.startsWith('!tarik')) {
      const estateCommand = lowerCaseMessage.replace('!tarik', '').trim();
      const estate = estateCommand.toUpperCase();

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

      try {
        const apiUrl = 'https://qc-apps.srs-ssms.com/api/getdatacron';
        const response = await axios.get(apiUrl);
        const dataestate = response.data;
        const matchingTasks = dataestate.filter(
          (task) => task.estate === estate
        );

        if (matchingTasks.length > 0) {
          const {
            estate: estateFromMatchingTask,
            wilayah: folder,
            id,
          } = matchingTasks[0];

          await sock.sendMessage(
            noWa,
            { text: 'Mohon tunggu laporan sedang di proses' },
            { quoted: message }
          );

          const result = await this.taksasiProgram.sendtaksasiest(
            estateFromMatchingTask,
            '120363384470022318@g.us',
            id,
            'null'
          );

          await sock.sendMessage(
            noWa,
            { text: result.message },
            { quoted: message }
          );

          logger.info.taksasi(
            `Permintaan Tarik PDF taksasi ${estateFromMatchingTask} Berhasil dikirim`
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
        console.error('Error fetching data:', error);
        await sock.sendMessage(
          noWa,
          { text: 'Terjadi kesalahan saat memproses permintaan Anda' },
          { quoted: message }
        );
      }
    } else if (lowerCaseMessage && lowerCaseMessage.startsWith('!taksasi')) {
      // console.log(lowerCaseMessage);
      await sock.sendMessage(
        noWa,
        {
          text: 'Masih dalam tahap pengembangan',
        },
        { quoted: message }
      );
      // await this.taksasiProgram.handleTaksasi(lowerCaseMessage, sock);
    } else if (lowerCaseMessage === '!menu') {
      await sock.sendMessage(
        noWa,
        {
          text: 'Perintah Bot Yang tersedia \n1 = !tarik (Menarik Estate yang di pilih untuk di generate ke dalam grup yang sudah di tentukan) \n2.!getgrup (Menampilkan semua isi list group yang ada) \n3.!cast (melakukan broadcast pesan ke semua grup taksasi) \n4.!taksasi = Menarik Banyak laporar taksasi sekaligus berdasarkan waktu yang di pilih\n5.!laporan izinkebun Menarik laporan izin kebun (Harap gunakan hanya di hari sabtu atau minggu)!\n6.failcronjob = Mrnjalankan semua fail cronjob yang ada di server\n7.!failizinkebun = Mengirip pdf yang gagal terkirim izin kebun\n8.!failgrading kirim ulang grading mill fail\n9.!laporanaws = Mengirim laporan AWS harian',
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

      await this.gradingProgram.runJobsMill();
    } else if (lowerCaseMessage === '!failcronjob') {
      await sock.sendMessage(
        noWa,
        {
          text: 'Mohon tunggu sedang mengcek fail cronjob.',
        },
        { quoted: message }
      );
      let response = await this.taksasiProgram.sendfailcronjob();
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
      const snoozeContent = lowerCaseMessage
        .substring('!snooze '.length)
        .trim();
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
          await this.generalProgram.handleChatSnoozePengawasanOperatorAi(
            noWa,
            text,
            sock
          );
        } else {
          const differenceInMillis = endDateTime - startDateTime;
          const differenceInHours = differenceInMillis / (1000 * 60 * 60);
          configSnoozeBotPengawasanOperator[noWa] = {
            datetime: `${startDate} s/d ${endDate}`,
            hour: differenceInHours,
          };
          this.userchoiceSnoozeBotPengawasanOperator[noWa] = true;
          await this.generalProgram.handleChatSnoozePengawasanOperatorAi(
            noWa,
            text,
            sock
          );
        }
      } else if (singleDatePattern.test(snoozeContent)) {
        const matches = snoozeContent.match(singleDatePattern);
        const singleDate = matches[1];
        const singleDateTime = parseDateTime(singleDate);
        if (singleDateTime <= now) {
          let text = 'Format tanggal dan waktu harus setelah waktu saat ini.';
          await this.generalProgram.handleChatSnoozePengawasanOperatorAi(
            noWa,
            text,
            sock
          );
        } else {
          configSnoozeBotPengawasanOperator[noWa] = {
            datetime: singleDate,
            hour: 24,
          };
          await this.generalProgram.handleChatSnoozePengawasanOperatorAi(
            noWa,
            text,
            sock
          );
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
          await this.generalProgram.handleChatSnoozePengawasanOperatorAi(
            noWa,
            text,
            sock
          );
        } else {
          const differenceInHours =
            (endDateTime - startDateTime) / (1000 * 60 * 60);
          configSnoozeBotPengawasanOperator[noWa] = {
            datetime: `${date} ${startTime} - ${endTime}`,
            hour: differenceInHours,
          };
          await this.generalProgram.handleChatSnoozePengawasanOperatorAi(
            noWa,
            text,
            sock
          );
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
    } else if (this.userchoiceSnoozeBotPengawasanOperator[noWa]) {
      let waUser = message.key.participant;
      let phoneNumber = waUser.replace(/[^0-9]/g, '');
      // Replace the first 3 digits (if they are '628') with '08'
      if (phoneNumber.length >= 3) {
        phoneNumber = phoneNumber.replace(/^628/, '08');
      }
      await this.generalProgram.handleChatSnoozePengawasanOperatorAi(
        noWa,
        text,
        sock,
        phoneNumber
      );
    } else if (lowerCaseMessage === '!laporanizinkebun') {
      await sock.sendMessage(
        noWa,
        {
          text: 'Mohon tunggu sedang mengirim laporan izin kebun',
        },
        { quoted: message }
      );
      let response = await this.izinkebunProgram.Report_group_izinkebun(sock);
      await sock.sendMessage(
        noWa,
        {
          text: response.message,
        },
        { quoted: message }
      );
    } else if (lowerCaseMessage === '!laporanaws') {
      await sock.sendMessage(
        noWa,
        {
          text: 'Mohon tunggu sedang mengirim laporan AWS harian',
        },
        { quoted: message }
      );
      let response = await this.iotProgram.get_data_harian_aws();
      await sock.sendMessage(
        noWa,
        {
          text: response.message,
        },
        { quoted: message }
      );
    }
  }

  async handlePrivateMessage(lowerCaseMessage, noWa, text, sock, message) {
    if (lowerCaseMessage === '!izin') {
      // Start the ijin process only if it's not already started
      // if (!this.userIzinkebunChoice[noWa]) {
      //   await this.izinkebunProgram.handleijinmsg(noWa, lowerCaseMessage, sock);
      //   this.userIzinkebunChoice[noWa] = true;
      // }
      // } else if (this.userIzinkebunChoice[noWa]) {
      //   // Continue the ijin process if it has already started
      //   await this.izinkebunProgram.handleijinmsg(noWa, text, sock);
      //   // Add this condition to clear the state when user cancels
      //   if (text.toLowerCase() === 'batal') {
      //     delete this.userIzinkebunChoice[noWa];
      //   }
      // }
      await sock.sendMessage(
        noWa,
        {
          text: 'Maintenace, silahkan kunjungi https://izin-kebun.srs-ssms.com/ untuk izin kebun',
        },
        { quoted: message }
      );
    } else if (lowerCaseMessage === '!iot') {
      if (!this.userIotChoice[noWa]) {
        await this.iotProgram.handleIotInput(noWa, lowerCaseMessage, sock);
        this.userIotChoice[noWa] = true;
      }
    } else if (this.userIotChoice[noWa]) {
      // Continue the input process if it has already started
      await this.iotProgram.handleIotInput(noWa, text, sock);
    } else {
      if (lowerCaseMessage === 'ya') {
        const imagePath = 'izinkebun/step1.jpg';
        const imagePath2 = 'izinkebun/step2.jpg';
        const caption =
          'Harap balas pesan dengan cara tekan/tahan pesan di atas';
        const caption2 =
          'Lalu balas *ya* untuk menyetujui izin di atas, atau balas *tidak* untuk menolak izin di atas.\n\nAtau balas *ya semua* tanpa menekan/menahan pesan di atas untuk menyetujui semua izin atas persetujuan anda.';

        await this.generalProgram.sendImageWithCaption(
          sock,
          noWa,
          imagePath,
          caption
        );
        await this.generalProgram.sendImageWithCaption(
          sock,
          noWa,
          imagePath2,
          caption2
        );
      } else if (lowerCaseMessage === 'tidak') {
        const imagePath = 'izinkebun/step1.jpg';
        const imagePath2 = 'izinkebun/step2.jpg';
        const caption =
          'Harap balas pesan dengan cara tekan/tahan pesan di atas';
        const caption2 =
          'Lalu balas *tidak* untuk menyetujui izin di atas, atau balas *ya* untuk menerima izin di atas.\n\nAtau balas *tidak semua* tanpa menekan/menahan pesan di atas untuk menolak semua izin atas persetujuan anda.';

        await this.generalProgram.sendImageWithCaption(
          sock,
          noWa,
          imagePath,
          caption
        );
        await this.generalProgram.sendImageWithCaption(
          sock,
          noWa,
          imagePath2,
          caption2
        );
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

          // Split messages by `$` and join with newlines
          const allMessages = responses.messages.split('$').join('\n');

          await sock.sendMessage(noWa, {
            text: `${allMessages}`,
          });
        } catch (error) {
          // Handle error, send a specific error message or log the error
          console.log('Error occurred:', error);
          await sock.sendMessage(noWa, {
            text: 'An error occurred while processing your request.',
          });
        }
      } else if (lowerCaseMessage === 'tidak semua') {
        try {
          const response = await axios.post(
            'https://management.srs-ssms.com/api/getizinverifinew',
            // 'http://erpda.test/api/getizinverifinew',
            {
              email: 'j',
              password: 'j',
              no_hp: noWa,
              jawaban: 'tidak',
            }
          );
          let responses = response.data;
          const allMessages = responses.messages.split('$').join('\n');

          await sock.sendMessage(noWa, {
            text: `${allMessages}`,
          });
        } catch (error) {
          console.log('Error occurred:', error);
          await sock.sendMessage(noWa, {
            text: 'An error occurred while processing your request.',
          });
        }
      }
    }
  }

  async handleReplyNoDocMessage(
    conversation,
    noWa,
    sock,
    respon_atasan,
    message
  ) {
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
    }
  }

  async handleReplyDocMessage(
    conversation,
    noWa,
    sock,
    respon_atasan,
    quotedMessage
  ) {
    const documentMessage =
      quotedMessage.documentWithCaptionMessage.message.documentMessage.caption;
    // Handle reply to document

    // console.log(documentMessage);

    if (
      documentMessage.includes(
        'Anda memiliki permintaan untuk meverifikasi data dari rekomendator'
      )
    ) {
      // Extract the Doc ID
      // console.log('test');

      const docIdMatch = documentMessage.match(/\*Doc ID\* : (\d+\/\d+)/);
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
  }
}

module.exports = MessageUpsert.init();
