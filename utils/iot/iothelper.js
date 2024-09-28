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

module.exports = {
  get_iot_weatherstation,
};
