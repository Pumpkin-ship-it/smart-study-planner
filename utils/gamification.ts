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

// --- Rank system (Mobile Legends-style tiers and stars) ---
// Separate from the Level/XP system above - XP never decreases, but rank
// CAN go down if the user misses deadlines or fails focus sessions.
// Each "gain" or "loss" event only adds partial progress (2 events =
// 1 star change), tracked via the *Progress counters on GamificationStats.

// Applies one unit of "gain" progress (e.g. one on-time assessment, or one
// successful focus session). Every 2 gain events grants a full star.
// Reaching 5 stars promotes to the next tier and resets stars to 0.
export function applyStarGain(
  progress: number,
  rankTier: number,
  rankStars: number,
  totalStarsEarned: number
): { progress: number; rankTier: number; rankStars: number; totalStarsEarned: number } {
  const newProgress = progress + 1;
  if (newProgress < 2) {
    return { progress: newProgress, rankTier, rankStars, totalStarsEarned };
  }

  let newStars = rankStars + 1;
  let newTier = rankTier;
  if (newStars >= 5) {
    newStars = 0;
    newTier = Math.min(rankTier + 1, RANK_TITLES.length - 1); // capped at the top tier
  }
  // totalStarsEarned counts every star ever gained, and never decreases -
  // this is what badges are earned against, so demotions never take a
  // badge away.
  return { progress: 0, rankTier: newTier, rankStars: newStars, totalStarsEarned: totalStarsEarned + 1 };
}

// Applies one unit of "loss" progress (e.g. one overdue assessment, or one
// failed focus session). Every 2 loss events removes a star. Dropping
// below 0 stars demotes to the previous tier with a "soft landing" of 4
// stars (matching MLBB-style rank demotion), except at the very first
// tier, which has a floor and cannot demote further.
export function applyStarLoss(
  progress: number,
  rankTier: number,
  rankStars: number
): { progress: number; rankTier: number; rankStars: number } {
  const newProgress = progress + 1;
  if (newProgress < 2) {
    return { progress: newProgress, rankTier, rankStars };
  }

  let newStars = rankStars - 1;
  let newTier = rankTier;
  if (newStars < 0) {
    if (rankTier === 0) {
      newStars = 0; // floor protection - cannot demote below the first tier
    } else {
      newTier = rankTier - 1;
      newStars = 4; // soft landing into the lower tier
    }
  }
  return { progress: 0, rankTier: newTier, rankStars: newStars };
}

// Returns the rank name for a given tier index (0 = Novice ... 9 = General).
export function getRankName(tier: number): string {
  const index = Math.min(Math.max(tier, 0), RANK_TITLES.length - 1);
  return RANK_TITLES[index];
}

// What unlocks at each level, shown in the Rewards "Next Reward" box.
// Index 0 = reward for reaching Level 2 (Level 1 is the starting point,
// so nothing "unlocks" there).
const LEVEL_REWARDS = [
  "New Badge",
  "New Badge",
  "New Badge",
  "Pet Unlocked: Phoenix",
  "New Badge",
  "New Badge",
  "New Badge",
  "New Badge",
  "Rank Title: General",
];

// Returns a description of what unlocks at the NEXT level, for display
// in the "Next Reward" box. Returns null once the user has reached the
// highest level we have a reward defined for.
export function getNextLevelReward(currentLevel: number): string | null {
  const index = currentLevel - 1;
  if (index < 0 || index >= LEVEL_REWARDS.length) return null;
  return LEVEL_REWARDS[index];
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
  starsRequired: number; // used to render a row of gold star icons on the badge
  condition: (stats: GamificationStats, totalCompleted: number) => boolean;
}

// Every badge is earned purely by accumulating total stars - a single,
// unified "currency" instead of juggling separate streak/level/count
// thresholds that could clash or cluster together.
export const BADGES: BadgeDefinition[] = [
  {
    id: "stars_1",
    name: "First Step",
    description: "Earn your first star.",
    starsRequired: 1,
    condition: (stats) => (stats.totalStarsEarned ?? 0) >= 1,
  },
  {
    id: "stars_3",
    name: "Getting Started",
    description: "Earn 3 stars.",
    starsRequired: 3,
    condition: (stats) => (stats.totalStarsEarned ?? 0) >= 3,
  },
  {
    id: "stars_5",
    name: "Consistent",
    description: "Earn 5 stars.",
    starsRequired: 5,
    condition: (stats) => (stats.totalStarsEarned ?? 0) >= 5,
  },
  {
    id: "stars_8",
    name: "Study Machine",
    description: "Earn 8 stars.",
    starsRequired: 8,
    condition: (stats) => (stats.totalStarsEarned ?? 0) >= 8,
  },
  {
    id: "stars_12",
    name: "Week Warrior",
    description: "Earn 12 stars.",
    starsRequired: 12,
    condition: (stats) => (stats.totalStarsEarned ?? 0) >= 12,
  },
  {
    id: "stars_16",
    name: "Rising Star",
    description: "Earn 16 stars.",
    starsRequired: 16,
    condition: (stats) => (stats.totalStarsEarned ?? 0) >= 16,
  },
  {
    id: "stars_20",
    name: "Dedicated",
    description: "Earn 20 stars.",
    starsRequired: 20,
    condition: (stats) => (stats.totalStarsEarned ?? 0) >= 20,
  },
  {
    id: "stars_25",
    name: "Unstoppable",
    description: "Earn 25 stars.",
    starsRequired: 25,
    condition: (stats) => (stats.totalStarsEarned ?? 0) >= 25,
  },
  {
    id: "stars_30",
    name: "Top Performer",
    description: "Earn 30 stars.",
    starsRequired: 30,
    condition: (stats) => (stats.totalStarsEarned ?? 0) >= 30,
  },
  {
    id: "stars_40",
    name: "Legend",
    description: "Earn 40 stars.",
    starsRequired: 40,
    condition: (stats) => (stats.totalStarsEarned ?? 0) >= 40,
  },
];

export function checkNewBadges(stats: GamificationStats, totalCompleted: number): string[] {
  return BADGES.filter(
    (badge) => !stats.badges.includes(badge.id) && badge.condition(stats, totalCompleted)
  ).map((badge) => badge.id);
}

// The pet companion is unlocked purely by reaching Level 5 - checked
// directly against XP here, independent of the badge system. Returns
// the pet to grant, or null if the user hasn't reached Level 5 yet or
// already has the pet.
const LEVEL_5_PET: PetId = "phoenix";

export function petUnlockedByLevel(xp: number, existingPets: PetId[]): PetId | null {
  const level = calculateLevel(xp);
  if (level >= 5 && !existingPets.includes(LEVEL_5_PET)) {
    return LEVEL_5_PET;
  }
  return null;
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


