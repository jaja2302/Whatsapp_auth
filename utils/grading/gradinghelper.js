// function bot grading mill
const axios = require('axios');
const fs = require('fs');
const https = require('https');
const { catcherror } = require('../izinkebun/helper');
const logger = require('../../src/services/logger');
const settings = require('../../src/web/data/settings.json');

// Get groups from settings with default values
const {
  grading: {
    groups = {
      SYM: '',
      SGM: '',
      SLM: '',
      NBM: '',
      MLM: '',
      NKM: '',
      SCM: '',
      SKM: '',
      default: '',
    },
    testing = {
      testingbotda: '',
      testingbotsampenikah: '',
    },
    credentials = {},
  } = {},
} = settings;

// Destructure with default values
const {
  SYM: noWa_grading_suayap = '',
  SGM: noWa_grading_sgm = '',
  SLM: noWa_grading_slm = '',
  NBM: noWa_grading_nbm = '',
  MLM: noWa_grading_mlm = '',
  NKM: noWa_grading_nkm = '',
  SCM: noWa_grading_scm = '',
  SKM: no_grup_skm = '',
  default: noWa_grading = '',
} = groups;

async function run_jobs_mill() {
  try {
    logger.info.grading('Fetching mill data...');
    const response = await axios.get(
      'https://management.srs-ssms.com/api/getdatamill',
      {
        params: credentials,
      }
    );
    logger.info.grading('Mill data fetched successfully');
    return response.data;
  } catch (error) {
    logger.error.grading(
      'Error fetching mill data:',
      error.response?.data || error.message
    );
    throw error;
  }
}

async function get_mill_data() {
  try {
    logger.info.grading('Fetching mill jobs data...');
    const response = await axios.get(
      'https://management.srs-ssms.com/api/getdatamilljobs',
      {
        params: credentials,
      }
    );

    const { data, id_jobs, pdf_name, image_name } = response.data;

    if (!data || data.length === 0) {
      logger.info.grading('No mill data available to process');
      return;
    }

    logger.info.grading(`Processing ${data.length} mill data items`);

    for (const itemdata of data) {
      const message = formatGradingMessage(itemdata);

      try {
        const targetGroup = (() => {
          switch (itemdata.mill) {
            case 'SYM':
              return noWa_grading_suayap;
            case 'SGM':
              return noWa_grading_sgm;
            case 'SLM':
              return noWa_grading_slm;
            case 'NBM':
              return noWa_grading_nbm;
            case 'MLM':
              return noWa_grading_mlm;
            case 'NKM':
              return noWa_grading_nkm;
            case 'SCM':
              return noWa_grading_scm;
            case 'SKM':
              return no_grup_skm;
            default:
              return noWa_grading;
          }
        })();

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

        logger.info.grading(
          `Queued messages for ${itemdata.mill}-${itemdata.estate}${itemdata.afdeling}`
        );
      } catch (error) {
        logger.error.grading(
          `Error processing mill data for ${itemdata.mill}:`,
          error
        );
        await catcherror(
          itemdata.id,
          'error_sending_message',
          'bot_grading_mill'
        );
      }
    }

    if (id_jobs.length > 0 && pdf_name.length > 0) {
      global.queue.push({
        type: 'update_data_mill',
        data: {
          id: id_jobs,
          pdf_name: pdf_name,
          image_name: image_name,
        },
      });
      logger.info.grading('Queued mill data update');
    }
  } catch (error) {
    logger.error.grading(
      'Error fetching data:',
      error.response?.data || error.message
    );
    throw error;
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
  if (itemdata.update_by !== null) {
    message += `Laporan diperbaharui\n`;
    message += `*Telah diedit oleh*: ${itemdata.status_edit}\n`;
  }
  message += `Generated by Digital Architect SRS bot`;

  return message;
}

async function updateDataMill(data) {
  try {
    logger.info.grading('Updating mill data...');
    const response = await axios.post(
      'https://management.srs-ssms.com/api/updatedatamill',
      {
        ...credentials,
        id: data.id,
        pdf_name: data.pdf_name,
        image_name: data.image_name,
      }
    );
    logger.info.grading('Mill data updated successfully');
    return response.data;
  } catch (error) {
    logger.error.grading(
      'Error updating mill data:',
      error.response?.data || error.message
    );
    throw error;
  }
}

module.exports = {
  get_mill_data,
  updateDataMill,
  run_jobs_mill,
};
