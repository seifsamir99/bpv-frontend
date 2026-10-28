// Salaries are processed one month behind: pages default to the previous month
// (opened in July → June). Jan rolls back to Dec of the prior year.
export function getPrevMonth(date = new Date()) {
  const month = date.getMonth(); // 0-indexed
  if (month === 0) return { month: 11, year: date.getFullYear() - 1 };
  return { month: month - 1, year: date.getFullYear() };
}

export default getPrevMonth;
