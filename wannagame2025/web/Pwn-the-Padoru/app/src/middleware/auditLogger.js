const db = require('../db');

async function auditTrail(req, res, next) {
  res.on('finish', () => {
    if (!req.user) {
      return;
    }

    if (req.originalUrl.startsWith('/api/arcade')) {
      const meta = {
        method: req.method,
        route: req.originalUrl,
        status: res.statusCode
      };

      db.recordLootEvent({
        user_id: req.user.id,
        event_name: 'http_trace',
        metadata: meta
      }).catch(() => {
        // swallow logging errors to keep app responsive
      });
    }
  });
  next();
}

module.exports = {
  auditTrail
};
