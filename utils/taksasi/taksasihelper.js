// function bot taksasi
const { DateTime } = require('luxon');
const axios = require('axios');
const { channel } = require('../../utils/pusher');
const idgroup = '120363205553012899@g.us';
const idgroup_testing = '120363204285862734@g.us';
const idgroup_da = '120363303562042176@g.us';
const { shortenURL } = require('../../utils/shortenurl');
const botTaksasi = {};
const userTalsasiChoice = {};
const timeoutHandlestaksasi = {};
const fs = require('fs');
const https = require('https');
const puppeteer = require('puppeteer');
const { json } = require('express');
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Adding 1 because getMonth() returns zero-based index
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get the current date
const today = new Date();

const datetimeValue = formatDate(today);

async function generatemapstaksasi(est, datetime) {
  let attempts = 0;
  let uploadSuccess = false;

  while (attempts < 2 && !uploadSuccess) {
    try {
      const browser = await puppeteer.launch({
        // executablePath: '../chrome-win/chrome.exe',
        headless: 'new',
      });
      const page = await browser.newPage();

      // Listen for console events and check for the success message
      page.on('console', (msg) => {
        if (msg.text() === 'Upload successfully gan') {
          uploadSuccess = true;
        }
      });

      await page.goto(
        `https://srs-ssms.com/rekap_pdf/convert_taksasi_pdf_get.php?datetime=${datetime}&estate=${est}`
      );
      await page.title();

      // Delay for 10 seconds before checking the success flag
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Close the page and browser regardless of success
      await page.close();
      await browser.close();

      if (uploadSuccess) {
        // console.log('Upload successful after', attempts + 1, 'attempts');
        return {
          status: 200,
          message: `Maps berhasil generate untuk ${est}`,
        };
      } else {
        console.log('Upload not successful, retrying...');
      }

      attempts++;
    } catch (error) {
      console.error('Attempt', attempts + 1, 'failed with error:', error);
      attempts++;
    }
  }

  if (!uploadSuccess) {
    console.error('Upload failed after 2 attempts');
    return {
      status: 500,
      message: 'Maps gagal generate',
    };
  }
}

async function sendtaksasiest(estate, group_id, folder, sock, taskid, tanggal) {
  try {
    let newdaate;
    if (tanggal === 'null' || tanggal === null) {
      newdaate = datetimeValue;
    } else {
      newdaate = tanggal;
    }
    await generatemapstaksasi(estate, newdaate);

    // console.log(newdaate);

    try {
      const { data: responseData } = await axios.get(
        `https://smart-app.srs-ssms.com/api/exportPdfTaksasi/${estate}/${newdaate}`
      );

      if (responseData.base64_pdf) {
        const pdfBuffer = Buffer.from(responseData.base64_pdf, 'base64');
        const pdfFilename = `Rekap Taksasi ${estate} ${datetimeValue}.pdf`;
        let captions = `Dikirim oleh ROBOT,jangan balas pesan\n`;
        const messageOptions = {
          document: pdfBuffer,
          mimetype: 'application/pdf',
          fileName: pdfFilename,
          caption: captions,
        };

        try {
          await sock.sendMessage(group_id, messageOptions);
          const apiUrl = 'https://qc-apps.srs-ssms.com/api/recordcronjob';
          // const apiUrl = 'http://qc-apps2.test/api/recordcronjob';

          // Create the form data with variables estate and datetime
          const formData = new FormData();
          formData.append('est', estate);

          // Get the current date and time in the Jakarta timezone using Luxon
          const dateTime = DateTime.now().setZone('Asia/Jakarta').toISO();

          formData.append('datetime', dateTime);
          formData.append('id', taskid);
          if (taskid !== null && taskid !== 'null') {
            await axios.post(apiUrl, formData);
          }
          return {
            status: 200,
            message: `PDF taksasi ${estate} Berhasil dikirim`,
          };
        } catch (error) {
          // console.log('errpr taksasi ');
          return {
            status: 500,
            message: `Taksasi gagal dikirim ${error.message}`,
          };
        }
      } else {
        // console.log('PDF not found in the API response.');
        return {
          status: 404,
          message: `PDF taksasi Tidak Ditemukan`,
        };
      }
    } catch (error) {
      // console.log(error);

      // console.error('Error sending PDF:', error.message);
      return {
        status: 500,
        message: `Error sending PDF: ${error.message}`,
      };
    }
    return 'success';
  } catch (error) {
    return {
      status: 500,
      message: 'Gagal mengirim taksasi',
    };
  }
}

