const { DateTime } = require('luxon');
const axios = require('axios');
const { channel } = require('../../utils/pusher');
const idgroup = '120363205553012899@g.us';
const idgroup_testing = '120363204285862734@g.us';
const idgroup_da = '120363303562042176@g.us';
const { shortenURL } = require('../../utils/shortenurl');
const userchoice = {};
const botpromt = {};
const timeoutHandles = {};
const fs = require('fs');
const https = require('https');

// function surat izin bot

async function getuserinfo(user) {
  try {
    // Fetch data from the API using the provided name
    const response = await axios.post(
      'https://qc-apps.srs-ssms.com/api/getuserinfo',
      {
        nama: user,
      }
    );
    // const response = await axios.post('https://qc-apps.srs-ssms.com/api/getuserinfo', {
    //     nama: user
    // });

    return response.data.data; // Assuming your API response structure has a 'data' field
  } catch (error) {
    // Check if the error response is due to a 404 status code
    if (error.response && error.response.status === 404) {
      return { message: 'Nama User tidak ditemukan' };
    } else {
      console.error('Error fetching data:', error);
      // throw new Error('Error fetching data from API');
    }
  }
}
async function checkatasan(nama_atasansatu) {
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
      console.error('Error fetching data:', error);
      // throw new Error('Error fetching data from API');
    }
  }
}

async function sendImageWithCaption(sock, noWa, imagePath, caption) {
  try {
    const imageBuffer = require('fs').readFileSync(imagePath);

    // Send the image with a caption
    await sock.sendMessage(noWa, {
      image: imageBuffer,
      caption: caption,
    });

    console.log('Image sent with caption successfully.');
  } catch (error) {
    console.error('Error sending image with caption:', error);
  }
}

