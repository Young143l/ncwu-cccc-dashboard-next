import * as XLSX from "xlsx";

export interface ExcelTeamData {
  name: string;
  members: string[];
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
  const wb = XLSX.utils.book_new();
  const data = [
    ["队伍名", "队员1", "队员2", "队员3", "队员4", "队员5", "队员6", "队员7", "队员8"],
    ["ACM 一队", "张三", "李四", "王五", "赵六", "孙七", "周八", "吴九", "郑十"],
    ["ACM 二队", "陈一", "刘二", "黄三", "林四", "杨五", "朱六", "马七", "高八"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "队伍信息");
  XLSX.writeFile(wb, "队伍导入模板.xlsx");
}
