const axios = require('axios');
// const cronJobSettings = require('../services/CronJobSettings');
const logger = require('../services/logger');
// const pusherService = require('../services/pusher');
const settings = require('../web/data/settings.json');
const credentials = settings.iot.credentials;
const groups = settings.iot.groups;
const { isProgramActive } = require('../utils/programHelper');

class IotProgram {
  constructor() {
    this.running = false;
    this.credentials = credentials;
    this.groups = groups;
    if (!global.queue) {
      global.queue = require('../services/queue');
    }
    this.userIotChoice = {};
    this.botIotPrompt = {};
    this.timeoutHandles = {};
  }

  static async init() {
    try {
      logger.info.iot('Initializing iot program');
      const instance = new IotProgram();
      await global.queue.init();
      return instance;
    } catch (error) {
      logger.error.iot('Error initializing iot program:', error);
      throw error;
    }
  }

  start() {
    if (!this.running) {
      this.running = true;
      logger.info.iot('Iot program started');
    }
  }

  stop() {
    if (this.running) {
      this.running = false;
      logger.info.iot('Iot program stopped');
    }
  }

  async get_iot_weatherstation() {
    if (!isProgramActive('iot')) {
      logger.info.iot('Iot program is not active during fetching weather data');
      return {
        error: 'Iot program is not active',
        message: 'Iot program is not active',
      };
    }

    try {
      const response = await axios.get(
        'https://management.srs-ssms.com/api/weather_station_status',
        { params: this.credentials }
      );

      if (!response.status === 200 || !response.data?.data?.length) {
        return { error: 'Data kosong iot' };
      }

      for (const station of response.data.data) {
        const message = this.formatWeatherStationMessage(station);

        try {
          // Send to specific estate group if configured
          const groupId =
            this.groups[`idgroupiot_${station.loc.toLowerCase()}`];
          if (groupId) {
            await global.queue.push({
              type: 'send_message',
              data: { to: groupId, message },
            });
          }

          // Send to main IOT group
          await global.queue.push({
            type: 'send_message',
            data: { to: this.groups.idgroupiot, message },
          });

          logger.info.iot('Sending message to iot group');
          return { success: true, message: 'Success' };
        } catch (error) {
          logger.error.iot('Error sending message to iot group:', error);
          return { error: error, message: 'Error' };
        }
      }
    } catch (error) {
      logger.error.iot('Error fetching data:', error);
      return { error: error, message: 'Error' };
    }
  }

  formatWeatherStationMessage(station) {
    return [
      'Laporan Weather Station',
      `Nama: ${station.loc}`,
      `Detail : ${station.desc}`,
      `Last online : ${station.last_online}`,
      `Ip address : ${station.ip_address}`,
    ].join('\n');
  }

  async get_iot_weatherstation_data_gap() {
    if (!isProgramActive('iot')) {
      return {
        error: 'Iot program is not active',
        message: 'Iot program is not active',
      };
    }
    try {
      const response = await axios.get(
        'https://management.srs-ssms.com/api/uptime_data_weather_station',
        // 'http://erpda.test/api/uptime_data_weather_station',
        {
          params: this.credentials,
        }
      );

      const data = response.data;

      if (response.status === 200 && data.data) {
        const result = data.data;
        const dead_stations = result.dead_stations;
        const stations_with_gaps = result.stations_with_gaps;

        // Handling dead stations
        if (dead_stations.length > 0) {
          let message = `Laporan Stasiun Cuaca: Stasiun Tidak Aktif\n\n`;
          dead_stations.forEach((station) => {
            message += `- Nama Stasiun: ${station}\n`;
          });

          message += `\nMohon segera periksa stasiun-stasiun yang tidak aktif.\n`;

          try {
            global.queue.push({
              type: 'send_message',
              data: { to: idgroupiot, message: message },
            });
            logger.info.iot('Sending message to iot group');
            return { success: true, message: 'Success' };
          } catch (error) {
            logger.error.iot('Error sending message to iot group:', error);
            return { error: error, message: 'Error' };
          }
        }

        // Menangani stasiun dengan data gap
        if (Object.keys(stations_with_gaps).length > 0) {
          for (const [stationId, gaps] of Object.entries(stations_with_gaps)) {
            gaps.forEach(async (gapData) => {
              let message = `Laporan Stasiun Cuaca: Terjadi Kesenjangan Data\n\n`;
              message += `Nama Stasiun: ${gapData.desc}\n`;
              message += `Lokasi: ${gapData.loc}\n`;
              message += `Terakhir Online: ${gapData.last_online_station || 'Data tidak tersedia'}\n`;
              message += `Terakhir Pembaruan Data: ${gapData.last_update_at_data}\n`;
              message += `Waktu Perbandingan dengan data terakhir: ${gapData.gap_current_time}\n`;
              message += `Durasi Kesenjangan Data: ${gapData.gap_in_minutes.toFixed(2)} menit\n`;

              message += `\nMohon selidiki kesenjangan data pada stasiun ini.\n`;

              try {
                global.queue.push({
                  type: 'send_message',
                  data: { to: idgroupiot, message: message },
                });
                logger.info.iot('Sending message to iot group');
                return { success: true, message: 'Success' };
              } catch (error) {
                logger.error.iot('Error sending message to iot group:', error);
                return { error: error, message: 'Error' };
              }
            });
          }
        }
      } else {
        return { error: 'Data kosong iot', message: 'Data kosong iot' };
      }
      return response;
    } catch (error) {
      logger.error.iot('Error fetching data:', error);
      return { error: error, message: 'Error' };
    }
  }

