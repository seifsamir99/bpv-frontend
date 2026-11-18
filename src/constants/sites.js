// The company's active sites, shared by the LPO and Job Order pages so the
// two dropdowns can't drift apart. `site` is the LPO delivery-site line,
// `project` the full project description printed on both documents, and
// `code` the project code used in Job Order ref numbers (JO/NEMW/<code>/...).
// Leave `code` blank where none is known; the user types it.
export const PREDEFINED_SITES = [
  {
    name: 'Warsan',
    code: 'S108',
    site: 'WARSAN - G+2P+7 RESIDENTIAL TOWER FOR AJMAL REAL ESTATE ON PLOT NO IC3-L-03 - WARSAN 4TH - 624',
    project: 'G+2P+7 RESIDENTIAL TOWER FOR AJMAL REAL ESTATE ON PLOT NO IC3-L-03 - WARSAN 4TH - 624',
  },
  {
    name: 'Wadi Al Safa 3',
    code: '',
    site: 'WADI AL SAFA 3 - G+3 POD +13 FLOORS+ROOF ON PLOT NO 645-7809 WADI AL SAFA 3 FOR MR AHMAD HUSSEIN HUSSEIN ABOU EID',
    project: 'G+3 POD +13 FLOORS+ROOF ON PLOT NO 645-7809 WADI AL SAFA 3 FOR MR AHMAD HUSSEIN HUSSEIN ABOU EID',
  },
  {
    name: 'Nadd Al Shiba',
    code: 'S106',
    site: 'NADD AL SHIBA - G+ 2POD. + 6+ ROOF) PLOT NO. 618-5417 AT NADD AL SHIBA FIRST HUSSEIN HASSAN ABOU EID (S#106)',
    project: 'G+ 2POD. + 6+ ROOF) PLOT NO. 618-5417 AT NADD AL SHIBA FIRST HUSSEIN HASSAN ABOU EID (S#106)',
  },
  {
    name: 'Jedaf',
    code: '',
    site: 'JEDAF - 4P + G+ 6 TYP + 1 R AT AL JEDAF ON PLOT NO. 3260901 FOR SHEIKH MOHAMMED SALEM SULTAN AL QASSIMI',
    project: '4P + G+ 6 TYP + 1 R AT AL JEDAF ON PLOT NO. 3260901 FOR SHEIKH MOHAMMED SALEM SULTAN AL QASSIMI',
  },
];
