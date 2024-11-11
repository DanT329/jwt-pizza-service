const os = require('os');
const fetch = require('node-fetch');
const config = require('./config.js'); // Ensure config has Grafana details

class Metrics {
  constructor() {
    this.methodCounts = { get: 0, post: 0, put: 0, delete: 0, all: 0 };
    this.purchases = [];
    this.authAttempts = { successful: 0, failed: 0 };
    this.activeUsers = 0;

    // Array to hold response times for latency calculation
    this.responseTimes = [];

    // Set up periodic reporting every 1 minute (60000 milliseconds)
    this.startPeriodicReporting(60000);
  }

  incrementAuthAttempt(success) {
    if (success) {
      this.authAttempts.successful++;
    } else {
      this.authAttempts.failed++;
    }
  }

  incrementActiveUsers() {
    this.activeUsers++;
  }

  decrementActiveUsers() {
    if (this.activeUsers > 0) {
      this.activeUsers--;
    }
  }

  requestTracker = (req, res, next) => {
    // Start timer for request
    const start = Date.now();
    
    // Register response finish event to record response time
    res.on('finish', () => {
      const responseTime = Date.now() - start;
      this.responseTimes.push(responseTime);
      this.incrementRequestMethod(req.method.toLowerCase());
    });

    next();
  };

  incrementRequestMethod(method) {
    if (method in this.methodCounts) {
      this.methodCounts[method]++;
    }
    this.methodCounts.all++;
  }

  getCpuUsagePercentage() {
    const cpuUsage = os.loadavg()[0] / os.cpus().length;
    return (cpuUsage * 100).toFixed(2);
  }

  getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    return ((usedMemory / totalMemory) * 100).toFixed(2);
  }

  recordPurchase(responseTime, quantity, cost, wasSuccessful) {
    this.purchases.push({ responseTime, quantity, cost, wasSuccessful });
  }

  // Calculate the average latency
  calculateAverageLatency() {
    const totalLatency = this.responseTimes.reduce((sum, time) => sum + time, 0);
    return this.responseTimes.length ? (totalLatency / this.responseTimes.length) : 0;
  }

  reportMetrics() {
    const buf = [];

    for (const method of ['get', 'post', 'put', 'delete', 'all']) {
      buf.push(`request,source=${config.metrics.source},method=${method} total=${this.methodCounts[method]}`);
    }

    buf.push(`system,source=${config.metrics.source},type=cpu usage=${this.getCpuUsagePercentage()}`);
    buf.push(`system,source=${config.metrics.source},type=memory usage=${this.getMemoryUsagePercentage()}`);

    const totalRevenue = this.purchases.reduce((sum, p) => sum + p.cost, 0);
    const totalQuantity = this.purchases.reduce((sum, p) => sum + p.quantity, 0);
    const successfulPurchases = this.purchases.filter(p => p.wasSuccessful).length;
    const failedPurchases = this.purchases.length - successfulPurchases;
    const avgPurchaseLatency = this.purchases.length
      ? this.purchases.reduce((sum, p) => sum + p.responseTime, 0) / this.purchases.length
      : 0;

    buf.push(`purchase,source=${config.metrics.source},metric=total_revenue value=${totalRevenue}`);
    buf.push(`purchase,source=${config.metrics.source},metric=total_quantity value=${totalQuantity}`);
    buf.push(`purchase,source=${config.metrics.source},metric=successful_purchases value=${successfulPurchases}`);
    buf.push(`purchase,source=${config.metrics.source},metric=failed_purchases value=${failedPurchases}`);
    buf.push(`purchase,source=${config.metrics.source},metric=average_purchase_latency value=${avgPurchaseLatency}`);

    // Add average latency for all requests
    const avgServiceLatency = this.calculateAverageLatency();
    buf.push(`service,source=${config.metrics.source},metric=average_latency value=${avgServiceLatency}`);

    buf.push(`auth_attempts,source=${config.metrics.source},type=successful total=${this.authAttempts.successful}`);
    buf.push(`auth_attempts,source=${config.metrics.source},type=failed total=${this.authAttempts.failed}`);
    buf.push(`active_users,source=${config.metrics.source} count=${this.activeUsers}`);

    const metrics = buf.join('\n');
    this.sendMetricToGrafana(metrics);

    // Reset data after reporting
    this.purchases = [];
    this.authAttempts = { successful: 0, failed: 0 };
    this.responseTimes = [];
    this.resetMethodCounts();
  }

  resetMethodCounts() {
    this.methodCounts = { get: 0, post: 0, put: 0, delete: 0, all: 0 };
  }

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