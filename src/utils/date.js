export function todayISO() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Australia/Sydney"
  });
}

export function isISODate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
