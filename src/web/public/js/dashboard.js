class Dashboard {
  constructor() {
    // Initialize all button references
    this.buttons = {
      reconnect: document.getElementById('reconnect-btn'),
      disconnect: document.getElementById('disconnect-btn'),
      startQueue: document.getElementById('start-queue'),
      pauseQueue: document.getElementById('pause-queue'),
      clearLogs: document.getElementById('clear-logs'),
    };

    // Initialize container references
    this.containers = {
      logContainer: document.getElementById('activity-logs'),
      qrCode: document.getElementById('qr-code'),
      connectionStatus: document.getElementById('connection-status'),
      queueStatus: document.getElementById('queue-status'),
    };

    // Make sure critical elements exist before continuing
    if (!this.validateElements()) {
      console.error('Required elements not found in DOM');
      return;
    }

    this.socket = io({
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    this.setupSocketHandlers();
    this.setupEventListeners();
    this.startStatusCheck();
  }

  validateElements() {
    // Check critical elements
    const criticalElements = [
      'connectionStatus',
      'queueStatus',
      'logContainer',
    ];
    return criticalElements.every((id) => {
      if (!this.containers[id]) {
        console.error(`Critical element "${id}" not found in DOM`);
        return false;
      }
      return true;
    });
  }

  async checkInitialState() {
    try {
      const response = await fetch('/api/status');
      const status = await response.json();
      this.updateStatus(status);
      this.updateButtonStates(status.whatsappConnected);
    } catch (error) {
      this.addToLog(`Error checking initial state: ${error.message}`, 'error');
    }
  }

  setupSocketHandlers() {
    this.socket.on('connect', () => {
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
      const qrElement = document.getElementById('qr-code');
      qrElement.innerHTML = `<img src="${qrDataURL}" alt="QR Code" style="max-width: 300px;">`;
      this.addToLog('New QR code received. Please scan!');
    });

    this.socket.on('clear-qr', () => {
      document.getElementById('qr-code').innerHTML = '';
    });

    this.socket.on('connection-status', (status) => {
      this.updateStatus(status);
      this.updateButtonStates(status.whatsappConnected);
    });

    // Listen specifically for WhatsApp logs
    this.socket.on('log-whatsapp', (data) => {
      this.addToLog(data.message, data.level);
    });
  }

  setupEventListeners() {
    // Only set up listeners for buttons that exist
    if (this.buttons.reconnect) {
      this.buttons.reconnect.addEventListener('click', () =>
        this.handleReconnect()
      );
    }

    if (this.buttons.disconnect) {
      this.buttons.disconnect.addEventListener('click', () =>
        this.handleDisconnect()
      );
    }

    if (this.buttons.clearLogs) {
      this.buttons.clearLogs.addEventListener('click', () => this.clearLogs());
    }

    if (this.buttons.startQueue) {
      this.buttons.startQueue.addEventListener('click', () =>
        this.toggleQueue(true)
      );
    }

    if (this.buttons.pauseQueue) {
      this.buttons.pauseQueue.addEventListener('click', () =>
        this.toggleQueue(false)
      );
    }
  }

  updateButtonStates(isConnected) {
    if (!this.buttons.reconnect || !this.buttons.disconnect) return;

    if (isConnected) {
      this.buttons.reconnect.disabled = true;
      this.buttons.reconnect.classList.add('btn-secondary');
      this.buttons.reconnect.classList.remove('btn-primary');

      this.buttons.disconnect.disabled = false;
      this.buttons.disconnect.classList.add('btn-danger');
      this.buttons.disconnect.classList.remove('btn-secondary');
    } else {
      this.buttons.reconnect.disabled = false;
      this.buttons.reconnect.classList.add('btn-primary');
      this.buttons.reconnect.classList.remove('btn-secondary');

      this.buttons.disconnect.disabled = true;
      this.buttons.disconnect.classList.add('btn-secondary');
      this.buttons.disconnect.classList.remove('btn-danger');
    }
  }

  updateQueueButtons(isPaused) {
    if (!this.buttons.startQueue || !this.buttons.pauseQueue) return;

    this.buttons.startQueue.disabled = !isPaused;
    this.buttons.pauseQueue.disabled = isPaused;
  }

  updateStatus(status) {
    if (!status) return;

    if (this.containers.connectionStatus) {
      if (status.whatsappConnected) {
        this.containers.connectionStatus.innerHTML =
          '<span class="badge bg-success">Connected</span>';
        if (this.containers.qrCode) {
          this.containers.qrCode.innerHTML = '';
        }
      } else if (status.reconnecting) {
        this.containers.connectionStatus.innerHTML =
          '<span class="badge bg-warning">Reconnecting...</span>';
      } else {
        this.containers.connectionStatus.innerHTML =
          '<span class="badge bg-danger">Disconnected</span>';
      }
    }

    this.updateButtonStates(status.whatsappConnected);

    if (status.queueStatus && this.containers.queueStatus) {
      this.containers.queueStatus.innerHTML = `
        <div>Status: ${
          status.queueStatus.isPaused
            ? '<span class="badge bg-warning">Paused</span>'
            : '<span class="badge bg-success">Running</span>'
        }</div>
        <div class="mt-2">
          <span class="badge bg-primary">Total: ${status.queueStatus.total}</span>
          <span class="badge bg-success">Completed: ${status.queueStatus.completed}</span>
          <span class="badge bg-danger">Failed: ${status.queueStatus.failed}</span>
        </div>
      `;
      this.updateQueueButtons(status.queueStatus.isPaused);
    }
  }

  addToLog(message, level = 'info') {
    if (!this.containers.logContainer) return;

    const logEntry = document.createElement('div');
    logEntry.className = 'p-2 border-b border-gray-100';
    const timestamp = new Date().toLocaleTimeString();
    logEntry.textContent = `${timestamp} - ${message}`;

    // Add color based on log level
    if (level === 'error') {
      logEntry.classList.add('text-red-600');
    } else if (level === 'warn') {
      logEntry.classList.add('text-yellow-600');
    }

    this.containers.logContainer.insertBefore(
      logEntry,
      this.containers.logContainer.firstChild
    );

    // Limit the number of log entries to prevent memory issues
    while (this.containers.logContainer.children.length > 100) {
      this.containers.logContainer.removeChild(
        this.containers.logContainer.lastChild
      );
    }
  }

  clearLogs() {
    if (this.containers.logContainer) {
      this.containers.logContainer.innerHTML = '';
      this.addToLog('Logs cleared');
    }
  }

  startStatusCheck() {
    setInterval(async () => {
      try {
        const response = await fetch('/api/status');
        const status = await response.json();
        this.updateStatus(status);
      } catch (error) {
        this.addToLog(`Error checking status: ${error.message}`, 'error');
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

  async handleDisconnect() {
    try {
      this.addToLog('Initiating disconnect...');
      const response = await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
      });
      const data = await response.json();
      this.addToLog(data.message);
    } catch (error) {
      this.addToLog(`Error: ${error.message}`, 'error');
    }
  }

  async toggleQueue(start) {
    try {
      const response = await fetch(`/api/queue/${start ? 'start' : 'pause'}`, {
        method: 'POST',
      });
      const data = await response.json();
      this.addToLog(data.message);
    } catch (error) {
      this.addToLog(`Error: ${error.message}`, 'error');
    }
  }
}

// Wait for DOM to be ready before initializing
document.addEventListener('DOMContentLoaded', () => {
  new Dashboard();
});