  async get_data_harian_aws() {
    if (!isProgramActive('iot')) {
      logger.info.iot('Iot program is not active during fetching AWS data');
      return {
        error: 'Iot program is not active',
        message: 'Iot program is not active',
      };
    }

    try {
      const response = await axios.get(
        'https://management.srs-ssms.com/api/get_weather_data_harian',
        {
          params: this.credentials,
        }
      );

      const data = response.data;

      if (response.status === 200 && data.data) {
        const stations = data.data;

        for (const [id, station] of Object.entries(stations)) {
          // Get weather prediction based on rainfall data

          let message = `🌦 DAILY REPORT AWS ${station.station_name}\n\n`;

          // Only show rainfall data if total is not 0

          message += `🌧 CURAH HUJAN ${station.date}\n`;
          if (Number(station.rainfall.total) > 0) {
            message += `Total: ${Number(station.rainfall.total).toFixed(2)} mm\n`;
          }
          message += `SBI: ${Number(station.rainfall.sbi).toFixed(2)} mm (rata-rata harian ${(station.rainfall.sbi / 30).toFixed(2)}mm)\n`;
          if (Number(station.rainfall.highest.value) > 0) {
            message += `Tertinggi: ${Number(station.rainfall.highest.value).toFixed(2)} mm/Jam (${station.rainfall.highest.hour})\n`;
            message += `Total durasi: ${station.rainfall.duration_minutes} menit\n\n`;
          }
          message += `🌡 CUACA\n`;
          message += `Suhu rata-rata: ${Number(station.temperature.average).toFixed(2)}°C\n`;
          message += `Suhu tertinggi: ${Number(station.temperature.highest.value).toFixed(2)}°C (${station.temperature.highest.hour})\n`;
          message += `Suhu terendah: ${Number(station.temperature.lowest.value).toFixed(2)}°C (${station.temperature.lowest.hour})\n`;
          message += `⛅ PERKIRAAN CUACA HARI INI:\n`;
          message += `${station.tomorrow_forecast.weather_description}\n\n`;
          message += `📥 Download data AWS bulan ini: https://iot.srs-ssms.com/dashboardaws\n`;

          try {
            // Send to station's specific group
            if (station.group_wa) {
              global.queue.push({
                type: 'send_message',
                data: { to: station.group_wa, message: message },
              });
            }

            // Send to main IOT group
            global.queue.push({
              type: 'send_message',
              data: { to: idgroupiot, message: message },
            });

            logger.info.iot('Sending message to iot group');
            return {
              success: true,
              message: 'Berhasil mengirim data AWS harian',
            };
          } catch (error) {
            logger.error.iot('Error sending message to iot group:', error);
            return {
              success: false,
              message: 'Gagal mengirim data AWS harian',
            };
          }
        }
      } else {
        return {
          error: 'Data AWS harian kosong',
          message: 'Data AWS harian kosong',
        };
      }
      return response;
    } catch (error) {
      logger.error.iot('Error fetching AWS daily data:', error);
      return {
        success: false,
        message: 'Gagal mengirim data AWS harian',
      };
    }
  }

  async handleTimeout(noWa, sock) {
    if (this.timeoutHandles[noWa]) {
      clearTimeout(this.timeoutHandles[noWa]);
    }

    this.timeoutHandles[noWa] = setTimeout(
      async () => {
        console.log(`Timeout triggered for ${noWa}`);
        await sock.sendMessage(noWa, {
          text: 'Waktu Anda telah habis. Silakan mulai kembali dengan mengetikkan !izin.',
        });
        delete this.userIotChoice[noWa];
        delete this.botIotPrompt[noWa];
        delete this.timeoutHandles[noWa];
      },
      5 * 60 * 1000
    );

    // console.log(`Timeout set for ${noWa}`);
  }

