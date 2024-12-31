const axios = require('axios');
const { channel } = require('../../utils/pusher');
const { catcherror } = require('../izinkebun/helper');
let now = new Date();
let hour = now.getHours();
let greeting;

if (hour >= 4 && hour < 12) {
  greeting = 'Selamat Pagi';
} else if (hour >= 12 && hour < 15) {
  greeting = 'Selamat Siang';
} else if (hour >= 15 && hour < 18) {
  greeting = 'Selamat Sore';
} else {
  greeting = 'Selamat Malam';
}
const function_rapidresponse = async (sock) => {
  channel.bind('notifkasirapidresponse', async (arrayData) => {
    if (!arrayData?.data) {
      console.log('Event data, data, or bot_data is undefined.');
      return;
    }
    console.log('notifkasirapidresponse');

    const itemdata = arrayData.data;

    const buildMessage = (verifikator, idVerifikator) => {
      return (
        `*${greeting}*:\n` +
        `Yth. Bapak/ibu ${verifikator}\n` +
        `Anda memiliki permintaan untuk meverifikasi data dari rekomendator ${itemdata.rekomendator} dalam aplikasi rapid respons. Dengan rincian\n` +
        `*Doc ID* : ${itemdata.id}/${idVerifikator}\n` +
        `*Estate* : ${itemdata.estate}\n` +
        `*Afdeling* : ${itemdata.afdeling}\n` +
        `*Blok* : ${itemdata.blok}\n` +
        `*Baris* : ${itemdata.baris}\n` +
        `*Masalah* : ${itemdata.masalah}\n` +
        `*Catatan* : ${itemdata.catatan}\n` +
        `Silahkan Repply pesan ini dengan kata kunci "Ya" untuk menerima permintaan verifikasi. Jika anda tidak dapat melakukan verifikasi, silahkan reply pesan ini dengan kata kunci "Tidak" untuk menolak permintaan verifikasi. \n` +
        `Detail dapat anda periksa di website : https://rapidresponse.srs-ssms.com \n`
      );
    };

    try {
      const { data: responseData } = await axios.get(
        'https://management.srs-ssms.com/api/generate_pdf_rapidresponse',
        {
          params: {
            email: 'j',
            password: 'j',
            id: itemdata.id,
          },
        }
      );

      if (!responseData.pdf) {
        console.log('PDF not found in the API response.');
        return;
      }

      const pdfBuffer = Buffer.from(responseData.pdf, 'base64');
      const pdfFilename = responseData.filename || 'Invoice.pdf';
      const createMessageOptions = (caption) => ({
        document: pdfBuffer,
        mimetype: 'application/pdf',
        fileName: pdfFilename,
        caption,
      });

      const messageOptions1 = createMessageOptions(
        buildMessage(itemdata.nama_verifikator1, itemdata.id_verifikator1)
      );
      const messageOptions2 = createMessageOptions(
        buildMessage(itemdata.nama_verifikator2, itemdata.id_verifikator2)
      );
      // console.log(messageOptions1);
      // console.log(messageOptions2);
      queue.push({
        type: 'send_message',
        data: {
          to: `${itemdata.verifikator1}@s.whatsapp.net`,
          message: messageOptions1,
        },
      });
      // await sock.sendMessage(
      //   `${itemdata.verifikator1}@s.whatsapp.net`,
      //   messageOptions1
      // );

      if (itemdata.verifikator2 !== itemdata.verifikator1) {
        queue.push({
          type: 'send_message',
          data: {
            to: `${itemdata.verifikator2}@s.whatsapp.net`,
            message: messageOptions2,
          },
        });
        // await sock.sendMessage(
        //   `${itemdata.verifikator2}@s.whatsapp.net`,
        //   messageOptions2
        // );
      }

      // console.log('PDF sent successfully!');
    } catch (error) {
      console.log('Error sending PDF rapid response:', error);
      await catcherror(itemdata.id, error, 'rapid_response');
    }
  });
};

module.exports = {
  function_rapidresponse,
};
