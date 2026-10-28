// WPS salary-transfer sheet (the bank's .xls upload).
// The bank file is the only place that holds each employee's MOL code, full
// legal name, bank routing code and account number, so the office uploads
// last month's file as the template and we refill the pay columns from the
// payroll: INCOMEFIXED = net − (OT + bonus), INCOMEVAR = OT + bonus,
// LEAVEDAYS = absent days.
import * as XLSX from 'xlsx';

const HEADERS = ['COMPMOLCODE', 'EMPMOLCODE', 'EMPNAME', 'PAYSTARTON', 'PAYENDON', 'INCOMEFIXED', 'INCOMEVAR', 'LEAVEDAYS', 'SALMONTH', 'SALYEAR', 'BANKCODE', 'ACC.NO'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TRANSFER_CHARGE = 5.25;
export const ON_LEAVE = 'On Leave';

const STORAGE_KEY = 'newell-wps-map-v1';

// Payroll covers employees of both companies; each has its own WPS file,
// told apart by the COMPMOLCODE column.
const COMPANIES = {
  '0000000787503': 'NEWELL ELECTROMECHANICAL LLC',
  '0000002540009': 'NAJMAT AL WAAD TECHNICAL SERVICES LLC',
};

export function companyName(compMol, fileName = '') {
  if (COMPANIES[compMol]) return COMPANIES[compMol];
  // Unknown company: the uploaded file name minus copy suffixes like " (3) (1)"
  return fileName.replace(/\.[^.]+$/, '').replace(/\s*\(\d+\)/g, '').split(' - ')[0].trim() || `MOL ${compMol}`;
}

const round2 = (n) => Math.round((n || 0) * 100) / 100;

// --- Template ---------------------------------------------------------------

// Rows of the uploaded WPS file, read as text so MOL codes and account
// numbers keep their leading zeros. Stops at the first row without an
// EMPMOLCODE (the blank row above TOTAL SALARY).
export function parseWpsTemplate(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

  const headerIdx = rows.findIndex(r => r.some(c => String(c).trim().toUpperCase() === 'EMPMOLCODE'));
  if (headerIdx === -1) throw new Error('This is not a WPS file — no EMPMOLCODE column found');
  const col = {};
  rows[headerIdx].forEach((h, i) => { col[String(h).trim().toUpperCase()] = i; });
  const get = (r, name) => String(r[col[name]] ?? '').trim();

  const out = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!get(r, 'EMPMOLCODE')) break;
    out.push({
      compMol: get(r, 'COMPMOLCODE'),
      molCode: get(r, 'EMPMOLCODE'),
      name: get(r, 'EMPNAME'),
      bankCode: get(r, 'BANKCODE'),
      accNo: get(r, 'ACC.NO'),
    });
  }
  if (out.length === 0) throw new Error('No employee rows found in the WPS file');
  return out;
}

// --- Name matching ----------------------------------------------------------

const tokens = (s) => String(s || '').toUpperCase().replace(/[^A-Z]+/g, ' ').trim().split(' ').filter(Boolean);

function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

// Spelling drift between the bank's legal name and the payroll name
// (JAHANGIR / JANHAGIR, MOHAMMAD / MOHAMMED)
function sameWord(a, b) {
  if (a === b) return true;
  const len = Math.min(a.length, b.length);
  if (len >= 7) return editDistance(a, b) <= 2;
  if (len >= 4) return editDistance(a, b) <= 1;
  return false;
}

// A payroll word found in the legal name, as-is or as a short form
// ("SEIF" of SEIFELDIN, "EMAD" of EMADELDIEN)
const wordIn = (w, t) => w.some(x => sameWord(x, t) || (t.length >= 4 && x.startsWith(t)));

// Payroll name written as one word where the legal name has two or more
// ("SHANAWAZ" vs "SHAH NAWAZ")
function joinedIn(w, compact) {
  for (let i = 0; i < w.length; i++) {
    let joined = '';
    for (let j = i; j < w.length && joined.length < compact.length + 2; j++) {
      joined += w[j];
      if (j > i && sameWord(joined, compact)) return true;
    }
  }
  return false;
}

// How strongly a payroll name points at a WPS legal name. 0 = no match.
// Every word of the (shorter) payroll name has to be found in the legal name.
// Exact words break ties between near-spellings ("MOHAMED EMAD" beats
// "MOHAMMAD IRFAN" for MOHAMED EMADELDIEN ERFAN).
function nameScore(wpsName, payrollName) {
  const w = tokens(wpsName);
  const p = tokens(payrollName);
  if (p.length === 0) return 0;
  const hits = p.filter(t => wordIn(w, t)).length;
  const exact = p.filter(t => w.includes(t)).length * 0.1;
  if (hits === p.length) return 10 + hits + exact;
  if (p.length === 1 && p[0].length >= 5 && joinedIn(w, p[0])) return 11;
  return hits >= 2 ? hits + exact : 0;
}

