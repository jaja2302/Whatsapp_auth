document.addEventListener('DOMContentLoaded', function () {
  const socket = io();
  const generalLogs = document.getElementById('general-logs');
  const programStatusDiv = document.getElementById('program-status');
  const jobControlsDiv = document.getElementById('job-controls');

  // Helper function untuk format log message
  function formatLogMessage(message) {
    if (typeof message === 'object') {
      return JSON.stringify(message, null, 2);
    }
    return message;
  }

  // Add log entry
  function addLog(message, level = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = 'p-2 border-b border-gray-100';

    // Format message jika object
    const formattedMessage = formatLogMessage(message);

    logEntry.textContent = `${new Date().toLocaleTimeString()} - ${formattedMessage}`;

    if (level === 'error') {
      logEntry.classList.add('text-red-600');
    } else if (level === 'warn') {
      logEntry.classList.add('text-yellow-600');
    }

    generalLogs.insertBefore(logEntry, generalLogs.firstChild);

    while (generalLogs.children.length > 100) {
      generalLogs.removeChild(generalLogs.lastChild);
    }
  }

  // Update status display
  async function updateCronStatus() {
    try {
      const response = await fetch('/api/general/get-cron-status');
      const data = await response.json();

      if (data.success) {
        const { program_status, jobs } = data.data;

        programStatusDiv.innerHTML = `
          <div class="flex items-center">
            <span class="mr-2">Program Status:</span>
            <span class="${program_status === 'active' ? 'text-green-600' : 'text-red-600'} font-medium">
              ${program_status}
            </span>
          </div>
        `;

        // Update job controls
        jobControlsDiv.innerHTML = '';
        Object.entries(jobs).forEach(([jobName, status]) => {
          const jobControl = createJobControl(jobName, status);
          jobControlsDiv.appendChild(jobControl);
        });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      addLog('Error updating status: ' + error.message, 'error');
    }
  }

  // Create job control element
  function createJobControl(jobName, status) {
    const div = document.createElement('div');
    div.className = 'border p-3 rounded';
    div.innerHTML = `
      <div class="flex justify-between items-center">
        <div>
          <h4 class="font-medium">${jobName}</h4>
          <p class="text-sm text-gray-600">
            Status: <span class="${status === 'active' ? 'text-green-600' : 'text-red-600'} font-medium">${status}</span>
          </p>
        </div>
        <div class="space-x-2">
          <button type="button" class="stop-job px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 focus:outline-none focus:ring-2">
            Stop
          </button>
          <button type="button" class="start-job px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 focus:outline-none focus:ring-2">
            Start
          </button>
        </div>
      </div>
    `;

    // Add event listeners
    div
      .querySelector('.start-job')
      .addEventListener('click', () => startJob(jobName));
    div
      .querySelector('.stop-job')
      .addEventListener('click', () => stopJob(jobName));

    return div;
  }

  // Job control functions
  async function startJob(jobName) {
    try {
      const response = await fetch(`/api/general/jobs/${jobName}/start`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        addLog(`${jobName} started successfully`);
        await updateCronStatus();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      addLog(`Error starting ${jobName}: ${error.message}`, 'error');
    }
  }

  async function stopJob(jobName) {
    try {
      const response = await fetch(`/api/general/jobs/${jobName}/stop`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        addLog(`${jobName} stopped successfully`);
        await updateCronStatus();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      addLog(`Error stopping ${jobName}: ${error.message}`, 'error');
    }
  }

  // Setup refresh button
  document
    .getElementById('refresh-status')
    .addEventListener('click', async () => {
      try {
        await updateCronStatus();
        addLog('Status refreshed successfully');
      } catch (error) {
        addLog('Error refreshing status: ' + error.message, 'error');
      }
    });

  // Listen for general logs
  socket.on('log-general', (data) => {
    const message = Array.isArray(data.message)
      ? data.message.map(formatLogMessage).join(' ')
      : formatLogMessage(data.message);
    addLog(message, data.level);
  });

  // Load current settings
  async function loadCurrentSettings() {
    try {
      const response = await fetch('/api/general/get-cron-settings');
      const data = await response.json();

      if (data.success) {
        const { settings, intervals } = data.data;

        // Populate all select elements with intervals
        populateSelectOptions(
          'handleBotLaporanHarianFleetManagement',
          intervals
        );
        populateSelectOptions('handleBotDailyPengawasanOperatorAI', intervals);
        populateSelectOptions('updatePCStatus', intervals);
        populateSelectOptions('triggerStatusPCPengawasanOperatorAI', intervals);

        // Update current text for each job
        updateCurrentText(
          'handleBotLaporanHarianFleetManagement',
          settings.handleBotLaporanHarianFleetManagement,
          intervals
        );
        updateCurrentText(
          'handleBotDailyPengawasanOperatorAI',
          settings.handleBotDailyPengawasanOperatorAI,
          intervals
        );
        updateCurrentText('updatePCStatus', settings.updatePCStatus, intervals);
        updateCurrentText(
          'triggerStatusPCPengawasanOperatorAI',
          settings.triggerStatusPCPengawasanOperatorAI,
          intervals
        );
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      addLog('Error loading settings: ' + error.message, 'error');
    }
  }

  // Populate select options
  function populateSelectOptions(selectId, intervals) {
    const select = document.getElementById(selectId);
    if (!select || !intervals) return;

    select.innerHTML = '';
    Object.entries(intervals).forEach(([key, value]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = key;
      select.appendChild(option);
    });
  }

  // Update current text under select
  function updateCurrentText(selectId, value, intervals) {
    const select = document.getElementById(selectId);
    const currentText = select.parentElement.querySelector('p');

    let displayText = value;
    if (intervals) {
      const matchingInterval = Object.entries(intervals).find(
        ([key, val]) => val === value
      );
      if (matchingInterval) {
        displayText = matchingInterval[0];
      }
    }

    currentText.textContent = `Current: ${displayText}`;
  }

  // Handle form submission
  document
    .getElementById('cron-settings-form')
    .addEventListener('submit', async (e) => {
      e.preventDefault();

      const jobs = [
        'handleBotLaporanHarianFleetManagement',
        'handleBotDailyPengawasanOperatorAI',
        'updatePCStatus',
        'triggerStatusPCPengawasanOperatorAI',
      ];

      try {
        for (const jobName of jobs) {
          const schedule = document.getElementById(jobName).value;

          const response = await fetch('/api/general/update-cron-settings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ jobName, schedule }),
          });

          const data = await response.json();

          if (!data.success) {
            throw new Error(`Failed to update ${jobName}: ${data.message}`);
          }
        }

        addLog('Cron settings updated successfully');
        await loadCurrentSettings();
      } catch (error) {
        addLog('Error updating cron settings: ' + error.message, 'error');
      }
    });

  // Initial loads
  loadCurrentSettings();
  updateCronStatus();
});
