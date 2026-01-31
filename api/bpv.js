const { google } = require('googleapis');

// Initialize Google Sheets API
const getAuth = () => {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  // Handle both escaped \n and actual newlines
  if (privateKey) {
    // If key has escaped newlines (\\n), convert them
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

const getSheets = async () => {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
};

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1DZfS3J6Men-XuX11nXAYnMhgQKCn4SJTFDDFxlEQAwk';
const SHEET_NAME = 'BPV';
const ALL_BPV_SHEET = 'all Bpv';

// Build voucher position map
const buildVoucherPositionMap = () => {
  const positions = {};

  const oldFormatBases = [5, 28, 48, 68, 88, 108, 128, 148, 168];
  oldFormatBases.forEach((base, i) => {
    const bpvNum = i + 1;
    positions[bpvNum] = {
      bpvNoRow: base,
      dateRow: base + 1,
      dataRow: base + 7,
      totalRow: base + 9,
      format: 'old'
    };
  });

  const transitional = [
    [10, 194], [11, 221], [12, 241], [13, 261],
    [14, 287], [15, 313], [16, 338], [17, 366]
  ];
  transitional.forEach(([bpvNum, base]) => {
    positions[bpvNum] = {
      bpvNoRow: base,
      dateRow: base + 1,
      dataRow: base + 7,
      totalRow: base + 9,
      format: 'transitional'
    };
  });

  const rowsPerVoucher = 27;
  for (let i = 0; i < 43; i++) {
    const bpvNum = 18 + i;
    const base = 393 + (i * rowsPerVoucher);
    positions[bpvNum] = {
      bpvNoRow: base,
      dateRow: base + 1,
      dataRow: base + 7,
      totalRow: base + 9,
      format: 'new'
    };
  }

  return positions;
};

const VOUCHER_POSITIONS = buildVoucherPositionMap();

const formatDate = (value) => {
  if (!value) return '';
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toLocaleDateString('en-GB');
  }
  return String(value);
};

const parseAmount = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/,/g, '');
  return parseFloat(cleaned) || 0;
};

const getCell = (rows, rowIdx, colIdx) => {
  if (rowIdx < rows.length) {
    const row = rows[rowIdx];
    if (colIdx < row.length) {
      return row[colIdx];
    }
  }
  return '';
};

const parseVoucherAtPosition = (rows, bpvNum, pos) => {
  const bpvNoRow = pos.bpvNoRow - 1;
  const dateRow = pos.dateRow - 1;
  const dataRow = pos.dataRow - 1;
  const totalRow = pos.totalRow - 1;

  const bpvNo = getCell(rows, bpvNoRow, 3);
  const date = getCell(rows, dateRow, 3);
  const pdcType = getCell(rows, bpvNoRow, 4) || 'PDC';

  const lineItems = [];
  const skipLabels = ['TOTAL AMOUNT', 'Prepared By', 'Received By', 'Approved By', 'Checked By', '___'];

  for (let i = 0; i < 5; i++) {
    const itemRow = dataRow + i;
    const srNo = getCell(rows, itemRow, 0);
    const description = getCell(rows, itemRow, 1);
    const companyName = getCell(rows, itemRow, 2);
    const chq = getCell(rows, itemRow, 3);
    const chqDate = getCell(rows, itemRow, 4);
    const debit = getCell(rows, itemRow, 5);
    const credit = getCell(rows, itemRow, 6);

    const isLabel = skipLabels.some(label => String(description).includes(label));
    if (isLabel) continue;

    const hasAmount = parseAmount(debit) > 0 || parseAmount(credit) > 0;
    const hasContent = Boolean(companyName) || Boolean(description);

    if (hasContent && hasAmount) {
      lineItems.push({
        srNo: srNo || String(lineItems.length + 1),
        description: description,
        companyName: companyName,
        chequeNo: chq,
        chequeDate: formatDate(chqDate),
        debit: parseAmount(debit),
        credit: parseAmount(credit)
      });
    }
  }

  const totalStr = getCell(rows, totalRow, 2);
  const totalAmount = parseAmount(totalStr);
  const hasData = lineItems.length > 0 || totalAmount > 0;

  return {
    id: bpvNum,
    bpvNo: bpvNo,
    date: formatDate(date),
    pdcType: pdcType,
    lineItems: lineItems,
    totalAmount: totalAmount,
    hasData: hasData,
    baseRow: pos.dataRow,
    format: pos.format
  };
};

