// Payroll calculation logic — ported directly from n8n workflow JS code nodes

function isPaidDay(value) {
  if (!value) return false;
  const v = value.toString().toLowerCase().trim();
  return ['present', 'off', 'sick', 'p'].includes(v);
}

function isDeductionDay(value) {
  if (!value) return false;
  const v = value.toString().toLowerCase().trim();
  return ['leave', 'joined', 'absent'].includes(v);
}

function isAbsent(value) {
  if (!value) return false;
  return value.toString().toLowerCase().trim() === 'absent';
}

/**
 * Last day of the month that still earns pay.
 *
 * `cutoffDay` comes from /api/attendance and encodes a Cancelled/Resigned
 * marking (see _cutoff_day in employee_attendance_service.py):
 *   null -> not ended, or ended in a later month: count the whole month
 *   0    -> already gone before this month: count nothing
 *   N    -> ended on day N: count days 1..N-1 only
 *
 * The cut-off is applied to the LOOP, not to the individual statuses, on
 * purpose. Days after a man leaves are frequently already sitting there as
 * Present from a "Mark all days as Present", and skipping them one status at
 * a time would still pay him for them - and could still trip the absent-day
 * penalty.
 */
function lastPaidDay(att, daysInMonth) {
  const cutoff = att?.cutoffDay;
  if (cutoff === null || cutoff === undefined) return daysInMonth;
  return Math.min(daysInMonth, cutoff - 1);
}

function endedRow(emp, att) {
  return {
    employeeId: emp.employeeId,
    name: emp.name,
    designation: emp.designation,
    paidDays: 0,
    deductionDays: 0,
    absentDays: 0,
    effectiveDeductionDays: 0,
    deductionAmount: 0,
    ratePerHour: 0,
    salaryBeforeOT: 0,
    otHours: 0,
    otPay: 0,
    netSalary: 0,
    endDate: att?.endDate || null,
    endReason: att?.endReason || null,
  };
}

// Index /api/month-end rows by employeeId; missing rows resolve to zeros/blanks
function adjustmentsById(adjustments) {
  const map = {};
  (adjustments || []).forEach(a => { map[String(a.employeeId)] = a; });
  return map;
}

const NO_ADJUSTMENT = { otHours: 0, bonus: 0, bonusReason: '', deductionAmount: 0, deductionReason: '', deductionNote: '' };

/**
 * Labour payroll: includes OT and absent-day penalty rule.
 * @param {Array} employees   — from GET /api/employees?type=labour
 * @param {Array} attendance  — from GET /api/attendance?type=labour
 * @param {Array} adjustments — from GET /api/month-end for the SAME month
 *                              (per-month OT hours + bonus/deduction entries)
 * @returns {Array} payroll result rows
 */
export function calculateLabourPayroll(employees, attendance, adjustments) {
  const adjMap = adjustmentsById(adjustments);
  return employees.map(emp => {
    const adj = adjMap[String(emp.employeeId)] || NO_ADJUSTMENT;
    const att = attendance.find(a =>
      String(a.employeeId) === String(emp.employeeId) ||
      (a.name && emp.name && a.name.trim().toLowerCase() === emp.name.trim().toLowerCase())
    );

    if (!att) {
      return {
        employeeId: emp.employeeId,
        name: emp.name,
        designation: emp.designation,
        paidDays: 0,
        deductionDays: 0,
        absentDays: 0,
        effectiveDeductionDays: 0,
        deductionAmount: 0,
        ratePerHour: 0,
        salaryBeforeOT: 0,
        otHours: 0,
        otPay: 0,
        netSalary: 0,
      };
    }

    // Already Cancelled/Resigned in an earlier month - no pay, no OT, no bonus.
    if (att.cutoffDay === 0) return endedRow(emp, att);

    // Determine days in month from attendance data
    const daysInMonth = (att.days && att.days[31] && att.days[31].toString().trim() !== '') ? 31 : 30;
    const lastDay = lastPaidDay(att, daysInMonth);

    let paidDays = 0;
    let deductionDays = 0;
    let absentDays = 0;

    for (let day = 1; day <= lastDay; day++) {
      const status = att.days?.[day];
      if (isPaidDay(status)) paidDays++;
      if (isDeductionDay(status)) deductionDays++;
      if (isAbsent(status)) absentDays++;
    }

    const ratePerDay = parseFloat(emp.ratePerDay) || 0;
    const ratePerHour = ratePerDay / 8;
    const grossSalary = ratePerDay * paidDays;

    // Penalty: up to 3 absences are taken at face value. From the 4th absence
    // on, EVERY absent day counts as two — 4 absences = 8 days deducted.
    // An absent day already costs one day of pay by not being in paidDays,
    // so only the EXTRA day per absence is charged here (never double-charge).
    const penaltyDays = absentDays > 3 ? absentDays : 0;
    const absentPenalty = ratePerDay * penaltyDays;
    // deductionDays already counts each absence once; doubling adds one more.
    const effectiveDeductionDays = deductionDays + penaltyDays;

    // Manual Month-End adjustments (per employee, per month): bonus adds,
    // deduction subtracts. "Deductions" reflects money actually taken off pay,
    // i.e. the manual entry plus the absent penalty above.
    const bonus = parseFloat(adj.bonus) || 0;
    const manualDeduction = parseFloat(adj.deductionAmount) || 0;
    const deductionAmount = manualDeduction + absentPenalty;

    // Explain the penalty on the payslip/remarks without clobbering the
    // office's own note.
    const penaltyNote = penaltyDays
      ? `${absentDays} absent x2 = ${absentDays * 2} days (extra ${penaltyDays} x ${ratePerDay.toFixed(2)} = ${absentPenalty.toFixed(2)})`
      : '';
    const deductionNote = [adj.deductionNote, penaltyNote].filter(Boolean).join(' | ');
    const deductionReason = adj.deductionReason || (penaltyDays ? 'Absent penalty' : '');

    const salaryBeforeOT = grossSalary;
    const otHours = parseFloat(adj.otHours) || 0;
    const otRatePerHour = ratePerHour * 1.25;
    const otPay = otHours * otRatePerHour;
    const netSalary = salaryBeforeOT + otPay + bonus - deductionAmount;

    return {
      employeeId: emp.employeeId,
      name: emp.name,
      designation: emp.designation,
      paidDays,
      deductionDays,
      absentDays,
      effectiveDeductionDays,
      absentPenaltyDays: penaltyDays,
      absentPenalty: parseFloat(absentPenalty.toFixed(2)),
      manualDeduction: parseFloat(manualDeduction.toFixed(2)),
      deductionAmount: parseFloat(deductionAmount.toFixed(2)),
      deductionReason,
      deductionNote,
      bonus: parseFloat(bonus.toFixed(2)),
      bonusReason: adj.bonusReason || '',
      ratePerHour: parseFloat(ratePerHour.toFixed(2)),
      salaryBeforeOT: parseFloat(salaryBeforeOT.toFixed(2)),
      otHours: parseFloat(otHours.toFixed(2)),
      otPay: parseFloat(otPay.toFixed(2)),
      // Round net pay to the nearest whole AED (kills the 3,999.90 artifacts
      // that come from rate/day being stored to 2 decimals)
      netSalary: Math.round(netSalary),
      endDate: att.endDate || null,
      endReason: att.endReason || null,
    };
  });
}

