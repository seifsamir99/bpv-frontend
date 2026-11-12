// Companies on the WPS bank files, told apart by the COMPMOLCODE column.
// Kept apart from wpsExport.js so the Payroll page can name them without
// loading SheetJS.
const COMPANIES = {
  '0000000787503': 'NEWELL ELECTROMECHANICAL LLC',
  '0000002540009': 'NAJMAT AL WAAD TECHNICAL SERVICES LLC',
};

export function companyName(compMol, fileName = '') {
  if (COMPANIES[compMol]) return COMPANIES[compMol];
  // Unknown company: the uploaded file name minus copy suffixes like " (3) (1)"
  return fileName.replace(/\.[^.]+$/, '').replace(/\s*\(\d+\)/g, '').split(' - ')[0].trim() || `MOL ${compMol}`;
}
