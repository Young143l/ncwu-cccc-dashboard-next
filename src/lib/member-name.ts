/**
 * 名单里的姓名可能来自多种录入方式，统一在这里解析：
 *   "202531305 王梦"  → 学号 + 姓名
 *   "202531305王梦"   → 学号 + 姓名（老师导入的格式，学号与姓名之间没有空格）
 *   "王梦"            → 只有姓名
 * 学号判定：开头 6~12 位数字。
 */
export interface ParsedMemberName {
  studentNumber: string | null;
  name: string;
}

/** PTA 侧的选手标识 */
export interface PlayerIdentity {
  name: string;
  studentNumber: string | null;
}

const STUDENT_NUMBER_RE = /^(\d{6,12})(?!\d)\s*(.*)$/;

export function parseMemberName(raw: string): ParsedMemberName {
  const value = (raw ?? "").trim();
  if (!value) return { studentNumber: null, name: "" };

  const matched = value.match(STUDENT_NUMBER_RE);
  if (matched) {
    const rest = matched[2].trim();
    // 只有学号、没有姓名时，整串仍按学号处理
    return { studentNumber: matched[1], name: rest };
  }
  return { studentNumber: null, name: value };
}

/** 名单条目（来自数据库） */
export interface MemberEntry {
  id: number;
  name: string;
}

export type MatchReason = "studentNumber" | "ambiguous" | "noStudentNumber";

export interface MatchResult {
  memberId: number | null;
  reason: MatchReason | "none";
  /** 歧义时命中的候选（便于后台提示人工确认） */
  candidates: MemberEntry[];
}

/**
 * 严格按学号匹配，完全不参考姓名：
 * 只有「PTA 学号」与「名单里解析出的学号」完全一致且唯一时才命中。
 * 任一方没有学号、或名单里同一学号出现多次，都不做猜测。
 */
export function matchMember(
  player: PlayerIdentity,
  members: MemberEntry[]
): MatchResult {
  const playerNo = (player.studentNumber ?? "").trim() || null;
  if (!playerNo) {
    return { memberId: null, reason: "noStudentNumber", candidates: [] };
  }

  const byNumber: MemberEntry[] = [];
  for (const member of members) {
    const parsed = parseMemberName(member.name);
    if (parsed.studentNumber === playerNo) byNumber.push(member);
  }

  if (byNumber.length === 1) {
    return { memberId: byNumber[0].id, reason: "studentNumber", candidates: [] };
  }
  if (byNumber.length > 1) {
    // 同一学号在名单里出现多次，无法判断归哪一条，交给人工处理
    return { memberId: null, reason: "ambiguous", candidates: byNumber };
  }
  return { memberId: null, reason: "none", candidates: [] };
}
