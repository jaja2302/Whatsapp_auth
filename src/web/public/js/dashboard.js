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

function addToLog(message, type = 'info') {
  const logContainer = document.getElementById('log-container');
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry ${type}`;

  const timestamp = new Date().toLocaleTimeString();

  logEntry.innerHTML = `
    <span class="log-time">${timestamp}</span>
    <span class="log-message">${message}</span>
  `;

  logContainer.appendChild(logEntry);

  // Keep only last 100 logs to prevent memory issues
  while (logContainer.children.length > 100) {
    logContainer.removeChild(logContainer.firstChild);
  }

  // Auto-scroll to bottom
  logContainer.scrollTop = logContainer.scrollHeight;
}

// Add this to clear logs
function clearLogs() {
  const logContainer = document.getElementById('log-container');
  logContainer.innerHTML = '';
  addToLog('Logs cleared');
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
      const status = data.status; // Get the status from the response

      // Create HTML for active jobs, grouped by type
      let activeQueueHtml = '';

      // Handle grouped jobs
      Object.entries(status.active).forEach(([type, jobs]) => {
        // Add type header
        activeQueueHtml += `
          <tr class="table-secondary">
            <td colspan="4">
              <div class="d-flex justify-content-between align-items-center">
                <strong>${type}</strong>
              </div>
            </td>
          </tr>
        `;

        // Add jobs for this type
        if (jobs.length === 0) {
          activeQueueHtml += `<tr><td colspan="4" class="text-center">No active jobs</td></tr>`;
        } else {
          jobs.forEach((job) => {
            activeQueueHtml += `
              <tr>
                <td>${job.type}</td>
                <td>${job.processing ? '<span class="badge bg-primary">Processing</span>' : '<span class="badge bg-secondary">Queued</span>'}</td>
                <td>${job.retries || 0}</td>
                <td>
                  <button class="btn btn-sm btn-danger" onclick="removeJob('${job.id}')">Remove</button>
                </td>
              </tr>
            `;
          });
        }
      });

      // If no jobs at all
      if (Object.keys(status.active).length === 0) {
        activeQueueHtml =
          '<tr><td colspan="4" class="text-center">No active jobs</td></tr>';
      }

      document.getElementById('active-queue').innerHTML = activeQueueHtml;

      // Update queue status indicators
      const statusHtml = `
        <div class="mb-3">
          <strong>Queue Status:</strong> 
          <span class="badge ${status.isPaused ? 'bg-warning' : 'bg-success'}">
            ${status.isPaused ? 'Paused' : 'Running'}
          </span>
        </div>
        <div class="mb-2">
          <strong>Statistics:</strong>
          <span class="badge bg-primary ms-2">Total: ${status.stats.total}</span>
          <span class="badge bg-success ms-2">Completed: ${status.stats.completed}</span>
          <span class="badge bg-warning ms-2">Pending: ${status.stats.pending}</span>
          <span class="badge bg-danger ms-2">Failed: ${status.stats.failed}</span>
        </div>
      `;

      document.getElementById('queue-status').innerHTML = statusHtml;

      // Update Failed Jobs section if you have failed jobs
      const failedJobsHtml =
        status.failed.length > 0
          ? status.failed
              .map(
                (job) => `
          <tr>
            <td>${job.type}</td>
            <td><small class="text-danger">${job.error || 'Unknown error'}</small></td>
            <td>${new Date(job.failedAt).toLocaleString()}</td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="retryJob('${job.id}')">Retry</button>
            </td>
          </tr>
        `
              )
              .join('')
          : '<tr><td colspan="4" class="text-center">No failed jobs</td></tr>';

      document.getElementById('failed-jobs').innerHTML = failedJobsHtml;
    } else {
      console.error('Failed to get queue status:', data.error);
    }
  } catch (error) {
    console.error('Error refreshing queue status:', error);
  }
}

// Add this new function to update status indicators
function updateQueueStatusIndicators(isPaused, pausedTypes) {
  const statusContainer = document.getElementById('queue-status');
  if (!statusContainer) return;

  let statusHtml = `
    <div class="mb-3">
      <strong>Queue Status:</strong> 
      <span class="badge ${isPaused ? 'bg-warning' : 'bg-success'}">
        ${isPaused ? 'Paused' : 'Running'}
      </span>
    </div>
  `;

  if (pausedTypes && pausedTypes.length > 0) {
    statusHtml += `
      <div class="small">
        <strong>Paused Types:</strong> 
        ${pausedTypes
          .map(
            (type) => `
          <span class="badge bg-warning me-1">${type}</span>
        `
          )
          .join('')}
      </div>
    `;
  }

  statusContainer.innerHTML = statusHtml;
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
    // Get initial state when page loads
    const response = await fetch('/api/mill/status');
    const data = await response.json();

    if (data.success) {
      // Get all required elements
      const elements = {
        toggleGetMillData: document.getElementById('toggleGetMillData'),
        toggleRunJobsMill: document.getElementById('toggleRunJobsMill'),
        getMillDataMinutes: document.getElementById('getMillDataMinutes'),
        runJobsMillMinutes: document.getElementById('runJobsMillMinutes'),
        updateGetMillDataSchedule: document.getElementById(
          'updateGetMillDataSchedule'
        ),
        updateRunJobsMillSchedule: document.getElementById(
          'updateRunJobsMillSchedule'
        ),
      };

      // Check if all elements exist
      const missingElements = Object.entries(elements)
        .filter(([key, element]) => !element)
        .map(([key]) => key);

      if (missingElements.length > 0) {
        console.error('Missing elements:', missingElements);
        return;
      }

      // Set toggle states
      elements.toggleGetMillData.checked = data.states.get_mill_data;
      elements.toggleRunJobsMill.checked = data.states.run_jobs_mill;

      // Set schedule values from saved schedules
      if (data.schedules) {
        if (data.schedules.get_mill_data) {
          const minutes =
            data.schedules.get_mill_data.cronExpression.match(/\*\/(\d+)/)[1];
          elements.getMillDataMinutes.value = minutes;
        }

        if (data.schedules.run_jobs_mill) {
          const minutes =
            data.schedules.run_jobs_mill.cronExpression.match(/\*\/(\d+)/)[1];
          elements.runJobsMillMinutes.value = minutes;
        }
      }

      // Add event listeners
      elements.updateGetMillDataSchedule.addEventListener('click', async () => {
        const minutes = elements.getMillDataMinutes.value;
        await updateSchedule('get_mill_data', minutes);
        await initializeMillControls();
      });

      elements.updateRunJobsMillSchedule.addEventListener('click', async () => {
        const minutes = elements.runJobsMillMinutes.value;
        await updateSchedule('run_jobs_mill', minutes);
        await initializeMillControls();
      });
    }
  } catch (error) {
    console.error('Error initializing mill controls:', error);
    addToLog(`Error initializing mill controls: ${error.message}`, 'error');
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
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    if (data.success) {
      addToLog(`${program} executed successfully`, 'success');
    } else {
      addToLog(`Error running ${program}: ${data.message}`, 'error');
    }
  } catch (error) {
    console.error('Error running mill program:', error);
    addToLog(`Error running ${program}: ${error.message}`, 'error');
  }
}

// Initialize controls when page loads
document.addEventListener('DOMContentLoaded', () => {
  initializeMillControls();
});

// Add these functions to handle queue type controls
async function toggleQueueType(type, pause) {
  try {
    const response = await fetch('/api/queue/type/toggle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type, pause }),
    });
    const data = await response.json();
    if (data.success) {
      refreshQueueStatus();
      addToLog(`Queue type ${type} ${pause ? 'paused' : 'resumed'}`);
    }
  } catch (error) {
    addToLog(`Error toggling queue type: ${error.message}`);
  }
}

// Add program scheduling functions
async function scheduleProgram(program, cronExpression) {
  try {
    const response = await fetch('/api/programs/schedule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ program, cronExpression }),
    });
    const data = await response.json();
    if (data.success) {
      loadProgramSchedules();
      addToLog(`Scheduled ${program} with cron: ${cronExpression}`);
    }
  } catch (error) {
    addToLog(`Error scheduling program: ${error.message}`);
  }
}

async function loadProgramSchedules() {
  try {
    const response = await fetch('/api/programs/schedules');
    const data = await response.json();
    if (data.success) {
      const container = document.getElementById('program-schedules');
      container.innerHTML = data.schedules
        .map(
          (schedule) => `
        <div class="schedule-item">
          <span>${schedule.program}</span>
          <span>${schedule.cronExpression}</span>
          <button onclick="deleteSchedule('${schedule.id}')" class="btn btn-sm btn-danger">Delete</button>
        </div>
      `
        )
        .join('');
    }
  } catch (error) {
    addToLog(`Error loading schedules: ${error.message}`);
  }
}

async function updateMillSchedule(program) {
  const minutes = document.getElementById(
    program === 'get_mill_data' ? 'getMillDataMinutes' : 'runJobsMillMinutes'
  ).value;

  try {
    const response = await fetch('/api/mill/schedule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        program,
        cronExpression: `*/${minutes} * * * *`,
      }),
    });

    const data = await response.json();
    if (data.success) {
      addToLog(
        `Updated ${program} schedule to run every ${minutes} minutes`,
        'success'
      );
    } else {
      addToLog(`Failed to update schedule: ${data.message}`, 'error');
    }
  } catch (error) {
    addToLog(`Error updating schedule: ${error.message}`, 'error');
  }
}

// Define all helper functions first
async function updateSchedule(program, minutes) {
  try {
    const response = await fetch('/api/mill/schedule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        program,
        cronExpression: `*/${minutes} * * * *`,
      }),
    });

    const data = await response.json();
    if (data.success) {
      addToLog(
        `Updated ${program} schedule to run every ${minutes} minutes`,
        'success'
      );
      // Refresh the display to show new values
      await initializeMillControls();
    } else {
      addToLog(`Failed to update ${program} schedule: ${data.error}`, 'error');
    }
  } catch (error) {
    console.error('Error updating schedule:', error);
    addToLog(`Error updating schedule: ${error.message}`, 'error');
  }
}

async function addToLog(message, type = 'info') {
  const logContainer = document.getElementById('logContainer');
  if (logContainer) {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    logContainer.insertBefore(logEntry, logContainer.firstChild);
  }
}

// Then your initialization function
async function initializeMillControls() {
  try {
    const response = await fetch('/api/mill/status');
    const data = await response.json();

    // ... rest of your initialization code ...
  } catch (error) {
    console.error('Error initializing mill controls:', error);
    addToLog(`Error initializing mill controls: ${error.message}`, 'error');
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initializeMillControls);

async function resumeQueue() {
  try {
    // Check connection status first
    const statusResponse = await fetch('/api/whatsapp/status');
    const statusData = await statusResponse.json();

    if (!statusData.connected) {
      addToLog('Cannot resume queue: WhatsApp is not connected', 'error');
      return;
    }

    const response = await fetch('/api/queue/resume', {
      method: 'POST',
    });
    const data = await response.json();

    if (data.success) {
      addToLog('Queue processing resumed', 'success');
      await refreshQueueStatus();
    } else {
      addToLog(`Failed to resume queue: ${data.error}`, 'error');
    }
  } catch (error) {
    console.error('Error resuming queue:', error);
    addToLog(`Error resuming queue: ${error.message}`, 'error');
  }
}

// Make sure the button is properly connected
document.addEventListener('DOMContentLoaded', () => {
  const resumeButton =
    document.querySelector('.resume-queue-btn') ||
    document.getElementById('resumeQueue');
  if (resumeButton) {
    resumeButton.addEventListener('click', resumeQueue);
  }
});

// Add WebSocket listeners for real-time updates
socket.on('whatsapp:status', (data) => {
  const { connected } = data;
  updateConnectionStatus(connected);
});

function updateConnectionStatus(connected) {
  const statusElement = document.querySelector('.connection-status');
  if (statusElement) {
    statusElement.textContent = connected ? 'Connected' : 'Disconnected';
    statusElement.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
  }
}
