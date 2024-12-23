// Remove socket initialization since it's now global
// Just keep the event listeners and functions

socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

// Function to add logs to the log container
function addToLog(message, type) {
  const logContainer = document.getElementById('log-container');
  if (logContainer) {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;

    const timestamp = new Date().toLocaleTimeString();
    logEntry.innerHTML = `
      <span class="log-time">${timestamp}</span>
      <span class="log-message">${message}</span>
    `;

    logContainer.appendChild(logEntry);

    // Keep only last 100 logs
    while (logContainer.children.length > 100) {
      logContainer.removeChild(logContainer.firstChild);
    }

    // Auto-scroll to bottom
    logContainer.scrollTop = logContainer.scrollHeight;
  }
}

// Listen for server logs
socket.on('server-log', (logData) => {
  addToLog(logData.message, logData.level);
});

// Listen for console logs
socket.on('console-log', (message) => {
  addToLog(message, 'info');
});

// Listen for error logs
socket.on('error-log', (message) => {
  addToLog(message, 'error');
});
