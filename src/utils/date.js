function todayISO() {
  try {
    const result = new Date().toLocaleDateString("en-CA", {
      timeZone: "Australia/Sydney"
    });
    if (/^\d{4}-\d{2}-\d{2}$/.test(result)) {
      return result;
    }
  } catch {
    // fall through to local time fallback
  }
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isISODate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDaysISO(date, days) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function daysAgoISO(days) {
  return addDaysISO(todayISO(), -days);
}

function nowPlusDaysISO(days) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString();
}

module.exports = { todayISO, isISODate, addDaysISO, daysAgoISO, nowPlusDaysISO };
