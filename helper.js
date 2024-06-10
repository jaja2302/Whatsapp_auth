const puppeteer = require('puppeteer');
const axios = require('axios');

async function generatemapstaksasi(est, datetime) {
    let attempts = 0;
    let uploadSuccess = false;

    while (attempts < 2 && !uploadSuccess) {
        try {
            const browser = await puppeteer.launch({
                headless: true,
                ignoreHTTPSErrors: true,
                args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--single-process",
                ],
                ignoreDefaultArgs: ["--disable-extensions"],
                ignoreHTTPSErrors: true,
            });
            const page = await browser.newPage();

            // Listen for console events and check for the success message
            page.on('console', msg => {
                if (msg.text() === 'Upload successfully gan') {
                    uploadSuccess = true;
                }
            });

            await page.goto(`https://srs-ssms.com/rekap_pdf/convert_taksasi_pdf_get.php?datetime=${datetime}&estate=${est}`);
            await page.title();

            // Delay for 15 seconds before checking the success flag
            await new Promise(resolve => setTimeout(resolve, 10000));

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


module.exports = { generatemapstaksasi };
