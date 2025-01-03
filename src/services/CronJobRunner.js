const cron = require('node-cron');
const cronJobSettings = require('./CronJobSettings');
const GradingProgram = require('../Programs/Grading');
const logger = require('./logger');

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
      // Tambahkan program lain di sini
      // smartlabs: new SmartLabsProgram(),
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
}

// Export singleton instance
module.exports = new CronJobRunner();
