// start.js

const { exec } = require('child_process');
const path = require('path');

const botPaths = {
  bot_a: path.join('C:', 'Users', 'jaja.valentino', 'Desktop', 'Whatsapp_auth'),
  bot_b: path.join('C:', 'Users', 'jaja.valentino', 'Desktop', 'whatsapp_ho')
};

const startBot = (botName) => {
  const botPath = botPaths[botName];
  if (!botPath) {
    console.error(`Path for ${botName} not found!`);
    return;
  }

  const logPath = path.join(botPath, 'output.log');
  const errorPath = path.join(botPath, 'error.log');

  const command = `pm2 start ${botPath} --log ${logPath} --error ${errorPath} --name ${botName}`;
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error starting ${botName}: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
    }
    console.log(`stdout: ${stdout}`);
  });
};

startBot('not_grading');
startBot('bot_ho');
