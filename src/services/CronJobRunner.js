const cron = require('node-cron');
const cronJobSettings = require('./CronJobSettings');
const GradingProgram = require('../Programs/Grading');
const logger = require('./logger');
const TaksasiProgram = require('../Programs/Taksasi');

class CronJobRunner {
  constructor() {
    this.jobs = {};
    this.programs = {};
    this.initializePrograms();
  }

  // Initialize all program instances
  initializePrograms() {
    this.programs = {
      grading: new GradingProgram(),
      taksasi: new TaksasiProgram(),
      // dll
    };
  }

  async initialize() {
    try {
      // Load settings untuk semua program
      for (const programName of Object.keys(this.programs)) {
        await cronJobSettings.loadSettings(programName);
      }

      // Hentikan job yang sedang berjalan sebelum menjadwalkan yang baru
      this.stopAllJobs();

      // Jadwalkan ulang semua jobs
      await this.scheduleJobs();

      logger.info.whatsapp('CronJobRunner initialized successfully');
    } catch (error) {
      logger.error.whatsapp('Error initializing CronJobRunner:', error);
      throw error;
    }
  }

  stopAllJobs() {
    Object.values(this.jobs).forEach((job) => {
      if (job && typeof job.stop === 'function') {
        job.stop();
      }
    });
    this.jobs = {};
  }

  async scheduleJobs() {
    try {
      // Ambil settings untuk setiap program yang terdaftar
      for (const [programName, programInstance] of Object.entries(
        this.programs
      )) {
        const settings = await cronJobSettings.loadSettings(programName);

        if (settings && settings.cronjobs) {
          Object.entries(settings.cronjobs).forEach(([jobName, schedule]) => {
            if (cron.validate(schedule)) {
              const jobKey = `${programName}-${jobName}`;

              // Hentikan job lama jika ada
              if (this.jobs[jobKey]) {
                this.jobs[jobKey].stop();
              }

              // Jadwalkan job baru
              this.jobs[jobKey] = cron.schedule(
                schedule,
                () => this.runJob(programName, jobName),
                {
                  timezone: settings.timezone || 'Asia/Jakarta',
                }
              );

              logger.info.whatsapp(
                `Scheduled ${jobKey} with schedule: ${schedule}`
              );
            } else {
              logger.error.whatsapp(
                `Invalid cron schedule for ${programName}-${jobName}: ${schedule}`
              );
            }
          });
        }
      }
    } catch (error) {
      logger.error.whatsapp('Error scheduling jobs:', error);
      throw error;
    }
  }

  async runJob(program, jobName) {
    try {
      const programInstance = this.programs[program];

      if (!programInstance) {
        throw new Error(`Program ${program} not found`);
      }

      if (typeof programInstance[jobName] === 'function') {
        logger.info[program](`Running ${program} - ${jobName}`);
        await programInstance[jobName]();
        logger.info[program](`Completed ${program} - ${jobName}`);
      } else {
        throw new Error(`Method ${jobName} not found in ${program} program`);
      }
    } catch (error) {
      logger.error[program](
        `Error running job ${program} - ${jobName}:`,
        error
      );
    }
  }

  // Method untuk memperbarui jadwal job
  async updateJobSchedule(program, jobName, newSchedule) {
    try {
      const jobKey = `${program}-${jobName}`;

      // Validasi schedule baru
      if (!cron.validate(newSchedule)) {
        throw new Error(`Invalid cron schedule: ${newSchedule}`);
      }

      // Hentikan job yang sedang berjalan
      if (this.jobs[jobKey]) {
        this.jobs[jobKey].stop();
      }

      // Load settings terbaru
      const settings = await cronJobSettings.loadSettings(program);

      // Jadwalkan ulang dengan schedule baru
      this.jobs[jobKey] = cron.schedule(
        newSchedule,
        () => this.runJob(program, jobName),
        {
          timezone: settings.timezone || 'Asia/Jakarta',
        }
      );

      logger.info.whatsapp(`Updated schedule for ${jobKey} to: ${newSchedule}`);
    } catch (error) {
      logger.error.whatsapp(
        `Error updating schedule for ${program}-${jobName}:`,
        error
      );
      throw error;
    }
  }

  // Menghentikan semua job untuk program tertentu
  async stopProgramJobs(programName) {
    try {
      const settings = await cronJobSettings.loadSettings(programName);

      Object.keys(this.jobs).forEach(async (jobKey) => {
        if (jobKey.startsWith(`${programName}-`)) {
          if (
            this.jobs[jobKey] &&
            typeof this.jobs[jobKey].stop === 'function'
          ) {
            this.jobs[jobKey].stop();
            delete this.jobs[jobKey];

            // Update status in settings
            const jobName = jobKey.split('-')[1];
            await this.updateJobStatus(programName, jobName, 'stopped');

            logger.info.whatsapp(`Stopped job: ${jobKey}`);
          }
        }
      });

      // Update program status
      settings.status = 'stopped';
      await cronJobSettings.updateSettings(programName, settings);

      logger.info.whatsapp(
        `All jobs for program ${programName} stopped successfully`
      );
      return true;
    } catch (error) {
      logger.error.whatsapp(
        `Error stopping jobs for program ${programName}:`,
        error
      );
      throw error;
    }
  }

