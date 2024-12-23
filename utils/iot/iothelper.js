const axios = require('axios');
const { catcherror } = require('../izinkebun/helper');
const idgroupiot = '120363339511378953@g.us';
const idgroupiot_sge = '120363347403672053@g.us';
const idgroupiot_rge = '120363329617301042@g.us';
const idgroupiot_sulung = '120363349319318472@g.us';
const idgroupiot_nke = '120363339978223243@g.us';
const idgroupiot_sje = '120363343703891310@g.us';
// grup testing
// const idgroupiot = '120363205553012899@g.us';

async function get_iot_weatherstation(sock) {
  try {
    const response = await axios.get(
      'https://management.srs-ssms.com/api/weather_station_status',

      {
        params: {
          email: 'j',
          password: 'j',
        },
      }
    );

    const data = response.data;
    // console.log(data);

    if (response.status === 200 && data.data && data.data.length > 0) {
      const result = data.data;

      for (const itemdata of result) {
        let message = `Laporan Weather Station\n`;
        message += `Nama: ${itemdata.loc}\n`;
        message += `Detail : ${itemdata.desc}\n`;
        message += `Last online : ${itemdata.last_online}\n`;
        message += `Ip address : ${itemdata.ip_address}\n`;

        try {
          if (itemdata.loc === 'SGE') {
            queue.push({
              type: 'send_message',
              data: { to: idgroupiot_sge, message: message },
            });
            // await sock.sendMessage(idgroupiot_sge, { text: message });
          } else if (itemdata.loc === 'RGE') {
            queue.push({
              type: 'send_message',
              data: { to: idgroupiot_rge, message: message },
            });
            // await sock.sendMessage(idgroupiot_rge, { text: message });
          } else if (itemdata.loc === 'Sulung Ranch') {
            queue.push({
              type: 'send_message',
              data: { to: idgroupiot_sulung, message: message },
            });
          } else if (itemdata.loc === 'NKE') {
            queue.push({
              type: 'send_message',
              data: { to: idgroupiot_nke, message: message },
            });
          } else if (itemdata.loc === 'SJE') {
            queue.push({
              type: 'send_message',
              data: { to: idgroupiot_sje, message: message },
            });
          }
          queue.push({
            type: 'send_message',
            data: { to: idgroupiot, message: message },
          });
          // await sock.sendMessage(idgroupiot, { text: message });
        } catch (error) {
          console.log(error);
          await catcherror(itemdata.id, 'error_cronjob', 'bot_iot');
        }
      }
    } else {
      console.log('data kosong iot');
    }
    return response;
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}
async function get_iot_weatherstation_data_gap(sock) {
  try {
    const response = await axios.get(
      'https://management.srs-ssms.com/api/uptime_data_weather_station',
      // 'http://erpda.test/api/uptime_data_weather_station',
      {
        params: {
          email: 'j',
          password: 'j',
        },
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
          await sock.sendMessage(idgroupiot, { text: message });
        } catch (error) {
          console.log(error);
          await catcherror('dead_station', 'error_cronjob', 'bot_iot');
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
              await sock.sendMessage(idgroupiot, { text: message });
            } catch (error) {
              // console.log(error);
              await catcherror(gapData.id, 'error_cronjob', 'bot_iot');
            }
          });
        }
      }
    } else {
      // console.log('Data kosong iot');
    }
    return response;
  } catch (error) {
    console.log('Error fetching data:', error);
  }
}

async function get_data_harian_aws(sock) {
  try {
    const response = await axios.get(
      'https://management.srs-ssms.com/api/get_weather_data_harian',
      {
        params: {
          email: 'j',
          password: 'j',
        },
      }
    );

    const data = response.data;

    if (response.status === 200 && data.data) {
      const stations = data.data;

      for (const [id, station] of Object.entries(stations)) {
        let message = `Laporan Harian Weather Station\n\n`;
        message += `Lokasi: ${station.desc} (${station.loc})\n`;
        message += `Tanggal: ${station.date}\n`;
        message += `Suhu: ${station.temp_out.toFixed(1)}°C\n`;
        message += `Kelembaban: ${station.hum_out.toFixed(1)}%\n`;
        message += `Curah Hujan: ${station.rain_rate} mm\n`;
        message += `Kecepatan Angin: ${station.windspeedkmh.toFixed(1)} km/h\n`;
        try {
          // Send to specific estate group
          if (station.loc === 'SGE') {
            queue.push({
              type: 'send_message',
              data: { to: idgroupiot_sge, message: message },
            });
          } else if (station.loc === 'RGE') {
            queue.push({
              type: 'send_message',
              data: { to: idgroupiot_rge, message: message },
            });
          } else if (station.loc === 'Sulung Ranch') {
            queue.push({
              type: 'send_message',
              data: { to: idgroupiot_sulung, message: message },
            });
          } else if (station.loc === 'NKE') {
            queue.push({
              type: 'send_message',
              data: { to: idgroupiot_nke, message: message },
            });
          } else if (station.loc === 'SJE') {
            queue.push({
              type: 'send_message',
              data: { to: idgroupiot_sje, message: message },
            });
          }

          // Send to main IOT group
          queue.push({
            type: 'send_message',
            data: { to: idgroupiot, message: message },
          });
        } catch (error) {
          console.log(error);
          await catcherror(station.idws, 'error_cronjob', 'bot_iot');
        }
      }
    } else {
      console.log('Data AWS harian kosong');
    }
    return response;
  } catch (error) {
    console.error('Error fetching AWS daily data:', error);
  }
}

module.exports = {
  get_iot_weatherstation,
  get_iot_weatherstation_data_gap,
  get_data_harian_aws,
};
