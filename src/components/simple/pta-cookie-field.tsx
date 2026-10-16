"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  isPtaSessionToken,
  normalizePtaCookieInput,
} from "@/lib/pta-cookie";

interface PtaCookieFieldProps {
  id?: string;
  /** 纯 token（不含 PTASession= 前缀） */
  value: string;
  onChange: (token: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * 固定前缀的 PTA Cookie 输入框：左侧展示 "PTASession="，用户只填等号后面那串。
 * 粘贴完整 Cookie 串会自动清洗成纯 token。
 */
export function PtaCookieField({
  id,
  value,
  onChange,
  disabled,
  placeholder = "粘贴等号后面那串（36 位 UUID）",
}: PtaCookieFieldProps) {
  const [show, setShow] = useState(false);
  const looksWrong = value.length > 0 && !isPtaSessionToken(value);

  return (
    <div className="space-y-1">
      <div className="flex items-stretch rounded-md border border-input bg-background focus-within:border-ring">
        <span className="flex select-none items-center rounded-l-md border-r border-input bg-muted px-3 text-sm text-muted-foreground">
          PTASession=
        </span>
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(normalizePtaCookieInput(e.target.value))}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-r-md bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-50"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => setShow((v) => !v)}
          className="my-0.5 mr-0.5 shrink-0"
        >
          {show ? "隐藏" : "显示"}
        </Button>
      </div>
      <p
        className={
          looksWrong
            ? "text-xs text-amber-600 dark:text-amber-500"
            : "text-xs text-muted-foreground"
        }
      >
        {looksWrong
          ? "看起来不是完整的 PTASession 值（通常为 36 位 UUID），请确认复制完整"
          : "浏览器开发者工具 → Application → Cookies → 复制 PTASession 的值"}
      </p>
    </div>
  );
}
