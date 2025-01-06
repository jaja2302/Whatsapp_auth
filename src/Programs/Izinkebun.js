const axios = require('axios');
const logger = require('../services/logger');
const pusherService = require('../services/pusher');
const { isProgramActive } = require('../utils/programHelper');

class IzinKebunProgram {
  constructor() {
    this.running = false;
    this.CHANNEL_NAME = 'my-channel';
    this.EVENT_NAME = 'izinkebunnotif_test';
    this.pusherWatcher = null;
    this.userchoice = {};
    this.botpromt = {};
    this.timeoutHandles = {};
    this.idgroup = '120363205553012899@g.us';

    if (!global.queue) {
      global.queue = require('../services/queue');
    }
  }

  static async init() {
    try {
      logger.info.izinkebun('Initializing izin kebun program');
      const instance = new IzinKebunProgram();
      await global.queue.init();
      return instance;
    } catch (error) {
      logger.error.izinkebun('Error initializing izin kebun program:', error);
      throw error;
    }
  }

  start() {
    if (!this.running) {
      this.running = true;

      this.pusherWatcher = pusherService.getDataPusher(
        this.CHANNEL_NAME,
        this.EVENT_NAME,
        'izinkebun',
        (data) => {
          if (!this.running) {
            logger.info.izinkebun('Ignoring event: Program is stopped');
            return;
          }
          logger.info.izinkebun('Received izin kebun notification:', data);
          this.handleIzinKebunNotification(data);
        }
      );

      logger.info.izinkebun('Izin kebun program started');
    }
  }

  stop() {
    if (this.running) {
      this.running = false;
      if (this.pusherWatcher) {
        this.pusherWatcher.stop();
        this.pusherWatcher = null;
      }
      logger.info.izinkebun('Izin kebun program stopped');
    }
  }

