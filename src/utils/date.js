export function todayISO() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Australia/Sydney"
  });
}

export function isISODate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function addDaysISO(date, days) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function daysAgoISO(days) {
  return addDaysISO(todayISO(), -days);
}

export function nowPlusDaysISO(days) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString();
}