  // Memulai kembali semua job untuk program tertentu
  async startProgramJobs(programName) {
    try {
      const settings = await cronJobSettings.loadSettings(programName);

      if (settings && settings.cronjobs) {
        Object.entries(settings.cronjobs).forEach(
          async ([jobName, schedule]) => {
            if (cron.validate(schedule)) {
              const jobKey = `${programName}-${jobName}`;

              if (this.jobs[jobKey]) {
                this.jobs[jobKey].stop();
              }

              this.jobs[jobKey] = cron.schedule(
                schedule,
                () => this.runJob(programName, jobName),
                {
                  timezone: settings.timezone || 'Asia/Jakarta',
                }
              );

              // Update status in settings
              await this.updateJobStatus(programName, jobName, 'active');

              logger.info.whatsapp(
                `Started job ${jobKey} with schedule: ${schedule}`
              );
            }
          }
        );

        // Update program status
        settings.status = 'active';
        await cronJobSettings.updateSettings(programName, settings);

        logger.info.whatsapp(
          `All jobs for program ${programName} started successfully`
        );
        return true;
      }
    } catch (error) {
      logger.error.whatsapp(
        `Error starting jobs for program ${programName}:`,
        error
      );
      throw error;
    }
  }

  // Get status of all jobs for a program
  async getProgramJobStatus(programName) {
    try {
      const settings = await cronJobSettings.loadSettings(programName);
      //   console.log('Current settings:', settings); // Debug log

      // Buat object jobs status dari cronjobs yang terdaftar
      const jobStatus = {};
      if (settings.cronjobs) {
        // Mengambil nama job dari cronjobs yang terdaftar
        Object.keys(settings.cronjobs).forEach((jobName) => {
          // Mengambil status dari cronjob_status jika ada, atau 'unknown' jika tidak ada
          jobStatus[jobName] = settings.cronjob_status?.[jobName] || 'unknown';
        });
      }

      return {
        program_status: settings.status || 'unknown',
        jobs: jobStatus, // Menggunakan status job yang diambil dari settings
      };
    } catch (error) {
      logger.error.whatsapp(
        `Error getting job status for program ${programName}:`,
        error
      );
      throw error;
    }
  }

  async updateJobStatus(programName, jobName, status) {
    try {
      const settings = await cronJobSettings.loadSettings(programName);
      if (!settings.cronjob_status) {
        settings.cronjob_status = {};
      }
      settings.cronjob_status[jobName] = status;
      await cronJobSettings.updateSettings(programName, settings);
    } catch (error) {
      logger.error.whatsapp(`Error updating job status: ${error}`);
    }
  }

  async startJob(programName, jobName) {
    try {
      const settings = await cronJobSettings.loadSettings(programName);
      const schedule = settings.cronjobs[jobName];

      if (!schedule) {
        throw new Error(`Job ${jobName} not found in settings`);
      }

      const jobKey = `${programName}-${jobName}`;

      // Stop existing job if running
      if (this.jobs[jobKey]) {
        this.jobs[jobKey].stop();
      }

      // Start new job
      this.jobs[jobKey] = cron.schedule(
        schedule,
        () => this.runJob(programName, jobName),
        {
          timezone: settings.timezone || 'Asia/Jakarta',
        }
      );

      // Update job status
      if (!settings.cronjob_status) {
        settings.cronjob_status = {};
      }
      settings.cronjob_status[jobName] = 'active';
      await cronJobSettings.updateSettings(programName, settings);

      logger.info.whatsapp(`Started job ${jobKey} with schedule: ${schedule}`);
      return true;
    } catch (error) {
      logger.error.whatsapp(
        `Error starting job ${programName}-${jobName}:`,
        error
      );
      throw error;
    }
  }

  async stopJob(programName, jobName) {
    try {
      const jobKey = `${programName}-${jobName}`;

      if (this.jobs[jobKey]) {
        this.jobs[jobKey].stop();
        delete this.jobs[jobKey];
      }

      // Update job status in settings
      const settings = await cronJobSettings.loadSettings(programName);
      if (!settings.cronjob_status) {
        settings.cronjob_status = {};
      }
      settings.cronjob_status[jobName] = 'stopped';
      await cronJobSettings.updateSettings(programName, settings);

      logger.info.whatsapp(`Stopped job ${jobKey}`);
      return true;
    } catch (error) {
      logger.error.whatsapp(
        `Error stopping job ${programName}-${jobName}:`,
        error
      );
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new CronJobRunner();
