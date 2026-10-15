export function computeStatus(
  startTime: string | null,
  durationMinutes: number | null,
  storedStatus: string
): string {
  if (!startTime) return storedStatus;
  const iso = startTime.includes("T") ? startTime : startTime.replace(" ", "T");
  const withZone = /Z|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}+08:00`;
  const now = Date.now();
  const start = new Date(withZone).getTime();
  const diff = now - start;
  if (diff < 0) return "upcoming";
  if (durationMinutes && diff > durationMinutes * 60 * 1000) return "finished";
  return "active";
}
