/**
 * 极简进程内滑动窗口限流，用于登录失败次数统计。
 *
 * 单实例部署（sql.js 内存库 + 整文件重写，本来就不允许多实例），
 * 因此内存态足够，进程重启后计数清零属可接受行为。
 */
interface Bucket {
  /** 窗口内失败时间戳（毫秒） */
  times: number[];
}

const buckets = new Map<string, Bucket>();

/** 防止长期运行时 key 无限增长：超过该数量时清理已过期桶 */
const MAX_KEYS = 5000;

export interface RateLimitResult {
  allowed: boolean;
  /** 距离可以重试还剩多少秒 */
  retryAfterSec: number;
  /** 窗口内剩余可用次数（allowed 为 true 时有效） */
  remaining: number;
}

/**
 * 记录一次失败并判断是否超限。
 * @param key 限流维度（如 `login:1.2.3.4`）
 * @param limit 窗口内允许的失败次数
 * @param windowMs 窗口长度
 */
export function hitRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { times: [] };
  bucket.times = bucket.times.filter((t) => now - t < windowMs);

  if (bucket.times.length >= limit) {
    const oldest = bucket.times[0];
    buckets.set(key, bucket);
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
      remaining: 0,
    };
  }

  bucket.times.push(now);
  buckets.set(key, bucket);
  if (buckets.size > MAX_KEYS) sweepStale(now, windowMs);
  return {
    allowed: true,
    retryAfterSec: 0,
    remaining: limit - bucket.times.length,
  };
}

/** 只查询，不记录（用于登录成功前判断是否已被锁定） */
export function peekRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket) return { allowed: true, retryAfterSec: 0, remaining: limit };
  const times = bucket.times.filter((t) => now - t < windowMs);
  if (times.length >= limit) {
    const oldest = times[0];
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
      remaining: 0,
    };
  }
  return { allowed: true, retryAfterSec: 0, remaining: limit - times.length };
}

/** 清空某个 key 的计数（登录成功后调用） */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

function sweepStale(now: number, windowMs: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.times.every((t) => now - t >= windowMs)) {
      buckets.delete(key);
    }
  }
}

/**
 * 从请求头解析客户端 IP。线上经 openresty 反向代理，
 * `x-forwarded-for` 首段即真实客户端地址。
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}