// { [molCode]: employeeId } for every WPS row we can pair confidently.
// A remembered pairing wins. The rest are paired strongest-first; a row whose
// best employee is already taken falls back to its next best, and a tie
// between two free employees is left for the office to pick.
export function autoMatch(templateRows, payrollRows, savedMap = {}) {
  const ids = new Set(payrollRows.map(r => String(r.employeeId)));
  const result = {};
  const taken = new Set();

  templateRows.forEach(t => {
    const saved = savedMap[t.molCode];
    if (saved === '') { result[t.molCode] = ''; return; } // explicitly "not in payroll"
    if (saved && ids.has(String(saved)) && !taken.has(String(saved))) {
      result[t.molCode] = String(saved);
      taken.add(String(saved));
    }
  });

  const pairs = [];
  templateRows.forEach(t => {
    if (t.molCode in result) return;
    payrollRows.forEach(r => {
      const score = nameScore(t.name, r.name);
      if (score > 0) pairs.push({ mol: t.molCode, id: String(r.employeeId), score });
    });
  });

  const ambiguous = new Set();
  pairs.sort((a, b) => b.score - a.score).forEach(p => {
    if (p.mol in result || ambiguous.has(p.mol) || taken.has(p.id)) return;
    const tie = pairs.some(q => q.mol === p.mol && q.id !== p.id && q.score === p.score && !taken.has(q.id));
    if (tie) { ambiguous.add(p.mol); return; }
    result[p.mol] = p.id;
    taken.add(p.id);
  });
  return result;
}

// --- Values -----------------------------------------------------------------

// Pay split for one payroll row. Saved payrolls don't store absentDays, so
// fall back to the unpaid days of the 30-day month.
export function wpsValues(row) {
  const variable = round2((row.otPay || 0) + (row.bonus || 0));
  const fixed = round2((row.netSalary || 0) - variable);
  const leave = row.absentDays ?? Math.max(0, 30 - (row.paidDays || 0));
  return { fixed, variable, leave };
}

// --- Remembered pairings (per browser) --------------------------------------

// map:          { [EMPMOLCODE]: employeeId } ('' = not in payroll)
// companies:    { [COMPMOLCODE]: employeeId[] } — who was in each company's file
// otherCompany: employeeId[] flagged by hand as not belonging to any file loaded
export function loadWpsMemory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { map: parsed.map || {}, companies: parsed.companies || {}, otherCompany: parsed.otherCompany || [] };
  } catch {
    return { map: {}, companies: {}, otherCompany: [] };
  }
}

export function saveWpsMemory(memory) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // storage blocked — the pairings just won't be remembered
  }
}

// --- Output -----------------------------------------------------------------

// lines: [{ compMol, molCode, name, bankCode, accNo, fixed (number | ON_LEAVE), variable, leave }]
// month is 0-based like the rest of the payroll page.
export function downloadWpsWorkbook(lines, month, year, company) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const mon = SHORT_MONTHS[month];
  const start = `01/${mon}/${year}`;
  const end = `${String(lastDay).padStart(2, '0')}/${mon}/${year}`;

  const aoa = [HEADERS];
  lines.forEach(l => {
    aoa.push([l.compMol, l.molCode, l.name, start, end, l.fixed, l.variable, l.leave, String(month + 1), String(year), l.bankCode, l.accNo]);
  });

  const paid = lines.filter(l => typeof l.fixed === 'number' && l.fixed + l.variable > 0);
  const totalSalary = round2(paid.reduce((s, l) => s + l.fixed + l.variable, 0));
  const charges = round2(TRANSFER_CHARGE * paid.length);

  // Same footer layout as the office's sheet
  aoa.push([]);
  aoa.push(['', '', '', '', 'TOTAL SALARY', totalSalary]);
  aoa.push(['', '', '', '', 'NO. OF TRANSFERS', paid.length]);
  aoa.push(['', '', '', '', 'TRANSFER CHARGES', charges]);
  aoa.push([]);
  aoa.push(['', '', '', '', 'GRAND TOTAL', round2(totalSalary + charges)]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const money = '#,##0.00';
  for (let r = 1; r < aoa.length; r++) {
    ['F', 'G'].forEach(c => {
      const cell = ws[`${c}${r + 1}`];
      if (cell && cell.t === 'n' && !(c === 'F' && aoa[r][4] === 'NO. OF TRANSFERS')) cell.z = money;
    });
  }
  ws['!cols'] = [16, 18, 44, 13, 13, 14, 12, 10, 9, 9, 12, 26].map(wch => ({ wch }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const fileName = `${company} - WPS - ${new Date(year, month).toLocaleString('en-US', { month: 'long' })} ${year}.xls`;
  XLSX.writeFile(wb, fileName, { bookType: 'xls' });
  return { fileName, transfers: paid.length, totalSalary, charges };
}
