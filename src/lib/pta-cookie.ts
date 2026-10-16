/**
 * PTA 鉴权只需要 PTASession 这一个 cookie（实测单靠它即可拉取榜单）。
 * 界面上固定给出 "PTASession=" 前缀，用户只填等号后面那串，
 * 因此存库与发请求前都要经过这里统一成完整形式。
 */
export const PTA_COOKIE_NAME = "PTASession";

const PTA_SESSION_RE = new RegExp(`${PTA_COOKIE_NAME}\\s*=\\s*([^;\\s]+)`, "i");
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 把用户粘贴的内容清洗成纯 token：
 * - "PTASession=xxx" 或一整串 Cookie → 取等号后的值
 * - 带 "Cookie:" 前缀、引号、分号、多余空白 → 一并去掉
 * - 已经是裸 token → 原样返回
 */
export function normalizePtaCookieInput(raw: string): string {
  let value = raw.trim();
  if (!value) return "";

  value = value.replace(/^cookie\s*:\s*/i, "").trim();

  const matched = value.match(PTA_SESSION_RE);
  if (matched) value = matched[1];

  return value.replace(/^["']|["';]+$/g, "").trim();
}

/** token → 存库/发请求用的完整 Cookie 头；空值返回空串（表示未配置） */
export function toPtaCookieHeader(token: string): string {
  const value = normalizePtaCookieInput(token);
  return value ? `${PTA_COOKIE_NAME}=${value}` : "";
}

/** 仅用于输入提示：PTASession 的值通常是 36 位 UUID */
export function isPtaSessionToken(value: string): boolean {
  return UUID_RE.test(value.trim());
}
