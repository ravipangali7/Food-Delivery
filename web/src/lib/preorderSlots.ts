/** Pre-order डेलिभरी समय स्लट — स्थानीय समयमा। */
export const PREORDER_TIME_SLOTS = [
  { id: '09:00', label: '9:00 AM – 11:00 AM', hour: 9, minute: 0 },
  { id: '11:00', label: '11:00 AM – 1:00 PM', hour: 11, minute: 0 },
  { id: '13:00', label: '1:00 PM – 3:00 PM', hour: 13, minute: 0 },
  { id: '15:00', label: '3:00 PM – 5:00 PM', hour: 15, minute: 0 },
  { id: '17:00', label: '5:00 PM – 7:00 PM', hour: 17, minute: 0 },
  { id: '19:00', label: '7:00 PM – 9:00 PM', hour: 19, minute: 0 },
] as const;

export type PreorderTimeSlotId = (typeof PREORDER_TIME_SLOTS)[number]['id'];

export function buildPreorderDateTime(dateYmd: string, slotId: PreorderTimeSlotId): Date | null {
  const slot = PREORDER_TIME_SLOTS.find(s => s.id === slotId);
  if (!slot || !dateYmd.trim()) return null;
  const [year, month, day] = dateYmd.split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(year, month - 1, day, slot.hour, slot.minute, 0, 0);
}

export function preorderSlotLabel(slotId: PreorderTimeSlotId): string {
  return PREORDER_TIME_SLOTS.find(s => s.id === slotId)?.label ?? slotId;
}

/** आजको मिति YYYY-MM-DD — date input को min attribute का लागि। */
export function todayYmdLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
