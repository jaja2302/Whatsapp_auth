const puppeteer = require('puppeteer');

async function generatemapstaksasi(est, datetime) {
    try {
        const browser = await puppeteer.launch({
            headless: true,
	        executablePath: '/usr/bin/chromium-browser',
            ignoreHTTPSErrors: true,
        });
        const page = await browser.newPage();
        await page.goto(`https://srs-ssms.com/rekap_pdf/convert_taksasi_pdf_get.php?datetime=${datetime}&estate=${est}`);
        const title = await page.title();

        // Delay for 5 seconds before closing the page
        await new Promise(resolve => setTimeout(resolve, 5000));

        await page.close();
        await browser.close();

        return {
            body: {}, // Provide your response body here
            cookies: {}, // Provide your cookies object here
            response: 'success',
        };
    } catch (error) {
        // Handle errors
        console.error('Error occurred:', error);
        return { error: 'Internal server error' };
    }
}

module.exports = { generatemapstaksasi };
