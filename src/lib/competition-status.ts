/**
 * 比赛时间的解析/展示统一入口。
 *
 * 库里存的时间可能是这几种形态：
 * - "2026-10-15T16:00"（datetime-local 原样存下的本地时间）
 * - "2026-10-15 16:00:00"（localtime 字符串）
 * - "2026-04-18 11:32:00Z" / "...+08:00"（PTA 返回的带时区时间）
 * 无时区的按 +08:00 解释（服务器时区要求为 Asia/Shanghai）。
 */
export function parseCompetitionTime(
  value: string | null | undefined
): Date | null {
  if (!value) return null;
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  const withZone = /Z$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}+08:00`;
  const date = new Date(withZone);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** 格式化为本机时区的 "YYYY-MM-DD HH:mm" */
export function formatLocalDateTime(value: string | null | undefined): string {
  const date = parseCompetitionTime(value);
  if (!date) return "";
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** 填给 <input type="datetime-local"> 的值 */
export function toDatetimeLocalValue(value: string | null | undefined): string {
  return formatLocalDateTime(value).replace(" ", "T");
}

export function computeStatus(
  startTime: string | null,
  endTime: string | null,
  durationMinutes: number | null,
  storedStatus: string
): string {
  const start = parseCompetitionTime(startTime);
  if (!start) return storedStatus;

  const now = Date.now();
  if (now < start.getTime()) return "upcoming";

  const end = parseCompetitionTime(endTime);
  if (end) {
    return now > end.getTime() ? "finished" : "active";
  }

  if (durationMinutes && now - start.getTime() > durationMinutes * 60 * 1000) {
    return "finished";
  }
  return "active";
}
