class Dashboard {
  constructor() {
    // Initialize program controls
    this.programs = ['smartlabs', 'izinkebun', 'grading', 'taksasi'];

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

    this.setupEventListeners();
    this.loadInitialStatus();
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
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const dashboard = new Dashboard();
});
