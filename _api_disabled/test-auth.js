const { google } = require('googleapis');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  try {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;

    // Handle both escaped \n and actual newlines
    if (privateKey && privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    console.log('Auth attempt with email:', email);
    console.log('Private key starts with:', privateKey ? privateKey.substring(0, 50) : 'null');

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: email,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    // Try to get an auth client and token
    const authClient = await auth.getClient();
    const token = await authClient.getAccessToken();

    res.status(200).json({
      success: true,
      message: 'Authentication successful!',
      hasToken: !!token
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      stack: error.stack
    });
  }
};
