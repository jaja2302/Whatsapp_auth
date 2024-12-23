const axios = require('axios');
const { channel } = require('../../utils/pusher');
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

const helperfunctionSmartlabs = async () => {
  channel.bind('Smartlabsnotification', async (itemdata) => {
    // console.log(itemdata);

    if (!itemdata || !itemdata.data) {
      console.log('Event data, data, or bot_data is undefined.');
      return;
    }
    // Loop through each item in the data array
    itemdata.data.forEach(async (dataitem) => {
      // let message = `*${greeting}* 👋\n\n`;
      let message = `Yth. Pelanggan Setia Lab CBI ✨\n\n`;
      if (dataitem.type === 'input') {
        message += `📥 Progress Sampel anda telah kami terima dengan:\n\n`;
      } else if (dataitem.progresss === 'Rilis Sertifikat') {
        message += `*Sampel anda sudah selesai kami proses!*\n\n`;
      } else {
        message += `Progress Sampel anda telah Terupdate dengan:\n\n`;
      }
      message += `*No. Surat* : ${dataitem.no_surat}\n`;
      message += `*Departemen* : ${dataitem.nama_departemen}\n`;
      message += `*Jenis Sampel* : ${dataitem.jenis_sampel}\n`;
      message += `*Jumlah Sampel* : ${dataitem.jumlah_sampel}\n`;

      if (dataitem.progresss === 'Rilis Sertifikat') {
        message += `*Status* : Selesai\n`;
      } else {
        message += `*Progress saat ini* : ${dataitem.progresss}\n`;
      }

      message += `*Tanggal Registrasi* : ${new Date(dataitem.tanggal_registrasi).toLocaleDateString('id-ID')}\n`;
      message += `*Estimasi* : ${new Date(dataitem.estimasi).toLocaleDateString('id-ID')}\n\n`;

      if (dataitem.progresss === 'Rilis Sertifikat') {
        message += `📋 *Sertifikat dapat didownload dengan kode tracking:*\n*${dataitem.kodesample}*\n`;
        message += `🌐Disini : https://smartlab.srs-ssms.com\n\n`;
      } else {
        message += `🌐Progress anda dapat dilihat disini :\nhttps://smartlab.srs-ssms.com\n\n`;
        message += `Progress saat ini dapat dicek dengan kode tracking:\n*${dataitem.kodesample}*\n\n`;
      }

      message += `Terima kasih telah mempercayakan sampel anda untuk dianalisa di Lab kami.`;
      queue.push({
        type: 'send_message',
        data: { to: dataitem.penerima + '@s.whatsapp.net', message: message },
      });
      if (dataitem.asal === 'Eksternal') {
        const response = await axios.get(
          'https://management.srs-ssms.com/api/invoices_smartlabs',
          {
            params: {
              email: 'j',
              password: 'j',
              id_data: dataitem.id_invoice,
            },
          }
        );
        const responseData = response.data;
        if (responseData.pdf) {
          // Step 2: Decode the base64 PDF
          const pdfBuffer = Buffer.from(responseData.pdf, 'base64');
          const pdfFilename = responseData.filename || 'Invoice.pdf';
          queue.push({
            type: 'send_document',
            data: {
              to: dataitem.penerima + '@s.whatsapp.net',
              document: pdfBuffer,
              mimetype: 'application/pdf',
              fileName: pdfFilename,
              caption: 'Invoice Smartlabs',
            },
          });
        } else {
          console.log('PDF not found in the API response smartlab.');
        }
      }
    });
  });
};

module.exports = {
  helperfunctionSmartlabs,
};