  async clearedhandleTimeout(noWa) {
    delete this.userIotChoice[noWa];
    delete this.botIotPrompt[noWa];
    clearTimeout(this.timeoutHandles[noWa]);
    delete this.timeoutHandles[noWa];
  }
  async handleIotInput(noWa, text, sock) {
    // Initial command
    if (text.toLowerCase() === '!iot') {
      this.userIotChoice[noWa] = 'estate';
      this.botIotPrompt[noWa] = { attempts: 0 };
      await sock.sendMessage(noWa, { text: 'Masukkan estate' });
      this.handleTimeout(noWa, sock);
      return;
    }

    // If no active conversation and not initial command, ignore
    if (!this.userIotChoice[noWa]) {
      return;
    }

    // Reset timeout on each valid input
    this.handleTimeout(noWa, sock);

    const step = this.userIotChoice[noWa];

    switch (step) {
      case 'estate':
        this.botIotPrompt[noWa].estate = text;
        try {
          const response = await axios.post(
            'http://qc-apps2.test/api/inputiotdata',
            {
              estate: this.botIotPrompt[noWa].estate,
              type: 'check_estate',
            }
          );
          const responses = response.data.data;

          await sock.sendMessage(noWa, {
            text: 'Mohon tunggu, server sedang melakukan validasi.',
          });

          let message = 'Pilih list afdeling, Masukan angka saja\n';
          let options = [];

          Object.keys(responses).forEach((key) => {
            responses[key].forEach((item) => {
              options.push(item);
              message += `${options.length}. ${item.nama}\n`;
            });
          });

          message += `${options.length + 1}. Afd tidak tersedia dalam daftar.\n`;
          message += `${options.length + 2}. Coba masukan afd kembali\n`;

          this.botIotPrompt[noWa].afdelingOptions = options;
          this.userIotChoice[noWa] = 'afdeling';
          await sock.sendMessage(noWa, { text: message });
        } catch (error) {
          await sock.sendMessage(noWa, {
            text: 'Terjadi kesalahan. Silakan mulai kembali dengan !iot',
          });
          this.clearedhandleTimeout(noWa);
        }
        break;

      case 'afdeling':
        const chosenIndex = parseInt(text) - 1;
        const options = this.botIotPrompt[noWa].afdelingOptions;

        if (
          isNaN(chosenIndex) ||
          chosenIndex < 0 ||
          chosenIndex >= options.length + 2
        ) {
          await sock.sendMessage(noWa, {
            text: 'Pilihan tidak valid. Silakan mulai kembali dengan !iot',
          });
          this.clearedhandleTimeout(noWa);
          return;
        }

        if (chosenIndex >= options.length) {
          await sock.sendMessage(noWa, {
            text: 'Silakan mulai kembali dengan !iot untuk memilih afdeling lain',
          });
          this.clearedhandleTimeout(noWa);
          return;
        }

        const selectedOption = options[chosenIndex];
        this.botIotPrompt[noWa] = {
          ...this.botIotPrompt[noWa],
          afdeling: selectedOption.nama,
          afdeling_id: selectedOption.afdeling_id,
          estate_id: selectedOption.est_id,
          estate_nama: selectedOption.est,
        };

        this.userIotChoice[noWa] = 'curah_hujan';
        await sock.sendMessage(noWa, {
          text: 'Masukkan curah hujan (harap angka saja)',
        });
        break;

      case 'curah_hujan':
        const curahHujan = parseFloat(text);
        if (isNaN(curahHujan)) {
          await sock.sendMessage(noWa, {
            text: 'Curah hujan tidak valid. Silakan masukkan angka saja.',
          });
          return;
        }

        this.botIotPrompt[noWa].curahHujan = curahHujan;
        this.userIotChoice[noWa] = 'confirm';
        await sock.sendMessage(noWa, {
          text: `*HARAP CROSSCHECK DATA ANDA TERLEBIH DAHULU*:
                \nAfdeling ID: ${this.botIotPrompt[noWa].afdeling_id}
                \nEstate: ${this.botIotPrompt[noWa].estate_nama}
                \nCurah Hujan: ${this.botIotPrompt[noWa].curahHujan}
                \nApakah semua data sudah sesuai? (ya/tidak)`,
        });
        break;

      case 'confirm':
        if (text.toLowerCase() === 'ya') {
          try {
            const response = await axios.post(
              'http://qc-apps2.test/api/inputiotdata',
              {
                afdeling_id: this.botIotPrompt[noWa].afdeling_id,
                estate_id: this.botIotPrompt[noWa].estate_id,
                curahHujan: this.botIotPrompt[noWa].curahHujan,
                estate: this.botIotPrompt[noWa].estate_nama,
                afdeling: this.botIotPrompt[noWa].afdeling,
                type: 'input',
              }
            );

            const responses = response.data;
            const responseKey = Object.keys(responses)[0];

            await sock.sendMessage(noWa, {
              text:
                responseKey === 'error_validasi'
                  ? `Data gagal diverifikasi, karena: ${responses[responseKey]}`
                  : 'Data berhasil dimasukan ke dalam database',
            });
          } catch (error) {
            await sock.sendMessage(noWa, {
              text: 'Terjadi kesalahan saat mengirim data. Silakan coba lagi dengan !iot',
            });
          }
        } else if (text.toLowerCase() === 'tidak') {
          await sock.sendMessage(noWa, {
            text: 'Silakan coba lagi untuk input dengan mengetikkan !iot.',
          });
        } else {
          await sock.sendMessage(noWa, {
            text: 'Pilihan tidak valid. Silakan jawab dengan "ya" atau "tidak"',
          });
          return;
        }
        // Clear state after confirmation (whether successful or not)
        this.clearedhandleTimeout(noWa);
        break;
    }
  }
}

module.exports = IotProgram;
