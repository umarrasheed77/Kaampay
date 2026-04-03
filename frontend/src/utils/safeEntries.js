export function safeEntries(data) {
  // data could be: null, undefined, [], {}, 
  // { entries: [] }, or a valid array

  if (!data) return [];

  // Already a valid array of entry objects
  if (Array.isArray(data)) {
    return data.filter(isValidEntry);
  }

  // { payroll_entries: [...] } shape (from API)
  if (Array.isArray(data.payroll_entries)) {
    return data.payroll_entries.filter(isValidEntry);
  }

  // { entries: [...] } shape (from VANI directly)
  if (Array.isArray(data.entries)) {
    return data.entries.filter(isValidEntry);
  }

  // Single entry object not wrapped in array
  if (isValidEntry(data)) {
    return [data];
  }

  return [];
}

function isValidEntry(entry) {
  return (
    entry &&
    typeof entry === "object" &&
    typeof entry.worker_name === "string" &&
    entry.worker_name.length > 0 &&
    (typeof entry.net_pay === "number" || typeof entry.gross_pay === "number" || typeof entry.amount === "number")
  );
}
