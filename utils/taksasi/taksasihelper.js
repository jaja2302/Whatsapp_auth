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

      // Delay for 15 seconds before checking the success flag
      await new Promise((resolve) => setTimeout(resolve, 10000));

      if (uploadSuccess) {
        console.log('Upload successful after', attempts + 1, 'attempts');
        await page.close();
        await browser.close();
        return {
          body: {}, // Provide your response body here
          cookies: {}, // Provide your cookies object here
          response: 'success',
        };
      } else {
        console.log('Upload not successful, retrying...');
        await page.close();
        await browser.close();
        attempts++;
      }
    } catch (error) {
      console.error('Attempt', attempts + 1, 'failed with error:', error);
      attempts++;
    }
  }

  if (!uploadSuccess) {
    console.error('Upload failed after 5 attempts');
    return { error: 'Upload failed after maximum attempts' };
  }
}

async function sendtaksasiest(estate, group_id, folder, sock) {
  try {
    await generatemapstaksasi(estate, datetimeValue);

    try {
      const { data: responseData } = await axios.get(
        `https://smart-app.srs-ssms.com/api/exportPdfTaksasi/${estate}/${datetimeValue}`
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

        await sock.sendMessage(group_id, messageOptions);

        // console.log('PDF sent successfully!');
        return 'success';
      } else {
        console.log('PDF not found in the API response.');
      }
    } catch (error) {
      console.error('Error sending PDF:', error.message);
    }
    return 'success';
  } catch (error) {
    console.log(error);
    return 'error';
  }
}

