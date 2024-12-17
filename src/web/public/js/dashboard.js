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

// Add these functions to handle message handlers
async function loadMessageHandlers() {
  try {
    const response = await fetch('/api/handlers');
    const data = await response.json();

    if (data.success) {
      const container = document.getElementById('message-handlers');
      container.innerHTML = '';

      Object.entries(data.handlers).forEach(([id, handler]) => {
        const col = document.createElement('div');
        col.className = 'col-md-3 mb-3';
        col.innerHTML = `
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">${handler.name}</h5>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" 
                                    id="handler-${id}" 
                                    ${handler.enabled ? 'checked' : ''}
                                    onchange="toggleHandler('${id}', this.checked)">
                                <label class="form-check-label" for="handler-${id}">
                                    ${handler.enabled ? 'Enabled' : 'Disabled'}
                                </label>
                            </div>
                        </div>
                    </div>
                `;
        container.appendChild(col);
      });
    }
  } catch (error) {
    addToLog(`Error loading handlers: ${error.message}`);
  }
}

async function toggleHandler(handlerId, enabled) {
  try {
    const response = await fetch('/api/handlers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ handlerId, enabled }),
    });

    const data = await response.json();
    if (data.success) {
      const label = document.querySelector(`label[for="handler-${handlerId}"]`);
      label.textContent = enabled ? 'Enabled' : 'Disabled';
      addToLog(`${handlerId} handler ${enabled ? 'enabled' : 'disabled'}`);
    } else {
      addToLog(`Failed to update handler: ${data.message}`);
      // Revert the checkbox if the update failed
      document.getElementById(`handler-${handlerId}`).checked = !enabled;
    }
  } catch (error) {
    addToLog(`Error updating handler: ${error.message}`);
    // Revert the checkbox if there was an error
    document.getElementById(`handler-${handlerId}`).checked = !enabled;
  }
}

// Add this to your existing socket connection handler
socket.on('connect', () => {
  loadMessageHandlers();
  refreshQueueStatus();
  // Set up periodic refresh
  setInterval(refreshQueueStatus, 5000); // Refresh every 5 seconds
});

// Add these functions for queue management
async function refreshQueueStatus() {
  try {
    const response = await fetch('/api/queue/status');
    const data = await response.json();

    if (data.success) {
      // Update Active Queue
      const activeQueueHtml =
        data.data.active
          .map(
            (job) => `
        <tr>
          <td>${job.type}</td>
          <td>${job.processing ? '<span class="badge bg-primary">Processing</span>' : '<span class="badge bg-secondary">Queued</span>'}</td>
          <td>${job.retries || 0}</td>
          <td>
            <button class="btn btn-sm btn-danger" onclick="removeJob('${job.id}')">Remove</button>
          </td>
        </tr>
      `
          )
          .join('') ||
        '<tr><td colspan="4" class="text-center">No active jobs</td></tr>';

      document.getElementById('active-queue').innerHTML = activeQueueHtml;

      // Update Failed Jobs
      const failedJobsHtml =
        data.data.failed
          .map(
            (job) => `
        <tr>
          <td>${job.type}</td>
          <td><small class="text-danger">${job.error}</small></td>
          <td>${new Date(job.failedAt).toLocaleString()}</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="retryJob('${job.id}')">Retry</button>
          </td>
        </tr>
      `
          )
          .join('') ||
        '<tr><td colspan="4" class="text-center">No failed jobs</td></tr>';

      document.getElementById('failed-jobs').innerHTML = failedJobsHtml;
    }
  } catch (error) {
    console.error('Error refreshing queue status:', error);
  }
}

async function toggleQueue(resume) {
  try {
    const response = await fetch('/api/queue/toggle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pause: !resume }),
    });

    const data = await response.json();
    if (data.success) {
      refreshQueueStatus();
    }
  } catch (error) {
    console.error('Error toggling queue:', error);
  }
}

async function retryJob(jobId) {
  try {
    const response = await fetch(`/api/queue/retry/${jobId}`, {
      method: 'POST',
    });

    const data = await response.json();
    if (data.success) {
      refreshQueueStatus();
    }
  } catch (error) {
    console.error('Error retrying job:', error);
  }
}

// Auto-refresh queue status every 30 seconds
setInterval(refreshQueueStatus, 30000);

// Initial load
document.addEventListener('DOMContentLoaded', () => {
  refreshQueueStatus();
});

// Add these functions to your dashboard.js

// Initialize mill program controls
async function initializeMillControls() {
  try {
    const response = await fetch('/api/mill/status');
    const data = await response.json();

    if (data.success) {
      document.getElementById('toggleGetMillData').checked =
        data.states.get_mill_data;
      document.getElementById('toggleRunJobsMill').checked =
        data.states.run_jobs_mill;
    }
  } catch (error) {
    console.error('Error initializing mill controls:', error);
  }
}

// Handle toggle switches
document
  .getElementById('toggleGetMillData')
  .addEventListener('change', async (e) => {
    await toggleMillProgram('get_mill_data', e.target.checked);
  });

document
  .getElementById('toggleRunJobsMill')
  .addEventListener('change', async (e) => {
    await toggleMillProgram('run_jobs_mill', e.target.checked);
  });

async function toggleMillProgram(program, enabled) {
  try {
    const response = await fetch('/api/mill/toggle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ program, enabled }),
    });

    const data = await response.json();
    if (!data.success) {
      // Revert toggle if failed
      document.getElementById(
        `toggle${program.charAt(0).toUpperCase() + program.slice(1)}`
      ).checked = !enabled;
    }
  } catch (error) {
    console.error('Error toggling mill program:', error);
    // Revert toggle on error
    document.getElementById(
      `toggle${program.charAt(0).toUpperCase() + program.slice(1)}`
    ).checked = !enabled;
  }
}

async function runMillProgram(program) {
  try {
    const response = await fetch(`/api/mill/${program}/run`, {
      method: 'POST',
    });

    const data = await response.json();
    if (data.success) {
      // Show success message
      alert(`${program} executed successfully`);
    }
  } catch (error) {
    console.error('Error running mill program:', error);
    alert(`Error running ${program}`);
  }
}

// Initialize controls when page loads
document.addEventListener('DOMContentLoaded', () => {
  initializeMillControls();
});