async function sendfailcronjob(sock) {
  try {
    // const apiUrl = 'http://qc-apps2.test/api/checkcronjob';
    const apiUrl = 'https://qc-apps.srs-ssms.com/api/checkcronjob';
    const response = await axios.get(apiUrl);

    let data = response.data.cronfail;
    // console.log(data);
    if (data.length === 0) {
      return {
        status: 200,
        message: 'TIdak ada Fail Cronjob',
      };
    } else {
      for (const task of data) {
        try {
          await sendtaksasiest(
            task.estate,
            task.group_id,
            'null',
            sock,
            task.id,
            'null'
          );
          // Task completed successfully
        } catch (error) {
          // Handle error here if needed
          console.error(error);
          return {
            status: 500,
            message: 'Mengirim fail Cronjob gagal',
          };
        }
      }
    }
    return {
      status: 200,
      message: 'Menggirim Fail Cronjob Berhasil',
    };
  } catch (error) {
    return {
      status: 500,
      message: 'Mengirim fail Cronjob gagal',
    };
  }
}

async function Generateandsendtaksasi(sock) {
  try {
    const response = await axios.get(
      'https://management.srs-ssms.com/api/get_crontab_data',
      {
        params: {
          email: 'j',
          password: 'j',
        },
      }
    );
    const data = response.data.data;
    for (const item of data) {
      await generatemapstaksasi(item.estate, datetimeValue);

      try {
        const { data: responseData } = await axios.get(
          `https://smart-app.srs-ssms.com/api/exportPdfTaksasi/${item.estate}/${datetimeValue}`
        );

        if (responseData.base64_pdf) {
          const pdfBuffer = Buffer.from(responseData.base64_pdf, 'base64');
          const pdfFilename = `Rekap Taksasi ${item.estate} ${datetimeValue}.pdf`;
          let captions = `Laporan Taksasi Perlu persetujuan sebelum diterbitkan\n`;
          captions += `\nID : ${item.id}`;
          captions += `\nEstate : ${item.estate}`;
          captions += `\nTanggal : ${datetimeValue}`;
          captions += `Harap hanya membalas pesan ini dengan jawaban ya atau tidak`;
          captions += `\n\nTerima kasih`;
          const messageOptions = {
            document: pdfBuffer,
            mimetype: 'application/pdf',
            fileName: pdfFilename,
            caption: captions,
          };

          await sock.sendMessage(item.new_group, messageOptions);

          console.log('PDF sent successfully!');
        } else {
          console.log('PDF not found in the API response.');
        }
      } catch (error) {
        console.error('Error sending PDF:', error.message);
      }
    }
  } catch (error) {
    console.error('Error fetching data from API:', error.message);
    throw error;
  }
}

