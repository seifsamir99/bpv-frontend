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
 * Labour payroll: includes OT and absent-day penalty rule.
 * @param {Array} employees  — from GET /api/employees?type=labour
 * @param {Array} attendance — from GET /api/attendance?type=labour
 * @returns {Array} payroll result rows
 */
export function calculateLabourPayroll(employees, attendance) {
  return employees.map(emp => {
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

    // Determine days in month from attendance data
    const daysInMonth = (att.days && att.days[31] && att.days[31].toString().trim() !== '') ? 31 : 30;

    let paidDays = 0;
    let deductionDays = 0;
    let absentDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const status = att.days?.[day];
      if (isPaidDay(status)) paidDays++;
      if (isDeductionDay(status)) deductionDays++;
      if (isAbsent(status)) absentDays++;
    }

    const ratePerDay = parseFloat(emp.ratePerDay) || 0;
    const ratePerHour = ratePerDay / 8;
    const grossSalary = ratePerDay * paidDays;

    // Penalty: absent days > 3 → each absent day counts as 2 deduction days
    let effectiveDeductionDays = deductionDays;
    if (absentDays > 3) {
      effectiveDeductionDays = (deductionDays - absentDays) + (absentDays * 2);
    }
    const deductionAmount = ratePerDay * effectiveDeductionDays;

    const salaryBeforeOT = grossSalary;
    const otHours = parseFloat(emp.otHours) || 0;
    const otRatePerHour = ratePerHour * 1.25;
    const otPay = otHours * otRatePerHour;
    const netSalary = salaryBeforeOT + otPay;

    return {
      employeeId: emp.employeeId,
      name: emp.name,
      designation: emp.designation,
      paidDays,
      deductionDays,
      absentDays,
      effectiveDeductionDays,
      deductionAmount: parseFloat(deductionAmount.toFixed(2)),
      ratePerHour: parseFloat(ratePerHour.toFixed(2)),
      salaryBeforeOT: parseFloat(salaryBeforeOT.toFixed(2)),
      otHours: parseFloat(otHours.toFixed(2)),
      otPay: parseFloat(otPay.toFixed(2)),
      netSalary: parseFloat(netSalary.toFixed(2)),
    };
  });
}

/**
 * Staff payroll: no OT, uses Deductions from employee record.
 * @param {Array} employees  — from GET /api/employees?type=staff
 * @param {Array} attendance — from GET /api/attendance?type=staff
 * @returns {Array} payroll result rows
 */
export function calculateStaffPayroll(employees, attendance) {
  return employees.map(emp => {
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
        netSalary: 0,
      };
    }

    const daysInMonth = 30;
    let paidDays = 0;
    let deductionDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const status = att.days?.[day];
      if (isPaidDay(status)) paidDays++;
      if (isDeductionDay(status)) deductionDays++;
    }

    const ratePerDay = parseFloat(emp.ratePerDay) || 0;
    const ratePerHour = ratePerDay / 8;
    const grossSalary = ratePerDay * paidDays;
    const attendanceDeduction = ratePerDay * deductionDays;
    const otherDeductions = parseFloat(emp.deductions) || 0;
    const totalDeductions = attendanceDeduction + otherDeductions;
    const netSalary = grossSalary - otherDeductions;

    return {
      employeeId: emp.employeeId,
      name: emp.name,
      designation: emp.designation,
      paidDays,
      deductionAmount: parseFloat(totalDeductions.toFixed(2)),
      ratePerHour: parseFloat(ratePerHour.toFixed(2)),
      netSalary: parseFloat(netSalary.toFixed(2)),
    };
  });
}
