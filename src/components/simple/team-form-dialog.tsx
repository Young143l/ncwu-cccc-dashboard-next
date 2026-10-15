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

interface TeamFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  initialName?: string;
  initialMembers?: string;
  onSave: (data: { name: string; members: string }) => void | Promise<void>;
}

export function TeamFormDialog({
  open,
  onOpenChange,
  mode,
  initialName = "",
  initialMembers = "",
  onSave,
}: TeamFormDialogProps) {
  const [name, setName] = useState(initialName);
  const [members, setMembers] = useState(initialMembers);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setMembers(initialMembers);
      setError("");
    }
  }, [open, initialName, initialMembers]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("队名不能为空");
      return;
    }
    const memberList = members
      .split(/[,，、]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (memberList.length === 0) {
      setError("至少需要一名队员");
      return;
    }

    setLoading(true);
    try {
      await onSave({ name: name.trim(), members: members.trim() });
      onOpenChange(false);
    } catch {
      setError("保存失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "添加队伍" : "编辑队伍"}</DialogTitle>
          <DialogDescription>
            队员姓名用逗号、顿号或空格分隔
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-name">队名</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：算法先锋队"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-members">队员</Label>
            <textarea
              id="team-members"
              value={members}
              onChange={(e) => setMembers(e.target.value)}
              placeholder="张三, 李四, 王五"
              disabled={loading}
              className="w-full h-32 px-3 py-2 rounded-md border border-input bg-background text-sm disabled:opacity-50"
            />
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
            disabled={loading}
          >
            取消
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
