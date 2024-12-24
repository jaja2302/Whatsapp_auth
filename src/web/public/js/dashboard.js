class Dashboard {
  constructor() {
    this.socket = io({
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });
    this.setupSocketHandlers();
    this.setupEventListeners();
    this.startStatusCheck();

    // Add initial state check
    this.checkInitialState();
  }

  async checkInitialState() {
    try {
      const response = await fetch('/api/status');
      const status = await response.json();
      this.updateStatus(status);
      this.updateButtonStates(status.whatsappConnected);
    } catch (error) {
      console.error('Error checking initial state:', error);
    }
  }

  setupSocketHandlers() {
    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.addToLog('Connected to server');

      // Request QR code if we're in disconnected state
      const statusElement = document.getElementById('connection-status');
      if (statusElement.textContent.includes('Disconnected')) {
        this.socket.emit('request-qr');
      }
    });

    this.socket.on('request-new-qr', () => {
      this.addToLog('Requesting new QR code...');
      // Trigger reconnect to generate new QR
      this.handleReconnect();
    });

    this.socket.on('qr', (qrDataURL) => {
      console.log('Received QR code');
      const qrElement = document.getElementById('qr-code');
      qrElement.innerHTML = `<img src="${qrDataURL}" alt="QR Code" style="max-width: 300px;">`;
      this.addToLog('New QR code received. Please scan!');
    });

    this.socket.on('clear-qr', () => {
      document.getElementById('qr-code').innerHTML = '';
    });

    this.socket.on('connection-status', (status) => {
      console.log('Received status update:', status);
      this.updateStatus(status);
      this.updateButtonStates(status.whatsappConnected);
    });
  }

  setupEventListeners() {
    document
      .getElementById('reconnect-btn')
      .addEventListener('click', async () => {
        try {
          this.addToLog('Initiating reconnection...');
          const response = await fetch('/api/whatsapp/reconnect', {
            method: 'POST',
          });
          const data = await response.json();
          this.addToLog(data.message);
        } catch (error) {
          this.addToLog(`Error: ${error.message}`, 'error');
        }
      });

    document
      .getElementById('disconnect-btn')
      .addEventListener('click', async () => {
        if (
          confirm(
            'Are you sure? You will need to scan the QR code again to reconnect.'
          )
        ) {
          try {
            this.addToLog('Disconnecting WhatsApp...');
            const response = await fetch('/api/whatsapp/disconnect', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
            });
            const data = await response.json();
            this.addToLog(data.message);

            // Clear QR code on disconnect
            document.getElementById('qr-code').innerHTML = '';
          } catch (error) {
            this.addToLog(`Error: ${error.message}`, 'error');
          }
        }
      });

    document
      .getElementById('clear-logs-btn')
      .addEventListener('click', () => this.clearLogs());
  }

  updateButtonStates(isConnected) {
    const reconnectBtn = document.getElementById('reconnect-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');

    console.log('Updating button states, connected:', isConnected);

    if (isConnected) {
      // When Connected:
      reconnectBtn.disabled = true;
      reconnectBtn.classList.add('btn-secondary');
      reconnectBtn.classList.remove('btn-primary');

      disconnectBtn.disabled = false;
      disconnectBtn.classList.add('btn-danger');
      disconnectBtn.classList.remove('btn-secondary');
    } else {
      // When Disconnected:
      reconnectBtn.disabled = false;
      reconnectBtn.classList.add('btn-primary');
      reconnectBtn.classList.remove('btn-secondary');

      disconnectBtn.disabled = true;
      disconnectBtn.classList.add('btn-secondary');
      disconnectBtn.classList.remove('btn-danger');
    }
  }

  updateStatus(status) {
    const statusElement = document.getElementById('connection-status');
    if (status.whatsappConnected) {
      statusElement.innerHTML =
        '<span class="badge bg-success">Connected</span>';
      document.getElementById('qr-code').innerHTML = '';
    } else if (status.reconnecting) {
      statusElement.innerHTML =
        '<span class="badge bg-warning">Reconnecting...</span>';
      if (status.error) {
        this.addToLog(`Connection error: ${status.error}`, 'warning');
      }
    } else {
      statusElement.innerHTML =
        '<span class="badge bg-danger">Disconnected</span>';
      if (status.error) {
        this.addToLog(`Connection error: ${status.error}`, 'error');
      }
    }

    // Update queue status
    if (status.queueStatus) {
      document.getElementById('queue-status').innerHTML = `
        <div>Status: ${
          status.queueStatus.isPaused
            ? '<span class="badge bg-warning">Paused</span>'
            : '<span class="badge bg-success">Running</span>'
        }
        </div>
        <div class="mt-2">
          <span class="badge bg-primary">Total: ${status.queueStatus.total}</span>
          <span class="badge bg-success">Completed: ${status.queueStatus.completed}</span>
          <span class="badge bg-danger">Failed: ${status.queueStatus.failed}</span>
        </div>
      `;
    }
  }

  addToLog(message, type = 'info') {
    const logContainer = document.getElementById('log-container');
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    const timestamp = new Date().toLocaleTimeString();
    logEntry.innerHTML = `<span class="log-time">${timestamp}</span><span class="log-message">${message}</span>`;
    logContainer.insertBefore(logEntry, logContainer.firstChild);
  }

  clearLogs() {
    document.getElementById('log-container').innerHTML = '';
    this.addToLog('Logs cleared');
  }

  startStatusCheck() {
    setInterval(async () => {
      try {
        const response = await fetch('/api/status');
        const status = await response.json();
        this.updateStatus(status);
      } catch (error) {
        console.error('Error checking status:', error);
      }
    }, 5000);
  }

  async handleReconnect() {
    try {
      this.addToLog('Initiating reconnection...');
      const response = await fetch('/api/whatsapp/reconnect', {
        method: 'POST',
      });
      const data = await response.json();
      this.addToLog(data.message);
    } catch (error) {
      this.addToLog(`Error: ${error.message}`, 'error');
    }
  }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
  new Dashboard();
});