async function Sendverificationtaksasi(sock) {
  try {
    const response = await axios.get(
      'https://management.srs-ssms.com/api/send_verification_pdf',
      {
        params: {
          email: 'j',
          password: 'j',
        },
      }
    );
    const responseMessage = response.data.message;

    // Handle the case when no data is found
    if (responseMessage === 'Tidak ada data yang ditemukan') {
      console.log('No data found in the API response.');
      return; // Stop execution if no data is found
    }

    const data = response.data.data;
    for (const item of data) {
      await generatemapstaksasi(item.estate, datetimeValue);

      try {
        const { data: responseData } = await axios.get(
          `https://smart-app.srs-ssms.com/api/exportPdfTaksasi/${item.estate}/${datetimeValue}`
        );

        if (responseData.base64_pdf) {
          const pdfBuffer = Buffer.from(responseData.base64_pdf, 'base64');
          const pdfFilename = `Rekap Taksasi ${item.estate} ${datetimeValue}.pdf`;
          const messageOptions = {
            document: pdfBuffer,
            mimetype: 'application/pdf',
            fileName: pdfFilename,
            caption: 'Pesan otomatis, harap jangan membalas pesan ini',
          };

          await sock.sendMessage(item.new_group, messageOptions);

          console.log('PDF sent successfully!');
        } else {
          console.log('PDF not found in the API response.');
        }
      } catch (error) {
        console.error('Error sending PDF:', error.message);
      }
    }
  } catch (error) {
    console.error('Error fetching data from API:', error.message);
    throw error;
  }
}

async function handleTaksasi(data, sock) {
  console.log('Received data:', data);

  // Extract parts of the command
  const parts = data.split('/');
  console.log(parts);

  // Check if the command is valid
  if (parts.length < 1) {
    return {
      status: 400,
      message:
        'Harap tambahkan  tanggal dan nama estate dibatasi dengan /\n-Contoh !taksasi/2024-12-23/kne/nbe/tbe/sbe/lme1',
    };
  }

  // Extract date and estate details
  const command = parts[0]; // !taksasi
  const date = parts[1]; // 2024-02-97
  const estates = parts.slice(2); // [kne, nbe, tbe, sbe, lme1]

  // Validate date format
  const dateRegex = /^\d{4}-\d{1,2}-\d{1,2}$/;
  if (!dateRegex.test(date)) {
    return {
      status: 400,
      message: 'invalid tanggal format,gunakan format tanggal yyyy-mm-dd',
    };
  }

  // Further validate that the date is logically valid
  const [year, month, day] = date.split('-').map(Number);
  const dateObject = new Date(year, month - 1, day); // JS Date months are 0-indexed

  if (
    dateObject.getFullYear() !== year ||
    dateObject.getMonth() + 1 !== month ||
    dateObject.getDate() !== day
  ) {
    return {
      status: 400,
      message: 'Tanggal yang anda masukan tidak valid',
    };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize today's date to remove time components

  if (date > today) {
    return {
      status: 400,
      message:
        'Bot tidak punya mesin waktu ke tanggal ini. Masukan masksimal hari ini dan masa lalu.',
    };
  }
  // Define your API URL
  const apiUrl = 'https://qc-apps.srs-ssms.com/api/getdatacron';

  try {
    // Fetch data from the API
    const response = await axios.get(apiUrl);
    const dataestate = response.data;

    // Loop through user input estates and match with API data
    for (const estate of estates) {
      const matchingTasks = dataestate.filter(
        (task) => task.estate === estate.toUpperCase()
      );

      if (matchingTasks.length > 0) {
        // There is a match, loop through and send for each matching task
        for (const task of matchingTasks) {
          const { estate, group_id, wilayah: folder, id } = task;
          try {
            // Call your sendtaksasiest function here
            await sendtaksasiest(estate, group_id, 'null', sock, id, date);
            // console.log(`Successfully sent taksasi for estate: ${estate}`);
          } catch (error) {
            // Handle error if sending fails
            console.error('Error sending taksasi:', error.message);
            return {
              status: 500,
              message: `Failed to send taksasi for estate ${estate}`,
            };
          }
        }
      } else {
        // No matching task found
        console.log(`No matching tasks found for estate: ${estate}`);
      }
    }
  } catch (error) {
    console.log('Error fetching data:', error.message);
    return {
      status: 500,
      message: 'Error fetching data from API',
    };
  }

  return {
    status: 200,
    message: 'Taksasi berhasil dikirim',
  };
}

module.exports = {
  handleTaksasi,
  // botTaksasi,
  // userTalsasiChoice,
  // timeoutHandlestaksasi,
  sendtaksasiest,
  sendfailcronjob,
  Generateandsendtaksasi,
  Sendverificationtaksasi,
};
