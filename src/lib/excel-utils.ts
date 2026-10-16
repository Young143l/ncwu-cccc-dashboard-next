import * as XLSX from "xlsx";

export interface ExcelTeamData {
  name: string;
  members: string[];
}

/** 导入模板的固定格式：A 列队伍名，B~K 共 10 列队员 */
const TEAM_COLUMNS = 10;
const SHEET_NAME = "队伍信息";
const MEMBER_SHEET_NAME = "全部成员";

/** 附加到工作簿的第二张表（如「全部成员」） */
export interface ExtraSheet {
  name: string;
  header: string[];
  rows: string[][];
}

/** 成员信息：学号可能缺失（非学生账号只有姓名） */
export interface MemberInfo {
  name: string;
  studentNumber: string | null;
}

/** 列宽（字符数），避免打开后手动拉宽 */
const TEAM_SHEET_COLS = [{ wch: 14 }, ...Array.from({ length: TEAM_COLUMNS }, () => ({ wch: 16 }))];
const MEMBER_SHEET_COLS = [{ wch: 6 }, { wch: 12 }, { wch: 14 }];

/** 生成与导入模板同结构的工作簿（不足 10 人的队伍补空列） */
export function buildTeamsWorkbook(
  teams: ExcelTeamData[],
  extraSheet?: ExtraSheet
): XLSX.WorkBook {
  const header = [
    "队伍名",
    ...Array.from({ length: TEAM_COLUMNS }, (_, i) => `队员${i + 1}`),
  ];
  const rows = teams.map((team) => [
    team.name,
    ...Array.from({ length: TEAM_COLUMNS }, (_, i) => team.members[i] ?? ""),
  ]);

  const wb = XLSX.utils.book_new();

  const teamSheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  teamSheet["!cols"] = TEAM_SHEET_COLS;
  XLSX.utils.book_append_sheet(wb, teamSheet, SHEET_NAME);

  if (extraSheet) {
    const extra = XLSX.utils.aoa_to_sheet([extraSheet.header, ...extraSheet.rows]);
    extra["!cols"] = MEMBER_SHEET_COLS;
    XLSX.utils.book_append_sheet(wb, extra, extraSheet.name);
  }

  return wb;
}

/** 导出队伍名单，导出结果可直接用「导入 Excel」再导回来 */
export function downloadTeamsExcel(
  teams: ExcelTeamData[],
  filename: string,
  extraSheet?: ExtraSheet
): void {
  const safeName = filename.replace(/[\\/:*?"<>|]/g, "_").replace(/\.xlsx$/i, "");
  XLSX.writeFile(buildTeamsWorkbook(teams, extraSheet), `${safeName}.xlsx`);
}

/** 把成员列表转成「全部成员」表：序号 / 学号 / 姓名 */
export function buildMemberSheet(members: MemberInfo[]): ExtraSheet {
  return {
    name: MEMBER_SHEET_NAME,
    header: ["序号", "学号", "姓名"],
    rows: members.map((m, i) => [
      String(i + 1),
      m.studentNumber ?? "",
      m.name,
    ]),
  };
}

/**
 * 拆开形如「202531921 李炎波」的成员姓名。
 * 没有学号前缀时，整串当作姓名。
 */
export function splitStudentName(full: string): MemberInfo {
  const value = full.trim();
  const matched = value.match(/^(\d{6,})\s+(.+)$/);
  if (matched) {
    return { studentNumber: matched[1], name: matched[2].trim() };
  }
  return { studentNumber: null, name: value };
}

/**
 * 把人员名单按每队 perTeam 人切分（首队优先满员，其余均分），
 * 用于把 PTA 用户组名单直接转成可导入的队伍结构。
 */
export function splitIntoTeams(
  names: string[],
  perTeam: number = TEAM_COLUMNS
): ExcelTeamData[] {
  const list = names.map((n) => n.trim()).filter(Boolean);
  if (list.length === 0) return [];

  const teamCount = Math.max(1, Math.ceil(list.length / perTeam));
  const sizes: number[] = [];

  if (teamCount === 1) {
    sizes.push(list.length);
  } else {
    sizes.push(Math.min(perTeam, list.length));
    const rest = list.length - sizes[0];
    const restTeams = teamCount - 1;
    const base = Math.floor(rest / restTeams);
    const remainder = rest % restTeams;
    for (let i = 0; i < restTeams; i++) {
      sizes.push(base + (i < remainder ? 1 : 0));
    }
  }

  const teams: ExcelTeamData[] = [];
  let cursor = 0;
  for (const [i, size] of sizes.entries()) {
    teams.push({
      name: `队伍${i + 1}`,
      members: list.slice(cursor, cursor + size),
    });
    cursor += size;
  }

  return teams;
}

export function parseTeamsFromExcel(buffer: ArrayBuffer): ExcelTeamData[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  // 优先读队伍表，避免用户在 Excel 里调换 sheet 顺序后读错表
  const sheetName =
    workbook.SheetNames.find((n) => n.trim() === SHEET_NAME) ??
    workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
  });

  const teams: ExcelTeamData[] = [];

  for (const row of rows.slice(1)) {
    if (!Array.isArray(row) || row.length === 0) continue;

    const teamName = String(row[0] || "").trim();
    if (!teamName) continue;

    const members: string[] = [];
    for (let i = 1; i < row.length; i++) {
      const name = String(row[i] || "").trim();
      if (name) members.push(name);
    }

    if (members.length > 0) {
      teams.push({ name: teamName, members });
    }
  }

  return teams;
}
