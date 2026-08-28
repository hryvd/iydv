const express = require('express');
const cors = require('cors');
const path = require('path');
const egovHandler = require('./api/egov-sso');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express route for eGov SSO Proxy
app.post('/api/egov-sso', (req, res) => {
  egovHandler(req, res);
});

// Serve static assets from project root
app.use(express.static(__dirname));

// Fallback to index.html for single-page app routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 IYDV ONEUP Server running at http://localhost:${PORT}`);
  console.log(`🇵🇭 eGov SSO Gateway integration enabled`);
  console.log(`====================================================`);
});
