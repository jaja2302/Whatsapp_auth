const axios = require('axios');
const fs = require('fs');
const https = require('https');
const { catcherror } = require('../izinkebun/helper');
const idgroup = '120363346145146382@g.us';
const { channel } = require('../../utils/pusher');
async function get_outstadingdata(sock) {
  try {
    const response = await axios.get(
      'https://management.srs-ssms.com/api/get_outstanding_payments',
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
        let message = `Laporan Invoice Outstanding Payments > 21 Hari:\n`;
        message += `No Resi: *${itemdata.resi_pengiriman}*\n`;
        message += `Tanggal Penerbitan Invoice: ${itemdata.tanggal_penerbitan_invoice}\n`;

        // Ensure perusahaan object exists and access its properties
        if (itemdata.perusahaan && itemdata.perusahaan.nama) {
          message += `Perusahaan: ${itemdata.perusahaan.nama}\n`;
        } else {
          message += `Perusahaan: Unknown\n`;
        }

        // Ensure residetail object exists and access its properties
        if (itemdata.residetail && itemdata.residetail.totalharga_ppn_disc) {
          message += `Total Outstanding Payments: *RP.${itemdata.residetail.totalharga_ppn_disc}*\n`;
        } else {
          message += `Total Outstanding Payments: Unknown\n`;
        }

        try {
          queue.push({
            type: 'send_message',
            data: { to: idgroup, message: message },
          });
          // await sock.sendMessage(idgroup, { text: message });
        } catch (error) {
          console.log(error);
          await catcherror(itemdata.id, 'error_cronjob', 'bot_marcom');
        }
      }
    } else {
      console.log('data kosong marcom');
    }
    return response;
  } catch (error) {
    console.log('Error fetching data:', error);
  }
}

const function_marcom = async (sock) => {
  channel.bind('Marcomnotification', async (arrayData) => {
    if (!arrayData?.data) {
      console.log('Event data, data, or bot_data is undefined.');
      return;
    }
    // console.log(arrayData);

    const itemdata = arrayData.data;
    let message = `*New Invoice*\n`;
    message += `No Resi: *${itemdata.resi_id}*\n`;
    message += `Dibuat oleh: ${itemdata.created_by}\n`;

    // sending pdf

    try {
      const response = await axios.get(
        'https://management.srs-ssms.com/api/invoices_smartlabs',
        {
          params: {
            email: 'j',
            password: 'j',
            id_data: itemdata.invoice_id,
            version: itemdata.version,
          },
        }
      );

      const data = response.data;
      const pdfBuffer = Buffer.from(data.pdf, 'base64');
      const messageOptions = {
        document: pdfBuffer,
        mimetype: 'application/pdf',
        fileName: data.filename,
        caption: message,
      };

      try {
        queue.push({
          type: 'send_message',
          data: { to: idgroup, message: messageOptions },
        });
        // await sock.sendMessage(idgroup, messageOptions);
      } catch (error) {
        console.log(error);

        await catcherror(itemdata.id, 'error_send', 'invoice');
      }
    } catch (error) {
      console.log(error);
      await catcherror(itemdata.id, 'error_send', 'invoice');
    }
  });
};

module.exports = {
  get_outstadingdata,
  function_marcom,
};