async function updatestatus_sock_vbot(id, type_atasan) {
  try {
    const response = await axios.post(
      'https://management.srs-ssms.com/api/update_status_sock',
      // 'http://127.0.0.1:8000/api/update_status_sock',
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

const handleTimeout = (noWa, sock) => {
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
};

const handleijinmsg = async (noWa, text, sock) => {
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

      if (result.message && result.message === 'Nama Atasan tidak ditemukan') {
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
      if (result.message && result.message === 'Nama Atasan tidak ditemukan') {
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
          if (error.response && error.response.status === 404) {
            await sock.sendMessage(noWa, {
              text: 'Nama Atasan tidak ditemukan di database. Harap input ulang.',
            });
          } else {
            console.error('Error fetching data:', error);
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
};

async function getNotifications(sock) {
  try {
    // const response = await axios.get('http://qc-apps2.test/api/getnotifijin');
    const response = await axios.get(
      'https://qc-apps.srs-ssms.com/api/getnotifijin'
    );
    const data = response.data;
    // console.log(data);
    if (data.status === '200' && data.data && data.data.length > 0) {
      const result = data.data;
      // console.log("Data ada");
      // console.log(data);
      for (const itemdata of result) {
        if (itemdata.no_hp) {
          const exists = await sock.onWhatsApp(itemdata.no_hp);
          if (exists?.jid || (exists && exists[0]?.jid)) {
            if (itemdata.status === 'approved') {
              let message = `*Izin baru perlu di approved*:\n`;
              message += `Hallo Selamat Siang Bapak/Ibu ${itemdata.atasan_nama}\n`;
              message += `Anda memiliki request baru untuk izin keluar kebun dengan detail sebagai berikut:\n`;
              message += `*ID Pemohon* : ${itemdata.id}\n`;
              message += `*Nama* : ${itemdata.user_request}\n`;
              message += `*Keperluan izin keluar kebun* : ${itemdata.keperluan}\n`;
              message += `*Lokasi yang dituju* : ${itemdata.lokasi_tujuan}\n`;
              message += `*Tanggal keluar izin* : ${itemdata.tanggal_keluar} ${itemdata.jam_keluar}\n`;
              message += `*Tanggal kembali izin* : ${itemdata.tanggal_kembali} ${itemdata.jam_kembali}\n`;
              message += `Silahkan Reply Pesan ini kemudian balas ya/tidak\n`;
              message += `Generated by Digital Architect SRS Bot`;
              await sock.sendMessage(itemdata.no_hp + '@s.whatsapp.net', {
                text: message,
              });
              // Check if the user's phone number is set and send a message to the user
              if (itemdata.no_hp_user) {
                let userMessage = `*Izin Keluar Kebun Anda Telah Di setujui Atasan Pertama*\n\n`;
                userMessage += `Hallo Selamat Siang Bapak/Ibu ${itemdata.user_request},\n\n`;
                userMessage += `Kami ingin menginformasikan bahwa permintaan izin keluar kebun Anda telah Disetuji :\n\n`;
                userMessage += `Silahkan tunggu notifikasi  berikutnya untuk persetujuan dari atasan kedua.\n\n`;
                userMessage += `Terima kasih,\n`;
                userMessage += `Tim Digital Architect SRS Bot`;

                await sock.sendMessage(
                  itemdata.no_hp_user + '@s.whatsapp.net',
                  { text: userMessage }
                );
              }
            } else if (itemdata.status === 'send_approved') {
              let message = `*Izin Keluar Kebun Anda Telah Disetujui Atasan Kedua*\n\n`;
              message += `Hallo Selamat Siang Bapak/Ibu ${itemdata.nama_user},\n\n`;
              message += `Kami ingin menginformasikan bahwa permintaan izin keluar kebun Anda telah disetujui.\n\n`;
              message += `Berikut adalah detail izin Anda:\n`;
              message += `*Nama Pemohon*: ${itemdata.nama_user}\n`;
              message += `*Tanggal keluar izin* : ${itemdata.tanggal_keluar} ${itemdata.jam_keluar}\n`;
              message += `*Tanggal kembali izin* : ${itemdata.tanggal_kembali} ${itemdata.jam_kembali}\n`;
              message += `*Keperluan*: ${itemdata.keperluan}\n`;
              message += `*Lokasi Tujuan*: ${itemdata.lokasi_tujuan}\n\n`;
              message += `Harap selalu berhati-hati selama perjalanan dan pastikan untuk mengikuti protokol keamanan yang berlaku. Kami mendoakan agar Anda tiba dengan selamat di tujuan dan kembali ke kebun dengan kondisi sehat dan aman.\n\n`;
              message += `Jika ada pertanyaan lebih lanjut, jangan ragu untuk menghubungi kami.\n\n`;
              message += `Atau kunjungi web kami di :https://izin-kebun.srs-ssms.com \n\n`;
              message += `Terima kasih,\n`;
              message += `Tim Digital Architect SRS Bot`;

              // kirim pdf
              try {
                // const genpdf = await axios.get('http://qc-apps2.test/api/generatePdfIzinKebun', {
                const genpdf = await axios.get(
                  'https://izin-kebun.srs-ssms.com/api/generatePdfIzinKebun',
                  {
                    params: {
                      user: 'j',
                      pw: 'j',
                      id: itemdata.id,
                    },
                  }
                );
                // console.log(genpdf.data.filename);

                const fileUrl = `https://izin-kebun.srs-ssms.com/public/storage/files/${genpdf.data.filename}`;
                const destinationPath = `./uploads/${itemdata.filename_pdf}`;

                const file = fs.createWriteStream(destinationPath);

                await new Promise((resolve, reject) => {
                  https
                    .get(fileUrl, function (response) {
                      response.pipe(file);
                      file.on('finish', function () {
                        file.close(() => {
                          console.log('File downloaded successfully.');
                          resolve(); // Resolve the promise after the file is downloaded
                        });
                      });
                    })
                    .on('error', function (err) {
                      fs.unlink(destinationPath, () => {}); // Delete the file if there is an error
                      console.error('Error downloading the file:', err);
                      reject(err); // Reject the promise if there is an error
                    });
                });
                const messageOptions = {
                  document: {
                    url: destinationPath,
                    caption: 'ini caption',
                  },
                  fileName: 'Surat Izin Kebun',
                };
                await sock.sendMessage(
                  itemdata.no_hp + '@s.whatsapp.net',
                  messageOptions
                );

                try {
                  const unlinkpdf = await axios.get(
                    'https://izin-kebun.srs-ssms.com/api/deletePdfIzinKebun',
                    {
                      params: {
                        user: 'j',
                        pw: 'j',
                        filename: genpdf.data.filename,
                      },
                    }
                  );
                } catch (error) {
                  console.log('Error unlinkpdf PDF:', error);
                }
              } catch (error) {
                console.log('Error generating PDF:', error);
              }

              await sock.sendMessage(itemdata.no_hp + '@s.whatsapp.net', {
                text: message,
              });

              try {
                // const response = await axios.post('http://qc-apps2.test/api/updatenotifijin', {
                const response = await axios.post(
                  'https://qc-apps.srs-ssms.com/api/updatenotifijin',
                  {
                    id_data: itemdata.id,
                    id_atasan: itemdata.id_atasan,
                    answer: 'ya',
                  }
                );
              } catch (error) {
                console.log('Error approving:', error);
              }
            } else if (itemdata.status === 'rejected') {
              let message = `*Izin Keluar Kebun Anda Telah Ditolak*\n\n`;
              message += `Hallo Selamat Siang Bapak/Ibu ${itemdata.user_request},\n\n`;
              message += `Kami ingin menginformasikan bahwa permintaan izin keluar kebun Anda telah ditolak dikarenakan :\n\n`;
              message += `*Alasan ditolak*: ${itemdata.alasan}\n`;
              message += `Jika ada pertanyaan lebih lanjut, jangan ragu untuk menghubungi kami.\n\n`;
              message += `Terima kasih,\n`;
              message += `Tim Digital Architect SRS Bot`;
              await sock.sendMessage(itemdata.no_hp + '@s.whatsapp.net', {
                text: message,
              });

              try {
                // const response = await axios.post('http://qc-apps2.test/api/updatenotifijin', {
                const response = await axios.post(
                  'https://qc-apps.srs-ssms.com/api/updatenotifijin',
                  {
                    id_data: itemdata.id,
                    id_atasan: '3',
                    answer: 'tidak',
                  }
                );
                console.log(response);
              } catch (error) {
                console.log('Error approving:', error);
              }
            }
          } else {
            let message = `Aplikasi Surat izin kebun Nomor HP tidak bisa di chat : ${itemdata.id}\n`;
            message += `Haraf di update nomor hp ${itemdata.no_hp}\n`;
            await sock.sendMessage('120363205553012899' + '@g.us', {
              text: message,
            });
          }
        } else {
          let message = `Aplikasi Surat izin kebun Nomor HP kosong untuk : ${itemdata.id}\n`;
          message += `Haraf di update nama atasan ${itemdata.atasan_nama}\n`;
          await sock.sendMessage('120363205553012899' + '@g.us', {
            text: message,
          });
        }
      }
    } else {
      console.log('Data kosong');
      console.log(data);
    }
    return response;
  } catch (error) {
    console.error('Error:', error);
  }
}

async function Report_group_izinkebun(sock) {
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
        const pdfBuffer = Buffer.from(data.pdf, 'base64');
        const pdfFilename = data.filename || 'Invoice.pdf';
        const messageOptions = {
          document: pdfBuffer,
          mimetype: 'application/pdf',
          fileName: pdfFilename,
          caption: 'Laporan Izin Kebun',
        };

        // Send the PDF as a document via WhatsApp
        await sock.sendMessage(idgroup_da, messageOptions);
        // console.log('PDF sent successfully!');
      } catch (sendError) {
        console.error('Error sending PDF:', sendError.message);
      }
    } else {
      console.log('PDF not found in the API response.');
    }

    // Return the message if needed
    return data.message;
  } catch (error) {
    console.error('Error fetching data from API:', error.message);
    throw error;
  }
}
const runfunction = async (sock) => {
  channel.bind('izinkebunnotif', async (itemdata) => {
    try {
      if (!itemdata || !itemdata.data) {
        console.log('itemdata is undefined or missing data property.');
        return;
      }
      const data = itemdata.data;
      let errormsg = 'Error mengirim notifikasi izin keluar kebun\n';
      errormsg += `*ID Pemohon* : ${data.id}\n`;
      errormsg += `*Nama* : ${data.nama_user}\n`;
      errormsg += `Error mengirim ke nomor ${data.nama_atasan_1}\n`;
      if (data.type === 'send_atasan_satu') {
        const base_url = 'https://management.srs-ssms.com/api/izin';
        const url_ya = await shortenURL(
          `${base_url}/${data.id}/ya/${data.uuid}`
        );
        const url_tidak = await shortenURL(
          `${base_url}/${data.id}/tidak/${data.uuid}`
        );

        let message = `*Permintaan Persetujuan Izin Baru*:\n`;
        message += `Halo, Selamat Siang Bapak/Ibu ${data.nama_atasan_1},\n`;
        message += `Anda memiliki permintaan izin keluar kebun yang membutuhkan persetujuan dengan rincian sebagai berikut:\n`;
        message += `*ID Pemohon*: ${data.id}\n`;
        message += `*Nama Pemohon*: *${data.nama_user}*\n`;
        message += `*Tanggal Keluar*: ${data.tanggal_keluar}\n\n`;
        message += `Untuk memberikan persetujuan, Anda dapat mengklik salah satu link berikut untuk menyetujui atau menolak hanya permintaan ini.\n`;
        message +=
          ' Anda juga bisa membalas dengan *Ya semua*/*Tidak semua* untuk menyetujui/menolak semua permintaan yang terkait dengan Anda.\n\n';
        message += `✅ Setuju: ${url_ya}\n`;
        message += `❌ Tidak Setuju: ${url_tidak}\n\n`;
        message += `Pesan otomatis oleh Digital Architect SRS Bot.`;

        await updatestatus_sock_vbot(data.id_db, data.type);
        await sock.sendMessage(`${data.send_to}@s.whatsapp.net`, {
          text: message,
        });
      } else if (data.type === 'send_atasan_dua') {
        const base_url = 'https://management.srs-ssms.com/api/izin';
        const url_ya = await shortenURL(
          `${base_url}/${data.id}/ya/${data.uuid}`
        );
        const url_tidak = await shortenURL(
          `${base_url}/${data.id}/tidak/${data.uuid}`
        );
        let message = `*Permintaan Persetujuan Izin Baru*:\n`;
        message += `Halo, Selamat Siang Bapak/Ibu ${data.nama_atasan_2},\n`;
        message += `Anda memiliki permintaan izin keluar kebun yang membutuhkan persetujuan dengan rincian sebagai berikut:\n`;
        message += `*ID Pemohon*: ${data.id}\n`;
        message += `*Nama* : ${data.nama_user}\n`;
        message += `*Tanggal keluar izin* : ${data.tanggal_keluar}\n`;
        message += `Untuk memberikan persetujuan, Anda dapat mengklik salah satu link berikut untuk menyetujui atau menolak hanya permintaan ini.\n`;
        message +=
          ' Anda juga bisa membalas dengan *Ya semua*/*Tidak semua* untuk menyetujui/menolak semua permintaan yang terkait dengan Anda.\n\n';
        message += `✅ Setuju: ${url_ya}\n`;
        message += `❌ Tidak Setuju: ${url_tidak}\n\n`;
        message += `Pesan otomatis oleh Digital Architect SRS Bot.`;
        let userMessage = `*Izin Keluar Kebun Anda Telah Disetujui Atasan Pertama*\n\n`;
        userMessage += `Hallo Selamat Siang Bapak/Ibu ${data.nama_user},\n\n`;
        userMessage += `Kami ingin menginformasikan bahwa permintaan izin keluar kebun Anda telah Disetujui.\n\n`;
        userMessage += `Silahkan tunggu notifikasi  berikutnya untuk persetujuan dari atasan kedua.\n\n`;
        userMessage += `Terima kasih,\n`;
        userMessage += `Tim Digital Architect SRS Bot`;
        await updatestatus_sock_vbot(data.id_db, data.type);
        await sock.sendMessage(`${data.send_to}@s.whatsapp.net`, {
          text: message,
        });
        await sock.sendMessage(data.no_hp_user + '@s.whatsapp.net', {
          text: userMessage,
        });
      } else if (data.type === 'send_user') {
        let message = ''; // Initialize the message variable here
        if (data.status === 'approved') {
          message += `*Izin Keluar Kebun Anda Telah Disetujui*\n\n`;
          message += `Hallo Selamat Siang Bapak/Ibu ${data.nama_user},\n\n`;
          message += `Kami ingin menginformasikan bahwa permintaan izin keluar kebun Anda telah disetujui.\n\n`;
          message += `Berikut adalah detail izin Anda:\n`;
          message += `*Nama Pemohon*: ${data.nama_user}\n`;
          message += `*Tanggal keluar izin* : ${data.tanggal_keluar}\n`;
          message += `*Tanggal kembali izin* : ${data.tanggal_kembali}\n`;
          message += `*Keperluan*: ${data.keperluan}\n`;
          message += `*Lokasi Tujuan*: ${data.lokasi_tujuan}\n\n`;
          message += `Harap selalu berhati-hati selama perjalanan dan pastikan untuk mengikuti protokol keamanan yang berlaku. Kami mendoakan agar Anda tiba dengan selamat di tujuan dan kembali ke kebun dengan kondisi sehat dan aman.\n\n`;
          message += `Jika ada pertanyaan lebih lanjut, jangan ragu untuk menghubungi kami.\n\n`;
          message += `Atau kunjungi web kami di :https://izin-kebun.srs-ssms.com \n\n`;
          message += `Terima kasih,\n`;
          message += `Tim Digital Architect SRS Bot`;
          try {
            // const genpdf = await axios.get('http://qc-apps2.test/api/generatePdfIzinKebun', {
            const genpdf = await axios.get(
              'https://izin-kebun.srs-ssms.com/api/generatePdfIzinKebun',
              // 'http://qc-apps2.test/api/generatePdfIzinKebun',
              {
                params: {
                  user: 'j',
                  pw: 'j',
                  id: data.id_db,
                },
              }
            );
            // console.log(genpdf.data.filename);
            const fileUrl = `https://izin-kebun.srs-ssms.com/public/storage/files/${genpdf.data.filename}`;
            const destinationPath = `./uploads/${itemdata.filename_pdf}`;
            const file = fs.createWriteStream(destinationPath);
            await new Promise((resolve, reject) => {
              https
                .get(fileUrl, function (response) {
                  response.pipe(file);
                  file.on('finish', function () {
                    file.close(() => {
                      console.log('File downloaded successfully.');
                      resolve(); // Resolve the promise after the file is downloaded
                    });
                  });
                })
                .on('error', function (err) {
                  fs.unlink(destinationPath, () => {}); // Delete the file if there is an error
                  console.error('Error downloading the file:', err);
                  reject(err); // Reject the promise if there is an error
                });
            });
            const messageOptions = {
              document: {
                url: destinationPath,
                caption: 'ini caption',
              },
              fileName: 'Surat Izin Kebun',
            };
            await updatestatus_sock_vbot(data.id_db, data.type);
            await sock.sendMessage(
              data.send_to + '@s.whatsapp.net',
              messageOptions
            );
            try {
              const unlinkpdf = await axios.get(
                'https://izin-kebun.srs-ssms.com/api/deletePdfIzinKebun',
                {
                  params: {
                    user: 'j',
                    pw: 'j',
                    filename: genpdf.data.filename,
                  },
                }
              );
            } catch (error) {
              console.log('Error unlinkpdf PDF:', error);
            }
          } catch (error) {
            console.log('Error generating PDF:', error);
          }
        } else if (data.status === 'rejected') {
          message += `*Izin Keluar Kebun Anda Telah Ditolak*\n\n`;
          message += `Hallo Selamat Siang Bapak/Ibu ${data.nama_user},\n\n`;
          message += `Kami ingin menginformasikan bahwa permintaan izin keluar kebun Anda telah ditolak dikarenakan :\n\n`;
          message += `*Alasan ditolak*: ${data.response}\n`;
          message += `Jika ada pertanyaan lebih lanjut, jangan ragu untuk menghubungi kami.\n\n`;
          message += `Terima kasih,\n`;
          message += `Tim Digital Architect SRS Bot`;
        } else {
          console.log('Unknown status:', data.type);
          return;
        }
        await updatestatus_sock_vbot(data.id_db, data.type);
        await sock.sendMessage(`${data.send_to}@s.whatsapp.net`, {
          text: message,
        });
      } else if (data.type === 'send_atasan_tiga') {
        const base_url = 'https://management.srs-ssms.com/api/izin';
        const url_ya = await shortenURL(
          `${base_url}/${data.id}/ya/${data.uuid}`
        );
        const url_tidak = await shortenURL(
          `${base_url}/${data.id}/tidak/${data.uuid}`
        );
        let message = `*Permintaan Persetujuan Izin Baru*:\n`;
        message += `Halo, Selamat Siang Bapak/Ibu ${data.nama_atasan_3},\n`;
        message += `Anda memiliki permintaan izin keluar kebun yang membutuhkan persetujuan dengan rincian sebagai berikut:\n`;
        message += `*ID Pemohon*: ${data.id}\n`;
        message += `*Nama* : ${data.nama_user}\n`;
        message += `*Tanggal keluar izin* : ${data.tanggal_keluar}\n`;
        message += `Untuk memberikan persetujuan, Anda dapat mengklik salah satu link berikut untuk menyetujui atau menolak hanya permintaan ini.\n`;
        message +=
          ' Anda juga bisa membalas dengan *Ya semua*/*Tidak semua* untuk menyetujui/menolak semua permintaan yang terkait dengan Anda.\n\n';
        message += `✅ Setuju: ${url_ya}\n`;
        message += `❌ Tidak Setuju: ${url_tidak}\n\n`;
        message += `Pesan otomatis oleh Digital Architect SRS Bot.`;
        let userMessage = `*Izin Keluar Kebun Anda Telah Di setujui Atasan Kedua*\n\n`;
        userMessage += `Hallo Selamat Siang Bapak/Ibu ${data.nama_user},\n\n`;
        userMessage += `Kami ingin menginformasikan bahwa permintaan izin keluar kebun Anda telah Disetuji :\n\n`;
        userMessage += `Silahkan tunggu notifikasi  berikutnya untuk persetujuan dari atasan ketiga.\n\n`;
        userMessage += `Terima kasih,\n`;
        userMessage += `Tim Digital Architect SRS Bot`;
        await updatestatus_sock_vbot(data.id_db, data.type);
        await sock.sendMessage(`${data.send_to}@s.whatsapp.net`, {
          text: message,
        });
        await sock.sendMessage(data.no_hp_user + '@s.whatsapp.net', {
          text: userMessage,
        });
      } else {
        console.log('Unknown status:', data.type);
        return;
      }
    } catch (globalError) {
      console.log('Unexpected error:', globalError);
    }
  });
};

module.exports = {
  handleijinmsg,
  getNotifications,
  runfunction,
  userchoice,
  botpromt,
  timeoutHandles,
  sendImageWithCaption,
  Report_group_izinkebun,
};
