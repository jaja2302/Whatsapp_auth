document.addEventListener('DOMContentLoaded', function () {
  const socket = io();
  const fetchMillDataBtn = document.getElementById('fetch-mill-data');
  const millStatus = document.getElementById('mill-status');
  const gradingLogs = document.getElementById('grading-logs');
  const totalProcessed = document.getElementById('total-processed');
  const successRate = document.getElementById('success-rate');

  // Handle Mill Data Fetching
  fetchMillDataBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/grading/fetch-mill-data', {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        addLog('Mill data fetch initiated successfully');
      } else {
        addLog('Error fetching mill data: ' + data.error);
      }
    } catch (error) {
      addLog('Error: ' + error.message);
    }
  });

  // Fetch initial mill status
  async function updateMillStatus() {
    try {
      const response = await fetch('/api/grading/mill-status');
      const data = await response.json();

      if (data.success) {
        millStatus.textContent = `Last Updated: ${new Date().toLocaleString()}`;
        // Update any other relevant UI elements with data.data
      }
    } catch (error) {
      addLog('Error fetching status: ' + error.message);
    }
  }

  // Update status every minute
  updateMillStatus();
  setInterval(updateMillStatus, 60000);

  // Socket Events
  socket.on('mill_data_update', (data) => {
    addLog(`Mill data update: ${data.message}`);
    updateMillStatus();
  });

  // Helper function to add logs
  function addLog(message) {
    const logEntry = document.createElement('div');
    logEntry.className = 'p-2 border-b border-gray-100';
    logEntry.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
    gradingLogs.insertBefore(logEntry, gradingLogs.firstChild);
  }

  // Add this function to update the "Current:" text under the selects
  function updateCurrentText(selectId, value, intervals) {
    const select = document.getElementById(selectId);
    const currentText = select.parentElement.querySelector('p');

    // Find the display text for the current value
    const displayText =
      Object.entries(intervals).find(([key, val]) => val === value)?.[0] ||
      value;
    currentText.textContent = `Current: Every ${displayText.replace('min', ' minute').replace('hour', ' hour')}`;
  }

  // Handle cron settings form
  const cronSettingsForm = document.getElementById('cron-settings-form');

  // Function to populate select options
  function populateSelectOptions(selectId, intervals) {
    const select = document.getElementById(selectId);
    select.innerHTML = ''; // Clear existing options

    Object.entries(intervals).forEach(([key, value]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = `Every ${key.replace('min', ' minute').replace('hour', ' hour')}`;
      select.appendChild(option);
    });
  }

  // Function to populate timezone options
  function populateTimezoneOptions(timezones) {
    const select = document.getElementById('timezone');
    select.innerHTML = ''; // Clear existing options

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
      const response = await fetch('/api/grading/get-cron-settings');
      const data = await response.json();

      if (data.success) {
        const { settings, intervals, timezones, timezone } = data.data;

        // Populate select options
        populateSelectOptions('runJobsMill', intervals);
        populateSelectOptions('getMillData', intervals);
        populateTimezoneOptions(timezones);

        // Set current values
        document.getElementById('runJobsMill').value = settings.runJobsMill;
        document.getElementById('getMillData').value = settings.getMillData;
        document.getElementById('timezone').value = timezone;

        // Update current text displays
        updateCurrentText('runJobsMill', settings.runJobsMill, intervals);
        updateCurrentText('getMillData', settings.getMillData, intervals);
      }
    } catch (error) {
      console.error('Error loading current settings:', error);
      addLog('Error loading current settings: ' + error.message);
    }
  }

  // Add change listeners to the selects
  document.getElementById('runJobsMill').addEventListener('change', (e) => {
    const response = fetch('/api/grading/get-cron-settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          updateCurrentText('runJobsMill', e.target.value, data.data.intervals);
        }
      });
  });

  document.getElementById('getMillData').addEventListener('change', (e) => {
    const response = fetch('/api/grading/get-cron-settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          updateCurrentText('getMillData', e.target.value, data.data.intervals);
        }
      });
  });

  cronSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
      runJobsMill: document.getElementById('runJobsMill').value,
      getMillData: document.getElementById('getMillData').value,
    };

    try {
      const response = await fetch('/api/grading/update-cron-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        addLog('Cron settings updated successfully');
        // Reload current settings to update displays
        await loadCurrentSettings();
      } else {
        addLog('Error updating cron settings: ' + data.error);
      }
    } catch (error) {
      addLog('Error: ' + error.message);
    }
  });

  // Load current settings when page loads
  loadCurrentSettings();
});
