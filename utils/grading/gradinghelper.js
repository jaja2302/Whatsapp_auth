// function bot grading mill
const axios = require('axios');
const fs = require('fs');
const https = require('https');
const { catcherror } = require('../izinkebun/helper');

async function get_mill_data(sock) {
  try {
    const response = await axios.get(
      'https://management.srs-ssms.com/api/getdatamill',
      {
        params: {
          email: 'j',
          password: 'j',
        },
      }
    );

    const data = response.data;
    // const noWa_grading = '120363205553012899@g.us';
    const noWa_grading = '120363164751475851@g.us';
    const noWa_grading_suayap = '6281397270799-1635156024@g.us';

    if (data.status === '200' && data.data && data.data.length > 0) {
      const result = data.data;

      for (const itemdata of result) {
        let pemanen_tanpabrondol =
          itemdata.pemanen_list_tanpabrondol?.tanpaBrondol_list || [];
        let pemanen_kurangbrondol =
          itemdata.pemanen_list_kurangbrondol?.kurangBrondol_list || [];

        let message = `*Berikut Hasil Grading Total ${itemdata.estate} ${itemdata.afdeling}*:\n`;
        message += `*Tanggal*: ${itemdata.Tanggal}\n`;
        message += `*Jam*: ${itemdata.waktu_grading}\n`;
        message += `*Ripeness*: ${itemdata.Ripeness} jjg (${itemdata.percentase_ripenes}%)\n`;
        message += `*Unripe*: ${itemdata.Unripe} jjg (${itemdata.persenstase_unripe}%)\n`;
        message += `•0 brondol: ${itemdata.nol_brondol} jjg (${itemdata.persentase_nol_brondol}%)\n`;
        pemanen_tanpabrondol.forEach((item, index) => {
          message += `${index + 1}. No. Pemanen : ${item.no_pemanen} = ${
            item.tanpaBrondol
          } jjg\n`;
        });
        message += `•< brondol: ${itemdata.kurang_brondol} jjg (${itemdata.persentase_brondol}%)\n`;
        pemanen_kurangbrondol.forEach((item, index) => {
          message += `${index + 1}. No. Pemanen : ${item.no_pemanen} = ${
            item.kurangBrondol
          } jjg\n`;
        });
        message += `*Overripe*:  ${itemdata.Overripe} jjg ( ${itemdata.persentase_overripe}%)\n`;
        message += `*Empty bunch*: ${itemdata.empty_bunch} jjg (${itemdata.persentase_empty_bunch}%)\n`;
        message += `*Rotten bunch*: ${itemdata.rotten_bunch} jjg (${itemdata.persentase_rotten_bunce}%)\n`;
        message += `*Abnormal*: ${itemdata.Abnormal} jjg (${itemdata.persentase_abnormal}%)\n`;
        message += `*Dirt*: ${itemdata.Dirt} Kg ( ${itemdata.persentase}%)\n`;
        message += `*Loose Fruit*: ${itemdata.loose_fruit} Kg (${itemdata.persentase_lose_fruit}%)\n\n`;
        message += `Jumlah janjang di Grading: ${itemdata.jjg_grading} jjg\n`;
        message += `Jumlah janjang di SPB:  ${itemdata.jjg_spb} jjg\n`;
        message += `Jumlah Selisih janjang: ${itemdata.jjg_selisih} jjg ( ${itemdata.persentase_selisih}%)\n`;
        message += `Generated by Digital Architect SRS bot`;

        // sendingimage
        const imgBuffer = Buffer.from(itemdata.base64Collage, 'base64');
        const imageOptions = {
          image: imgBuffer,
          caption: message,
        };
        await sock.sendMessage(noWa_grading, imageOptions);

        // sending pdf
        const pdfBuffer = Buffer.from(itemdata.pdf, 'base64');
        const messageOptions = {
          document: pdfBuffer,
          mimetype: 'application/pdf',
          fileName: `${itemdata.tanggal_judul}(${itemdata.waktu_grading_judul})-Grading ${itemdata.mill}-${itemdata.estate}${itemdata.afdeling}`,

          caption: `${itemdata.tanggal_judul}(${itemdata.waktu_grading_judul})-Grading ${itemdata.mill}-${itemdata.estate}${itemdata.afdeling}`,
        };

        try {
          // First, try sending the message
          await sock.sendMessage(noWa_grading, messageOptions);

          // if (itemdata.estate == 'SYE') {
          //   await sock.sendMessage(noWa_grading_suayap, messageOptions);
          //   await sock.sendMessage(noWa_grading_suayap, imageOptions);
          // }
          // If sendMessage succeeds, then proceed with updating data
          try {
            await axios.post(
              'https://management.srs-ssms.com/api/updatedatamill',
              {
                id: itemdata.id,
                email: 'j', // replace with actual credentials
                password: 'j', // replace with actual credentials
              }
            );
            console.log('Data update successful for ID:', itemdata.id);
          } catch (updateError) {
            console.log(
              'Error updating data for ID:',
              itemdata.id,
              updateError
            );
            await catcherror(
              itemdata.id,
              'error_updating_data',
              'bot_grading_mill'
            );
          }
        } catch (sendMessageError) {
          console.log('Error sending message:', sendMessageError);
          await catcherror(
            itemdata.id,
            'error_sending_message',
            'bot_grading_mill'
          );
        }

        // Send the PDF file
      }
    } else {
      console.log('data kosong');
    }
    return response;
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

// async function get_mill_data(sock) {
//   const credentials = {
//     email: 'j',
//     password: 'j',
//   };

//   try {
//     const response = await axios.get(
//       'https://management.srs-ssms.com/api/getdatamill',
//       {
//         params: credentials,
//       }
//     );

//     const data = response.data;
//     const noWa_grading = '120363164751475851@g.us';
//     const noWa_grading_suayap = '6281397270799-1635156024@g.us';

//     if (data.status === '200' && data.data && data.data.length > 0) {
//       for (const itemdata of data.data) {
//         const message = formatGradingMessage(itemdata);

//         // Send image
//         const imgBuffer = Buffer.from(itemdata.base64Collage, 'base64');
//         const imageOptions = {
//           image: imgBuffer,
//           caption: message,
//         };

//         // Send PDF
//         const pdfBuffer = Buffer.from(itemdata.pdf, 'base64');
//         const messageOptions = {
//           document: pdfBuffer,
//           mimetype: 'application/pdf',
//           fileName: `${itemdata.tanggal_judul}(${itemdata.waktu_grading_judul})-Grading ${itemdata.mill}-${itemdata.estate}${itemdata.afdeling}`,
//           caption: `${itemdata.tanggal_judul}(${itemdata.waktu_grading_judul})-Grading ${itemdata.mill}-${itemdata.estate}${itemdata.afdeling}`,
//         };

//         try {
//           // Send to main grading group
//           await sock.sendMessage(noWa_grading, imageOptions);
//           await sock.sendMessage(noWa_grading, messageOptions);

//           // If estate is SYE, also send to the Suayap group
//           if (itemdata.estate === 'SYE') {
//             await sock.sendMessage(noWa_grading_suayap, imageOptions);
//             await sock.sendMessage(noWa_grading_suayap, messageOptions);
//           }

//           // Update data after sending messages
//           await updateDataMill(itemdata.id, credentials);
//         } catch (sendMessageError) {
//           console.error('Error sending message:', sendMessageError);
//           await catcherror(
//             itemdata.id,
//             'error_sending_message',
//             'bot_grading_mill'
//           );
//         }
//       }
//     } else {
//       console.log('No data found.');
//     }
//   } catch (error) {
//     console.error('Error fetching data:', error);
//   }
// }

function formatGradingMessage(itemdata) {
  let message = `*Berikut Hasil Grading Total ${itemdata.estate} ${itemdata.afdeling}*:\n`;
  message += `*Tanggal*: ${itemdata.Tanggal}\n`;
  message += `*Jam*: ${itemdata.waktu_grading}\n`;
  message += `*Ripeness*: ${itemdata.Ripeness} jjg (${itemdata.percentase_ripenes}%)\n`;
  message += `*Unripe*: ${itemdata.Unripe} jjg (${itemdata.persenstase_unripe}%)\n`;
  message += `•0 brondol: ${itemdata.nol_brondol} jjg (${itemdata.persentase_nol_brondol}%)\n`;

  itemdata.pemanen_list_tanpabrondol?.tanpaBrondol_list?.forEach(
    (item, index) => {
      message += `${index + 1}. No. Pemanen : ${item.no_pemanen} = ${item.tanpaBrondol} jjg\n`;
    }
  );

  message += `•< brondol: ${itemdata.kurang_brondol} jjg (${itemdata.persentase_brondol}%)\n`;

  itemdata.pemanen_list_kurangbrondol?.kurangBrondol_list?.forEach(
    (item, index) => {
      message += `${index + 1}. No. Pemanen : ${item.no_pemanen} = ${item.kurangBrondol} jjg\n`;
    }
  );

  message += `*Overripe*:  ${itemdata.Overripe} jjg (${itemdata.persentase_overripe}%)\n`;
  message += `*Empty bunch*: ${itemdata.empty_bunch} jjg (${itemdata.persentase_empty_bunch}%)\n`;
  message += `*Rotten bunch*: ${itemdata.rotten_bunch} jjg (${itemdata.persentase_rotten_bunce}%)\n`;
  message += `*Abnormal*: ${itemdata.Abnormal} jjg (${itemdata.persentase_abnormal}%)\n`;
  message += `*Dirt*: ${itemdata.Dirt} Kg (${itemdata.persentase}%)\n`;
  message += `*Loose Fruit*: ${itemdata.loose_fruit} Kg (${itemdata.persentase_lose_fruit}%)\n\n`;
  message += `Jumlah janjang di Grading: ${itemdata.jjg_grading} jjg\n`;
  message += `Jumlah janjang di SPB: ${itemdata.jjg_spb} jjg\n`;
  message += `Jumlah Selisih janjang: ${itemdata.jjg_selisih} jjg (${itemdata.persentase_selisih}%)\n`;
  message += `Generated by Digital Architect SRS bot`;

  return message;
}

async function updateDataMill(id, credentials) {
  try {
    await axios.post('https://management.srs-ssms.com/api/updatedatamill', {
      id: id,
      ...credentials,
    });
    console.log('Data update successful for ID:', id);
  } catch (updateError) {
    console.error('Error updating data for ID:', id, updateError);
    await catcherror(id, 'error_updating_data', 'bot_grading_mill');
  }
}

module.exports = {
  get_mill_data,
};
