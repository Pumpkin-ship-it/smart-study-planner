// A palette of distinct, visually distinguishable colors used to color-code
// subjects consistently across the app (e.g. in Progress rings, Subjects
// list, Dashboard).
const SUBJECT_COLORS = [
  "#2563eb", // blue
  "#16a34a", // green
  "#dc2626", // red
  "#9333ea", // purple
  "#ea580c", // orange
  "#0891b2", // teal
  "#db2777", // pink
  "#65a30d", // olive green
  "#7c3aed", // violet
  "#0d9488", // dark teal
];

// Builds a lookup table assigning each subject a DISTINCT color, based on
// its position within the given list (sorted by creation date, so the
// assignment is stable and doesn't shuffle as new subjects are added).
// This avoids the color collisions that a hash-based approach can produce
// when two different subject IDs happen to hash to the same palette slot.
export function buildSubjectColorMap(subjects: { id: string; createdAt: string }[]): Record<string, string> {
  const sorted = [...subjects].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const map: Record<string, string> = {};
  sorted.forEach((subject, index) => {
    map[subject.id] = SUBJECT_COLORS[index % SUBJECT_COLORS.length];
  });
  return map;
}
