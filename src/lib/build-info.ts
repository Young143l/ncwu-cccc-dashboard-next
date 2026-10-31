import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

/**
 * 构建/运行版本信息。线上排查最常见的问题就是「服务器到底跑的是哪一版」，
 * 因此把 git 短 sha 与 package.json 版本暴露到 /api/health 和后台页脚。
 */
export interface BuildInfo {
  version: string;
  gitSha: string | null;
  gitBranch: string | null;
}

const globalForBuild = globalThis as unknown as {
  __buildInfo?: BuildInfo;
};

function readPackageVersion(): string {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function git(args: string[]): string | null {
  try {
    const out = execFileSync("git", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000,
    });
    return out.trim() || null;
  } catch {
    // 部署目录没有 .git（例如打包上传）时静默降级
    return null;
  }
}

export function getBuildInfo(): BuildInfo {
  if (globalForBuild.__buildInfo) return globalForBuild.__buildInfo;
  const info: BuildInfo = {
    version: readPackageVersion(),
    gitSha: git(["rev-parse", "--short", "HEAD"]),
    gitBranch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
  };
  globalForBuild.__buildInfo = info;
  return info;
}
