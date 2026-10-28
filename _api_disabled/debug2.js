module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  // Check the key structure
  const lines = privateKey ? privateKey.split('\n') : [];
  const firstLine = lines[0] || '';
  const lastLine = lines[lines.length - 1] || '';

  // Check for any hidden characters
  const hasCarriageReturn = privateKey ? privateKey.includes('\r') : false;
  const hasTab = privateKey ? privateKey.includes('\t') : false;

  res.status(200).json({
    totalLength: privateKey ? privateKey.length : 0,
    lineCount: lines.length,
    firstLine: firstLine,
    lastLine: lastLine,
    startsCorrectly: firstLine === '-----BEGIN PRIVATE KEY-----',
    endsCorrectly: lastLine === '-----END PRIVATE KEY-----' || lines[lines.length - 2] === '-----END PRIVATE KEY-----',
    hasCarriageReturn,
    hasTab,
    line2Length: lines[1] ? lines[1].length : 0,
    line3Length: lines[2] ? lines[2].length : 0
  });
};