  async handleIzinKebunNotification(itemdata) {
    if (!isProgramActive('izinkebun')) {
      return 'Izin kebun program not started: Status is not active';
    }

    if (!itemdata || !itemdata.data) {
      logger.error.izinkebun('itemdata is undefined or missing data property.');
      return;
    }
    const data = itemdata.data;
    let errormsg = 'Error mengirim notifikasi izin keluar kebun\n';
    errormsg += `*ID Pemohon* : ${data.id}\n`;
    errormsg += `*Nama* : ${data.nama_user}\n`;
    errormsg += `Error mengirim ke nomor ${data.nama_atasan_1}\n`;
    if (data.type === 'send_atasan_satu') {
      let message = `Permintaan Persetujuan Izin Baru:\n`;
      message += `Halo, Selamat Siang Bapak/Ibu ${data.nama_atasan_1},\n`;
      message += `Anda memiliki permintaan izin keluar kebun yang membutuhkan persetujuan dengan rincian sebagai berikut:\n`;
      message += `ID Pemohon: ${data.id}\n`;
      message += `Nama Pemohon: *${data.nama_user}*\n`;
      message += `Alasan : ${data.keperluan}\n`;
      message += `Tanggal Keluar: *${data.tanggal_keluar}*\n\n`;
      message +=
        ' Anda juga bisa membalas dengan *Ya*/*Tidak* untuk menyetujui/menolak semua permintaan yang terkait dengan Anda dengan cara menahan pesan ini dan harap di reply .\n';
      message +=
        ' Anda juga bisa membalas dengan *Ya semua*/*Tidak semua* untuk menyetujui/menolak semua permintaan yang terkait dengan anda tanpa perlu menahan pesan ini\n';
      message += `Pesan otomatis oleh Digital Architect SRS Bot.`;

      global.queue.push({
        type: 'send_message',
        data: { to: `${data.send_to}@s.whatsapp.net`, message },
      });
      global.queue.push({
        type: 'update_status_izinkebun',
        data: { id_db: data.id_db, type: data.type },
      });
    } else if (data.type === 'send_atasan_dua') {
      let message = `Permintaan Persetujuan Izin Baru:\n`;
      message += `Halo, Selamat Siang Bapak/Ibu ${data.nama_atasan_2},\n`;
      message += `Anda memiliki permintaan izin keluar kebun yang membutuhkan persetujuan dengan rincian sebagai berikut:\n`;
      message += `ID Pemohon: ${data.id}\n`;
      message += `Nama : *${data.nama_user}*\n`;
      message += `Alasan : ${data.keperluan}\n`;
      message += `Tanggal keluar izin : *${data.tanggal_keluar}*\n`;
      message +=
        ' Anda juga bisa membalas dengan *Ya*/*Tidak* untuk menyetujui/menolak semua permintaan yang terkait dengan Anda dengan cara menahan pesan ini dan harap di reply .\n';
      message +=
        ' Anda juga bisa membalas dengan *Ya semua*/*Tidak semua* untuk menyetujui/menolak semua permintaan yang terkait dengan anda tanpa perlu menahan pesan ini\n';
      message += `Pesan otomatis oleh Digital Architect SRS Bot.`;
      let userMessage = `*Izin Keluar Kebun Anda Telah Disetujui Atasan Pertama*\n\n`;
      userMessage += `Hallo Selamat Siang Bapak/Ibu ${data.nama_user},\n\n`;
      userMessage += `Kami ingin menginformasikan bahwa permintaan izin keluar kebun Anda telah Disetujui.\n\n`;
      userMessage += `Silahkan tunggu notifikasi  berikutnya untuk persetujuan dari atasan kedua.\n\n`;
      userMessage += `Terima kasih,\n`;
      userMessage += `Tim Digital Architect SRS Bot`;

      global.queue.push({
        type: 'send_message',
        data: { to: `${data.send_to}@s.whatsapp.net`, message },
      });
      global.queue.push({
        type: 'send_message',
        data: {
          to: `${data.no_hp_user}@s.whatsapp.net`,
          message: userMessage,
        },
      });
      global.queue.push({
        type: 'update_status_izinkebun',
        data: { id_db: data.id_db, type: data.type },
      });

      logger.info.izinkebun('Izin kebun notification sent');
    } else if (data.type === 'send_user' && data.status === 'approved') {
      let message = `Izin Keluar Kebun Anda Telah Disetujui\n\n`;
      message += `Hallo Selamat Siang Bapak/Ibu ${data.nama_user},\n\n`;
      message += `Kami ingin menginformasikan bahwa permintaan izin keluar kebun Anda telah disetujui.\n\n`;
      message += `Berikut adalah detail izin Anda:\n`;
      message += `Nama Pemohon: *${data.nama_user}*\n`;
      message += `Tanggal keluar izin : ${data.tanggal_keluar}\n`;
      message += `Tanggal kembali izin : ${data.tanggal_kembali}\n`;
      message += `Keperluan: ${data.keperluan}\n`;
      message += `Lokasi Tujuan: ${data.lokasi_tujuan}\n\n`;
      message += `Harap selalu berhati-hati selama perjalanan dan pastikan untuk mengikuti protokol keamanan yang berlaku. Kami mendoakan agar Anda tiba dengan selamat di tujuan dan kembali ke kebun dengan kondisi sehat dan aman.\n\n`;
      message += `Jika ada pertanyaan lebih lanjut, jangan ragu untuk menghubungi kami.\n\n`;
      message += `Atau kunjungi web kami di :https://izin-kebun.srs-ssms.com \n\n`;
      message += `Terima kasih,\n`;
      message += `Tim Digital Architect SRS Bot`;

      try {
        const genpdf = await axios.get(
          'https://izin-kebun.srs-ssms.com/api/generatePdfIzinKebun',
          {
            params: {
              user: 'j',
              pw: 'j',
              id: data.id_db,
            },
          }
        );
        const datapdf = genpdf.data;
        if (datapdf.pdf) {
          const pdfBuffer = Buffer.from(datapdf.pdf, 'base64');
          const pdfFilename = datapdf.filename || 'Invoice.pdf';

          global.queue.push({
            type: 'send_document',
            data: {
              to: `${data.send_to}@s.whatsapp.net`,
              document: pdfBuffer,
              filename: pdfFilename,
              caption: message,
            },
          });
          global.queue.push({
            type: 'update_status_izinkebun',
            data: { id_db: data.id_db, type: data.type },
          });
        } else {
          //   console.log('PDF not found in the API response.');
          logger.error.izinkebun('PDF not found in the API response.');
        }
      } catch (error) {
        logger.error.izinkebun('Error generating PDF:', error);
        // console.log('Error generating PDF:', error);
      }
    } else if (data.type === 'send_user' && data.status === 'rejected') {
      let message = `*Izin Keluar Kebun Anda Telah Ditolak*\n\n`;
      message += `Hallo Selamat Siang Bapak/Ibu ${data.nama_user},\n\n`;
      message += `Kami ingin menginformasikan bahwa permintaan izin keluar kebun Anda telah ditolak dikarenakan :\n\n`;
      message += `*Alasan ditolak*: ${data.response}\n`;
      message += `Jika ada pertanyaan lebih lanjut, jangan ragu untuk menghubungi kami.\n\n`;
      message += `Terima kasih,\n`;
      message += `Tim Digital Architect SRS Bot`;

      global.queue.push({
        type: 'send_message',
        data: { to: `${data.send_to}@s.whatsapp.net`, message },
      });
      global.queue.push({
        type: 'update_status_izinkebun',
        data: { id_db: data.id_db, type: data.type },
      });
    } else if (data.type === 'send_atasan_tiga') {
      let message = `Permintaan Persetujuan Izin Baru:\n`;
      message += `Halo, Selamat Siang Bapak/Ibu ${data.nama_atasan_3},\n`;
      message += `Anda memiliki permintaan izin keluar kebun yang membutuhkan persetujuan dengan rincian sebagai berikut:\n`;
      message += `ID Pemohon: ${data.id}\n`;
      message += `Nama : *${data.nama_user}*\n`;
      message += `Alasan : ${data.keperluan}\n`;
      message += `Tanggal keluar izin : *${data.tanggal_keluar}*\n`;
      message +=
        ' Anda juga bisa membalas dengan *Ya*/*Tidak* untuk menyetujui/menolak semua permintaan yang terkait dengan Anda dengan cara menahan pesan ini dan harap di reply .\n';
      message +=
        ' Anda juga bisa membalas dengan *Ya semua*/*Tidak semua* untuk menyetujui/menolak semua permintaan yang terkait dengan anda tanpa perlu menahan pesan ini\n';
      message += `Pesan otomatis oleh Digital Architect SRS Bot.`;
      let userMessage = `*Izin Keluar Kebun Anda Telah Di setujui Atasan Kedua*\n\n`;
      userMessage += `Hallo Selamat Siang Bapak/Ibu ${data.nama_user},\n\n`;
      userMessage += `Kami ingin menginformasikan bahwa permintaan izin keluar kebun Anda telah Disetuji :\n\n`;
      userMessage += `Silahkan tunggu notifikasi  berikutnya untuk persetujuan dari atasan ketiga.\n\n`;
      userMessage += `Terima kasih,\n`;
      userMessage += `Tim Digital Architect SRS Bot`;

      global.queue.push({
        type: 'send_message',
        data: { to: `${data.send_to}@s.whatsapp.net`, message },
      });
      global.queue.push({
        type: 'send_message',
        data: {
          to: `${data.no_hp_user}@s.whatsapp.net`,
          message: userMessage,
        },
      });
      global.queue.push({
        type: 'update_status_izinkebun',
        data: { id_db: data.id_db, type: data.type },
      });
      logger.info.izinkebun('Izin kebun notification sent');
    } else {
      logger.error.izinkebun('Unknown status:', data.type);
      return;
    }
  }

