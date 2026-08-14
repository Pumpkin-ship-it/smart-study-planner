import { auth, db } from "@/services/firebase";
import { useTheme } from "@/components/ThemeContext";
import { HeroFigure } from "@/components/HeroFigure";
import { StreakWeekDay } from "@/components/StreakWeekDay";
import { GamificationStats, HeroId, PetId } from "@/types";
import { BADGES, calculateLevel, levelProgress } from "@/utils/gamification";
import { getStreakWeek } from "@/utils/dueDate";
import { useFocusEffect, useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
// SafeAreaView automatically adds padding so content doesn't overlap
// the phone's notch, camera cutout, or status bar.
import { SafeAreaView } from "react-native-safe-area-context";

// Default stats shown before the user has completed anything yet, and also
// used to fill in any fields missing from OLDER Firestore documents that
// were created before heroId/pets existed in our data model.
const EMPTY_STATS: GamificationStats = {
  userId: "",
  xp: 0,
  streak: 0,
  lastCompletedDate: null,
  badges: [],
  heroId: null,
  pets: [],
};

const HERO_OPTIONS: { id: HeroId; name: string; description: string }[] = [
  { id: "elf", name: "Elf Ranger", description: "Swift and sharp-eyed." },
  { id: "knight", name: "Knight", description: "Sturdy and disciplined." },
  { id: "mage", name: "Mage", description: "Wise and studious." },
  { id: "warrior", name: "Warrior", description: "Bold and relentless." },
  { id: "rogue", name: "Rogue", description: "Quick and resourceful." },
];

const PET_LABELS: Record<PetId, string> = {
  wolf: "Wolf",
  cat: "Cat",
  fox: "Fox",
  dragon: "Dragon",
  phoenix: "Phoenix",
};

export default function RewardsScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [stats, setStats] = useState<GamificationStats>(EMPTY_STATS);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);

  // Loads this user's gamification stats and basic profile info.
  // Stats are merged with EMPTY_STATS so any fields missing from an older
  // document (e.g. accounts created before heroId/pets existed) get safe
  // defaults instead of causing crashes elsewhere in this screen.
  async function loadStats() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setLoading(true);
    try {
      setUserEmail(currentUser.email ?? "");

      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.exists()) {
        setUserName(userDoc.data().name ?? "");
      }

      const statsSnap = await getDoc(doc(db, "gamification", currentUser.uid));
      if (statsSnap.exists()) {
        setStats({ ...EMPTY_STATS, ...(statsSnap.data() as Partial<GamificationStats>) });
      } else {
        setStats(EMPTY_STATS);
      }
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [])
  );

  async function chooseHero(heroId: HeroId) {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const updated: GamificationStats = { ...stats, userId: currentUser.uid, heroId };
    await setDoc(doc(db, "gamification", currentUser.uid), updated);
    setStats(updated);
  }

  async function handleLogout() {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (error: any) {
      Alert.alert("Error signing out", error.message);
    }
  }

  const level = calculateLevel(stats.xp);
  const { currentLevelXp, xpForNextLevel, percent } = levelProgress(stats.xp);
  const heroScale = 1 + Math.min(level - 1, 4) * 0.1;
  const heroName = HERO_OPTIONS.find((h) => h.id === stats.heroId)?.name ?? "";

  // The next badge the user hasn't earned yet, shown as a "next reward"
  // preview - BADGES is ordered roughly by increasing difficulty, so the
  // first not-yet-earned one is a reasonable "what's coming up" hint.
  const nextBadge = BADGES.find((b) => !stats.badges.includes(b.id));
  const streakWeek = getStreakWeek(stats.streak, stats.lastCompletedDate);

  // If no hero has been chosen yet, show the selection screen instead
  // of the normal Rewards view.
  if (!loading && !stats.heroId) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Text style={styles.title}>Choose Your Hero</Text>
        <Text style={styles.subtitle}>
          Your hero grows as you level up by completing assessments.
        </Text>
        <FlatList
          data={HERO_OPTIONS}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable style={styles.heroOptionCard} onPress={() => chooseHero(item.id)}>
              <HeroFigure heroId={item.id} size={90} />
              <View style={{ flex: 1 }}>
                <Text style={styles.heroOptionName}>{item.name}</Text>
                <Text style={styles.heroOptionDescription}>{item.description}</Text>
              </View>
            </Pressable>
          )}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>Rewards</Text>

      {/* Header row: hero portrait on the side, level + hero name next to
          it, and a "next reward" chest-style preview on the right. */}
      <View style={styles.headerRow}>
        {stats.heroId && <HeroFigure heroId={stats.heroId} size={90} scale={heroScale} />}
        {/* Middle column: level, hero name, and how much XP is left to
            reach the next level, with a compact progress bar. */}
        <View style={styles.headerMiddle}>
          <Text style={styles.headerLevel}>Level {level}</Text>
          <Text style={styles.headerHeroName}>{heroName}</Text>
          <Text style={styles.headerXpRemaining}>
            {xpForNextLevel - currentLevelXp} XP to Level {level + 1}
          </Text>
          <View style={styles.headerProgressTrack}>
            <View
              style={[
                styles.headerProgressFill,
                { width: `${percent}%`, backgroundColor: theme.primary },
              ]}
            />
          </View>
        </View>
        {nextBadge ? (
          <View style={[styles.nextRewardBox, { borderColor: theme.primary }]}>
            <Text style={styles.nextRewardIcon}>[?]</Text>
            <Text style={styles.nextRewardLabel}>Next</Text>
            <Text style={styles.nextRewardName} numberOfLines={2}>
              {nextBadge.name}
            </Text>
          </View>
        ) : (
          <View style={[styles.nextRewardBox, { borderColor: "#eab308" }]}>
            <Text style={styles.nextRewardIcon}>[*]</Text>
            <Text style={styles.nextRewardLabel}>All done!</Text>
          </View>
        )}
      </View>

      {/* Streak row: icon + day count on the left, week-day dots on the right */}
      <View style={styles.streakRow}>
        <View style={styles.streakRowLeft}>
          {/* Fixed-size placeholder box - swap for an <Image> here once a
              real streak icon is ready, same pattern as HeroFigure. */}
          <View style={styles.streakIconBox}>
            <Text style={styles.streakIconPlaceholderText}>[Icon]</Text>
          </View>
          {/* Streak number floats above the "day streak" label, stacked
              to match the icon box's height. */}
          <View style={styles.streakTextStack}>
            <Text style={styles.streakNumberFloat}>{stats.streak}</Text>
            <Text style={styles.streakRowText}>
              day streak{stats.streak === 1 ? "" : "s"}
            </Text>
          </View>
        </View>
        <View style={styles.weekDaysRow}>
          {streakWeek.map((day, index) => (
            <StreakWeekDay
              key={index}
              label={day.label}
              isActive={day.isActive}
              isToday={day.isToday}
              color={theme.primary}
            />
          ))}
        </View>
      </View>

      

      {stats.pets.length > 0 && (
        <View style={styles.petsRow}>
          {stats.pets.map((petId) => (
            <View key={petId} style={styles.petChip}>
              <Text style={styles.petChipText}>{PET_LABELS[petId]}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.sectionHeader}>Badges</Text>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Badges now slide horizontally instead of showing all at once
            in a grid - a more compact use of space for a growing list. */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={BADGES}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 10, paddingRight: 16 }}
          renderItem={({ item }) => {
            const earned = stats.badges.includes(item.id);
            return (
              <View style={[styles.badgeCard, earned ? styles.badgeEarned : styles.badgeLocked]}>
                <Text style={styles.badgeIcon}>{earned ? "[*]" : "[ ]"}</Text>
                <Text style={[styles.badgeName, !earned && styles.badgeNameLocked]}>
                  {item.name}
                </Text>
                <Text style={styles.badgeDescription}>{item.description}</Text>
              </View>
            );
          }}
        />

        <View style={styles.userInfoSection}>
          <Text style={styles.userInfoLabel}>Signed in as</Text>
          <Text style={styles.userInfoName}>{userName || "-"}</Text>
          <Text style={styles.userInfoEmail}>{userEmail || "-"}</Text>
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </Pressable>
        </View>
      </ScrollView>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa", padding: 16 },
  title: { fontSize: 24, fontWeight: "bold", color: "#1e293b", marginBottom: 12 },
  subtitle: { fontSize: 13, color: "#64748b", marginBottom: 16 },
  heroOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: "#ffffff",
  },
  heroOptionName: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  heroOptionDescription: { fontSize: 12, color: "#64748b", marginTop: 2 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  headerMiddle: { flex: 1 },
  headerLevel: { fontSize: 18, fontWeight: "bold", color: "#1e293b" },
  headerHeroName: { fontSize: 12, color: "#64748b", marginTop: 2 },
  headerXpRemaining: { fontSize: 11, color: "#475569", marginTop: 6, marginBottom: 4 },
  headerProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  headerProgressFill: { height: "100%", borderRadius: 3 },
  streakRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fdf6ec",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  streakRowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  streakIconBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#ffedd5",
    alignItems: "center",
    justifyContent: "center",
  },
  streakIconPlaceholderText: { fontSize: 10, fontWeight: "700", color: "#c2410c" },
  streakTextStack: { height: 48, justifyContent: "center" },
  streakNumberFloat: { fontSize: 20, fontWeight: "bold", color: "#c2410c", lineHeight: 22 },
  streakRowText: { fontSize: 12, fontWeight: "600", color: "#1e293b", lineHeight: 14 },
  weekDaysRow: { flexDirection: "row", gap: 6 },
  weekDayDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e2e8f0",
  },
  weekDayToday: { borderWidth: 2, borderColor: "#94a3b8" },
  weekDayLabel: { fontSize: 10, fontWeight: "700", color: "#64748b" },
  weekDayLabelActive: { color: "#ffffff" },
  nextRewardBox: {
    width: 90,
    borderWidth: 2,
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  nextRewardIcon: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  nextRewardLabel: { fontSize: 10, color: "#94a3b8", marginTop: 2 },
  nextRewardName: { fontSize: 11, fontWeight: "700", color: "#1e293b", textAlign: "center", marginTop: 2 },
  levelCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  xpLabel: { fontSize: 13, color: "#334155", marginBottom: 10 },
  progressTrack: {
    width: "100%",
    height: 10,
    backgroundColor: "#e2e8f0",
    borderRadius: 6,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 6 },
  totalXp: { fontSize: 12, color: "#475569", marginTop: 8 },
  streakCard: {
    backgroundColor: "#fff7ed",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
  },
  streakNumber: { fontSize: 32, fontWeight: "bold", color: "#c2410c" },
  streakLabel: { fontSize: 13, color: "#854d0e", marginTop: 2 },
  petsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  petChip: {
    backgroundColor: "#dcfce7",
    borderColor: "#16a34a",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  petChipText: { color: "#166534", fontWeight: "600", fontSize: 12 },
  sectionHeader: { fontSize: 16, fontWeight: "700", color: "#1e293b", marginBottom: 8 },
  badgeCard: {
    width: 140,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  badgeEarned: { backgroundColor: "#fef9c3", borderColor: "#eab308" },
  badgeLocked: { backgroundColor: "#f1f5f9", borderColor: "#e2e8f0" },
  badgeIcon: { fontSize: 14, fontWeight: "700", marginBottom: 4, color: "#1e293b" },
  badgeName: { fontSize: 13, fontWeight: "700", color: "#1e293b" },
  badgeNameLocked: { color: "#94a3b8" },
  badgeDescription: { fontSize: 11, color: "#64748b", marginTop: 2 },
  userInfoSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    alignItems: "center",
  },
  userInfoLabel: { fontSize: 11, color: "#94a3b8" },
  userInfoName: { fontSize: 15, fontWeight: "700", color: "#1e293b", marginTop: 2 },
  userInfoEmail: { fontSize: 12, color: "#64748b", marginTop: 2, marginBottom: 12 },
  logoutButton: {
    backgroundColor: "#dc2626",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    alignItems: "center",
  },
  logoutButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});








