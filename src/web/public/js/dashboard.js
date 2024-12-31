class Dashboard {
  constructor() {
    // Initialize all button references
    this.buttons = {
      reconnect: document.getElementById('reconnect-btn'),
      disconnect: document.getElementById('disconnect-btn'),
      startQueue: document.getElementById('start-queue'),
      pauseQueue: document.getElementById('pause-queue'),
      clearLogs: document.getElementById('clear-logs'),
      getParticipants: document.getElementById('get-participants'),
    };

    // Initialize container references
    this.containers = {
      logContainer: document.getElementById('activity-logs'),
      qrCode: document.getElementById('qr-code'),
      connectionStatus: document.getElementById('connection-status'),
      queueStatus: document.getElementById('queue-status'),
      failedJobs: document.getElementById('failed-jobs'),
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

    // Add method to load failed jobs
    this.loadFailedJobs();

    // Reload failed jobs every 10 seconds
    setInterval(() => this.loadFailedJobs(), 10000);
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

    if (this.buttons.getParticipants) {
      this.buttons.getParticipants.addEventListener('click', () =>
        this.handleGetParticipants()
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

    // Show both buttons but disable/enable based on state
    this.buttons.startQueue.style.display = 'inline-block';
    this.buttons.pauseQueue.style.display = 'inline-block';

    // Enable/disable based on current state
    this.buttons.startQueue.disabled = !isPaused; // Disable start if not paused
    this.buttons.pauseQueue.disabled = isPaused; // Disable pause if paused

    // Update button appearance based on disabled state
    this.buttons.startQueue.classList.toggle('opacity-50', !isPaused);
    this.buttons.pauseQueue.classList.toggle('opacity-50', isPaused);
  }

  updateStatus(status) {
    if (!status) return;

    if (this.containers.connectionStatus) {
      if (status.whatsappConnected) {
        this.containers.connectionStatus.innerHTML =
          '<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-200 text-green-800">Connected</span>';
        if (this.containers.qrCode) {
          this.containers.qrCode.innerHTML = '';
        }
      } else if (status.reconnecting) {
        this.containers.connectionStatus.innerHTML =
          '<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-200 text-yellow-800">Reconnecting...</span>';
      } else {
        this.containers.connectionStatus.innerHTML =
          '<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-200 text-red-800">Disconnected</span>';
      }
    }

    if (status.queueStatus && this.containers.queueStatus) {
      const statusClass = status.queueStatus.isPaused
        ? 'bg-yellow-200 text-yellow-800'
        : 'bg-green-200 text-green-800';
      this.containers.queueStatus.innerHTML = `
        <div class="mb-3">
          Status: 
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusClass}">
            ${status.queueStatus.isPaused ? 'Paused' : 'Running'}
          </span>
        </div>
        <div class="space-x-2">
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            Total: ${status.queueStatus.total}
          </span>
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            Completed: ${status.queueStatus.completed}
          </span>
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            Failed: ${status.queueStatus.failed}
          </span>
        </div>
        <div class="mt-4 space-x-2">
          <button
            id="start-queue"
            class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
            ${status.queueStatus.isPaused ? '' : 'disabled'}
          >
            Start Queue
          </button>
          <button
            id="pause-queue"
            class="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
            ${status.queueStatus.isPaused ? 'disabled' : ''}
          >
            Pause Queue
          </button>
        </div>
      `;

      // Re-attach event listeners to new buttons
      const startQueueBtn = document.getElementById('start-queue');
      const pauseQueueBtn = document.getElementById('pause-queue');

      if (startQueueBtn) {
        startQueueBtn.addEventListener('click', () => this.toggleQueue(true));
      }
      if (pauseQueueBtn) {
        pauseQueueBtn.addEventListener('click', () => this.toggleQueue(false));
      }

      // Update button states
      this.buttons.startQueue = startQueueBtn;
      this.buttons.pauseQueue = pauseQueueBtn;
      this.updateQueueButtons(status.queueStatus.isPaused);
    }

    this.updateButtonStates(status.whatsappConnected);
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

  async handleGetParticipants() {
    try {
      this.addToLog('Fetching group participants...');
      const response = await fetch('/api/whatsapp/get-participants');
      const data = await response.json();

      const participantsList = document.getElementById('participants-list');
      participantsList.innerHTML = ''; // Clear existing content

      // Convert the participants object into a more readable format
      Object.entries(data).forEach(([groupId, group]) => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'mb-4 p-3 border rounded';

        const groupName = group.subject || groupId;
        groupDiv.innerHTML = `
                <h3 class="font-bold mb-2">${groupName}</h3>
                <p class="text-sm text-gray-600">ID: ${groupId}</p>
                <p class="text-sm text-gray-600">Participants: ${Object.keys(group.participants).length}</p>
            `;

        participantsList.appendChild(groupDiv);
      });

      this.addToLog('Group participants fetched successfully');
    } catch (error) {
      this.addToLog(`Error fetching participants: ${error.message}`, 'error');
    }
  }

  async loadFailedJobs() {
    try {
      const response = await fetch('/api/failed-jobs');
      const failedJobs = await response.json();
      this.updateFailedJobsDisplay(failedJobs);
    } catch (error) {
      this.addToLog('Error loading failed jobs: ' + error.message, 'error');
    }
  }

  updateFailedJobsDisplay(failedJobs) {
    if (!this.containers.failedJobs) return;

    this.containers.failedJobs.innerHTML = `
      <div class="max-h-[500px] overflow-y-auto">
        <div class="sticky top-0 z-10 bg-white py-2 space-y-2">
          <div class="flex justify-between items-center">
            <div class="relative flex-1 max-w-xs">
              <input 
                type="text" 
                id="failed-jobs-search" 
                placeholder="Search failed jobs..." 
                class="w-full pl-8 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
              <div class="absolute left-3 top-2.5 text-gray-400">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
              </div>
            </div>
            ${
              failedJobs.length > 0
                ? `
              <button id="clear-failed-jobs" 
                class="px-3 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50">
                Clear Failed Jobs
              </button>
            `
                : ''
            }
          </div>
        </div>

        ${
          failedJobs.length === 0
            ? `
          <div class="text-gray-500 text-center py-4">
            No failed jobs
          </div>
        `
            : `
          <div class="mt-2 overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50 sticky top-16">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Error</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200" id="failed-jobs-table-body">
                ${failedJobs
                  .map(
                    (job) => `
                  <tr class="failed-job-row">
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        ${job.type}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${new Date(job.failed_at).toLocaleString()}
                    </td>
                    <td class="px-6 py-4 text-sm text-red-600">
                      ${job.error.message}
                    </td>
                    <td class="px-6 py-4">
                      <button class="text-blue-600 hover:text-blue-800 text-sm" onclick="toggleData(this)">
                        Show Data
                      </button>
                      <pre class="hidden mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">${JSON.stringify(job.data, null, 2)}</pre>
                    </td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `
        }
      </div>
    `;

    // Add toggle data function
    window.toggleData = function (button) {
      const pre = button.nextElementSibling;
      const isHidden = pre.classList.contains('hidden');
      pre.classList.toggle('hidden');
      button.textContent = isHidden ? 'Hide Data' : 'Show Data';
    };

    // Add search functionality
    const searchInput = document.getElementById('failed-jobs-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('.failed-job-row');

        rows.forEach((row) => {
          const text = row.textContent.toLowerCase();
          row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
      });
    }

    // Add custom scrollbar styles
    const style = document.createElement('style');
    style.textContent = `
      #failed-jobs .overflow-y-auto::-webkit-scrollbar {
        width: 6px;
      }
      #failed-jobs .overflow-y-auto::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
      }
      #failed-jobs .overflow-y-auto::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 3px;
      }
      #failed-jobs .overflow-y-auto::-webkit-scrollbar-thumb:hover {
        background: #666;
      }
    `;
    document.head.appendChild(style);

    // Add event listener for clear button
    const clearFailedJobsBtn = document.getElementById('clear-failed-jobs');
    if (clearFailedJobsBtn) {
      clearFailedJobsBtn.addEventListener('click', async () => {
        try {
          const response = await fetch('/api/failed-jobs', {
            method: 'DELETE',
          });

          if (response.ok) {
            this.loadFailedJobs();
            this.addToLog('Failed jobs cleared successfully');
          } else {
            throw new Error('Failed to clear jobs');
          }
        } catch (error) {
          this.addToLog(
            'Error clearing failed jobs: ' + error.message,
            'error'
          );
        }
      });
    }
  }
}

// Wait for DOM to be ready before initializing
document.addEventListener('DOMContentLoaded', () => {
  new Dashboard();
});
