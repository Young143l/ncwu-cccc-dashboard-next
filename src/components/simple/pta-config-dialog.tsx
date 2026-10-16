"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCompetition } from "@/services/api";
import { toDatetimeLocalValue } from "@/lib/competition-status";
import { PtaCookieField } from "@/components/simple/pta-cookie-field";
import { toPtaCookieHeader } from "@/lib/pta-cookie";

export interface PtaConfigTarget {
  id: number;
  name: string;
  pta_contest_id: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  has_cookie: boolean;
}

interface PtaConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competition: PtaConfigTarget;
  onSaved: () => void | Promise<void>;
}

export function PtaConfigDialog({
  open,
  onOpenChange,
  competition,
  onSaved,
}: PtaConfigDialogProps) {
  const [name, setName] = useState(competition.name);
  const [ptaId, setPtaId] = useState(competition.pta_contest_id ?? "");
  const [cookie, setCookie] = useState("");
  const [clearCookie, setClearCookie] = useState(false);
  const [startTime, setStartTime] = useState(
    toDatetimeLocalValue(competition.start_time)
  );
  const [endTime, setEndTime] = useState(
    toDatetimeLocalValue(competition.end_time)
  );
  const [duration, setDuration] = useState(
    String(competition.duration_minutes ?? 180)
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(competition.name);
    setPtaId(competition.pta_contest_id ?? "");
    setCookie("");
    setClearCookie(false);
    setStartTime(toDatetimeLocalValue(competition.start_time));
    setEndTime(toDatetimeLocalValue(competition.end_time));
    setDuration(String(competition.duration_minutes ?? 180));
    setError("");
  }, [open, competition]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("比赛名称不能为空");
      return;
    }
    const durationMinutes = parseInt(duration, 10);
    if (!durationMinutes || durationMinutes <= 0) {
      setError("比赛时长必须是大于 0 的分钟数");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await updateCompetition(competition.id, {
        name: name.trim(),
        pta_contest_id: ptaId.trim(),
        start_time: startTime || undefined,
        end_time: endTime,
        duration_minutes: durationMinutes,
        ...(clearCookie
          ? { access_cookie: "" }
          : cookie.trim()
            ? { access_cookie: toPtaCookieHeader(cookie) }
            : {}),
      });
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const cookieStateText = clearCookie
    ? "保存后将清空已存 Cookie，自动同步会停止"
    : cookie.trim()
      ? "保存后将替换为新 Cookie，自动同步会立即重启"
      : competition.has_cookie
        ? "已配置 Cookie（留空表示不修改）"
        : "尚未配置 Cookie，自动同步未启用";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑比赛与 PTA 配置</DialogTitle>
          <DialogDescription>
            修改 PTA 比赛 ID 或 Cookie 后，自动同步会按新配置立即重启
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="comp-name">比赛名称</Label>
            <Input
              id="comp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pta-id">PTA 比赛 ID</Label>
            <Input
              id="pta-id"
              value={ptaId}
              onChange={(e) => setPtaId(e.target.value)}
              placeholder="例如：1763xxxxxxx"
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pta-cookie">PTA Cookie</Label>
            <PtaCookieField
              id="pta-cookie"
              value={cookie}
              onChange={setCookie}
              disabled={saving || clearCookie}
              placeholder="粘贴等号后面那串；留空表示保持现有 Cookie 不变"
            />
            <p className="text-xs text-muted-foreground">{cookieStateText}</p>
            {competition.has_cookie && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={clearCookie}
                  onChange={(e) => setClearCookie(e.target.checked)}
                  disabled={saving}
                />
                清空已保存的 Cookie（停止自动同步）
              </label>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="comp-start">开始时间</Label>
              <Input
                id="comp-start"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comp-end">结束时间</Label>
              <Input
                id="comp-end"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">
                留空则按「开始时间 + 时长」计算，比赛状态与倒计时以结束时间为准
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="comp-duration">时长（分钟）</Label>
              <Input
                id="comp-duration"
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
