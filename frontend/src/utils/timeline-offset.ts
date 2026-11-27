import type { TimelineSlot } from "../types";

export function computeOffsetMinutesFromNow(
  slotEpochSec: number,
  nowMs: number = Date.now()
): number {
  if (!Number.isFinite(slotEpochSec) || !Number.isFinite(nowMs)) return 0;
  const slotMinute = Math.floor(slotEpochSec / 60);
  const nowMinute = Math.floor(nowMs / 60_000);
  return Math.min(0, slotMinute - nowMinute);
}

export function formatRelativeOffset(offsetMin: number): string {
  if (!Number.isFinite(offsetMin)) return "0m";
  const abs = Math.max(0, Math.round(Math.abs(offsetMin)));
  if (abs === 0) return "0m";
  if (abs < 60) return `-${abs}m`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `-${h}h` : `-${h}h ${m}m`;
}

export function formatSlotBadge(
  slot: TimelineSlot | undefined,
  isLatest: boolean,
  nowMs: number = Date.now()
): string {
  if (!slot) return "...";
  if (isLatest) return "Latest";
  return formatRelativeOffset(computeOffsetMinutesFromNow(slot.epoch, nowMs));
}
