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
  function addLog(message, level = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = 'p-2 border-b border-gray-100';
    logEntry.textContent = `${new Date().toLocaleTimeString()} - ${message}`;

    // Add color based on log level
    if (level === 'error') {
      logEntry.classList.add('text-red-600');
    } else if (level === 'warn') {
      logEntry.classList.add('text-yellow-600');
    }

    gradingLogs.insertBefore(logEntry, gradingLogs.firstChild);

    // Limit the number of log entries
    while (gradingLogs.children.length > 100) {
      gradingLogs.removeChild(gradingLogs.lastChild);
    }
  }

  // Add this function to update the "Current:" text under the selects
  function updateCurrentText(selectId, value, intervals) {
    const select = document.getElementById(selectId);
    const currentText = select.parentElement.querySelector('p');

    // Find the display text for the current value
    let displayText = value; // Default to the value itself

    // Only try to find matching interval if intervals exist
    if (intervals) {
      const matchingInterval = Object.entries(intervals).find(
        ([key, val]) => val === value
      );
      if (matchingInterval) {
        displayText = matchingInterval[0];
      }
    }

    // Safely format the display text
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
    if (!select || !intervals) return; // Guard clause

    select.innerHTML = ''; // Clear existing options

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
    if (!select || !timezones) return; // Guard clause

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

      if (data.success && data.data) {
        const { settings, intervals, timezones, timezone } = data.data;

        // Guard against undefined values
        if (settings && intervals) {
          // Populate select options
          populateSelectOptions('runJobsMill', intervals);
          populateSelectOptions('getMillData', intervals);

          // Set current values if they exist
          if (settings.runJobsMill) {
            document.getElementById('runJobsMill').value = settings.runJobsMill;
            updateCurrentText('runJobsMill', settings.runJobsMill, intervals);
          }

          if (settings.getMillData) {
            document.getElementById('getMillData').value = settings.getMillData;
            updateCurrentText('getMillData', settings.getMillData, intervals);
          }
        }

        // Handle timezone separately
        if (timezones && timezone) {
          populateTimezoneOptions(timezones);
          document.getElementById('timezone').value = timezone;
        }
      }
    } catch (error) {
      logger.error.grading('Error loading current settings:', error);
      addLog('Error loading current settings: ' + error.message, 'error');
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
      timezone: document.getElementById('timezone').value,
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
        await loadCurrentSettings();
      } else {
        addLog('Error updating cron settings: ' + data.error, 'error');
      }
    } catch (error) {
      addLog('Error: ' + error.message, 'error');
    }
  });

  // Load current settings when page loads
  loadCurrentSettings();

  // Listen specifically for grading logs
  socket.on('log-grading', (data) => {
    const logEntry = document.createElement('div');
    logEntry.className = 'p-2 border-b border-gray-100';
    logEntry.textContent = `${data.timestamp} - ${data.message}`;

    // Add color based on log level
    if (data.level === 'error') {
      logEntry.classList.add('text-red-600');
    } else if (data.level === 'warn') {
      logEntry.classList.add('text-yellow-600');
    }

    gradingLogs.insertBefore(logEntry, gradingLogs.firstChild);

    // Limit the number of log entries to prevent memory issues
    while (gradingLogs.children.length > 100) {
      gradingLogs.removeChild(gradingLogs.lastChild);
    }
  });

  const groupList = document.getElementById('group-list');
  const addGroupBtn = document.getElementById('add-group');
  const saveGroupsBtn = document.getElementById('save-groups');

  // Load existing groups
  async function loadGroups() {
    try {
      const response = await fetch('/api/grading/get-group-settings');
      const data = await response.json();

      if (data.success) {
        groupList.innerHTML = '';
        Object.entries(data.data).forEach(([key, value]) => {
          addGroupRow(key, value);
        });
      }
    } catch (error) {
      addLog('Error loading groups: ' + error.message, 'error');
    }
  }

  // Add a new group row
  function addGroupRow(name = '', id = '') {
    const row = document.createElement('div');
    row.className = 'flex items-center space-x-2 group-row';
    row.innerHTML = `
      <input type="text" placeholder="Group Name" value="${name}" 
        class="group-name w-1/3 px-2 py-1 border rounded">
      <input type="text" placeholder="Group ID" value="${id}" 
        class="group-id w-1/2 px-2 py-1 border rounded">
      <button class="delete-group px-2 py-1 text-red-500 hover:text-red-700">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `;

    row.querySelector('.delete-group').addEventListener('click', () => {
      row.remove();
    });

    groupList.appendChild(row);
  }

  // Add new group button
  addGroupBtn.addEventListener('click', () => {
    addGroupRow();
  });

  // Save groups
  saveGroupsBtn.addEventListener('click', async () => {
    const groups = {};
    document.querySelectorAll('.group-row').forEach((row) => {
      const name = row.querySelector('.group-name').value.trim();
      const id = row.querySelector('.group-id').value.trim();
      if (name && id) {
        groups[name] = id;
      }
    });

    try {
      const response = await fetch('/api/grading/update-group-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ groups }),
      });

      const data = await response.json();
      if (data.success) {
        addLog('Group settings saved successfully');
        loadGroups(); // Reload to ensure consistency
      } else {
        addLog('Error saving groups: ' + data.error, 'error');
      }
    } catch (error) {
      addLog('Error: ' + error.message, 'error');
    }
  });

  // Load groups on page load
  loadGroups();
});