  async getuserinfo(user) {
    try {
      // Fetch data from the API using the provided name
      const response = await axios.post(
        'https://qc-apps.srs-ssms.com/api/getuserinfo',
        {
          nama: user,
        }
      );

      return response.data.data; // Assuming your API response structure has a 'data' field
    } catch (error) {
      // Check if the error response is due to a 404 status code
      if (error.response && error.response.status === 404) {
        return { message: 'Nama User tidak ditemukan' };
      } else {
        console.log('Error fetching data:', error);
        // throw new Error('Error fetching data from API');
      }
    }
  }
  async checkatasan(nama_atasansatu) {
    try {
      const response = await axios.post(
        'https://qc-apps.srs-ssms.com/api/getnamaatasan',
        {
          nama: nama_atasansatu,
        }
      );
      // const response = await axios.post('https://qc-apps.srs-ssms.com/api/getnamaatasan', {
      //     nama: nama_atasansatu
      // });

      return response.data.data; // Assuming your API response structure has a 'data' field
    } catch (error) {
      // Check if the error response is due to a 404 status code
      if (error.response && error.response.status === 404) {
        return { message: 'Nama Atasan tidak ditemukan' };
      } else {
        console.log('Error fetching data:', error);
        // throw new Error('Error fetching data from API');
      }
    }
  }

  async sendImageWithCaption(sock, noWa, imagePath, caption) {
    try {
      const imageBuffer = require('fs').readFileSync(imagePath);

      // Send the image with a caption

      await sock.sendMessage(noWa, {
        image: imageBuffer,
        caption: caption,
      });

      console.log('Image sent with caption successfully.');
    } catch (error) {
      console.log('Error sending image with caption:', error);
    }
  }

  async updatestatus_sock_vbot(id, type_atasan) {
    try {
      const response = await axios.post(
        'https://management.srs-ssms.com/api/update_status_sock',
        // 'http://erpda.test/api/update_status_sock',
        {
          id: id,
          type_atasan: type_atasan,
          email: 'j',
          password: 'j',
        }
      );
      console.log(response.data); // Handle the response if necessary
    } catch (error) {
      console.log(error);
    }
  }

  async catcherror(id, type_atasan, bot_type) {
    try {
      const response = await axios.post(
        'https://management.srs-ssms.com/api/catch_error_bot',
        // 'http://127.0.0.1:8000/api/catch_error_bot',
        {
          id: id,
          error_data: type_atasan,
          email: 'j',
          password: 'j',
          bot_type: bot_type,
        }
      );
      console.log(response.data);
    } catch (error) {
      console.log(error);
    }
  }
  async handleTimeout(noWa, sock) {
    if (timeoutHandles[noWa]) {
      clearTimeout(timeoutHandles[noWa]);
    }

    timeoutHandles[noWa] = setTimeout(
      async () => {
        console.log(`Timeout triggered for ${noWa}`);
        await sock.sendMessage(noWa, {
          text: 'Waktu Anda telah habis. Silakan mulai kembali dengan mengetikkan !izin.',
        });
        delete userchoice[noWa];
        delete botpromt[noWa];
        delete timeoutHandles[noWa];
      },
      5 * 60 * 1000
    );

    // console.log(`Timeout set for ${noWa}`);
  }