/**
 * Staff payroll: no OT, uses Deductions from employee record.
 * @param {Array} employees   — from GET /api/employees?type=staff
 * @param {Array} attendance  — from GET /api/attendance?type=staff
 * @param {Array} adjustments — from GET /api/month-end for the SAME month
 *                              (labour-only today, so staff rows resolve to zeros)
 * @returns {Array} payroll result rows
 */
export function calculateStaffPayroll(employees, attendance, adjustments) {
  const adjMap = adjustmentsById(adjustments);
  return employees.map(emp => {
    const adj = adjMap[String(emp.employeeId)] || NO_ADJUSTMENT;
    const att = attendance.find(a =>
      String(a.employeeId) === String(emp.employeeId) ||
      (a.name && emp.name && a.name.trim().toLowerCase() === emp.name.trim().toLowerCase())
    );

    if (!att) {
      return {
        employeeId: emp.employeeId,
        name: emp.name,
        designation: emp.designation,
        paidDays: 0,
        deductionAmount: 0,
        ratePerHour: 0,
        otHours: 0,
        otPay: 0,
        netSalary: 0,
      };
    }

    if (att.cutoffDay === 0) return endedRow(emp, att);

    const daysInMonth = 30;
    const lastDay = lastPaidDay(att, daysInMonth);
    let paidDays = 0;
    let deductionDays = 0;

    for (let day = 1; day <= lastDay; day++) {
      const status = att.days?.[day];
      if (isPaidDay(status)) paidDays++;
      if (isDeductionDay(status)) deductionDays++;
    }

    const ratePerDay = parseFloat(emp.ratePerDay) || 0;
    const ratePerHour = ratePerDay / 8;
    const grossSalary = ratePerDay * paidDays;
    const otherDeductions = parseFloat(emp.deductions) || 0;

    // Manual Month-End adjustments: bonus adds, deduction subtracts,
    // OT adds at 1.25× the hourly rate (same rule as labour).
    const bonus = parseFloat(adj.bonus) || 0;
    const manualDeduction = parseFloat(adj.deductionAmount) || 0;
    const otHours = parseFloat(adj.otHours) || 0;
    const otPay = otHours * ratePerHour * 1.25;
    const totalDeductions = otherDeductions + manualDeduction;
    const netSalary = grossSalary - totalDeductions + bonus + otPay;

    return {
      employeeId: emp.employeeId,
      name: emp.name,
      designation: emp.designation,
      paidDays,
      deductionAmount: parseFloat(totalDeductions.toFixed(2)),
      deductionReason: adj.deductionReason || '',
      deductionNote: adj.deductionNote || '',
      bonus: parseFloat(bonus.toFixed(2)),
      bonusReason: adj.bonusReason || '',
      ratePerHour: parseFloat(ratePerHour.toFixed(2)),
      otHours: parseFloat(otHours.toFixed(2)),
      otPay: parseFloat(otPay.toFixed(2)),
      // Round net pay to the nearest whole AED (kills the 3,999.90 artifacts)
      netSalary: Math.round(netSalary),
      endDate: att.endDate || null,
      endReason: att.endReason || null,
    };
  });
}
