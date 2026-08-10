// A palette of distinct, visually distinguishable colors used to color-code
// subjects consistently across the app (e.g. in Progress bars/rings).
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

// Deterministically picks a color for a given subject ID, so the SAME
// subject always gets the SAME color (even across reloads), and colors
// are spread out across the palette rather than repeating immediately.
export function getSubjectColor(subjectId: string): string {
  // Turn the subject ID into a number by summing its character codes.
  let hash = 0;
  for (let i = 0; i < subjectId.length; i++) {
    hash += subjectId.charCodeAt(i);
  }
  // Use that number to pick a consistent index into the palette.
  const index = hash % SUBJECT_COLORS.length;
  return SUBJECT_COLORS[index];
}
