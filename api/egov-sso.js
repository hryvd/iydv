/* ==========================================================================
   eGovPH Single Sign-On (SSO) Backend API Proxy (Vercel Serverless Function)
   Partner Code: 2d0c24ee9ca249f49127cae6933b4116
   Base URL: https://platforms-api.e.gov.ph/egov-sso
   ========================================================================== */

const EGOV_PARTNER_CODE = process.env.EGOV_PARTNER_CODE || '2d0c24ee9ca249f49127cae6933b4116';
const EGOV_PARTNER_SECRET = process.env.EGOV_PARTNER_SECRET || '4f499fc0d1594d15bc73f04332a13337';
const EGOV_BASE_URL = (process.env.EGOV_BASE_URL || 'https://platforms-api.e.gov.ph/egov-sso').replace(/\/$/, '');

async function postJSON(endpointUrl, payload, headers = {}) {
  const res = await fetch(endpointUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...headers
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = { raw: text };
  }

  if (!res.ok) {
    const errorMsg = data.error || data.message || `HTTP ${res.status}`;
    const err = new Error(errorMsg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const { action, exchange_code, username, otp, pin, otp_validation_token, type } = body || {};

  try {
    // 1. Check Gateway Access
    if (action === 'check_access') {
      const result = await postJSON(`${EGOV_BASE_URL}/api/partner/check_access`, {
        partner_code: EGOV_PARTNER_CODE
      });
      return res.status(200).json(result);
    }

    // 2. Exchange code for token & fetch citizen profile (Full SSO Flow)
    if (action === 'exchange_code' || action === 'full_sso') {
      if (!exchange_code) {
        return res.status(400).json({ error: 'Missing exchange_code parameter' });
      }

      // Step 3: Get Token
      const tokenRes = await postJSON(`${EGOV_BASE_URL}/api/token`, {
        partner_code: EGOV_PARTNER_CODE,
        partner_secret: EGOV_PARTNER_SECRET,
        exchange_code: exchange_code,
        scope: 'SSO_AUTHENTICATION'
      });

      const accessToken = tokenRes.access_token;
      if (!accessToken) {
        return res.status(400).json({ error: 'Failed to retrieve access token from eGov gateway', details: tokenRes });
      }

      // Step 4: Fetch Citizen Profile
      const profileRes = await postJSON(
        `${EGOV_BASE_URL}/api/partner/sso_authentication`,
        {},
        { 'Authorization': `Bearer ${accessToken}` }
      );

      return res.status(200).json({
        success: true,
        access_token: accessToken,
        profile: profileRes.data || profileRes
      });
    }

    // 3. OTP Generation (Appendix A2)
    if (action === 'otp_generate') {
      if (!username) return res.status(400).json({ error: 'Missing username (mobile number or email)' });
      const result = await postJSON(`${EGOV_BASE_URL}/api/otp_generate`, {
        partner_code: EGOV_PARTNER_CODE,
        username: username,
        type: type || 'MOBILE_NUMBER'
      });
      return res.status(200).json(result);
    }

    // 4. OTP Validation (Appendix A3)
    if (action === 'otp_validate') {
      if (!username || !otp) return res.status(400).json({ error: 'Missing username or OTP' });
      const result = await postJSON(`${EGOV_BASE_URL}/api/otp_validate`, {
        partner_code: EGOV_PARTNER_CODE,
        username: username,
        type: type || 'MOBILE_NUMBER',
        otp: otp
      });
      return res.status(200).json(result);
    }

    // 5. PIN Authenticate (Appendix A4)
    if (action === 'authenticate') {
      if (!username || !pin || !otp_validation_token) {
        return res.status(400).json({ error: 'Missing username, PIN, or otp_validation_token' });
      }
      const result = await postJSON(`${EGOV_BASE_URL}/api/authenticate`, {
        partner_code: EGOV_PARTNER_CODE,
        username: username,
        pin: pin,
        otp_validation_token: otp_validation_token
      });
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: `Invalid action specified: '${action}'` });

  } catch (err) {
    console.error(`[eGov Proxy Error - ${action}]:`, err);
    return res.status(err.status || 500).json({
      error: err.message || 'eGov gateway request failed',
      details: err.data || null
    });
  }
};
