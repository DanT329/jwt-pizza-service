const os = require('os');
const fetch = require('node-fetch');
const config = require('./config.js'); // Ensure config has Grafana details

class Metrics {
  constructor() {
    // Counts for each HTTP method and total
    this.methodCounts = { get: 0, post: 0, put: 0, delete: 0, all: 0 };
    this.purchases = []; // Array to hold purchase data

    // Add counters for authentication attempts
    this.authAttempts = { successful: 0, failed: 0 };

    // Set up periodic reporting every 1 minute (60000 milliseconds)
    this.startPeriodicReporting(60000); // Report every 1 minute
  }

  // Increment counts for authentication attempts
  incrementAuthAttempt(success) {
    if (success) {
      this.authAttempts.successful++;
    } else {
      this.authAttempts.failed++;
    }
  }

  // Middleware to track incoming requests
  requestTracker = (req, res, next) => {
    // Increment the count for the request method
    this.incrementRequestMethod(req.method.toLowerCase());
    next();
  };

  incrementRequestMethod(method) {
    // Check if the method is valid and increment count
    if (method in this.methodCounts) {
      this.methodCounts[method]++;
    }
    // Always increment the 'all' method for total count
    this.methodCounts.all++;
  }

  // System Metrics: CPU usage
  getCpuUsagePercentage() {
    const cpuUsage = os.loadavg()[0] / os.cpus().length;
    return (cpuUsage * 100).toFixed(2);
  }

  // System Metrics: Memory usage
  getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    return ((usedMemory / totalMemory) * 100).toFixed(2);
  }

  // Track a purchase metric
  recordPurchase(responseTime, quantity, cost, wasSuccessful) {
    this.purchases.push({ responseTime, quantity, cost, wasSuccessful });
  }

  // Build and send all metrics to Grafana
  reportMetrics() {
    const buf = [];

    // Request metrics (for each HTTP method and total)
    for (const method of ['get', 'post', 'put', 'delete', 'all']) {
      buf.push(`request,source=${config.metrics.source},method=${method} total=${this.methodCounts[method]}`);
    }

    // System metrics (CPU and memory)
    buf.push(`system,source=${config.metrics.source},type=cpu usage=${this.getCpuUsagePercentage()}`);
    buf.push(`system,source=${config.metrics.source},type=memory usage=${this.getMemoryUsagePercentage()}`);

    // Purchase metrics
    this.purchases.forEach((purchase, index) => {
      buf.push(`purchase,source=${config.metrics.source},index=${index} responseTime=${purchase.responseTime},quantity=${purchase.quantity},cost=${purchase.cost},success=${purchase.wasSuccessful ? 1 : 0}`);
    });

    // Authentication attempt metrics
    buf.push(`auth_attempts,source=${config.metrics.source},type=successful total=${this.authAttempts.successful}`);
    buf.push(`auth_attempts,source=${config.metrics.source},type=failed total=${this.authAttempts.failed}`);

    // Send all metrics as a single batch
    const metrics = buf.join('\n');
    this.sendMetricToGrafana(metrics);

    // Reset tracked purchases and authentication attempts after reporting
    this.purchases = [];
    this.authAttempts = { successful: 0, failed: 0 };

    // Reset method counts after sending to Grafana
    this.resetMethodCounts();
  }

  // Reset the method counts after reporting to Grafana
  resetMethodCounts() {
    this.methodCounts = { get: 0, post: 0, put: 0, delete: 0, all: 0 };
  }

  // Send data to Grafana
  sendMetricToGrafana(metrics) {
    fetch(config.metrics.url, {
      method: 'POST',
      body: metrics,
      headers: {
        'Authorization': `Bearer ${config.metrics.userId}:${config.metrics.apiKey}`,
        'Content-Type': 'text/plain',
      },
    })
    .then(response => {
      if (!response.ok) {
        console.error('Failed to push metrics data to Grafana');
      } else {
        console.log(`Metrics pushed:\n${metrics}`);
      }
    })
    .catch(error => {
      console.error('Error pushing metrics:', error);
    });
  }

  // Start periodic reporting
  startPeriodicReporting(period) {
    setInterval(() => {
      try {
        this.reportMetrics();
      } catch (error) {
        console.error('Error reporting metrics:', error);
      }
    }, period);
  }
}

const metrics = new Metrics();
module.exports = metrics;


