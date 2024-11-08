// function bot grading mill
const axios = require('axios');
const fs = require('fs');
const https = require('https');
const { catcherror } = require('../izinkebun/helper');
const testingbotda = '120363205553012899@g.us';
const testingbotsampenikah = '120363204285862734@g.us';
const noWa_grading = '120363164751475851@g.us';
const noWa_grading_suayap = '6281397270799-1635156024@g.us';
const noWa_grading_sgm = '6282257572112-1635223872@g.us';
const noWa_grading_slm = '6281397270799-1565316655@g.us';
const noWa_grading_nbm = '6285655573821-1566449850@g.us';
const noWa_grading_mlm = '120363332857987276@g.us';
const noWa_grading_nkm = '120363046524351245@g.us';
// id_group: 120363046524351245@g.us || Nama Group: GRADING NKM
// id_group: 120363332857987276@g.us || Nama Group: QC Grading PKS Malata

// List id_group: 120363331441324422@g.us || Nama Group: Grading Reg II

// id_group: 6285655573821-1566449850@g.us || Nama Group: NBM 22.00

const { channel } = require('../../utils/pusher');
// const noWa_grading = testingbotda;
// const noWa_grading_suayap = testingbotsampenikah;
// id_group: 6282257572112-1635223872@g.us || Nama Group: SGM 23.50