const getAllVouchers = async () => {
  const sheets = await getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${SHEET_NAME}'!A1:G2000`,
  });

  const rows = response.data.values || [];
  const vouchers = [];

  for (const [bpvNumStr, pos] of Object.entries(VOUCHER_POSITIONS)) {
    const bpvNum = parseInt(bpvNumStr);
    try {
      const voucher = parseVoucherAtPosition(rows, bpvNum, pos);
      if (voucher && voucher.hasData) {
        vouchers.push(voucher);
      }
    } catch (error) {
      console.error(`Error parsing BPV #${bpvNum}:`, error);
    }
  }

  return { success: true, data: vouchers };
};

const getNextNumber = async () => {
  const { data: vouchers } = await getAllVouchers();

  if (!vouchers || vouchers.length === 0) {
    return { success: true, data: { nextNumber: 1 } };
  }

  const bpvNumbers = vouchers
    .map(v => parseInt(v.bpvNo))
    .filter(n => !isNaN(n));

  if (bpvNumbers.length === 0) {
    return { success: true, data: { nextNumber: 1 } };
  }

  const maxBpv = Math.max(...bpvNumbers);
  return { success: true, data: { nextNumber: maxBpv + 1 } };
};

const getVoucher = async (id) => {
  const bpvNum = parseInt(id);
  const pos = VOUCHER_POSITIONS[bpvNum];

  if (!pos) {
    return { success: false, error: 'Voucher position not found' };
  }

  const sheets = await getSheets();
  const startRow = pos.bpvNoRow - 5;
  const endRow = pos.totalRow + 10;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${SHEET_NAME}'!A${startRow}:G${endRow}`,
  });

  const rows = response.data.values || [];

  const adjustedPos = {
    bpvNoRow: pos.bpvNoRow - startRow + 1,
    dateRow: pos.dateRow - startRow + 1,
    dataRow: pos.dataRow - startRow + 1,
    totalRow: pos.totalRow - startRow + 1,
    format: pos.format
  };

  const voucher = parseVoucherAtPosition(rows, bpvNum, adjustedPos);
  return { success: true, data: voucher };
};

const findEmptySlot = async () => {
  const { data: vouchers } = await getAllVouchers();
  const usedSlots = new Set(vouchers.map(v => v.id));

  const sortedPositions = Object.keys(VOUCHER_POSITIONS)
    .map(k => parseInt(k))
    .sort((a, b) => a - b);

  for (const bpvNum of sortedPositions) {
    if (!usedSlots.has(bpvNum)) {
      return bpvNum;
    }
  }

  return null;
};

const calculateTotal = (lineItems) => {
  let total = 0;
  for (const item of lineItems || []) {
    total += parseAmount(item.debit) || 0;
  }
  return Math.round(total * 100) / 100;
};

const syncToAllBpv = async (bpvNum, voucherData) => {
  const sheets = await getSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${ALL_BPV_SHEET}'!A:A`,
  });

  const rows = response.data.values || [];
  let targetRow = -1;

  for (let i = 0; i < rows.length; i++) {
    const cellValue = rows[i][0];
    if (cellValue && parseInt(cellValue) === bpvNum) {
      targetRow = i + 1;
      break;
    }
  }

  const firstItem = voucherData.lineItems?.[0] || {};

  const rowData = [
    voucherData.bpvNo || bpvNum,
    firstItem.companyName || '',
    firstItem.description || '',
    voucherData.date || '',
    firstItem.chequeNo || '',
    firstItem.chequeDate || '',
    voucherData.totalAmount || '',
    voucherData.pdcType || 'PDC'
  ];

  if (targetRow > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${ALL_BPV_SHEET}'!A${targetRow}:H${targetRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rowData] }
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `'${ALL_BPV_SHEET}'!A:H`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [rowData] }
    });
  }
};

