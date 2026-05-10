export function daysUntil(month, day) {
  const today     = new Date();
  const todayFlat = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let   next      = new Date(today.getFullYear(), month - 1, day);
  if (next < todayFlat) next = new Date(today.getFullYear() + 1, month - 1, day);
  return Math.round((next - todayFlat) / 864e5);
}

export function turningAge(birthYear, month, day) {
  if (!birthYear) return null;
  const today     = new Date();
  const todayFlat = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let   next      = new Date(today.getFullYear(), month - 1, day);
  if (next < todayFlat) next = new Date(today.getFullYear() + 1, month - 1, day);
  return next.getFullYear() - birthYear;
}
