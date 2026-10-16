"use client";

import { useEffect, useState } from "react";

/** 官方观赛版是按 1200px 宽设计的固定版式 */
export const GPLT_DESIGN_WIDTH = 1200;

/**
 * 窄屏下按比例缩放整页，等价于把浏览器手动缩放自动化。
 * 屏幕宽度 ≥ 设计宽度时不缩放（桌面观感不变）。
 */
export function useViewportScale(designWidth: number = GPLT_DESIGN_WIDTH): number {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      setScale(width >= designWidth ? 1 : width / designWidth);
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [designWidth]);

  return scale;
}