async function run_jobs_mill() {
  const credentials = {
    email: 'j',
    password: 'j',
  };

  try {
    const response = await axios.get(
      'https://management.srs-ssms.com/api/getdatamill',
      // 'http://erpda.test/api/getdatamill',
      {
        params: credentials,
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching mill data:', error);
    throw error;
  }
}

async function get_mill_data(sock) {
  const credentials = {
    email: 'j',
    password: 'j',
  };

  try {
    const response = await axios.get(
      'https://management.srs-ssms.com/api/getdatamilljobs',
      {
        params: credentials,
      }
    );

    const { data, id_jobs, pdf_name, image_name } = response.data;

    // Check if data exists and is not empty
    if (!data || data.length === 0) {
      console.log('No mill data available to process');
      return; // Exit the function early if no data
    }

    // Process data only if we have items
    for (let i = 0; i < data.length; i++) {
      const itemdata = data[i];
      const message = formatGradingMessage(itemdata);

      try {
        const targetGroup = (() => {
          // SKM
          // SGM
          // SYM
          // SLM
          // NBM
          let send_image = false;
          switch (itemdata.mill) {
            case 'SYM':
              send_images = true;
              return noWa_grading_suayap;
            case 'SGM':
              send_images = true;
              return noWa_grading_sgm;
            case 'SLM':
              return noWa_grading_slm;
            case 'NBM':
              send_images = true;
              return noWa_grading_nbm;
            case 'MLM':
              send_images = false;
              return noWa_grading_mlm;
            case 'NKM':
              send_images = false;
              return noWa_grading_nkm;
            default:
              send_images = false;
              return noWa_grading;
          }
        })();
        if (send_images) {
          global.queue.push({
            type: 'send_image',
            data: {
              to: targetGroup,
              image: itemdata.collage_url,
              caption: message,
            },
          });
          global.queue.push({
            type: 'send_document',
            data: {
              to: targetGroup,
              document: itemdata.pdf_url,
              filename: `${itemdata.tanggal_judul}(${itemdata.waktu_grading_judul})-Grading ${itemdata.mill}-${itemdata.estate}${itemdata.afdeling}.pdf`,
              caption: `${itemdata.tanggal_judul}(${itemdata.waktu_grading_judul})-Grading ${itemdata.mill}-${itemdata.estate}${itemdata.afdeling}.pdf`,
            },
          });
        } else {
          global.queue.push({
            type: 'send_document',
            data: {
              to: targetGroup,
              document: itemdata.pdf_url,
              filename: `${itemdata.tanggal_judul}(${itemdata.waktu_grading_judul})-Grading ${itemdata.mill}-${itemdata.estate}${itemdata.afdeling}.pdf`,
              caption: message,
            },
          });
        }
      } catch (error) {
        console.log('Error in broadcast_grading_mill:', error);
        await catcherror(
          itemdata.id,
          'error_sending_message',
          'bot_grading_mill'
        );
      }
    }

    // Only push update if we have data to update
    if (id_jobs.length > 0 && pdf_name.length > 0) {
      global.queue.push({
        type: 'update_data_mill',
        data: {
          id: id_jobs,
          pdf_name: pdf_name,
          image_name: image_name,
        },
      });
    }
  } catch (error) {
    console.log('Error fetching data:', error);
  }
}

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

async function updateDataMill(data) {
  const credentials = {
    email: 'j',
    password: 'j',
  };
  console.log('updateDataMill', data);

  try {
    const response = await axios.post(
      'https://management.srs-ssms.com/api/updatedatamill',
      // 'http://erpda.test/api/updatedatamill',
      {
        ...credentials,
        id: data.id,
        pdf_name: data.pdf_name,
        image_name: data.image_name,
      }
    );
    console.log('Cleanup successful:', response.data);
  } catch (updateError) {
    console.error('Error cleaning up data:', updateError);
    throw updateError;
  }
}

const broadcast_grading_mill = async () => {
  channel.bind('gradingmillpdf', async (data) => {
    console.log(`Broadcast Grading :${data}`);
    if (data.data && data.data.length > 0) {
      for (const itemdata of data.data) {
        const message = formatGradingMessage(itemdata);

        try {
          // Send to appropriate group based on mill
          if (itemdata.mill === 'SYM') {
            // global.queue.push({
            //   type: 'send_image',
            //   data: {
            //     to: noWa_grading_suayap,
            //     image: itemdata.collage_url,
            //     caption: message,
            //   },
            // });
            global.queue.push({
              type: 'send_document',
              data: {
                to: noWa_grading_suayap,
                document: itemdata.pdf_url,
                filename: `${itemdata.tanggal_judul}(${itemdata.waktu_grading_judul})-Grading ${itemdata.mill}-${itemdata.estate}${itemdata.afdeling}.pdf`,
                caption: message,
              },
            });
          } else if (itemdata.mill === 'SGM') {
            // global.queue.push({
            //   type: 'send_image',
            //   data: {
            //     to: noWa_grading_sgm,
            //     image: itemdata.collage_url,
            //     caption: message,
            //   },
            // });
            global.queue.push({
              type: 'send_document',
              data: {
                to: noWa_grading_sgm,
                document: itemdata.pdf_url,
                filename: `${itemdata.tanggal_judul}(${itemdata.waktu_grading_judul})-Grading ${itemdata.mill}-${itemdata.estate}${itemdata.afdeling}.pdf`,
                caption: message,
              },
            });
          } else if (itemdata.mill === 'SLM') {
            // global.queue.push({
            //   type: 'send_image',
            //   data: {
            //     to: noWa_grading_slm,
            //     image: itemdata.collage_url,
            //     caption: message,
            //   },
            // });
            global.queue.push({
              type: 'send_document',
              data: {
                to: noWa_grading_slm,
                document: itemdata.pdf_url,
                filename: `${itemdata.tanggal_judul}(${itemdata.waktu_grading_judul})-Grading ${itemdata.mill}-${itemdata.estate}${itemdata.afdeling}.pdf`,
                caption: message,
              },
            });
          } else if (itemdata.mill === 'NBM') {
            // global.queue.push({
            //   type: 'send_image',
            //   data: {
            //     to: noWa_grading_slm,
            //     image: itemdata.collage_url,
            //     caption: message,
            //   },
            // });
            global.queue.push({
              type: 'send_document',
              data: {
                to: noWa_grading_nbm,
                document: itemdata.pdf_url,
                filename: `${itemdata.tanggal_judul}(${itemdata.waktu_grading_judul})-Grading ${itemdata.mill}-${itemdata.estate}${itemdata.afdeling}.pdf`,
                caption: message,
              },
            });
          } else {
            // global.queue.push({
            //   type: 'send_image',
            //   data: {
            //     to: noWa_grading,
            //     image: itemdata.collage_url,
            //     caption: message,
            //   },
            // });
            global.queue.push({
              type: 'send_document',
              data: {
                to: noWa_grading,
                document: itemdata.pdf_url,
                filename: `${itemdata.tanggal_judul}(${itemdata.waktu_grading_judul})-Grading ${itemdata.mill}-${itemdata.estate}${itemdata.afdeling}.pdf`,
                caption: message,
              },
            });
          }

          // Update data after sending messages
          // global.queue.push({
          //   type: 'update_data_mill',
          //   data: {
          //     id: itemdata.id,
          //     credentials: {
          //       email: 'j',
          //       password: 'j',
          //     },
          //   },
          // });
        } catch (error) {
          console.log('Error in broadcast_grading_mill:', error);
          await catcherror(
            itemdata.id,
            'error_sending_message',
            'bot_grading_mill'
          );
        }
      }
    }
  });
};

module.exports = {
  get_mill_data,
  updateDataMill,
  run_jobs_mill,
  broadcast_grading_mill,
};
