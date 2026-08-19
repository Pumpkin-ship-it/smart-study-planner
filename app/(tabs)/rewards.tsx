import { auth, db } from "@/services/firebase";
import { useTheme } from "@/components/ThemeContext";
import { HeroFigure } from "@/components/HeroFigure";
import { StreakWeekDay } from "@/components/StreakWeekDay";
import { getStreakWeek } from "@/utils/dueDate";
import { Assessment, GamificationStats, HeroId } from "@/types";
import { BADGES, calculateLevel, levelProgress, xpForAssessment } from "@/utils/gamification";
import { useFocusEffect, useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { useCallback, useState } from "react";
import { Alert, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BADGE_IMAGES } from "@/components/badgeImages";
// SafeAreaView automatically adds padding so content doesn't overlap
// the phone's notch, camera cutout, or status bar.
import { SafeAreaView } from "react-native-safe-area-context";

// Default stats shown before the user has completed anything yet, and also
// used to fill in any fields missing from OLDER Firestore documents that
// were created before newer fields existed in our data model.
const EMPTY_STATS: GamificationStats = {
  userId: "",
  xp: 0,
  streak: 0,
  lastCompletedDate: null,
  badges: [],
  heroId: null,
  pets: [],
  rankTier: 0,
  rankStars: 0,
  assessmentGainProgress: 0,
  assessmentLossProgress: 0,
  focusGainProgress: 0,
  focusLossProgress: 0,
  totalStarsEarned: 0,
};

const HERO_OPTIONS: { id: HeroId; name: string; description: string }[] = [
  { id: "elf", name: "Elf Ranger", description: "Swift and sharp-eyed." },
  { id: "knight", name: "Knight", description: "Sturdy and disciplined." },
  { id: "mage", name: "Mage", description: "Wise and studious." },
  { id: "warrior", name: "Warrior", description: "Bold and relentless." },
  { id: "rogue", name: "Rogue", description: "Quick and resourceful." },
];

export default function RewardsScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [stats, setStats] = useState<GamificationStats>(EMPTY_STATS);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [completedCount, setCompletedCount] = useState(0);
  const [assessmentXpTotal, setAssessmentXpTotal] = useState(0);
  const [recentCompletions, setRecentCompletions] = useState<{ id: string; title: string; xp: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Loads this user's gamification stats, basic profile info, and
  // completed-assessment stats used in the Recent Rewards summary.
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

      const assessmentsSnap = await getDocs(
        query(collection(db, "assessments"), where("userId", "==", currentUser.uid))
      );
      const assessments = assessmentsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Assessment, "id">),
      })) as Assessment[];
      const completed = assessments.filter((a) => a.completed);
      setCompletedCount(completed.length);
      setAssessmentXpTotal(completed.reduce((sum, a) => sum + xpForAssessment(a.priority), 0));

      const recent = [...completed]
        .filter((a) => a.completedAt)
        .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
        .slice(0, 5)
        .map((a) => ({ id: a.id, title: a.title, xp: xpForAssessment(a.priority) }));
      setRecentCompletions(recent);
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
  const streakWeek = getStreakWeek(stats.streak, stats.lastCompletedDate);

  // "Next Reward" is now driven by LEVEL, not badges - it always has
  // something meaningful to show, and lines up naturally with milestones
  // like the pet unlock at Level 5.
  // The next badge the user hasn't earned yet, ordered by how many stars
  // it requires - shown in the reward box as what they're working toward.
  const nextBadge = [...BADGES].sort((a, b) => a.starsRequired - b.starsRequired).find(
    (b) => !stats.badges.includes(b.id)
  );
  const starsToNextBadge = nextBadge
    ? Math.max(nextBadge.starsRequired - (stats.totalStarsEarned ?? 0), 0)
    : 0;

  // The most recently earned badge - shown enlarged with its star
  // requirement, MLBB-style, above the rest of the badge row.
  const mostRecentBadge = [...BADGES].reverse().find((b) => stats.badges.includes(b.id));
  const otherBadges = BADGES.filter((b) => b.id !== mostRecentBadge?.id);

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

      {/* Header row: hero | level + XP progress | next reward (level-based) */}
      <View style={styles.headerRow}>
        {stats.heroId && <HeroFigure heroId={stats.heroId} size={90} scale={heroScale} />}
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
            <Image
              source={BADGE_IMAGES[nextBadge.id]}
              style={styles.nextRewardBadgeImage}
            />
            <Text style={styles.nextRewardName} numberOfLines={2}>
              {nextBadge.name}
            </Text>
            <Text style={styles.nextRewardLabel}>{starsToNextBadge} stars to go</Text>
          </View>
        ) : (
          <View style={[styles.nextRewardBox, { borderColor: "#eab308" }]}>
            <Text style={styles.nextRewardIcon}>[*]</Text>
            <Text style={styles.nextRewardLabel}>All earned!</Text>
          </View>
        )}
      </View>

      {/* Streak row: icon + day count on the left, animated week dots on the right */}
      <View style={styles.streakRow}>
        <View style={styles.streakRowLeft}>
          <View style={styles.streakIconBox}>
            <Image source={require("../../assets/icons/strx_fire.png")} style={styles.streakIconImage} />
          </View>
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
              key={`${day.label}-${index}`}
              label={day.label}
              isActive={day.isActive}
              isToday={day.isToday}
              color={theme.primary}
            />
          ))}
        </View>
      </View>

      <Text style={styles.sectionHeader}>Badges</Text>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Most recently earned badge, shown larger with gold stars
            underneath (MLBB-style), separate from the rest of the row. */}
        {mostRecentBadge && (
          <View style={[styles.featuredBadgeCard, { borderColor: theme.primary }]}>
            <Image source={BADGE_IMAGES[mostRecentBadge.id]} style={styles.featuredBadgeImage} />
            <Text style={styles.featuredBadgeName}>{mostRecentBadge.name}</Text>
            <Text style={styles.featuredBadgeDescription}>{mostRecentBadge.description}</Text>
            <View style={styles.featuredBadgeStarsRow}>
              {Array.from({ length: mostRecentBadge.starsRequired }, (_, i) => (
                <Image key={`${mostRecentBadge.id}-star-${i}`} source={require("../../assets/icons/star.jpg")} style={styles.featuredBadgeStarImage} />
              ))}
            </View>
          </View>
        )}

        {/* The rest of the badges, standard size, earned or locked. */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={otherBadges}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 10, paddingRight: 16 }}
          renderItem={({ item }) => {
            const earned = stats.badges.includes(item.id);
            return (
              <View style={[styles.badgeCard, earned ? styles.badgeEarned : styles.badgeLocked]}>
                <Image
                  source={BADGE_IMAGES[item.id]}
                  style={[styles.badgeImage, !earned && styles.badgeImageLocked]}
                />
                <Text style={[styles.badgeName, !earned && styles.badgeNameLocked]}>
                  {item.name}
                </Text>
                <Text style={styles.badgeDescription}>{item.description}</Text>
              </View>
            );
          }}
        />

        <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Recent Rewards</Text>
        <View style={styles.recentRewardsBlock}>
          {/* Left side: what happened. Right side: the XP tied to that
              event - completed assessments show their real earned XP,
              streak reflects total XP (overall consistency), and level
              shows how much XP is needed for the next one. */}
          <View style={styles.recentRewardRow}>
            <View style={styles.recentRewardIconBox}>
              <Image source={require("../../assets/icons/done.png")} style={styles.recentRewardIconImage} resizeMode="contain" />
            </View>
            <Text style={styles.recentRewardText}>
              {completedCount} assessment{completedCount === 1 ? "" : "s"} completed
            </Text>
            <Text style={[styles.xpGainText, { color: theme.primary }]}>
              +{assessmentXpTotal} XP
            </Text>
          </View>
          {stats.streak > 0 && (
            <View style={styles.recentRewardRow}>
              <View style={styles.recentRewardIconBox}>
                <Image source={require("../../assets/icons/fire.png")} style={styles.recentRewardIconImage} resizeMode="contain" />
              </View>
              <Text style={styles.recentRewardText}>
                {stats.streak}-day streak going strong
              </Text>
              <Text style={[styles.xpGainText, { color: theme.primary }]}>
                {stats.xp} XP
              </Text>
            </View>
          )}
          <View style={styles.recentRewardRow}>
            <View style={styles.recentRewardIconBox}>
              <Image source={require("../../assets/icons/up.png")} style={styles.recentRewardIconImage} resizeMode="contain" />
            </View>
            <Text style={styles.recentRewardText}>Reached Level {level}</Text>
            <Text style={[styles.xpGainText, { color: theme.primary }]}>
              {xpForNextLevel - currentLevelXp} to next
            </Text>
          </View>
        </View>

        <View style={styles.userInfoSection}>
          <Text style={styles.userInfoLabel}>Signed in as</Text>
          <Text style={styles.userInfoName}>{userName || "-"}</Text>
          <Text style={styles.userInfoEmail}>{userEmail || "-"}</Text>
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </Pressable>
        </View>
      </ScrollView>
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
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  headerMiddle: { flex: 1 },
  headerLevel: { fontSize: 18, fontWeight: "bold", color: "#1e293b" },
  headerHeroName: { fontSize: 12, color: "#64748b", marginTop: 2 },
  headerXpRemaining: { fontSize: 11, color: "#475569", marginTop: 6, marginBottom: 4 },
  headerProgressTrack: { height: 6, borderRadius: 3, backgroundColor: "#e2e8f0", overflow: "hidden" },
  headerProgressFill: { height: "100%", borderRadius: 3 },
  nextRewardBox: {
    width: 90,
    borderWidth: 2,
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  nextRewardIcon: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  nextRewardBadgeImage: { width: 40, height: 40, marginBottom: 2 },
  nextRewardLabel: { fontSize: 10, color: "#94a3b8", marginTop: 2 },
  nextRewardName: { fontSize: 11, fontWeight: "700", color: "#1e293b", textAlign: "center", marginTop: 2 },
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
  streakIconImage: { width: 32, height: 32 },
  streakTextStack: { height: 48, justifyContent: "center" },
  streakNumberFloat: { fontSize: 20, fontWeight: "bold", color: "#c2410c", lineHeight: 22 },
  streakRowText: { fontSize: 12, fontWeight: "600", color: "#1e293b", lineHeight: 14 },
  weekDaysRow: { flexDirection: "row", gap: 6 },
  sectionHeader: { fontSize: 16, fontWeight: "700", color: "#1e293b", marginBottom: 8 },
  // Enlarged "featured" card for the user's most recently earned badge.
  featuredBadgeCard: {
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    alignItems: "center",
  },
  featuredBadgeImage: { width: 72, height: 72, marginBottom: 6 },
  featuredBadgeName: { fontSize: 18, fontWeight: "800", color: "#1e293b" },
  featuredBadgeDescription: { fontSize: 12, color: "#64748b", marginTop: 4, textAlign: "center" },
  featuredBadgeStarsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 10, justifyContent: "center" },
  featuredBadgeStarImage: { width: 18, height: 18 },
  badgeCard: {
    width: 210,
    height: 175,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeEarned: { borderColor: "transparent", backgroundColor: "transparent" },
  badgeLocked: { backgroundColor: "#f1f5f9", borderColor: "#e2e8f0" },
  badgeImage: { width: 110, height: 110, marginBottom: 8 },
  badgeImageLocked: { opacity: 0.35 },
  badgeName: { fontSize: 17, fontWeight: "700", color: "#1e293b", textAlign: "center" },
  badgeNameLocked: { color: "#94a3b8" },
  badgeDescription: { fontSize: 13, color: "#64748b", marginTop: 5, textAlign: "center" },
  recentRewardsBlock: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  recentRewardRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 28 },
  recentRewardIconImage: { width: 28, height: 28 },
  recentRewardText: { fontSize: 13, color: "#1e293b", flex: 1 },
  xpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  xpRowCategory: { fontSize: 10, color: "#94a3b8", textTransform: "uppercase" },
  xpRowLabel: { fontSize: 13, color: "#1e293b", marginTop: 1 },
  xpGainText: { fontSize: 12, fontWeight: "700" },
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

























