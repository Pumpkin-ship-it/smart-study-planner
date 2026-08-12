// This file defines the "shape" of our core data.
// TypeScript will use these interfaces to check that we always
// create, read, and update objects with the correct fields and types.

// Represents a registered user of the app.
export interface UserProfile {
  id: string;          // Unique ID for this user (comes from Firebase Auth)
  name: string;         // The user's display name
  email: string;        // The user's email address (used to log in)
  createdAt: string;    // Timestamp of when the account was created
}

// Represents a subject/course the user is studying (e.g. "Biology").
export interface Subject {
  id: string;           // Unique ID for this subject
  userId: string;       // Links this subject to the user who created it
  name: string;         // Subject name, e.g. "Biology"
  code?: string;        // Optional subject code, e.g. "BIO301" (the "?" means this field can be left out)
  createdAt: string;    // Timestamp of when the subject was added
}

// Represents a single assessment/task tied to a subject.
export interface Assessment {
  id: string;                              // Unique ID for this assessment
  userId: string;                          // Links this assessment to the user who created it
  subjectId: string;                       // Links this assessment to its parent subject
  title: string;                           // Name of the assessment, e.g. "Midterm Exam"
  dueDate: string;                         // The date this assessment is due (used for sorting/priority)
  estimatedHours: number;                  // How many hours the user estimates this will take
  priority: "low" | "medium" | "high";     // Restricts this field to only these 3 exact values
  completed: boolean;                      // Whether the user has marked this as done
  createdAt: string;                       // Timestamp of when the assessment was added
  xpAwarded?: boolean;                     // True once XP has been granted for completing this -
                                            // prevents earning XP repeatedly by toggling complete on/off
}

// The original (non-copyrighted) hero archetypes the user can choose from.
export type HeroId = "elf" | "knight" | "mage" | "warrior" | "rogue";

// The original (non-copyrighted) pet companions that can be unlocked via badges.
export type PetId = "wolf" | "cat" | "dragon" | "fox" | "phoenix";

// Represents one user's gamification progress: XP, streak, earned badges,
// chosen hero, and unlocked pets. Stored as a single document per user
// in the "gamification" Firestore collection.
export interface GamificationStats {
  userId: string;                    // Links this record to the user
  xp: number;                        // Total experience points earned so far
  streak: number;                    // Current consecutive-day completion streak
  lastCompletedDate: string | null;  // "YYYY-MM-DD" of the last day an assessment was completed
  badges: string[];                  // IDs of badges this user has earned (see utils/gamification.ts)
  heroId: HeroId | null;             // Which hero archetype the user picked (null until first chosen)
  pets: PetId[];                     // Pet IDs unlocked so far, via badge milestones
}

// Represents a single focus-timer session tied to one assessment.
// Used by the Focus Timer feature: completing a session without leaving
// the app grants bonus XP; leaving early fails the session (no reward).
export interface FocusSession {
  id: string;             // Unique ID for this session
  userId: string;         // Links this session to the user who ran it
  assessmentId: string;   // Which assessment this focus session was for
  durationMinutes: number; // Planned length of the session
  startedAt: string;      // Timestamp when the session began
  completed: boolean;     // True if the user stayed in-app for the full duration
}
