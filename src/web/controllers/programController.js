const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const {
  connectToWhatsApp,
  toggleMessageHandler,
  getMessageHandlerStates,
} = require('../../services/whatsappService');
const cron = require('node-cron');
const GradingMill = require('../programs/grading/gradingMill');
const GRADING_TYPES = require('../programs/grading/types');

class ProgramController {
  constructor() {
    this.schedules = new Map();
    this.loadSchedules();

    // Initialize mill program states
    global.millProgramStates = {
      get_mill_data: false,
      run_jobs_mill: false,
    };
  }

  async loadSchedules() {
    try {
      const data = await fs.readFile(
        path.join(__dirname, '../data/schedules.json'),
        'utf8'
      );
      const schedules = JSON.parse(data);
      schedules.forEach((schedule) => {
        this.createSchedule(
          schedule.id,
          schedule.program,
          schedule.cronExpression
        );
      });
    } catch (error) {
      console.log('No existing schedules found');
    }
  }

  async saveSchedules() {
    const schedules = Array.from(this.schedules.values()).map((s) => ({
      id: s.id,
      program: s.program,
      cronExpression: s.cronExpression,
    }));
    await fs.writeFile(
      path.join(__dirname, '../data/schedules.json'),
      JSON.stringify(schedules, null, 2)
    );
  }

  createSchedule(id, program, cronExpression) {
    const job = cron.schedule(cronExpression, () => {
      this.runProgram({ params: { programName: program } }, null);
    });

    this.schedules.set(id, {
      id,
      program,
      cronExpression,
      job,
    });
  }