async function sendhistorycron(estate, id) {
  try {
    // const apiUrl = 'http://ssms-qc.test/api/recordcronjob';
    const apiUrl = 'https://qc-apps.srs-ssms.com/api/recordcronjob';

    // Create the form data with variables estate and datetime
    const formData = new FormData();
    formData.append('est', estate);

    // Get the current date and time in the Jakarta timezone using Luxon
    const dateTime = DateTime.now().setZone('Asia/Jakarta').toISO();

    formData.append('datetime', dateTime);
    formData.append('id', id);
    // Send the POST request with form data
    const response = await axios.post(apiUrl, formData);

    // Handle the response if needed
    console.log('Response:', response.data);
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}
async function sendfailcronjob(sock) {
  try {
    const apiUrl = 'https://qc-apps.srs-ssms.com/api/checkcronjob';
    const response = await axios.get(apiUrl);

    let data = response.data.cronfail;
    // console.log(sock);
    if (data.length === 0) {
      console.log('nodata');
    } else {
      for (const task of data) {
        try {
          await generatemapstaksasi(task.estate, datetimeValue);
          await sendtaksasiest(task.estate, task.group_id, 'null', sock);
          await sendhistorycron(task.estate, task.id, sock);
        } catch (error) {
          console.error('Error performing task in cronjob:', error);
        }
      }
    }
  } catch (error) {
    console.error('Error fetching data:', error);
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

const handleTaksasi = async (noWa, text, sock) => {
  const resetUserState = async () => {
    await sock.sendMessage(noWa, {
      text: 'Waktu Anda telah habis. Silakan mulai kembali dengan mengetikkan !taksasi.',
    });
    delete userTalsasiChoice[noWa];
    delete botTaksasi[noWa];
    if (timeoutHandlestaksasi[noWa]) {
      clearTimeout(timeoutHandlestaksasi[noWa]);
      delete timeoutHandlestaksasi[noWa];
    }
  };

  const setUserTimeout = () => {
    if (timeoutHandlestaksasi[noWa]) {
      clearTimeout(timeoutHandlestaksasi[noWa]);
    }
    timeoutHandlestaksasi[noWa] = setTimeout(resetUserState, 60 * 1000);
  };

  if (!userTalsasiChoice[noWa]) {
    userTalsasiChoice[noWa] = 'tanggal';
    botTaksasi[noWa] = { attempts: 0 };
    await sock.sendMessage(noWa, {
      text: 'Masukkan Tanggal (Format: Hari-Bulan-Tahun) Contoh : (20-02-2024)',
    });
    setUserTimeout();
  } else {
    setUserTimeout(); // Reset timeout with every interaction
    const step = userTalsasiChoice[noWa];

    if (step === 'tanggal') {
      botTaksasi[noWa].tanggal = text;
      const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
      if (!dateRegex.test(text)) {
        await sock.sendMessage(noWa, {
          text: 'Tanggal tidak sesuai, harap masukkan kembali (Format: Hari-Bulan-Tahun):',
        });
        return;
      }

      const [day, month, year] = text.split('-').map(Number);
      if (month < 1 || month > 12 || day < 1 || day > 31) {
        await sock.sendMessage(noWa, {
          text: 'Tanggal atau bulan tidak valid. Harap masukkan kembali (Format: Hari-Bulan-Tahun):',
        });
        return;
      }

      const inputDate = new Date(year, month - 1, day);
      if (
        inputDate.getDate() !== day ||
        inputDate.getMonth() !== month - 1 ||
        inputDate.getFullYear() !== year
      ) {
        await sock.sendMessage(noWa, {
          text: 'Tanggal tidak valid. Harap masukkan kembali (Format: Hari-Bulan-Tahun):',
        });
        return;
      }

      botTaksasi[noWa].date = text;
      userTalsasiChoice[noWa] = 'estate';
      await sock.sendMessage(noWa, {
        text: 'Harap masukkan Estate apa saja dengan format setiap estate diakhiri dengan (/) contoh: kne/sce/nbe',
      });
    } else if (step === 'estate') {
      const estates = text.split('/').filter(Boolean); // Split input by '/' and filter out empty strings
      botTaksasi[noWa].estates = estates;

      // Validate the input format
      if (!text.includes('/')) {
        await sock.sendMessage(noWa, {
          text: 'Format tidak sesuai. Harap masukkan estate dengan pemisah / contoh: kne/sce/nbe',
        });
        return;
      }

      try {
        const apiUrl = 'https://qc-apps.srs-ssms.com/api/getdatacron';
        const response = await axios.get(apiUrl);

        if (Array.isArray(response.data)) {
          const apiEstates = response.data.map((item) =>
            item.estate.toLowerCase()
          ); // Extract estate values from API response and convert to lowercase

          // Find available estates
          const availableEstates = estates.filter((estate) =>
            apiEstates.includes(estate.toLowerCase())
          ); // Convert user input to lowercase before comparing

          if (availableEstates.length === 0) {
            await sock.sendMessage(noWa, {
              text: 'Masukan nama estate yang benar!',
            });
          } else {
            const dataestate = response.data;

            for (const estate of availableEstates) {
              const matchingTasks = dataestate.filter(
                (task) => task.estate.toLowerCase() === estate.toLowerCase()
              );

              if (matchingTasks.length > 0) {
                const {
                  estate: estateFromMatchingTask,
                  group_id,
                  wilayah: folder,
                } = matchingTasks[0];
                await sock.sendMessage(noWa, {
                  text: `Estate ${estateFromMatchingTask} sedang di proses`,
                });
                await generatemapstaksasi(
                  estateFromMatchingTask,
                  botTaksasi[noWa].tanggal
                );
                // estate, group_id, folder, sock
                await sendtaksasiest(
                  estateFromMatchingTask,
                  group_id,
                  'null',
                  sock
                );
              }
            }
          }
        } else {
          throw new Error('Invalid API response structure');
        }
      } catch (error) {
        console.log('Error fetching data:', error.message);
        await sock.sendMessage(noWa, {
          text: 'There was an error checking the estate availability. Please try again later.',
        });
      }

      // Send a thank you message with the estates entered
      // await sock.sendMessage(noWa, { text: `Terima kasih. Estate yang Anda masukkan adalah: ${estates.join(', ')}` });

      // Reset all states
      delete userTalsasiChoice[noWa];
      delete botTaksasi[noWa];
      if (timeoutHandlestaksasi[noWa]) {
        clearTimeout(timeoutHandlestaksasi[noWa]);
        delete timeoutHandlestaksasi[noWa];
      }
    } else {
      await sock.sendMessage(noWa, {
        text: 'Pilihan tidak valid. Silakan masukkan nomor yang sesuai:',
      });
    }
  }
};

module.exports = {
  handleTaksasi,
  botTaksasi,
  userTalsasiChoice,
  timeoutHandlestaksasi,
  sendtaksasiest,
  sendfailcronjob,
  Generateandsendtaksasi,
  Sendverificationtaksasi,
};
