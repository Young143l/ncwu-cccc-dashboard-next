"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { parseTeamsFromExcel, downloadTeamTemplate, type ExcelTeamData } from "@/lib/excel-utils";

interface ExcelImportProps {
  onImport: (teams: ExcelTeamData[]) => void;
}

export function ExcelImport({ onImport }: ExcelImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const teams = parseTeamsFromExcel(buffer);
    if (teams.length > 0) {
      onImport(teams);
    }
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
      >
        导入 Excel
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={downloadTeamTemplate}
      >
        下载模板
      </Button>
    </div>
  );
}
