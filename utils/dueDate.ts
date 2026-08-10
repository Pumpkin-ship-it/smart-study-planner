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
