document.addEventListener('DOMContentLoaded', function () {
  const socket = io();
  const fetchWeatherDataBtn = document.getElementById('fetch-weather-data');
  const iotLogs = document.getElementById('iot-logs');
  const programStatusDiv = document.getElementById('program-status');

  // Handle Weather Data Fetching
  fetchWeatherDataBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/iot/fetch-weather-data', {
        method: 'GET',
      });

      const data = await response.json();
      addLog(data.message);
    } catch (error) {
      addLog('Error: ' + error.message, 'error');
    }
  });

  // Helper function to add logs
  function addLog(message, level = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = 'p-2 border-b border-gray-100';
    logEntry.textContent = `${new Date().toLocaleTimeString()} - ${message}`;

    if (level === 'error') {
      logEntry.classList.add('text-red-600');
    } else if (level === 'warn') {
      logEntry.classList.add('text-yellow-600');
    }

    iotLogs.insertBefore(logEntry, iotLogs.firstChild);

    // Limit the number of log entries
    while (iotLogs.children.length > 100) {
      iotLogs.removeChild(iotLogs.lastChild);
    }
  }

  // Function to update the "Current:" text under the selects
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

    let formattedText = displayText;
    if (typeof displayText === 'string') {
      formattedText = displayText
        .replace(/min/g, ' minute')
        .replace(/hour/g, ' hour');
    }

    currentText.textContent = `Current: Every ${formattedText}`;
  }

  // Handle cron settings form
  const cronSettingsForm = document.getElementById('cron-settings-form');

  // Function to populate select options
  function populateSelectOptions(selectId, intervals) {
    const select = document.getElementById(selectId);
    if (!select || !intervals) return;

    select.innerHTML = '';

    Object.entries(intervals).forEach(([key, value]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = `Every ${key.replace(/min/g, ' minute').replace(/hour/g, ' hour')}`;
      select.appendChild(option);
    });
  }

  // Function to populate timezone options
  function populateTimezoneOptions(timezones) {
    const select = document.getElementById('timezone');
    if (!select || !timezones) return;

    select.innerHTML = '';

    timezones.forEach((timezone) => {
      const option = document.createElement('option');
      option.value = timezone;
      option.textContent = timezone;
      select.appendChild(option);
    });
  }

  // Set initial values based on current settings
  async function loadCurrentSettings() {
    try {
      const response = await fetch('/api/iot/get-cron-settings');
      const data = await response.json();

      if (data.success) {
        const { settings, intervals, timezones, timezone } = data.data;

        // Populate all select options
        populateSelectOptions('get_iot_weatherstation', intervals);
        populateSelectOptions('get_iot_weatherstation_data_gap', intervals);
        populateSelectOptions('get_data_harian_aws', intervals);
        populateTimezoneOptions(timezones);

        // Set current values
        if (settings.get_iot_weatherstation) {
          document.getElementById('get_iot_weatherstation').value =
            settings.get_iot_weatherstation;
          updateCurrentText(
            'get_iot_weatherstation',
            settings.get_iot_weatherstation,
            intervals
          );
        }
        if (settings.get_iot_weatherstation_data_gap) {
          document.getElementById('get_iot_weatherstation_data_gap').value =
            settings.get_iot_weatherstation_data_gap;
          updateCurrentText(
            'get_iot_weatherstation_data_gap',
            settings.get_iot_weatherstation_data_gap,
            intervals
          );
        }
        if (settings.get_data_harian_aws) {
          document.getElementById('get_data_harian_aws').value =
            settings.get_data_harian_aws;
          updateCurrentText(
            'get_data_harian_aws',
            settings.get_data_harian_aws,
            intervals
          );
        }
        if (timezone) {
          document.getElementById('timezone').value = timezone;
        }
      }
    } catch (error) {
      addLog('Error loading settings: ' + error.message, 'error');
    }
  }

  // Handle form submission
  cronSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
      get_iot_weatherstation: document.getElementById('get_iot_weatherstation')
        .value,
      get_iot_weatherstation_data_gap: document.getElementById(
        'get_iot_weatherstation_data_gap'
      ).value,
      get_data_harian_aws: document.getElementById('get_data_harian_aws').value,
      timezone: document.getElementById('timezone').value,
    };

    try {
      const response = await fetch('/api/iot/update-cron-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        addLog('Cron settings updated successfully');
        await loadCurrentSettings();
        await updateCronStatus();
      } else {
        throw new Error(data.error || 'Failed to update settings');
      }
    } catch (error) {
      addLog('Error updating settings: ' + error.message, 'error');
    }
  });

  // Function to update status display
  async function updateCronStatus() {
    try {
      const response = await fetch('/api/iot/get-cron-status');
      const data = await response.json();

      if (data.success) {
        const { program_status, jobs } = data.data;

        // Update program status
        programStatusDiv.innerHTML = `
          <div class="flex items-center">
            <span class="mr-2">Program Status:</span>
            <span class="${program_status === 'active' ? 'text-green-600' : 'text-red-600'} font-medium">
              ${program_status}
            </span>
          </div>
        `;

        // Update individual job statuses
        Object.entries(jobs).forEach(([jobName, status]) => {
          const statusElement = document.getElementById(`status-${jobName}`);
          if (statusElement) {
            statusElement.innerHTML = `Status: <span class="${status === 'active' ? 'text-green-600' : 'text-red-600'} font-medium">${status}</span>`;
          }
        });
      } else {
        throw new Error(data.error || 'Failed to fetch status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      programStatusDiv.innerHTML = `
        <div class="text-red-600">
          Error fetching status: ${error.message}
        </div>
      `;
    }
  }

  // Setup individual job controls
  const jobs = [
    'get_iot_weatherstation',
    'get_iot_weatherstation_data_gap',
    'get_data_harian_aws',
  ];

  jobs.forEach((jobName) => {
    const startBtn = document.getElementById(`start-${jobName}`);
    const stopBtn = document.getElementById(`stop-${jobName}`);

    startBtn.addEventListener('click', async () => {
      try {
        startBtn.disabled = true;
        const response = await fetch(`/api/iot/jobs/${jobName}/start`, {
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
      } finally {
        startBtn.disabled = false;
      }
    });

    stopBtn.addEventListener('click', async () => {
      try {
        stopBtn.disabled = true;
        const response = await fetch(`/api/iot/jobs/${jobName}/stop`, {
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
      } finally {
        stopBtn.disabled = false;
      }
    });
  });

  // Setup refresh button
  const refreshBtn = document.getElementById('refresh-status');
  refreshBtn.addEventListener('click', async () => {
    try {
      refreshBtn.disabled = true;
      await updateCronStatus();
      addLog('Status refreshed successfully');
    } catch (error) {
      addLog('Error refreshing status: ' + error.message, 'error');
    } finally {
      refreshBtn.disabled = false;
    }
  });

  socket.on('log-iot', (data) => {
    const logEntry = document.createElement('div');
    logEntry.className = 'p-2 border-b border-gray-100';

    // Check if the message is an array and join its elements into a string
    const message = Array.isArray(data.message)
      ? data.message.join(' ')
      : data.message;

    logEntry.textContent = `${data.timestamp} - ${message}`;

    // console.log(data);

    // Add color based on log level
    if (data.level === 'error') {
      logEntry.classList.add('text-red-600');
    } else if (data.level === 'warn') {
      logEntry.classList.add('text-yellow-600');
    }

    iotLogs.insertBefore(logEntry, iotLogs.firstChild);

    // Limit the number of log entries to prevent memory issues
    while (iotLogs.children.length > 100) {
      iotLogs.removeChild(iotLogs.lastChild);
    }
  });

  // Load initial settings and status
  loadCurrentSettings();
  updateCronStatus();
});
