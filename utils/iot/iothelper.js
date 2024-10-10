const axios = require('axios');
const { catcherror } = require('../izinkebun/helper');
const idgroupiot = '120363339511378953@g.us';

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
          // Send message as an object with the text field
          await sock.sendMessage(idgroupiot, { text: message });
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
      // 'https://management.srs-ssms.com/api/uptime_data_weather_station',
      'http://erpda.test/api/uptime_data_weather_station',
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
        let message = `Laporan Weather Station - Dead Stations\n`;
        dead_stations.forEach((station) => {
          message += `Nama: ${station}\n`;
        });

        try {
          await sock.sendMessage(idgroupiot, { text: message });
        } catch (error) {
          console.log(error);
          await catcherror('dead_station', 'error_cronjob', 'bot_iot');
        }
      }

      // Handling stations with gaps
      if (Object.keys(stations_with_gaps).length > 0) {
        for (const [stationId, gaps] of Object.entries(stations_with_gaps)) {
          gaps.forEach(async (gapData) => {
            let message = `Laporan Weather Station - Gaps\n`;
            message += `Nama: ${gapData.desc}\n`;
            message += `Lokasi: ${gapData.loc}\n`;
            message += `Last online station: ${gapData.last_online_station || 'N/A'}\n`;
            message += `Last update data: ${gapData.last_update_at_data}\n`;
            message += `Tanggal Sekarang: ${gapData.gap_current_time}\n`;
            message += `Gap waktu dimiliki (menit): ${gapData.gap_in_minutes.toFixed(2)}\n`;

            try {
              await sock.sendMessage(idgroupiot, { text: message });
            } catch (error) {
              console.log(error);
              await catcherror(gapData.id, 'error_cronjob', 'bot_iot');
            }
          });
        }
      }
    } else {
      console.log('Data kosong iot');
    }
    return response;
  } catch (error) {
    console.log('Error fetching data:', error);
  }
}

module.exports = {
  get_iot_weatherstation,
  get_iot_weatherstation_data_gap,
};
