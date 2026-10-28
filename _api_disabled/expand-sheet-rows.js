const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env files
const envPaths = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '..', '.env'),
];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    console.log(`Loading env from: ${envPath}`);
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      }
    });
  }
}

const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const SHEET_ID = '1DZfS3J6Men-XuX11nXAYnMhgQKCn4SJTFDDFxlEQAwk';
const SHEET_NAME = 'BPV';

async function expandSheetRows() {
  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Get current sheet info
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
  });

  const bpvSheet = spreadsheet.data.sheets.find(s => s.properties.title === SHEET_NAME);
  const sheetId = bpvSheet.properties.sheetId;
  const currentRows = bpvSheet.properties.gridProperties.rowCount;

  console.log(`Current row count: ${currentRows}`);

  // Need rows up to BPV 100: 2607 + 27 = 2634, round up to 3000
  const targetRows = 3000;

  if (currentRows >= targetRows) {
    console.log('Sheet already has enough rows.');
    return;
  }

  const rowsToAdd = targetRows - currentRows;
  console.log(`Adding ${rowsToAdd} rows to reach ${targetRows} total...`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [{
        appendDimension: {
          sheetId: sheetId,
          dimension: 'ROWS',
          length: rowsToAdd,
        }
      }]
    }
  });

  console.log('Done! Sheet now has 3000 rows.');
}

expandSheetRows().catch(console.error);
