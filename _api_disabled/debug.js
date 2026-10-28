module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  res.status(200).json({
    hasEmail: !!email,
    emailPreview: email ? email.substring(0, 20) + '...' : null,
    hasPrivateKey: !!privateKey,
    privateKeyLength: privateKey ? privateKey.length : 0,
    privateKeyStart: privateKey ? privateKey.substring(0, 30) : null,
    hasNewlines: privateKey ? privateKey.includes('\n') : false,
    hasEscapedNewlines: privateKey ? privateKey.includes('\\n') : false,
    hasSheetId: !!sheetId,
    sheetIdPreview: sheetId ? sheetId.substring(0, 10) + '...' : null
  });
};