  async scheduleProgram(req, res) {
    try {
      const { program, cronExpression } = req.body;
      const id = Date.now().toString();

      this.createSchedule(id, program, cronExpression);
      await this.saveSchedules();

      res.json({
        success: true,
        schedule: {
          id,
          program,
          cronExpression,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getProgramSchedules(req, res) {
    try {
      const schedules = Array.from(this.schedules.values()).map((s) => ({
        id: s.id,
        program: s.program,
        cronExpression: s.cronExpression,
      }));
      res.json({ success: true, schedules });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async deleteSchedule(req, res) {
    try {
      const { id } = req.params;
      const schedule = this.schedules.get(id);
      if (schedule) {
        schedule.job.stop();
        this.schedules.delete(id);
        await this.saveSchedules();
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, message: 'Schedule not found' });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getStatus(req, res) {
    try {
      const status = {
        whatsappConnected: !!global.sock?.user,
        activePrograms: {
          taksasi: true,
          smartlabs: true,
          iot: true,
          grading: true,
        },
      };
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async runProgram(req, res) {
    try {
      const { programName } = req.params;
      let result;

      switch (programName) {
        case 'taksasi':
          result = await Generateandsendtaksasi();
          break;
        case 'smartlabs':
          result = await helperfunctionSmartlabs();
          break;
        // Add other program cases
        default:
          throw new Error('Program not found');
      }

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getProgramLogs(req, res) {
    try {
      const { programName } = req.params;
      // Implement log retrieval logic
      res.json({ logs: [] });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async disconnectWhatsApp(req, res) {
    try {
      if (global.sock) {
        await global.sock.logout();
        await global.sock.end();
        global.sock = null;

        // Delete the Baileys auth info directory
        const authPath = path.join(process.cwd(), 'baileys_auth_info');
        if (fs.existsSync(authPath)) {
          rimraf.sync(authPath);
          console.log('Deleted Baileys auth info');
        }

        res.json({
          success: true,
          message: 'WhatsApp disconnected successfully',
        });
      } else {
        res.json({ success: false, message: 'WhatsApp is not connected' });
      }
    } catch (error) {
      // Even if there's an error during logout, try to delete auth files
      try {
        const authPath = path.join(process.cwd(), 'baileys_auth_info');
        if (fs.existsSync(authPath)) {
          rimraf.sync(authPath);
          console.log('Deleted Baileys auth info');
        }
      } catch (deleteError) {
        console.error('Error deleting auth files:', deleteError);
      }

      res.status(500).json({ success: false, error: error.message });
    }
  }

  async reconnectWhatsApp(req, res) {
    try {
      // First check if there's any existing connection
      if (global.sock) {
        await global.sock.end();
        global.sock = null;
      }

      // Create a new connection
      try {
        await connectToWhatsApp();
        res.json({
          success: true,
          message:
            'Initializing new WhatsApp connection. Please wait for QR code.',
        });
      } catch (connError) {
        console.error('Connection error:', connError);
        res.status(500).json({
          success: false,
          message: 'Failed to initialize WhatsApp connection',
          error: connError.message,
        });
      }
    } catch (error) {
      console.error('Reconnection error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reconnect',
        error: error.message,
      });
    }
  }

  async getHandlerStates(req, res) {
    try {
      const states = getMessageHandlerStates();
      res.json({ success: true, handlers: states });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateHandlerState(req, res) {
    try {
      const { handlerId, enabled } = req.body;
      const success = toggleMessageHandler(handlerId, enabled);
      if (success) {
        res.json({
          success: true,
          message: `Handler ${enabled ? 'enabled' : 'disabled'}`,
        });
      } else {
        res.status(400).json({ success: false, message: 'Invalid handler ID' });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async toggleMillProgram(req, res) {
    try {
      const { program, enabled } = req.body;

      // Store the state of the program
      global.millProgramStates = global.millProgramStates || {};
      global.millProgramStates[program] = enabled;

      // Clear existing cron job if it exists
      if (global.millCronJobs && global.millCronJobs[program]) {
        global.millCronJobs[program].stop();
      }

      // Setup new cron job if enabled
      if (enabled) {
        global.millCronJobs = global.millCronJobs || {};

        if (program === 'get_mill_data') {
          global.millCronJobs[program] = cron.schedule(
            '*/5 * * * *',
            async () => {
              await get_mill_data(global.sock);
            },
            {
              scheduled: true,
              timezone: 'Asia/Jakarta',
            }
          );
        } else if (program === 'run_jobs_mill') {
          global.millCronJobs[program] = cron.schedule(
            '*/1 * * * *',
            async () => {
              await run_jobs_mill(global.sock);
            },
            {
              scheduled: true,
              timezone: 'Asia/Jakarta',
            }
          );
        }
      }

      res.json({
        success: true,
        message: `${program} ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getMillProgramStatus(req, res) {
    try {
      // Get current states
      const states = global.millProgramStates || {
        get_mill_data: false,
        run_jobs_mill: false,
      };

      // Get current schedules for mill programs
      const schedules = {};
      for (const [id, schedule] of this.schedules.entries()) {
        if (id.startsWith('mill_')) {
          const programName = id.replace('mill_', '');
          schedules[programName] = schedule.cronExpression;
        }
      }

      res.json({
        success: true,
        states,
        schedules,
      });
    } catch (error) {
      console.error('Error getting mill status:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async runMillProgramNow(req, res) {
    try {
      const { program } = req.params;

      if (program === 'get_mill_data') {
        await get_mill_data(global.sock);
      } else if (program === 'run_jobs_mill') {
        await run_jobs_mill(global.sock);
      } else {
        throw new Error('Invalid program specified');
      }

      res.json({ success: true, message: `${program} executed successfully` });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async runMillProgram(req, res) {
    try {
      const { program } = req.params;

      if (program === GRADING_TYPES.GET_MILL_DATA) {
        await GradingMill.getMillData(global.sock);
      } else if (program === GRADING_TYPES.RUN_JOBS_MILL) {
        await GradingMill.runJobsMill();
      } else {
        throw new Error('Invalid program specified');
      }

      res.json({ success: true, message: `${program} executed successfully` });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateMillSchedule(req, res) {
    try {
      const { program, cronExpression } = req.body;

      // Create new schedule
      const job = cron.schedule(
        cronExpression,
        async () => {
          try {
            if (program === GRADING_TYPES.GET_MILL_DATA) {
              await GradingMill.getMillData(global.sock);
            } else if (program === GRADING_TYPES.RUN_JOBS_MILL) {
              await GradingMill.runJobsMill();
            }
          } catch (error) {
            global.queue.emitLog(
              `Error in scheduled job ${program}: ${error.message}`,
              'error'
            );
          }
        },
        {
          scheduled: true,
          timezone: 'Asia/Jakarta',
        }
      );

      // Save schedule
      const id = `mill_${program}`;
      this.schedules.set(id, { id, program, cronExpression, job });
      await this.saveSchedules();

      res.json({
        success: true,
        message: `Updated ${program} schedule to ${cronExpression}`,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new ProgramController();
