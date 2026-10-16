import * as XLSX from "xlsx";

export interface ExcelTeamData {
  name: string;
  members: string[];
}

/** 导入模板的固定格式：A 列队伍名，B~K 共 10 列队员 */
const TEAM_COLUMNS = 10;
const SHEET_NAME = "队伍信息";

/** 生成与导入模板同结构的工作簿（不足 10 人的队伍补空列） */
export function buildTeamsWorkbook(teams: ExcelTeamData[]): XLSX.WorkBook {
  const header = [
    "队伍名",
    ...Array.from({ length: TEAM_COLUMNS }, (_, i) => `队员${i + 1}`),
  ];
  const rows = teams.map((team) => [
    team.name,
    ...Array.from({ length: TEAM_COLUMNS }, (_, i) => team.members[i] ?? ""),
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), SHEET_NAME);
  return wb;
}

/** 导出队伍名单，导出结果可直接用「导入 Excel」再导回来 */
export function downloadTeamsExcel(teams: ExcelTeamData[], filename: string): void {
  const safeName = filename.replace(/[\\/:*?"<>|]/g, "_").replace(/\.xlsx$/i, "");
  XLSX.writeFile(buildTeamsWorkbook(teams), `${safeName}.xlsx`);
}

export function parseTeamsFromExcel(buffer: ArrayBuffer): ExcelTeamData[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
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

export function downloadTeamTemplate(): void {
  const sampleMembers = (start: number) =>
    Array.from({ length: TEAM_COLUMNS }, (_, i) => `选手${start + i}`);
  downloadTeamsExcel(
    [
      { name: "天梯赛一队", members: sampleMembers(1) },
      { name: "天梯赛二队", members: sampleMembers(11) },
    ],
    "队伍导入模板.xlsx"
  );
}
