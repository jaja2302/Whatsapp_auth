const Queue = require('../../../utils/queue');
const fs = require('fs').promises;
const path = require('path');

const queue = global.queue; // Assuming you've made your queue instance global

async function getQueueStatus(req, res) {
  try {
    const activeJobs = queue.items;
    const failedJobsPath = path.join(
      __dirname,
      '../../../utils/failed_jobs.json'
    );

    let failedJobs = [];
    try {
      const data = await fs.readFile(failedJobsPath, 'utf8');
      failedJobs = JSON.parse(data);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error reading failed jobs:', error);
      }
    }

    res.json({
      success: true,
      data: {
        active: activeJobs,
        failed: failedJobs,
        isPaused: queue.paused,
        isProcessing: queue.processing,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function toggleQueue(req, res) {
  try {
    const { pause } = req.body;
    if (pause) {
      queue.pause();
    } else {
      queue.resume();
    }
    res.json({ success: true, isPaused: queue.paused });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function retryJob(req, res) {
  try {
    const { jobId } = req.params;
    const failedJobsPath = path.join(__dirname, '../../utils/failed_jobs.json');

    let failedJobs = [];
    try {
      const data = await fs.readFile(failedJobsPath, 'utf8');
      failedJobs = JSON.parse(data);
    } catch (error) {
      throw new Error('Failed to read failed jobs file');
    }

    const jobIndex = failedJobs.findIndex((job) => job.id === jobId);
    if (jobIndex === -1) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const job = failedJobs[jobIndex];
    job.retries = 0; // Reset retries
    delete job.failedAt;
    delete job.error;

    // Add back to queue
    queue.push(job);

    // Remove from failed jobs
    failedJobs.splice(jobIndex, 1);
    await fs.writeFile(failedJobsPath, JSON.stringify(failedJobs, null, 2));

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getQueueStatus,
  toggleQueue,
  retryJob,
};
