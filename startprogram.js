const puppeteer = require('puppeteer');
const ping = require('ping');
const { exec } = require('child_process');

const USERNAME = 'jaja.valentino';
const PASSWORD = 'Els@1212';
const URL = 'https://10.6.1.1/connect/PortalMain';
const CHROME_PATH = '/usr/bin/chromium-browser';

const INTERNET_OUTAGE_THRESHOLD = 60000; // 1 minute
const CHECK_INTERVAL = 30000; // 30 seconds
const MAX_RELOGIN_ATTEMPTS = 3;
let noInternetStartTime = null;

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
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
  });

  try {
    const page = await browser.newPage();

    page.on('dialog', async dialog => {
      console.log(dialog.message());
      await dialog.accept();
    });

    await page.goto(URL);
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds

    const errorMessageElement = await page.$('#LoginUserPassword_error_message');
    if (errorMessageElement) {
      const errorMessage = await page.evaluate(el => el.textContent, errorMessageElement);
      if (errorMessage.includes('Your session has expired. Please try again')) {
        await page.reload();
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds after reload
      }
    }

    await page.waitForSelector('#LoginUserPassword_auth_username');
    await page.waitForSelector('#LoginUserPassword_auth_password');

    await page.type('#LoginUserPassword_auth_username', USERNAME);
    await page.type('#LoginUserPassword_auth_password', PASSWORD);

    await Promise.all([
      page.click('#UserCheck_Login_Button'),
      new Promise(resolve => setTimeout(resolve, 5000)), // Wait for 5 seconds after clicking login
    ]);

    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait for 10 seconds after login to ensure it is successful
    loginSuccess = await checkInternet();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }

  return loginSuccess;
}

async function restartPm2Process(processName) {
  return execPromise(`pm2 restart ${processName}`, `Restarted PM2 process: ${processName}`);
}

async function stopPm2Process(processName) {
  return execPromise(`pm2 stop ${processName}`, `Stopped PM2 process: ${processName}`);
}

function execPromise(command, successMessage) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
      console.log(`stdout: ${stdout}`);
      console.log(successMessage);
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
      return true;
    } else {
      console.log('Reconnection failed.');
      if (attempt < MAX_RELOGIN_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  }

  console.log('Reached maximum reconnection attempts. Stopping PM2 process bot_da.');
  await stopPm2Process('bot_da');

  setTimeout(async () => {
    await reconnectWithRetries();
  }, 3600000);

  return false;
}

async function monitorInternet() {
  const isConnected = await checkInternet();

  if (isConnected) {
    console.log('Internet connection available.');
    noInternetStartTime = null;
  } else {
    console.log('No Internet connection detected.');
    if (!noInternetStartTime) {
      noInternetStartTime = Date.now();
    } else if (Date.now() - noInternetStartTime >= INTERNET_OUTAGE_THRESHOLD) {
      console.log('Internet connection lost for 1 minute. Attempting to reconnect...');
      await reconnectWithRetries();
      noInternetStartTime = null;
    }
  }
}

async function checkInternetConnection() {
  await monitorInternet();
  setInterval(monitorInternet, CHECK_INTERVAL);
}

(async () => {
  await checkInternetConnection();
})();
