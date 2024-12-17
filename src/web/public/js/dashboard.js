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

// Add these functions to handle button states
function updateButtonStates(connected, isReconnecting) {
  const connectBtn = document.getElementById('reconnect-btn');
  const disconnectBtn = document.getElementById('disconnect-btn');

  if (connected) {
    connectBtn.disabled = true;
    disconnectBtn.disabled = false;
  } else if (isReconnecting) {
    connectBtn.disabled = true;
    disconnectBtn.disabled = true;
  } else {
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
  }
}

socket.on('connection-status', (status) => {
  updateStatus({ whatsappConnected: status.connected });
  updateButtonStates(status.connected, status.isReconnecting);

  if (status.connected) {
    document.getElementById('qr-code').innerHTML = '';
    addToLog('WhatsApp connected successfully');
  } else {
    addToLog('WhatsApp disconnected');
  }
});

socket.on('reconnecting', (isReconnecting) => {
  updateButtonStates(false, isReconnecting);
  if (isReconnecting) {
    addToLog('Attempting to reconnect...');
  }
});

async function reconnectWhatsApp() {
  try {
    // Disable both buttons immediately
    updateButtonStates(false, true);

    const response = await fetch('/api/whatsapp/reconnect', {
      method: 'POST',
    });
    const data = await response.json();

    if (data.success) {
      addToLog('Attempting to reconnect to WhatsApp...');
      addToLog('Please wait for QR code to appear...');
      document.getElementById('qr-code').innerHTML = '';
    } else {
      addToLog(`Failed to reconnect: ${data.message}`);
      if (data.error) {
        addToLog(`Error details: ${data.error}`);
      }
      // Re-enable connect button if reconnection fails
      updateButtonStates(false, false);
    }
  } catch (error) {
    addToLog(`Error during reconnection: ${error.message}`);
    // Re-enable connect button if there's an error
    updateButtonStates(false, false);
  }
}

async function disconnectWhatsApp() {
  try {
    // Disable both buttons immediately
    updateButtonStates(false, true);

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
