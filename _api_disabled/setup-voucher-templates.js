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

// Initialize Google Sheets API
const getAuth = () => {
  // Try to use credentials file first (GOOGLE_APPLICATION_CREDENTIALS)
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (credentialsPath && fs.existsSync(credentialsPath)) {
    console.log(`Using credentials file: ${credentialsPath}`);
    const auth = new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return auth;
  }

  // Fallback to inline credentials
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (privateKey) {
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth;
};

// BPV sheet ID (hardcoded because .env has a different sheet)
const SHEET_ID = '1DZfS3J6Men-XuX11nXAYnMhgQKCn4SJTFDDFxlEQAwk';
const SHEET_NAME = 'BPV';

async function setupVoucherTemplates() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  // Get the sheet ID (not the spreadsheet ID, the actual sheet/tab ID)
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
  });

  const bpvSheet = spreadsheet.data.sheets.find(s => s.properties.title === SHEET_NAME);
  const sheetId = bpvSheet.properties.sheetId;

  console.log(`Found sheet "${SHEET_NAME}" with ID: ${sheetId}`);

  // Each voucher block is 27 rows
  // BPV NO row (bpvNoRow) = 393 + ((bpvNum - 18) * 27)
  // The template header "BANK PAYMENT VOUCHER" is ~5 rows before bpvNoRow
  // So actual voucher block start = bpvNoRow - 5
  const rowsPerVoucher = 27;

  // Source template: Use BPV 55 as the template
  // BPV 55 bpvNoRow = 393 + (37 * 27) = 1392
  // Template starts at row 1392 - 5 = 1387 (but need to find exact boundary)
  // Looking at the sheet: row 1386-1387 has separators "===", 1390 has header
  const sourceBpvNoRow = 393 + (37 * 27); // BPV 55 at row 1392
  const sourceStartRow = sourceBpvNoRow - 5 - 1; // 0-indexed, start at row 1387

  // Destination: BPV 56-100
  const startBpv = 56;
  const endBpv = 100;

  const requests = [];

  for (let bpvNum = startBpv; bpvNum <= endBpv; bpvNum++) {
    const destBpvNoRow = 393 + ((bpvNum - 18) * rowsPerVoucher);
    const destStartRow = destBpvNoRow - 5 - 1; // 0-indexed, same offset as source

    console.log(`Setting up BPV ${bpvNum} - bpvNoRow: ${destBpvNoRow}, template starts at row ${destStartRow + 1}`);

    // Copy formatting from source to destination
    requests.push({
      copyPaste: {
        source: {
          sheetId: sheetId,
          startRowIndex: sourceStartRow,
          endRowIndex: sourceStartRow + rowsPerVoucher,
          startColumnIndex: 0,
          endColumnIndex: 8, // Columns A-H
        },
        destination: {
          sheetId: sheetId,
          startRowIndex: destStartRow,
          endRowIndex: destStartRow + rowsPerVoucher,
          startColumnIndex: 0,
          endColumnIndex: 8,
        },
        pasteType: 'PASTE_FORMAT', // Only copy formatting, not values
      },
    });

    // Also copy the static template text (headers, labels)
    requests.push({
      copyPaste: {
        source: {
          sheetId: sheetId,
          startRowIndex: sourceStartRow,
          endRowIndex: sourceStartRow + 9, // First 9 rows have headers/labels
          startColumnIndex: 0,
          endColumnIndex: 8,
        },
        destination: {
          sheetId: sheetId,
          startRowIndex: destStartRow,
          endRowIndex: destStartRow + 9,
          startColumnIndex: 0,
          endColumnIndex: 8,
        },
        pasteType: 'PASTE_NORMAL',
      },
    });
  }

  // Execute in batches to avoid hitting limits
  const batchSize = 20;
  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    console.log(`Executing batch ${Math.floor(i / batchSize) + 1}...`);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: batch },
    });

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('Done! All voucher templates have been set up.');
}

// Clear the data values but keep formatting for new vouchers
async function clearNewVoucherData() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const startBpv = 56;
  const endBpv = 100;
  const rowsPerVoucher = 27;

  const ranges = [];

  for (let bpvNum = startBpv; bpvNum <= endBpv; bpvNum++) {
    const baseRow = 393 + ((bpvNum - 18) * rowsPerVoucher);

    // Clear BPV No (D column)
    ranges.push(`'${SHEET_NAME}'!D${baseRow}`);
    // Clear Date
    ranges.push(`'${SHEET_NAME}'!D${baseRow + 1}`);
    // Clear PDC type
    ranges.push(`'${SHEET_NAME}'!E${baseRow}`);
    // Clear data rows (5 rows starting at baseRow + 7)
    for (let i = 0; i < 5; i++) {
      ranges.push(`'${SHEET_NAME}'!A${baseRow + 7 + i}:G${baseRow + 7 + i}`);
    }
    // Clear total
    ranges.push(`'${SHEET_NAME}'!C${baseRow + 9}`);
  }

  // Clear in batches
  const batchSize = 50;
  for (let i = 0; i < ranges.length; i += batchSize) {
    const batch = ranges.slice(i, i + batchSize);
    await sheets.spreadsheets.values.batchClear({
      spreadsheetId: SHEET_ID,
      requestBody: { ranges: batch },
    });
  }

  console.log('Cleared data from new voucher slots (keeping formatting).');
}

// Run the setup
async function main() {
  try {
    console.log('Setting up voucher templates for BPV 56-100...\n');
    await setupVoucherTemplates();

    console.log('\nClearing placeholder data...');
    await clearNewVoucherData();

    console.log('\nAll done! New voucher slots are ready to use.');
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

main();
