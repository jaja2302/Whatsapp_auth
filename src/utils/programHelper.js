const fs = require('fs');

function isProgramActive(programName) {
  try {
    const currentSettings = JSON.parse(
      fs.readFileSync(require.resolve('../web/data/settings.json'))
    );

    return currentSettings[programName]?.status === 'active';
  } catch (error) {
    console.error(`Error checking ${programName} status:`, error);
    return false;
  }
}

module.exports = {
  isProgramActive,
};
