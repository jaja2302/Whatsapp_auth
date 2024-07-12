// index.js
const { exec } = require('child_process');
const ping = require('ping');
const { loginwifi } = require('./loginwifi.js');

let isFirstRun = true;

async function login() {
    let result = await loginwifi();

    if (result) {
        console.log('Login successful');
    } else {
        console.log('Login failed');
    }
}

async function checkInternetConnection() {
    const host = 'www.whatsapp.com';
    let attempts = 0;

    const retryLogin = async () => {
        let isAlive = false;
        let timeoutReached = false;

        while (!isAlive && attempts < 3 && !timeoutReached) {
            ping.sys.probe(host, async (isAliveResult) => {
                isAlive = isAliveResult;

                if (!isAlive) {
                    attempts++;
                    console.log(`Attempt ${attempts}: Internet connection not available. Trying to login...`);
                    await login();

                    // Check the internet connection status again
                    ping.sys.probe(host, async (newIsAlive) => {
                        isAlive = newIsAlive;
                        if (isAlive) {
                            console.log('Internet connection established.');
                        }
                    });

                    if (!isAlive) {
                        // Wait for the result of loginwifi or timeout
                        const loginStatus = await loginwifi();
                        if (loginStatus) {
                            console.log('Reconnected successfully.');
                            isAlive = true;
                        } else {
                            console.log('Reconnection failed.');
                        }
                    }
                } else {
                    console.log('Internet connection available.');
                }
            }, { timeout: 30 });

            await new Promise(resolve => setTimeout(resolve, 1000)); // wait for 1 second between attempts
        }
    };

    await retryLogin();
}

if (isFirstRun) {
    isFirstRun = false;
    checkInternetConnection();
}

setInterval(checkInternetConnection, 1000);
