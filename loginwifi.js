const puppeteer = require('puppeteer');
const ping = require('ping');

const USERNAME = 'jaja.valentino';
const PASSWORD = 'J@ja1212';
const URL = 'https://10.6.1.1/connect/PortalMain';
const CHROME_PATH = '/usr/bin/chromium-browser';

async function checkinternet() {
    return new Promise(resolve => {
        const host = 'www.whatsapp.com';
        ping.sys.probe(host, async (isAlive) => {
            if (isAlive) {
                resolve(true); // Internet is available
            } else {
                resolve(false); // Internet is not available
            }
        });
    });
}

async function loginwifi() {
    let loginSuccess = false;

    const browser = await puppeteer.launch({
        headless: false,
        // executablePath: CHROME_PATH,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
    });

    try {
        const page = await browser.newPage();

        page.on('dialog', async dialog => {
            console.log(dialog.message());
            await dialog.accept();
        });

        await page.goto(URL, { waitUntil: 'networkidle2' });

        if (page.url().includes('net::ERR_CERT_AUTHORITY_INVALID')) {
            await page.goto('chrome-error://chromewebdata/');
            await page.evaluate(() => {
                document.querySelector('#details-button').click();
                document.querySelector('#proceed-link').click();
            });
        }

        await page.waitForSelector('#LoginUserPassword_auth_username');
        await page.waitForSelector('#LoginUserPassword_auth_password');

        await page.type('#LoginUserPassword_auth_username', USERNAME);
        await page.type('#LoginUserPassword_auth_password', PASSWORD);

        await Promise.all([
            page.click('#UserCheck_Login_Button'),
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
        ]);

        // Wait for 10 seconds after login to ensure it is successful
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Check internet connection after 10 seconds
        loginSuccess = await checkinternet();

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await browser.close();
    }

    return loginSuccess;
}

module.exports = { loginwifi };
