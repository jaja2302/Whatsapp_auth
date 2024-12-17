async function runProgram(programName) {
  try {
    const response = await fetch(`/api/programs/${programName}`, {
      method: 'POST',
    });
    const data = await response.json();

    if (data.success) {
      addToLog(`Successfully ran ${programName}`);
    } else {
      addToLog(`Error running ${programName}: ${data.error}`);
    }
  } catch (error) {
    addToLog(`Error: ${error.message}`);
  }
}

function addToLog(message) {
  const logContainer = document.getElementById('log-container');
  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';
  logEntry.innerHTML = `
        <span class="log-time">${new Date().toLocaleTimeString()}</span>
        <span class="log-message">${message}</span>
    `;
  logContainer.appendChild(logEntry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

// Check status periodically
setInterval(async () => {
  try {
    const response = await fetch('/api/status');
    const status = await response.json();
    updateStatus(status);
  } catch (error) {
    console.error('Error checking status:', error);
  }
}, 5000);

function updateStatus(status) {
  const statusElement = document.getElementById('connection-status');
  if (status.whatsappConnected) {
    statusElement.innerHTML = '<span class="badge bg-success">Connected</span>';
    document.getElementById('qr-code').innerHTML = '';
  } else {
    statusElement.innerHTML =
      '<span class="badge bg-danger">Disconnected</span>';
  }
}

async function disconnectWhatsApp() {
  try {
    const response = await fetch('/api/whatsapp/disconnect', {
      method: 'POST',
    });
    const data = await response.json();

    if (data.success) {
      addToLog('WhatsApp disconnected successfully');
      updateStatus({ whatsappConnected: false });
    } else {
      addToLog(`Failed to disconnect: ${data.message}`);
    }
  } catch (error) {
    addToLog(`Error: ${error.message}`);
  }
}

async function reconnectWhatsApp() {
  try {
    const response = await fetch('/api/whatsapp/reconnect', {
      method: 'POST',
    });
    const data = await response.json();

    if (data.success) {
      addToLog('Attempting to reconnect to WhatsApp...');
    } else {
      addToLog(`Failed to reconnect: ${data.message}`);
    }
  } catch (error) {
    addToLog(`Error: ${error.message}`);
  }
}

// Add this to your socket.io handlers
socket.on('connection-status', (status) => {
  if (status.connected) {
    updateStatus({ whatsappConnected: true });
    // Clear QR code when connected
    document.getElementById('qr-code').innerHTML = '';
  }
});

socket.on('qr', (qr) => {
  const qrContainer = document.getElementById('qr-code');
  if (
    !document
      .getElementById('connection-status')
      .innerHTML.includes('Connected')
  ) {
    qrContainer.innerHTML = `<img src="${qr}" alt="Scan this QR code" />`;
    addToLog('New QR code received. Please scan with WhatsApp.');
  }
});
