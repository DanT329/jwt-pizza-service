const config = require('./config.js'); // Ensure config has Grafana details

class Logger {
  httpLogger = (req, res, next) => {
    let send = res.send;
    res.send = (resBody) => {
      const logData = {
        authorized: !!req.headers.authorization,
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        reqBody: JSON.stringify(req.body),
        resBody: JSON.stringify(resBody),
      };
      const level = this.statusToLogLevel(res.statusCode);
      this.log(level, 'http', logData);
      res.send = send;
      return res.send(resBody);
    };
    next();
  };

  dbLogger(query, params) {
    const logData = {
      query: query,
      params: JSON.stringify(params),
    };
    this.log('info', 'database', logData);  // Log with 'database' type
  }

  // New method to capture order-related info
  factoryLogger(orderInfo) {
    const logData = {
      diner: {
        id: orderInfo.diner.id,
        name: orderInfo.diner.name,
        email: orderInfo.diner.email,
      },
      order: orderInfo.order, // You can sanitize this if needed
    };
    this.log('info', 'order', logData);  // Log with 'order' type
  }

  // New method to capture and log errors
  errorLogger(error) {
    const logData = {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode || 500,  // Default to 500 if no status code
    };
    this.log('error', 'unhandledError', logData);  // Log with 'error' type and 'unhandledError' tag
  }

  log(level, type, logData) {
    const labels = { component: config.logging.source, level: level, type: type };
    const values = [this.nowString(), this.sanitize(logData)];
    const logEvent = { streams: [{ stream: labels, values: [values] }] };

    this.sendLogToGrafana(logEvent);
  }

  statusToLogLevel(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  nowString() {
    return (Math.floor(Date.now()) * 1000000).toString();
  }

  sanitize(logData) {
    logData = JSON.stringify(logData);
  
    // Mask password fields if present
    logData = logData.replace(/\\"password\\":\s*\\"[^"]*\\"/g, '\\"password\\": \\"*****\\"');
  
    // Mask token fields if present
    logData = logData.replace(/\\"token\\":\s*\\"[^"]*\\"/g, '\\"token\\": \\"*****\\"');
  
    // Mask sensitive order data if necessary (e.g., payment info)
    // Example: if there's a 'paymentInfo' field, sanitize it:
    logData = logData.replace(/(\\"paymentInfo\\":\s*\{[^}]*\})/, '\\"paymentInfo\\": \\"*****\\"');
  
    return logData;
  }

  sendLogToGrafana(event) {
    const body = JSON.stringify(event);
    fetch(`${config.logging.url}`, {
      method: 'post',
      body: body,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.logging.userId}:${config.logging.apiKey}`,
      },
    }).then((res) => {
      if (!res.ok) console.log('Failed to send log to Grafana');
    });
  }
}

module.exports = new Logger();