  async handleijinmsg(noWa, text, sock) {
    if (!userchoice[noWa]) {
      userchoice[noWa] = 'name';
      botpromt[noWa] = { attempts: 0 };
      await sock.sendMessage(noWa, {
        text: 'Anda dapat membatalkan kapan saja permintaan izin dengan menjawab batal pada pertanyaan.',
      });

      await sock.sendMessage(noWa, {
        text: 'Silakan masukkan *nama lengkap anda* atau *nama depan Anda* untuk pencarian di database.Balas batal untuk membatalkan.',
      });

      handleTimeout(noWa, sock);
    } else {
      handleTimeout(noWa, sock); // Reset timeout with every interaction
      const step = userchoice[noWa];

      if (step === 'name') {
        if (text.toLowerCase() === 'batal') {
          await sock.sendMessage(noWa, {
            text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
          });
          delete userchoice[noWa];
          delete botpromt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
          return;
        }
        botpromt[noWa].name = text;
        userchoice[noWa] = 'check_user';
        await sock.sendMessage(noWa, {
          text: 'Memeriksa nama pengguna di database...',
        });

        const result = await getuserinfo(text);

        // console.log(result);
        if (result.message && result.message === 'Nama User tidak ditemukan') {
          botpromt[noWa].attempts += 1;
          if (botpromt[noWa].attempts >= 3) {
            await sock.sendMessage(noWa, {
              text: 'Anda telah mencoba 3 kali. Silakan coba lagi nanti.',
            });
            delete userchoice[noWa];
            delete botpromt[noWa];
            clearTimeout(timeoutHandles[noWa]);
            delete timeoutHandles[noWa];
          } else {
            await sock.sendMessage(noWa, {
              text: 'Pengguna tidak ditemukan di database. Harap masukkan ulang:',
            });
            userchoice[noWa] = 'name';
          }
        } else if (result !== null && result.length > 0) {
          botpromt[noWa].user_id_option = result;

          let message =
            'Silakan pilih pengguna dari daftar berikut ,*HARAP MASUKAN ANGKA SAJA DARI PILIHAN TERSEDIA*:\n';
          result.forEach((item, index) => {
            message += `${index + 1}. ${item.nama} (${item.departemen})\n`;
          });
          message += `${
            result.length + 1
          }. Pengguna tidak tersedia dalam daftar.\n`;
          message += `${result.length + 2}. Coba masukan nama kembali`;

          userchoice[noWa] = 'choose_name';
          await sock.sendMessage(noWa, { text: message });
        }
      } else if (step === 'choose_name') {
        if (text.toLowerCase() === 'batal') {
          await sock.sendMessage(noWa, {
            text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
          });
          delete userchoice[noWa];
          delete botpromt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
          return;
        }
        const chosenIndex = parseInt(text) - 1;
        const options = botpromt[noWa].user_id_option;

        if (
          isNaN(chosenIndex) ||
          !options ||
          chosenIndex < 0 ||
          chosenIndex >= options.length + 2
        ) {
          await sock.sendMessage(noWa, {
            text: 'Pilihan tidak valid. Silakan masukkan nomor yang sesuai:',
          });
          return;
        }

        if (chosenIndex === options.length) {
          await sock.sendMessage(noWa, {
            text: 'Nama tidak tersedia.Silakan hubungi admin Digital Architect untuk penambahan nama.',
          });
          delete userchoice[noWa];
          delete botpromt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
        } else if (chosenIndex === options.length + 1) {
          userchoice[noWa] = 'name';
          await sock.sendMessage(noWa, {
            text: 'Silakan masukkan *nama lengkap anda* atau *nama depan Anda* untuk pencarian di database.',
          });
        } else {
          try {
            const response = await axios.post(
              'https://qc-apps.srs-ssms.com/api/formdataizin',
              {
                name: options[chosenIndex].id,
                type: 'check_user',
                no_hp: noWa,
              }
            );
            let responses = response.data;

            const responseKey = Object.keys(responses)[0];

            // console.log(responses);
            await sock.sendMessage(noWa, {
              text: 'Mohon tunggu, server sedang melakukan validasi.',
            });
            if (responseKey === 'error_validasi') {
              await sock.sendMessage(noWa, {
                text: `Verifikasi data gagal karena: ${responses[responseKey]}`,
              });
              await sock.sendMessage(noWa, {
                text: `Session Berakhir, Silahkan Izin Ulang dengan perintah !izin`,
              });
              delete userchoice[noWa];
              delete botpromt[noWa];
              clearTimeout(timeoutHandles[noWa]);
              delete timeoutHandles[noWa];
            } else {
              botpromt[noWa].user_nama = options[chosenIndex].nama;
              botpromt[noWa].user_nama_id = options[chosenIndex].id;
              userchoice[noWa] = 'location';
              await sock.sendMessage(noWa, {
                text: 'Mohon tentukan *LOKASI* yang akan Anda kunjungi untuk pengajuan izin.',
              });
            }
          } catch (error) {
            console.log(error);

            if (error.response && error.response.status === 404) {
              console.log(error);

              await sock.sendMessage(noWa, {
                text: 'Terjadi error tidak terduga',
              });
              delete userchoice[noWa];
              delete botpromt[noWa];
              clearTimeout(timeoutHandles[noWa]);
              delete timeoutHandles[noWa];
            } else {
              await sock.sendMessage(noWa, {
                text: 'Terjadi kesalahan saat mengirim data. Mohon coba lagi.',
              });
              delete userchoice[noWa];
              delete botpromt[noWa];
              clearTimeout(timeoutHandles[noWa]);
              delete timeoutHandles[noWa];
            }
          }
        }
      } else if (step === 'location') {
        if (text.toLowerCase() === 'batal') {
          await sock.sendMessage(noWa, {
            text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
          });
          delete userchoice[noWa];
          delete botpromt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
          return;
        }
        botpromt[noWa].location = text;
        userchoice[noWa] = 'kendaraan';
        await sock.sendMessage(noWa, {
          text: 'Harap masukkan jenis kendaraan *UNTUK KELUAR KEBUN*',
        });
      } else if (step === 'kendaraan') {
        if (text.toLowerCase() === 'batal') {
          await sock.sendMessage(noWa, {
            text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
          });
          delete userchoice[noWa];
          delete botpromt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
          return;
        }
        botpromt[noWa].kendaraan = text;
        userchoice[noWa] = 'plat_nomor';
        await sock.sendMessage(noWa, {
          text: 'Harap masukkan Plat nomor Kendaraan *UNTUK KELUAR KEBUN*, Anda bisa melewatkan pertanyaan ini dengan menjawab *skip*',
        });
      } else if (step === 'plat_nomor') {
        if (text.toLowerCase() === 'batal') {
          await sock.sendMessage(noWa, {
            text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
          });
          delete userchoice[noWa];
          delete botpromt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
          return;
        }

        if (text.toLowerCase() === 'skip') {
          botpromt[noWa].plat_nomor = text.toLowerCase();
        } else {
          botpromt[noWa].plat_nomor = text.toUpperCase();
        }
        userchoice[noWa] = 'date';
        await sock.sendMessage(noWa, {
          text: 'Harap masukkan tanggal *UNTUK KELUAR KEBUN* dengan format (DD-MM-YYYY)(23-02-2024) yang benar:',
        });
      } else if (step === 'date') {
        if (text.toLowerCase() === 'batal') {
          await sock.sendMessage(noWa, {
            text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
          });
          delete userchoice[noWa];
          delete botpromt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
          return;
        }
        const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
        if (!dateRegex.test(text)) {
          await sock.sendMessage(noWa, {
            text: 'Tanggal Tidak sesuai harap masukkan kembali (Format:Hari-Bulan-Tahun):',
          });
          return;
        }

        const [day, month, year] = text.split('-').map(Number);

        if (month < 1 || month > 12 || day < 1 || day > 31) {
          await sock.sendMessage(noWa, {
            text: 'Tanggal atau bulan tidak valid. Harap masukkan kembali (Format:Hari-Bulan-Tahun):',
          });
          return;
        }

        const inputDate = new Date(year, month - 1, day);
        if (
          inputDate.getDate() !== day ||
          inputDate.getMonth() !== month - 1 ||
          inputDate.getFullYear() !== year
        ) {
          await sock.sendMessage(noWa, {
            text: 'Tanggal tidak valid. Harap masukkan kembali (Format:Hari-Bulan-Tahun):',
          });
          return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (inputDate < today) {
          await sock.sendMessage(noWa, {
            text: 'Tanggal Tidak boleh di masa lalu. Harap masukkan tanggal yang valid (Format:Hari-Bulan-Tahun):',
          });
          return;
        }

        botpromt[noWa].date = text;
        userchoice[noWa] = 'jam_keluar';
        await sock.sendMessage(noWa, {
          text: 'Mohon masukan waktu *jam keluar* dari kebun dengan format (HH:MM)(10:00):',
        });
      } else if (step === 'jam_keluar') {
        if (text.toLowerCase() === 'batal') {
          await sock.sendMessage(noWa, {
            text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
          });
          delete userchoice[noWa];
          delete botpromt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
          return;
        }
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!timeRegex.test(text)) {
          await sock.sendMessage(noWa, {
            text: 'Waktu tidak valid. Harap masukkan waktu dalam format 24 jam (HH:MM), contoh: 11:00 atau 23:30',
          });
          return;
        }
        botpromt[noWa].jam_keluar = text;
        userchoice[noWa] = 'date_2';
        await sock.sendMessage(noWa, {
          text: 'Harap masukkan tanggal *UNTUK KEMBALI* dengan format (DD-MM-YYYY)(23-02-2024) yang benar:',
        });
      } else if (step === 'date_2') {
        if (text.toLowerCase() === 'batal') {
          await sock.sendMessage(noWa, {
            text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
          });
          delete userchoice[noWa];
          delete botpromt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
          return;
        }
        const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
        if (!dateRegex.test(text)) {
          await sock.sendMessage(noWa, {
            text: 'Tanggal Tidak sesuai harap masukkan kembali (Format:Hari-Bulan-Tahun):',
          });
          return;
        }

        const [day, month, year] = text.split('-').map(Number);

        if (month < 1 || month > 12 || day < 1 || day > 31) {
          await sock.sendMessage(noWa, {
            text: 'Tanggal atau bulan tidak valid. Harap masukkan kembali (Format:Hari-Bulan-Tahun):',
          });
          return;
        }

        const inputDate = new Date(year, month - 1, day);
        if (
          inputDate.getDate() !== day ||
          inputDate.getMonth() !== month - 1 ||
          inputDate.getFullYear() !== year
        ) {
          await sock.sendMessage(noWa, {
            text: 'Tanggal tidak valid. Harap masukkan kembali (Format:Hari-Bulan-Tahun):',
          });
          return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (inputDate < today) {
          await sock.sendMessage(noWa, {
            text: 'Tanggal Tidak boleh di masa lalu. Harap masukkan tanggal yang valid (Format:Hari-Bulan-Tahun):',
          });
          return;
        }

        botpromt[noWa].date_2 = text;
        userchoice[noWa] = 'jam_kembali';
        await sock.sendMessage(noWa, {
          text: 'Mohon masukan waktu *jam kembali* ke kebun dengan format (HH:MM)(10:00):',
        });
      } else if (step === 'jam_kembali') {
        if (text.toLowerCase() === 'batal') {
          await sock.sendMessage(noWa, {
            text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
          });
          delete userchoice[noWa];
          delete botpromt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
          return;
        }
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!timeRegex.test(text)) {
          await sock.sendMessage(noWa, {
            text: 'Waktu tidak valid. Harap masukkan waktu dalam format 24 jam (HH:MM), contoh: 11:00 atau 23:30',
          });
          return;
        }
        botpromt[noWa].jam_kembali = text;
        userchoice[noWa] = 'needs';
        await sock.sendMessage(noWa, {
          text: 'Mohon jelaskan keperluan Anda untuk keluar dari kebun:',
        });
      } else if (step === 'needs') {
        if (text.toLowerCase() === 'batal') {
          await sock.sendMessage(noWa, {
            text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
          });
          delete userchoice[noWa];
          delete botpromt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
          return;
        }
        botpromt[noWa].needs = text;
        userchoice[noWa] = 'atasan_satu';
        await sock.sendMessage(noWa, {
          text: 'Silakan masukkan nama lengkap *ATASAN PERTAMA* atau nama depan saja tanpa tanda titik/koma/backtip (./,/`) untuk pencarian didatabase',
        });
      } else if (step === 'atasan_satu') {
        if (text.toLowerCase() === 'batal') {
          await sock.sendMessage(noWa, {
            text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
          });
          delete userchoice[noWa];
          delete botpromt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
          return;
        }
        botpromt[noWa].atasan_satu = text;
        const nama_atasansatu = text;
        const result = await checkatasan(nama_atasansatu);

        if (
          result.message &&
          result.message === 'Nama Atasan tidak ditemukan'
        ) {
          botpromt[noWa].attempts = (botpromt[noWa].attempts || 0) + 1;
          if (botpromt[noWa].attempts >= 3) {
            await sock.sendMessage(noWa, {
              text: 'Anda sudah melakukan percobaan 3 kali. Silahkan coba kembali nanti.',
            });
            delete userchoice[noWa];
            delete botpromt[noWa];
            clearTimeout(timeoutHandles[noWa]);
            delete timeoutHandles[noWa];
          } else {
            await sock.sendMessage(noWa, {
              text: 'Nama Atasan Tidak ditemukan di database. Harap input ulang:',
            });
          }
        } else if (result && result.length > 0) {
          botpromt[noWa].atasan_options_satu = result;

          let message =
            'Pilih Nama Atasan Pertama.*HARAP MASUKAN ANGKA SAJA DARI PILIHAN TERSEDIA*:\n';
          result.forEach((item, index) => {
            message += `${index + 1}. ${item.nama} (${item.departemen})\n`;
          });
          message += `${
            result.length + 1
          }. Nama tidak tersedia di dalam pilihan\n`;
          message += `${result.length + 2}. Coba masukan nama kembali`;

          userchoice[noWa] = 'choose_atasan_satu';
          await sock.sendMessage(noWa, { text: message });
        } else {
          await sock.sendMessage(noWa, {
            text: 'Nama Atasan Tidak ditemukan di database. Harap input ulang:',
          });
        }
      } else if (step === 'choose_atasan_satu') {
        if (text.toLowerCase() === 'batal') {
          await sock.sendMessage(noWa, {
            text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
          });
          delete userchoice[noWa];
          delete botpromt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
          return;
        }
        const chosenIndex = parseInt(text) - 1;
        const options = botpromt[noWa].atasan_options_satu;

        if (
          isNaN(chosenIndex) ||
          !options ||
          chosenIndex < 0 ||
          chosenIndex >= options.length + 2
        ) {
          botpromt[noWa].attempts = (botpromt[noWa].attempts || 0) + 1;
          if (botpromt[noWa].attempts >= 3) {
            await sock.sendMessage(noWa, {
              text: 'Anda sudah melakukan percobaan 3 kali. Silahkan coba kembali nanti.',
            });
            delete userchoice[noWa];
            delete botpromt[noWa];
            clearTimeout(timeoutHandles[noWa]);
            delete timeoutHandles[noWa];
            return;
          } else {
            await sock.sendMessage(noWa, {
              text: 'Pilihan tidak valid. Silakan masukkan nomor yang sesuai:',
            });
            return;
          }
        }

        if (chosenIndex === options.length) {
          await sock.sendMessage(noWa, {
            text: 'Nama Atasan tidak tersedia. Silakan hubungi admin Digital Architect untuk penambahan nama atasan.',
          });
          delete userchoice[noWa];
          delete botpromt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
        } else if (chosenIndex === options.length + 1) {
          userchoice[noWa] = 'atasan_satu';
          await sock.sendMessage(noWa, {
            text: 'Silakan masukkan nama lengkap atasan *PERTAMA* atau nama depan saja tanpa tanda titik/koma/backtip (./,/`) untuk pencarian didatabase',
          });
        } else {
          botpromt[noWa].atasan_satu = options[chosenIndex].nama;
          botpromt[noWa].atasan_satu_id = options[chosenIndex].id;
          delete botpromt[noWa].atasan_options_satu;

          userchoice[noWa] = 'atasan_dua';
          // botpromt[noWa] = { attempts: 0 };
          await sock.sendMessage(noWa, {
            text: 'Silakan masukkan nama lengkap *ATASAN KEDUA* atau nama depan saja tanpa tanda titik/koma/backtip (./,/`) untuk pencarian didatabase',
          });
        }
      } else if (step === 'atasan_dua') {
        if (text.toLowerCase() === 'batal') {
          await sock.sendMessage(noWa, {
            text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
          });
          delete userchoice[noWa];
          delete botpromt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
          return;
        }
        botpromt[noWa].atasan_dua = text;
        const nama_atasandua = text;
        const result = await checkatasan(nama_atasandua);
        if (
          result.message &&
          result.message === 'Nama Atasan tidak ditemukan'
        ) {
          botpromt[noWa].attempts += 1;
          if (botpromt[noWa].attempts >= 3) {
            await sock.sendMessage(noWa, {
              text: 'Anda sudah melakukan percobaan *3 kali*. Silahkan coba kembali nanti.',
            });
            delete userchoice[noWa];
            delete botpromt[noWa];
            clearTimeout(timeoutHandles[noWa]);
            delete timeoutHandles[noWa];
          } else {
            await sock.sendMessage(noWa, {
              text: 'Nama Atasan Tidak ditemukan di database. Harap input ulang:',
            });
          }
        } else if (result !== null && result.length > 0) {
          botpromt[noWa].atasan_options_dua = result;

          let message =
            'Pilih Nama Atasan kedua , *HARAP MASUKAN ANGKA SAJA DARI PILIHAN TERSEDIA*:\n';
          result.forEach((item, index) => {
            message += `${index + 1}. ${item.nama} (${item.departemen})\n`;
          });
          message += `${
            result.length + 1
          }. Nama tidak tersedia di dalam pilihan\n`;
          message += `${result.length + 2}. Coba masukan nama kembali`;

          userchoice[noWa] = 'choose_atasan_dua';
          await sock.sendMessage(noWa, { text: message });
        } else {
          await sock.sendMessage(noWa, {
            text: 'Nama Atasan Tidak ditemukan di database. Harap input ulang:',
          });
        }
      } else if (step === 'choose_atasan_dua') {
        const chosenIndex = parseInt(text) - 1;
        const options = botpromt[noWa].atasan_options_dua;

        if (
          isNaN(chosenIndex) ||
          !options ||
          chosenIndex < 0 ||
          chosenIndex >= options.length + 2
        ) {
          botpromt[noWa].attempts = (botpromt[noWa].attempts || 0) + 1;
          if (botpromt[noWa].attempts >= 3) {
            await sock.sendMessage(noWa, {
              text: 'Anda sudah melakukan percobaan 3 kali. Silahkan coba kembali nanti.',
            });
            delete userchoice[noWa];
            delete botpromt[noWa];
            clearTimeout(timeoutHandles[noWa]);
            delete timeoutHandles[noWa];
            return;
          } else {
            await sock.sendMessage(noWa, {
              text: 'Pilihan tidak valid. Silakan masukkan nomor atasan 2 yang sesuai:',
            });
            return;
          }
        }
        if (chosenIndex === options.length) {
          await sock.sendMessage(noWa, {
            text: 'Nama Atasan tidak tersedia.Silakan hubungi admin Digital Architect untuk penambahan nama.',
          });
          delete userchoice[noWa];
          delete botpromt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
        } else if (chosenIndex === options.length + 1) {
          userchoice[noWa] = 'atasan_dua';
          await sock.sendMessage(noWa, {
            text: 'Silakan masukkan nama lengkap atasan *KEDUA* atau nama depan untuk pencarian didatabase',
          });
        } else if (!isNaN(chosenIndex) && options && options[chosenIndex]) {
          botpromt[noWa].atasan_dua = options[chosenIndex].nama;
          botpromt[noWa].atasan_dua_id = options[chosenIndex].id;
          delete botpromt[noWa].atasan_options_dua;

          userchoice[noWa] = 'confirm';
          await sock.sendMessage(noWa, {
            text: `*HARAP CROSSCHECK DATA ANDA TERLEBIH DAHULU*:
                            \nNama: ${botpromt[noWa].user_nama}
                            \nTujuan: ${botpromt[noWa].location}
                            \nKendaraan: ${botpromt[noWa].kendaraan}
                            \nPlat Nomor: ${botpromt[noWa].plat_nomor}
                            \nTanggal Izin Keluar: ${botpromt[noWa].date}
                            \nTanggal Kembali: ${botpromt[noWa].date_2}
                            \nJam Keluar: ${botpromt[noWa].jam_keluar}
                            \nJam Kembali: ${botpromt[noWa].jam_kembali}
                            \nKeperluan: ${botpromt[noWa].needs}
                            \nAtasan Satu: ${botpromt[noWa].atasan_satu}
                            \nAtasan Dua: ${botpromt[noWa].atasan_dua}
                            \nApakah semua data sudah sesuai? (ya/tidak)`,
          });
        } else {
          await sock.sendMessage(noWa, {
            text: 'Pilihan tidak valid. Silakan masukkan pilihan yang sesuai:',
          });
          return;
        }
      } else if (step === 'confirm') {
        if (text.toLowerCase() === 'ya') {
          userchoice[noWa] = 'disclamer_user';
          await sock.sendMessage(noWa, {
            text: `*Disclamer Harap di baca dengan seksama apakah anda setuju atau tidak*:
                        \n- Izin keluar kebun diberikan dengan tujuan yang telah ditentukan dan harus digunakan sesuai dengan ketentuan yang berlaku.
                        \n- Pemberi izin tidak bertanggung jawab atas cedera, kerugian, atau kerusakan yang timbul dari kecelakaan, baik yang diakibatkan oleh kelalaian sendiri maupun orang lain.
                        \n- Izin keluar kebun dapat dibatalkan sewaktu-waktu oleh pemberi izin jika ditemukan pelanggaran terhadap ketentuan yang berlaku.\n\nApakah Anda setuju dengan disclaimer ini? (ya/tidak)`,
          });
        } else if (text.toLowerCase() === 'tidak') {
          await sock.sendMessage(noWa, {
            text: 'Silakan coba lagi untuk input dengan mengetikkan !izin.',
          });
        } else {
          await sock.sendMessage(noWa, {
            text: 'Pilihan tidak valid. Silakan jawab dengan "ya" atau "tidak":',
          });
          return;
        }
      } else if (step === 'disclamer_user') {
        if (text.toLowerCase() === 'ya') {
          try {
            const response = await axios.post(
              'https://management.srs-ssms.com/api/formdataizin',
              // 'http://127.0.0.1:8000/api/formdataizin',
              {
                name: botpromt[noWa].user_nama_id,
                tujuan: botpromt[noWa].location,
                pergi: botpromt[noWa].date,
                kembali: botpromt[noWa].date_2,
                keperluan: botpromt[noWa].needs,
                atasan_satu: botpromt[noWa].atasan_satu_id,
                atasan_dua: botpromt[noWa].atasan_dua_id,
                kendaraan: botpromt[noWa].kendaraan,
                plat_nomor: botpromt[noWa].plat_nomor,
                jam_keluar: botpromt[noWa].jam_keluar,
                jam_kembali: botpromt[noWa].jam_kembali,
                no_hp: noWa,
                email: 'j',
                password: 'j',
              }
            );

            let responses = response.data;

            const responseKey = Object.keys(responses)[0];

            // console.log(responses);
            await sock.sendMessage(noWa, {
              text: 'Mohon Tunggu server melakukan validasi.....',
            });
            if (responseKey === 'error_validasi') {
              await sock.sendMessage(noWa, {
                text: `Data gagal diverifikasi, Karena: ${responses[responseKey]}`,
              });
            } else {
              await sock.sendMessage(noWa, {
                text: 'Permohonan izin berhasil dikirim dan sedang menunggu persetujuan dari atasan. Harap tunggu notifikasi selanjutnya atau cek perkembangan di website: https://izin-kebun.srs-ssms.com/.',
              });
            }
          } catch (error) {
            console.log('izinkebun error');

            if (error.response && error.response.status === 404) {
              await sock.sendMessage(noWa, {
                text: 'Nama Atasan tidak ditemukan di database. Harap input ulang.',
              });
            } else {
              console.log('Error fetching data:', error);
              await sock.sendMessage(noWa, {
                text: 'Terjadi kesalahan saat mengirim data. Silakan coba lagi.',
              });
            }
          }

          // await sock.sendMessage(noWa, { text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.' });
          delete userchoice[noWa];
          delete botpromt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
        } else if (text.toLowerCase() === 'tidak') {
          await sock.sendMessage(noWa, {
            text: 'Permintaan izin di batalkan, coba lagi untuk input dengan mengetikkan !izin.',
          });
          delete userchoice[noWa];
          delete botpromt[noWa];
          clearTimeout(timeoutHandles[noWa]);
          delete timeoutHandles[noWa];
        } else {
          await sock.sendMessage(noWa, {
            text: 'Pilihan tidak valid. Silakan jawab dengan "ya" atau "tidak":',
          });
          return;
        }
      } else {
        await sock.sendMessage(noWa, {
          text: 'Silahkan coba kembali dengan mengetikan perintah !izin:',
        });
        delete userchoice[noWa];
        delete botpromt[noWa];
        clearTimeout(timeoutHandles[noWa]);
        delete timeoutHandles[noWa];
      }
    }
  }

