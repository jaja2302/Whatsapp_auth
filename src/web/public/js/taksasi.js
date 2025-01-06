document.addEventListener('DOMContentLoaded', function () {
  const socket = io();
  const taksasiLogs = document.getElementById('taksasi-logs');
  const programStatusDiv = document.getElementById('program-status');

  // Helper function untuk flatten object
  function formatLogMessage(message) {
    if (typeof message === 'object') {
      if (Array.isArray(message)) {
        // Jika array, format setiap item
        return message
          .map((item) => {
            if (typeof item === 'object') {
              return Object.entries(item)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
            }
            return item;
          })
          .join('\n');
      } else {
        // Jika single object
        return Object.entries(message)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
      }
    }
    return message;
  }

  // Helper function untuk add logs dengan format yang lebih baik
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

    taksasiLogs.insertBefore(logEntry, taksasiLogs.firstChild);

    while (taksasiLogs.children.length > 100) {
      taksasiLogs.removeChild(taksasiLogs.lastChild);
    }
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

    let formattedText = displayText;
    if (typeof displayText === 'string') {
      formattedText = displayText
        .replace(/min/g, ' minute')
        .replace(/hour/g, ' hour');
    }

    currentText.textContent = `Current: Every ${formattedText}`;
  }

  // Populate select options
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

  // Load current settings
  async function loadCurrentSettings() {
    try {
      const response = await fetch('/api/taksasi/get-cron-settings');
      const data = await response.json();

      if (data.success && data.data) {
        const { settings, intervals } = data.data;

        if (settings && intervals) {
          populateSelectOptions('sendfailcronjob', intervals);

          if (settings.sendfailcronjob) {
            document.getElementById('sendfailcronjob').value =
              settings.sendfailcronjob;
            updateCurrentText(
              'sendfailcronjob',
              settings.sendfailcronjob,
              intervals
            );
          }
        }
      } else {
        addLog('Failed to load cron settings', 'error');
      }
    } catch (error) {
      addLog('Error loading current settings: ' + error.message, 'error');
    }
  }

  // Handle form submission
  const cronSettingsForm = document.getElementById('cron-settings-form');
  cronSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
      sendfailcronjob: document.getElementById('sendfailcronjob').value,
    };

    try {
      const response = await fetch('/api/taksasi/update-cron-settings', {
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

  // Update status display
  async function updateCronStatus() {
    try {
      const response = await fetch('/api/taksasi/get-cron-status');
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

        Object.entries(jobs).forEach(([jobName, status]) => {
          const statusElement = document.getElementById(`status-${jobName}`);
          if (statusElement) {
            statusElement.innerHTML = `Status: <span class="${status === 'active' ? 'text-green-600' : 'text-red-600'} font-medium">${status}</span>`;
          }
        });
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

  // Setup job controls
  const jobName = 'sendfailcronjob';
  const startBtn = document.getElementById(`start-${jobName}`);
  const stopBtn = document.getElementById(`stop-${jobName}`);

  startBtn.addEventListener('click', async () => {
    try {
      startBtn.disabled = true;
      const response = await fetch(`/api/taksasi/jobs/${jobName}/start`, {
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
      const response = await fetch(`/api/taksasi/jobs/${jobName}/stop`, {
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

  // Listen for taksasi logs dengan format yang lebih baik
  socket.on('log-taksasi', (data) => {
    const message = Array.isArray(data.message)
      ? data.message.map(formatLogMessage).join(' ')
      : formatLogMessage(data.message);
    addLog(message, data.level);
  });

  // Initial loads
  loadCurrentSettings();
  updateCronStatus();
});
