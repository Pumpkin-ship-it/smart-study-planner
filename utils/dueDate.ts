// Calculates how many days remain until a given due date (YYYY-MM-DD).
// Negative numbers mean the date has already passed.
export function daysUntil(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // ignore time of day, compare dates only

  const due = new Date(dueDate + "T00:00:00");
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((due.getTime() - today.getTime()) / msPerDay);
}

// Turns a day count into a short, human-readable label.
export function dueDateLabel(dueDate: string): string {
  const days = daysUntil(dueDate);
  if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

// Returns an urgency level based on how close the due date is.
// This is used to color-code assessments regardless of their manually
// chosen priority - e.g. a "low" priority task due tomorrow should still
// stand out visually.
export type UrgencyLevel = "overdue" | "urgent" | "soon" | "normal";

export function getUrgencyLevel(dueDate: string): UrgencyLevel {
  const days = daysUntil(dueDate);
  if (days < 0) return "overdue";
  if (days <= 2) return "urgent"; // due today, tomorrow, or in 2 days
  if (days <= 7) return "soon"; // due within a week
  return "normal";
}

// Returns info for each day of the CURRENT calendar week (Monday to
// Sunday), marking which ones fall within the user's active streak.
// We only store a streak COUNT and the last completed date (not full
// history), so this works backward from there: the active streak covers
// `streak` consecutive days ending at lastCompletedDate. Days from the
// current week that fall within that range are marked active.
export interface WeekDayInfo {
  label: string;   // "M", "T", "W", etc.
  isActive: boolean;
  isToday: boolean;
}

export function getStreakWeek(streak: number, lastCompletedDate: string | null): WeekDayInfo[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  // Find the most recent Monday, to anchor the week Monday -> Sunday.
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ...
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysSinceMonday);

  // Build the set of dates covered by the active streak, if any.
  const activeDates = new Set<string>();
  if (lastCompletedDate && streak > 0) {
    const anchor = new Date(lastCompletedDate + "T00:00:00");
    for (let i = 0; i < streak; i++) {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() - i);
      activeDates.add(d.toISOString().slice(0, 10));
    }
  }

  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  const week: WeekDayInfo[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dStr = d.toISOString().slice(0, 10);
    week.push({
      label: labels[i],
      isActive: activeDates.has(dStr),
      isToday: dStr === todayStr,
    });
  }
  return week;
}