  async Report_group_izinkebun() {
    try {
      // Fetch data from the API
      const response = await axios.get(
        // 'http://127.0.0.1:8000/api/get_reportdata_suratizin',
        'https://management.srs-ssms.com/api/get_reportdata_suratizin',
        {
          params: {
            email: 'j',
            password: 'j',
          },
        }
      );

      const data = response.data;

      // Check if the PDF exists in the response
      if (data.pdf) {
        try {
          // Decode the base64 PDF and prepare it for sending
          const captions =
            'Laporan Izin Kebun Minggu ini\n' +
            'Berikut data yang izin keluar kebun\n' +
            'Generate by SRS BOT';

          const pdfBuffer = Buffer.from(data.pdf, 'base64');
          const pdfFilename = data.filename || 'Invoice.pdf';
          // const messageOptions = {
          //   document: pdfBuffer,
          //   mimetype: 'application/pdf',
          //   fileName: pdfFilename,
          //   caption: captions,
          // };
          queue.push({
            type: 'send_document',
            data: {
              to: idgroup,
              document: pdfBuffer,
              filename: pdfFilename,
              caption: captions,
            },
          });
          // Send the PDF as a document via WhatsApp
          // await sock.sendMessage(idgroup, messageOptions);
          // console.log('PDF sent successfully!');
        } catch (sendError) {
          console.log('Error sending PDF:', sendError.message);
        }
      } else {
        console.log('PDF not found in the API response.');
      }

      // Return the message if needed
      return data.message;
    } catch (error) {
      console.log('Error fetching data from API:', error.message);
      throw error;
    }
  }
  async Fail_send_pdf() {
    try {
      // Fetch data from the API
      const response = await axios.get(
        'https://management.srs-ssms.com/api/check_pdf_izin_fail',
        // 'http://erpda.test/api/check_pdf_izin_fail',
        {
          params: {
            email: 'j',
            password: 'j',
          },
        }
      );

      console.log(response.data);

      return response.data;
    } catch (error) {
      console.log('Error fetching data from API:', error.message);
      throw error;
    }
  }
  async reminder_izin_kebun() {
    try {
      // Fetch data from the API
      const response = await axios.get(
        'https://management.srs-ssms.com/api/reminder_izin_kebun',
        // 'http://erpda.test/api/check_pdf_izin_fail',
        {
          params: {
            email: 'j',
            password: 'j',
          },
        }
      );

      console.log(response.data);

      return response.data;
    } catch (error) {
      console.log('Error fetching data from API:', error.message);
      throw error;
    }
  }
}

module.exports = IzinKebunProgram;