const clearFromAllBpv = async (bpvNum) => {
  const sheets = await getSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${ALL_BPV_SHEET}'!A:A`,
  });

  const rows = response.data.values || [];

  for (let i = 0; i < rows.length; i++) {
    const cellValue = rows[i][0];
    if (cellValue && parseInt(cellValue) === bpvNum) {
      const targetRow = i + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `'${ALL_BPV_SHEET}'!A${targetRow}:H${targetRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: [['', '', '', '', '', '', '', '']] }
      });
      break;
    }
  }
};

const createVoucher = async (data) => {
  const emptySlot = await findEmptySlot();
  if (!emptySlot) {
    return { success: false, error: 'No empty voucher slots available' };
  }

  const result = await updateVoucher(emptySlot, data, true);

  if (result.success && result.data) {
    await syncToAllBpv(emptySlot, result.data);
  }

  return result;
};

const updateVoucher = async (id, data, skipSync = false) => {
  const bpvNum = parseInt(id);
  const pos = VOUCHER_POSITIONS[bpvNum];

  if (!pos) {
    return { success: false, error: `Voucher #${bpvNum} not found in position map` };
  }

  const sheets = await getSheets();
  const requests = [];

  if (data.bpvNo !== undefined) {
    requests.push({
      range: `'${SHEET_NAME}'!D${pos.bpvNoRow}`,
      values: [[data.bpvNo]]
    });
  }

  if (data.date !== undefined) {
    requests.push({
      range: `'${SHEET_NAME}'!D${pos.dateRow}`,
      values: [[data.date]]
    });
  }

  if (data.pdcType !== undefined) {
    requests.push({
      range: `'${SHEET_NAME}'!E${pos.bpvNoRow}`,
      values: [[data.pdcType]]
    });
  }

  if (data.lineItems) {
    const lineItems = data.lineItems.slice(0, 5);

    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      const row = pos.dataRow + i;
      requests.push({
        range: `'${SHEET_NAME}'!A${row}:G${row}`,
        values: [[
          item.srNo || String(i + 1),
          item.description || '',
          item.companyName || '',
          item.chequeNo || '',
          item.chequeDate || '',
          item.debit || '',
          item.credit || ''
        ]]
      });
    }

    for (let i = lineItems.length; i < 5; i++) {
      const row = pos.dataRow + i;
      requests.push({
        range: `'${SHEET_NAME}'!A${row}:G${row}`,
        values: [['', '', '', '', '', '', '']]
      });
    }
  }

  if (data.totalAmount !== undefined) {
    requests.push({
      range: `'${SHEET_NAME}'!C${pos.totalRow}`,
      values: [[data.totalAmount]]
    });
  } else if (data.lineItems) {
    const total = calculateTotal(data.lineItems);
    requests.push({
      range: `'${SHEET_NAME}'!C${pos.totalRow}`,
      values: [[total]]
    });
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        data: requests,
        valueInputOption: 'USER_ENTERED'
      }
    });
  }

  const result = await getVoucher(bpvNum);

  if (!skipSync && result.success && result.data) {
    await syncToAllBpv(bpvNum, result.data);
  }

  return result;
};

const deleteVoucher = async (id) => {
  const bpvNum = parseInt(id);
  const pos = VOUCHER_POSITIONS[bpvNum];

  if (!pos) {
    return { success: false, error: `Voucher #${bpvNum} not found` };
  }

  const sheets = await getSheets();

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${SHEET_NAME}'!D${pos.bpvNoRow}:E${pos.bpvNoRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['', '']] }
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${SHEET_NAME}'!D${pos.dateRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['']] }
  });

  for (let i = 0; i < 5; i++) {
    const row = pos.dataRow + i;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${SHEET_NAME}'!A${row}:G${row}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[String(i + 1), '', '', '', '', '', '']] }
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${SHEET_NAME}'!C${pos.totalRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['']] }
  });

  await clearFromAllBpv(bpvNum);

  return { success: true, message: `Voucher #${bpvNum} deleted` };
};

// Vercel serverless function handler
module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Parse path from URL
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathParts = url.pathname.replace('/api/bpv', '').split('/').filter(Boolean);
    const id = pathParts[0];

    // GET requests
    if (req.method === 'GET') {
      if (id === 'next-number') {
        const result = await getNextNumber();
        return res.status(200).json(result);
      }
      if (id) {
        const result = await getVoucher(id);
        return res.status(200).json(result);
      }
      const result = await getAllVouchers();
      return res.status(200).json(result);
    }

    // POST - Create
    if (req.method === 'POST') {
      const result = await createVoucher(req.body);
      return res.status(201).json(result);
    }

    // PUT - Update
    if (req.method === 'PUT' && id) {
      const result = await updateVoucher(id, req.body);
      return res.status(200).json(result);
    }

    // DELETE
    if (req.method === 'DELETE' && id) {
      const result = await deleteVoucher(id);
      return res.status(200).json(result);
    }

    return res.status(404).json({ success: false, error: 'Not found' });
  } catch (error) {
    console.error('BPV API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
