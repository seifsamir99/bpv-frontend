const { google } = require('googleapis');

// Initialize Google Sheets API
const getAuth = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth;
};

const getSheets = async () => {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
};

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1DZfS3J6Men-XuX11nXAYnMhgQKCn4SJTFDDFxlEQAwk';
const SHEET_NAME = 'all Bpv';

// Helper to format date
const formatDate = (value) => {
  if (!value) return '';
  if (typeof value === 'number') {
    // Excel serial date conversion
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toLocaleDateString('en-GB');
  }
  return String(value);
};

// Helper to parse amount (handles commas in numbers like "100,000")
const parseAmount = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  // Remove commas and parse
  const cleaned = String(value).replace(/,/g, '');
  return parseFloat(cleaned) || 0;
};

// Convert row to voucher object
const rowToVoucher = (row, rowIndex) => {
  return {
    id: rowIndex + 2, // +2 because row 1 is header, and array is 0-indexed
    bpvNo: row[0] || '',
    date: formatDate(row[3]),
    pdcType: row[7] || 'PDC', // Column H contains CDC/PDC type
    totalAmount: parseAmount(row[6]),
    lineItems: [{
      srNo: 1,
      companyName: row[1] || '',
      description: row[2] || '',
      chequeNo: row[4] || '',
      chequeDate: formatDate(row[5]),
      debit: parseAmount(row[6]),
      credit: 0
    }]
  };
};

// GET all vouchers
const getAllVouchers = async () => {
  const sheets = await getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A2:H`,
  });

  const rows = response.data.values || [];
  const vouchers = rows
    .map((row, index) => rowToVoucher(row, index))
    .filter(v => v.bpvNo || v.totalAmount);

  return { success: true, data: vouchers };
};

// GET next BPV number
const getNextNumber = async () => {
  const sheets = await getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:A`,
  });

  const rows = response.data.values || [];
  let maxBpv = 0;
  for (let i = 1; i < rows.length; i++) {
    const num = parseInt(rows[i][0]) || 0;
    if (num > maxBpv) maxBpv = num;
  }

  return { success: true, data: { nextNumber: maxBpv + 1 } };
};

// GET single voucher by row ID
const getVoucher = async (id) => {
  const sheets = await getSheets();
  const rowNum = parseInt(id);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A${rowNum}:H${rowNum}`,
  });

  const row = response.data.values?.[0];
  if (!row) {
    return { success: false, error: 'Voucher not found' };
  }

  return { success: true, data: rowToVoucher(row, rowNum - 2) };
};

// CREATE new voucher
const createVoucher = async (data) => {
  const sheets = await getSheets();
  const lineItem = data.lineItems?.[0] || {};

  const row = [
    data.bpvNo || '',
    lineItem.companyName || '',
    lineItem.description || '',
    data.date || '',
    lineItem.chequeNo || '',
    lineItem.chequeDate || '',
    lineItem.debit || data.totalAmount || '',
    data.pdcType || 'PDC'
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:H`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });

  // Get the new row number
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:A`,
  });
  const newRowNum = response.data.values?.length || 2;

  return {
    success: true,
    data: {
      id: newRowNum,
      bpvNo: data.bpvNo,
      date: data.date,
      pdcType: data.pdcType || 'PDC',
      totalAmount: lineItem.debit || data.totalAmount || 0,
      lineItems: [lineItem]
    }
  };
};

// UPDATE voucher
const updateVoucher = async (id, data) => {
  const sheets = await getSheets();
  const rowNum = parseInt(id);
  const lineItem = data.lineItems?.[0] || {};

  const row = [
    data.bpvNo || '',
    lineItem.companyName || '',
    lineItem.description || '',
    data.date || '',
    lineItem.chequeNo || '',
    lineItem.chequeDate || '',
    lineItem.debit || data.totalAmount || '',
    data.pdcType || 'PDC'
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A${rowNum}:H${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });

  return {
    success: true,
    data: {
      id: rowNum,
      bpvNo: data.bpvNo,
      date: data.date,
      pdcType: data.pdcType || 'PDC',
      totalAmount: lineItem.debit || data.totalAmount || 0,
      lineItems: [lineItem]
    }
  };
};

// DELETE voucher
const deleteVoucher = async (id) => {
  const sheets = await getSheets();
  const rowNum = parseInt(id);

  // Clear the row (we can't delete rows easily via Sheets API values endpoint)
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A${rowNum}:H${rowNum}`,
  });

  return { success: true };
};

// Main handler
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Handle both direct function calls and /api/bpv redirects
    let path = event.path
      .replace('/.netlify/functions/bpv', '')
      .replace('/api/bpv', '');
    const segments = path.split('/').filter(Boolean);
    const id = segments[0];

    // GET requests
    if (event.httpMethod === 'GET') {
      if (path === '/next-number' || segments[0] === 'next-number') {
        const result = await getNextNumber();
        return { statusCode: 200, headers, body: JSON.stringify(result) };
      }
      if (id && id !== 'next-number') {
        const result = await getVoucher(id);
        return { statusCode: 200, headers, body: JSON.stringify(result) };
      }
      const result = await getAllVouchers();
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // POST - Create
    if (event.httpMethod === 'POST') {
      const data = JSON.parse(event.body);
      const result = await createVoucher(data);
      return { statusCode: 201, headers, body: JSON.stringify(result) };
    }

    // PUT - Update
    if (event.httpMethod === 'PUT' && id) {
      const data = JSON.parse(event.body);
      const result = await updateVoucher(id, data);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // DELETE
    if (event.httpMethod === 'DELETE' && id) {
      const result = await deleteVoucher(id);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ success: false, error: 'Not found' }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
