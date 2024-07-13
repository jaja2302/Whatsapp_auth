const puppeteer = require('puppeteer');
const ping = require('ping');
const { exec } = require('child_process');

const USERNAME = 'jaja.valentino';
const PASSWORD = 'J@ja1212';
const URL = 'https://10.6.1.1/connect/PortalMain';
const CHROME_PATH = '/usr/bin/chromium-browser'; // Optional Chrome path

let noInternetStartTime = null;
const INTERNET_OUTAGE_THRESHOLD = 60000; // 1 minute
const CHECK_INTERVAL = 30000; // 30 seconds
const MAX_RELOGIN_ATTEMPTS = 3;

async function checkInternet(host = 'www.whatsapp.com') {
  return new Promise(resolve => {
    ping.sys.probe(host, isAlive => {
      resolve(isAlive);
    });
  });
}

async function loginWifi() {
  let loginSuccess = false;
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME_PATH, // Uncomment if using a specific Chrome path
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

    // Reload the page to avoid session expiry
    await page.reload({ waitUntil: 'networkidle2' });

    await page.waitForSelector('#LoginUserPassword_auth_username');
    await page.waitForSelector('#LoginUserPassword_auth_password');

    await page.type('#LoginUserPassword_auth_username', USERNAME);
    await page.type('#LoginUserPassword_auth_password', PASSWORD);

    await Promise.all([
      page.click('#UserCheck_Login_Button'),
    ]);

    // Wait for 10 seconds after login to ensure it is successful
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check internet connection after 10 seconds
    loginSuccess = await checkInternet();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }

  return loginSuccess;
}

async function restartPm2Process(processName) {
  return new Promise((resolve, reject) => {
    exec(`pm2 restart ${processName}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error restarting PM2 process: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
      console.log(`stdout: ${stdout}`);
      console.log(`Restarted PM2 process: ${processName}`);
      resolve();
    });
  });
}

async function stopPm2Process(processName) {
  return new Promise((resolve, reject) => {
    exec(`pm2 stop ${processName}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error stopping PM2 process: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
      console.log(`stdout: ${stdout}`);
      console.log(`Stopped PM2 process: ${processName}`);
      resolve();
    });
  });
}

async function reconnectWithRetries() {
  for (let attempt = 1; attempt <= MAX_RELOGIN_ATTEMPTS; attempt++) {
    console.log(`Attempt ${attempt}: Trying to login WiFi...`);
    const loginResult = await loginWifi();

    if (loginResult) {
      console.log('Reconnected successfully.');
      await restartPm2Process('bot_da');
      return true; // Exit if reconnection is successful
    } else {
      console.log('Reconnection failed.');
      if (attempt < MAX_RELOGIN_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds before next attempt
      }
    }
  }

  console.log('Reached maximum reconnection attempts. Stopping PM2 process bot_da.');
  await stopPm2Process('bot_da');

  // Schedule a retry after 1 hour (3600 seconds)
  setTimeout(async () => {
    await reconnectWithRetries(); // Recursively call to retry after 1 hour
  }, 3600000);

  return false;
}

async function monitorInternet() {
  const isConnected = await checkInternet();

  if (isConnected) {
    console.log('Internet connection available.');
    noInternetStartTime = null; // Reset the timer
  } else {
    console.log('No Internet connection detected.');
    if (!noInternetStartTime) {
      noInternetStartTime = Date.now(); // Start the timer
    } else if (Date.now() - noInternetStartTime >= INTERNET_OUTAGE_THRESHOLD) {
      console.log('Internet connection lost for 1 minute. Attempting to reconnect...');
      await reconnectWithRetries();
      noInternetStartTime = null; // Reset the timer after attempting to reconnect
    }
  }
}

async function checkInternetConnection() {
  await monitorInternet();
  setInterval(monitorInternet, CHECK_INTERVAL);
}

// Initial check
(async () => {
  await checkInternetConnection();
})();
