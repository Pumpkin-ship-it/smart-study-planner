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
}