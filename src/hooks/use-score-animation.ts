"use client";

import { useEffect, useRef, useState } from "react";

export function useScoreAnimation(depValue: number | null | undefined) {
  const [flash, setFlash] = useState(false);
  const prevRef = useRef(depValue);

  useEffect(() => {
    if (
      depValue !== null &&
      depValue !== undefined &&
      prevRef.current !== depValue
    ) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 1200);
      prevRef.current = depValue;
      return () => clearTimeout(timer);
    }
  }, [depValue]);

  return flash;
}

export function useTeamScoreFlash(teamId: string, totalScore: number) {
  const [flash, setFlash] = useState(false);
  const prevScoreRef = useRef<number | null>(null);
  const prevIdRef = useRef<string>(teamId);

  useEffect(() => {
    if (prevIdRef.current !== teamId) {
      prevIdRef.current = teamId;
      prevScoreRef.current = totalScore;
      return;
    }
    if (
      prevScoreRef.current !== null &&
      prevScoreRef.current !== totalScore
    ) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 1500);
      prevScoreRef.current = totalScore;
      return () => clearTimeout(timer);
    }
    prevScoreRef.current = totalScore;
  }, [teamId, totalScore]);

  return flash;
}
