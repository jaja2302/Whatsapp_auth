class Dashboard {
  constructor() {
    // Initialize program controls
    this.programs = [
      'smartlabs',
      'izinkebun',
      'grading',
      'taksasi',
      'iot',
      'general',
    ];

    // Program specific elements
    this.programButtons = {};
    this.programStatuses = {};
    this.programIndicators = {};

    // Initialize program controls
    this.programs.forEach((program) => {
      this.programButtons[program] = document.getElementById(
        `toggle-${program}`
      );
      this.programStatuses[program] = document.getElementById(
        `${program}-status`
      );
      this.programIndicators[program] = document.getElementById(
        `${program}-indicator`
      );
    });

    // Add logs container reference
    this.activityLogs = document.getElementById('activity-logs');
    this.clearLogsBtn = document.getElementById('clear-logs');

    // Initialize socket connection
    this.socket = io();
    this.setupSocketListeners();

    this.setupEventListeners();
    this.loadInitialStatus();

    // Immediately check initial status
    this.checkInitialStatus();

    // Initialize containers including qrCode
    this.containers = {
      logContainer: document.getElementById('activity-logs'),
      qrCode: document.getElementById('qr-code'),
      connectionStatus: document.getElementById('connection-status'),
      queueStatus: document.getElementById('queue-status'),
    };
  }

  setupEventListeners() {
    // Add program control event listeners
    this.programs.forEach((program) => {
      const button = this.programButtons[program];
      if (button) {
        console.log(`Setting up listener for ${program}`);
        button.addEventListener('click', () => {
          console.log(`${program} button clicked`);
          this.toggleProgram(program);
        });
      }
    });

    // Add clear logs button handler
    this.clearLogsBtn.addEventListener('click', () => {
      this.clearLogs();
    });

    // Add disconnect button handler
    const disconnectBtn = document.getElementById('disconnect-btn');
    if (disconnectBtn) {
      console.log('Setting up disconnect button listener');
      disconnectBtn.addEventListener('click', async () => {
        console.log('Disconnect button clicked');
        await this.handleDisconnect();
      });
    }

    // Add reconnect button handler
    const reconnectBtn = document.getElementById('reconnect-btn');
    if (reconnectBtn) {
      console.log('Setting up reconnect button listener');
      reconnectBtn.addEventListener('click', async () => {
        console.log('Reconnect button clicked');
        await this.handleReconnect();
      });
    }

    // Add restart service button handler
    const restartServiceBtn = document.getElementById('restart-service-btn');
    if (restartServiceBtn) {
      restartServiceBtn.addEventListener('click', async () => {
        if (
          confirm(
            'Are you sure you want to restart the service? Please refresh your browser after a few seconds to see the changes.'
          )
        ) {
          try {
            const response = await fetch('/api/service/restart', {
              method: 'POST',
            });

            if (!response.ok) {
              throw new Error('Failed to restart service');
            }

            // Service will restart automatically
            this.addLog({
              level: 'info',
              timestamp: new Date().toISOString(),
              message:
                'Service restart initiated. Please refresh your browser after a few seconds.',
            });
          } catch (error) {
            console.error('Error restarting service:', error);
            this.addLog({
              level: 'error',
              timestamp: new Date().toISOString(),
              message: `Error restarting service: ${error.message}`,
            });
          }
        }
      });
    }
  }

  async loadInitialStatus() {
    // Load initial status for each program
    for (const program of this.programs) {
      try {
        const response = await fetch(`/api/program/${program}/status`);
        const data = await response.json();
        this.updateProgramStatus(program, data.running);
      } catch (error) {
        console.error(`Error loading ${program} status:`, error);
      }
    }
  }

  async toggleProgram(program) {
    try {
      console.log(`Toggling ${program}`);
      const button = this.programButtons[program];
      const isRunning = button.textContent.trim() === 'Stop Program';

      const endpoint = `/api/program/${program}/${isRunning ? 'stop' : 'start'}`;
      console.log(`Sending request to ${endpoint}`);

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
      console.log(`Response:`, data);

      this.updateProgramStatus(program, data.running);
    } catch (error) {
      console.error(`Error toggling ${program}:`, error);
    }
  }

  updateProgramStatus(program, running) {
    const button = this.programButtons[program];
    const status = this.programStatuses[program];
    const indicator = this.programIndicators[program];

    if (button && status && indicator) {
      // Update button
      button.textContent = running ? 'Stop Program' : 'Start Program';
      button.className = `px-4 py-2 rounded-md font-medium transition-colors duration-150 ${
        running
          ? 'bg-red-500 hover:bg-red-600 text-white'
          : 'bg-green-500 hover:bg-green-600 text-white'
      }`;

      // Update status text color
      status.className = `text-lg font-medium ${
        running ? 'text-green-600' : 'text-gray-600'
      }`;

      // Update indicator
      indicator.className = `h-3 w-3 rounded-full ${
        running ? 'bg-green-500' : 'bg-red-500'
      }`;
    }
  }

  setupSocketListeners() {
    // Listen for WhatsApp logs
    this.socket.on('log-whatsapp', (data) => {
      this.addLog(data);
    });

    // Listen for connection status updates
    this.socket.on('connection-status', (status) => {
      this.updateConnectionStatus(status);
    });
  }

  updateConnectionStatus(status) {
    const connectionStatus = document.getElementById('connection-status');
    if (!connectionStatus) return;

    let statusText = 'Disconnected';
    let statusClass = 'bg-red-200 text-red-800';

    if (status.reconnecting) {
      statusText = 'Reconnecting...';
      statusClass = 'bg-yellow-200 text-yellow-800';
    } else if (status.whatsappConnected) {
      statusText = 'Connected';
      statusClass = 'bg-green-200 text-green-800';
    }

    connectionStatus.innerHTML = `
      <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusClass}">
        ${statusText}
      </span>
    `;

    // Update button states
    const reconnectBtn = document.getElementById('reconnect-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');

    if (reconnectBtn) {
      reconnectBtn.disabled = status.whatsappConnected || status.reconnecting;
    }
    if (disconnectBtn) {
      disconnectBtn.disabled = !status.whatsappConnected;
    }
  }

  addLog(data) {
    if (!this.activityLogs) return;

    const logEntry = document.createElement('div');
    logEntry.className = 'p-2 border-b border-gray-100';

    // Format timestamp if it doesn't exist
    const timestamp = data.timestamp || new Date().toLocaleTimeString();

    // Check if the message is an array and join its elements
    const message = Array.isArray(data.message)
      ? data.message.join(' ')
      : data.message;

    logEntry.textContent = `${timestamp} - ${message}`;

    // Add color based on log level
    if (data.level === 'error') {
      logEntry.classList.add('text-red-600');
    } else if (data.level === 'warn') {
      logEntry.classList.add('text-yellow-600');
    }

    this.activityLogs.insertBefore(logEntry, this.activityLogs.firstChild);

    // Limit the number of log entries
    while (this.activityLogs.children.length > 100) {
      this.activityLogs.removeChild(this.activityLogs.lastChild);
    }
  }

  clearLogs() {
    // Clear all logs from the container
    while (this.activityLogs.firstChild) {
      this.activityLogs.removeChild(this.activityLogs.firstChild);
    }
  }

  async checkInitialStatus() {
    try {
      const response = await fetch('/api/status');
      const status = await response.json();
      this.updateConnectionStatus(status);
    } catch (error) {
      console.error('Error checking initial status:', error);
    }
  }

  async handleReconnect() {
    try {
      this.addLog({
        timestamp: new Date().toLocaleTimeString(),
        message: 'Initiating reconnection...',
        level: 'info',
      });

      // Clear any existing QR code
      if (this.containers.qrCode) {
        this.containers.qrCode.innerHTML = '';
      }

      const response = await fetch('/api/whatsapp/reconnect', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to initiate reconnection');
      }

      const data = await response.json();
      this.addLog({
        timestamp: new Date().toLocaleTimeString(),
        message: data.message,
        level: 'info',
      });

      // Update UI to show reconnecting state
      this.updateConnectionStatus({
        whatsappConnected: false,
        reconnecting: true,
      });
    } catch (error) {
      console.error('Reconnect error:', error);
      this.addLog({
        timestamp: new Date().toLocaleTimeString(),
        message: `Error during reconnection: ${error.message}`,
        level: 'error',
      });
    }
  }

  async handleDisconnect() {
    try {
      this.addLog('Initiating disconnect...');
      const response = await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      const data = await response.json();
      this.addLog(data.message);

      // Update UI to show disconnected state
      this.updateConnectionStatus({
        whatsappConnected: false,
        reconnecting: false,
      });

      // Clear QR code if present
      if (this.containers.qrCode) {
        this.containers.qrCode.innerHTML = '';
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      this.addLog(`Error during disconnect: ${error.message}`, 'error');
    }
  }

  setupSocketHandlers() {
    this.socket.on('connect', () => {
      this.addLog({
        timestamp: new Date().toLocaleTimeString(),
        message: 'Connected to server',
        level: 'info',
      });
    });

    this.socket.on('qr', (qrDataURL) => {
      console.log('QR code received');
      if (this.containers.qrCode) {
        this.containers.qrCode.innerHTML = `
          <img src="${qrDataURL}" alt="QR Code" style="max-width: 300px;">
        `;
        this.addLog({
          timestamp: new Date().toLocaleTimeString(),
          message: 'New QR code received. Please scan!',
          level: 'info',
        });
      } else {
        console.error('QR code container not found');
      }
    });

    this.socket.on('clear-qr', () => {
      if (this.containers.qrCode) {
        this.containers.qrCode.innerHTML = '';
      }
    });

    this.socket.on('connection-status', (status) => {
      this.updateConnectionStatus(status);
      if (status.error) {
        this.addLog({
          timestamp: new Date().toLocaleTimeString(),
          message: `Connection error: ${status.error}`,
          level: 'error',
        });
      }
    });

    this.socket.on('log-whatsapp', (data) => {
      this.addLog(data);
    });
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const dashboard = new Dashboard();
});
