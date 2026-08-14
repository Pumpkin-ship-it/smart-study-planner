import { Assessment, GamificationStats, PetId } from "@/types";

// How much XP each priority level awards when an assessment is completed.
const XP_BY_PRIORITY: Record<Assessment["priority"], number> = {
  low: 10,
  medium: 20,
  high: 35,
};

// XP required to reach each level. Level = index + 1.
const LEVEL_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200];

// A title shown alongside the user's name (e.g. "Hello, General Kezang"),
// reflecting their current level - gives the level-up system a more
// rewarding, visible sense of progression.
const RANK_TITLES = [
  "Novice",
  "Apprentice",
  "Adventurer",
  "Veteran",
  "Champion",
  "Elite",
  "Hero",
  "Master",
  "Legend",
  "General",
];

// Returns the rank title for a given level. Levels beyond the highest
// defined title just keep the top rank ("General").
export function getRankTitle(level: number): string {
  const index = Math.min(level - 1, RANK_TITLES.length - 1);
  return RANK_TITLES[Math.max(index, 0)];
}

export function calculateLevel(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
    }
  }
  return level;
}

export function levelProgress(xp: number): { currentLevelXp: number; xpForNextLevel: number; percent: number } {
  const level = calculateLevel(xp);
  const currentLevelStart = LEVEL_THRESHOLDS[level - 1];
  const nextLevelStart = LEVEL_THRESHOLDS[level] ?? currentLevelStart + 1000;
  const currentLevelXp = xp - currentLevelStart;
  const xpForNextLevel = nextLevelStart - currentLevelStart;
  const percent = Math.min(100, Math.round((currentLevelXp / xpForNextLevel) * 100));
  return { currentLevelXp, xpForNextLevel, percent };
}

export function xpForAssessment(priority: Assessment["priority"]): number {
  return XP_BY_PRIORITY[priority];
}

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  condition: (stats: GamificationStats, totalCompleted: number) => boolean;
}

export const BADGES: BadgeDefinition[] = [
  {
    id: "first_step",
    name: "First Step",
    description: "Complete your first assessment.",
    condition: (_stats, totalCompleted) => totalCompleted >= 1,
  },
  {
    id: "five_done",
    name: "Getting Things Done",
    description: "Complete 5 assessments.",
    condition: (_stats, totalCompleted) => totalCompleted >= 5,
  },
  {
    id: "ten_done",
    name: "Study Machine",
    description: "Complete 10 assessments.",
    condition: (_stats, totalCompleted) => totalCompleted >= 10,
  },
  {
    id: "streak_3",
    name: "On a Roll",
    description: "Reach a 3-day completion streak.",
    condition: (stats) => stats.streak >= 3,
  },
  {
    id: "streak_7",
    name: "Week Warrior",
    description: "Reach a 7-day completion streak.",
    condition: (stats) => stats.streak >= 7,
  },
  {
    id: "level_3",
    name: "Rising Star",
    description: "Reach Level 3.",
    condition: (stats) => calculateLevel(stats.xp) >= 3,
  },
  {
    id: "level_5",
    name: "Top Performer",
    description: "Reach Level 5.",
    condition: (stats) => calculateLevel(stats.xp) >= 5,
  },
];

// Maps specific badges to the pet companion they unlock. Centralized here
// so both the badge-checking logic and the Rewards display use the same
// source of truth for which badge grants which pet.
export const PET_UNLOCK_BADGES: Record<string, PetId> = {
  streak_3: "cat",
  five_done: "fox",
  streak_7: "wolf",
  level_3: "dragon",
  level_5: "phoenix",
};

export function checkNewBadges(stats: GamificationStats, totalCompleted: number): string[] {
  return BADGES.filter(
    (badge) => !stats.badges.includes(badge.id) && badge.condition(stats, totalCompleted)
  ).map((badge) => badge.id);
}

// Given a list of newly earned badge IDs, returns any pets that should be
// unlocked as a result (skipping any the user already has).
export function petsUnlockedByBadges(newBadgeIds: string[], existingPets: PetId[]): PetId[] {
  const newPets: PetId[] = [];
  for (const badgeId of newBadgeIds) {
    const pet = PET_UNLOCK_BADGES[badgeId];
    if (pet && !existingPets.includes(pet) && !newPets.includes(pet)) {
      newPets.push(pet);
    }
  }
  return newPets;
}

export function updateStreak(lastCompletedDate: string | null, currentStreak: number): { streak: number; today: string } {
  const today = new Date().toISOString().slice(0, 10);

  if (lastCompletedDate === today) {
    return { streak: currentStreak, today };
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (lastCompletedDate === yesterdayStr) {
    return { streak: currentStreak + 1, today };
  }

  return { streak: 1, today };
}

