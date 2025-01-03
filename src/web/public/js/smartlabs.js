document.addEventListener('DOMContentLoaded', function () {
  const socket = io();

  // Elements
  const statusElement = document.getElementById('smartlabs-status');
  const statusIndicator = document.getElementById('status-indicator');
  const logsContainer = document.getElementById('smartlabs-logs');
  const toggleButton = document.getElementById('toggle-smartlabs');
  const clearLogsButton = document.getElementById('clear-logs');
  const notificationsTodayElement = document.getElementById(
    'notifications-today'
  );
  const successRateTodayElement = document.getElementById('success-rate-today');

  let isRunning = false;

  // Connect to WebSocket
  socket.on('connect', () => {
    console.log('Connected to server');
    // Request initial status
    socket.emit('get-smartlabs-status');
  });

  // Update program status display
  function updateProgramStatus(running) {
    isRunning = running;

    // Update button
    toggleButton.textContent = running ? 'Stop Program' : 'Start Program';
    toggleButton.className = `px-4 py-2 rounded-md font-medium transition-colors duration-150 ${
      running
        ? 'bg-red-500 hover:bg-red-600 text-white'
        : 'bg-green-500 hover:bg-green-600 text-white'
    }`;

    // Update status text and indicator
    statusElement.textContent = running ? 'Program Running' : 'Program Stopped';
    statusElement.className = `text-lg font-medium ${
      running ? 'text-green-600' : 'text-red-600'
    }`;

    // Update status indicator dot
    statusIndicator.className = `h-3 w-3 rounded-full ${
      running ? 'bg-green-500' : 'bg-red-500'
    }`;
  }

  // Toggle button click handler
  toggleButton.addEventListener('click', async () => {
    try {
      const endpoint = isRunning
        ? '/api/smartlabs/stop'
        : '/api/smartlabs/start';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to toggle program status');
      }

      const data = await response.json();
      updateProgramStatus(data.running);
    } catch (error) {
      console.error('Error toggling program:', error);
    }
  });

  // Clear logs button click handler
  clearLogsButton.addEventListener('click', () => {
    logsContainer.innerHTML = '';
  });

  // Listen for smartlabs status updates
  socket.on('smartlabs-status', (data) => {
    updateProgramStatus(data.running);
  });

  // Listen for statistics updates
  socket.on('smartlabs-stats', (data) => {
    notificationsTodayElement.textContent = data.notificationsToday;
    successRateTodayElement.textContent = `${data.successRateToday}%`;
  });

  // Listen for new logs
  socket.on('log-smartlabs', (data) => {
    const logEntry = document.createElement('div');
    logEntry.className = 'p-2 border-b border-gray-100';

    const message = Array.isArray(data.message)
      ? data.message.join(' ')
      : data.message;

    logEntry.textContent = `${data.timestamp} - ${message}`;

    // Add color based on log level
    if (data.level === 'error') {
      logEntry.classList.add('text-red-600');
    } else if (data.level === 'warn') {
      logEntry.classList.add('text-yellow-600');
    }

    logsContainer.insertBefore(logEntry, logsContainer.firstChild);

    // Limit the number of log entries
    while (logsContainer.children.length > 100) {
      logsContainer.removeChild(logsContainer.lastChild);
    }
  });

  // Add initial status fetch
  async function fetchInitialStatus() {
    try {
      const response = await fetch('/api/smartlabs/get-status');
      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }
      const data = await response.json();
      updateProgramStatus(data.running);
    } catch (error) {
      console.error('Error fetching initial status:', error);
    }
  }

  // Call this when page loads
  fetchInitialStatus();
});
