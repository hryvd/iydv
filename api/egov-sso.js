'use strict';
// Legacy proxy disabled: public authentication must be server-verified and session-bound.
// Previously committed partner credentials must be revoked by their owner.
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(503).json({ error: 'eGovPH sign-in is unavailable. Use your OneUp account.' });
};
