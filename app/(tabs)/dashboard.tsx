import { HeroFigure } from "@/components/HeroFigure";
import { ProgressRing } from "@/components/ProgressRing";
import { useTheme } from "@/components/ThemeContext";
import { auth, db } from "@/services/firebase";
import { Assessment, GamificationStats, HeroId, Subject } from "@/types";
import { dueDateLabel, getUrgencyLevel } from "@/utils/dueDate";
import { buildSubjectColorMap } from "@/utils/subjectColors";
import { calculateLevel, levelProgress } from "@/utils/gamification";
import { useFocusEffect, useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
// SafeAreaView automatically adds padding so content doesn't overlap
// the phone's notch, camera cutout, or status bar.
import { SafeAreaView } from "react-native-safe-area-context";

// Builds 2-letter initials from a full name, e.g. "Kezang Choden" -> "KC".
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Small colored square icon shown next to each upcoming assessment,
// colored to match its subject (same color used in Subjects/Progress).
function AssessmentIcon({ color }: { color: string }) {
  return (
    <View style={[styles.assessmentIconBox, { backgroundColor: color }]}>
      <Text style={styles.assessmentIconText}>[ ]</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [userName, setUserName] = useState("");
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Loads everything the Dashboard needs: the user's name, their subjects,
  // their assessments, and their gamification stats (for the hero/level card).
  async function loadData() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setLoading(true);
    try {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.exists()) {
        setUserName(userDoc.data().name || "there");
      }

      const subjectsSnap = await getDocs(
        query(collection(db, "subjects"), where("userId", "==", currentUser.uid))
      );
      setSubjects(
        subjectsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Subject, "id">) }))
      );

      const assessmentsSnap = await getDocs(
        query(collection(db, "assessments"), where("userId", "==", currentUser.uid))
      );
      const results: Assessment[] = assessmentsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Assessment, "id">),
      }));
      results.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      setAssessments(results);

      const statsSnap = await getDoc(doc(db, "gamification", currentUser.uid));
      if (statsSnap.exists()) {
        setStats(statsSnap.data() as GamificationStats);
      }
    } finally {
      setLoading(false);
    }
  }

  // Reload every time the Dashboard tab comes into focus, so it always
  // reflects the latest data (e.g. after adding an assessment elsewhere).
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const todayStr = new Date().toISOString().slice(0, 10);

  const subjectColorMap = buildSubjectColorMap(subjects);
  const totalCount = assessments.length;
  const completedCount = assessments.filter((a) => a.completed).length;
  const overdueCount = assessments.filter((a) => !a.completed && a.dueDate < todayStr).length;

  // "Daily Progress" ring reflects assessments due TODAY specifically,
  // to match the "let's make today productive" framing.
  const dueToday = assessments.filter((a) => a.dueDate === todayStr);
  const dueTodayCompleted = dueToday.filter((a) => a.completed).length;
  const dailyPercent =
    dueToday.length === 0 ? 0 : Math.round((dueTodayCompleted / dueToday.length) * 100);

  // Upcoming list - soonest, not-completed assessments, capped to 4 rows
  // so the Dashboard stays scannable at a glance.
  const upcoming = assessments.filter((a) => !a.completed).slice(0, 4);

  function subjectName(id: string) {
    return subjects.find((s) => s.id === id)?.name ?? "";
  }

  // Overall subject completion breakdown, same calculation as the Progress tab.
  const subjectBreakdown = subjects.map((subject) => {
    const subjectAssessments = assessments.filter((a) => a.subjectId === subject.id);
    const completed = subjectAssessments.filter((a) => a.completed).length;
    return {
      id: subject.id,
      name: subject.name,
      total: subjectAssessments.length,
      completed,
    };
  });
  const overallSubjectPercent =
    totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  // Hero + level info for the "Level Up Your Journey" section.
  const xp = stats?.xp ?? 0;
  const level = calculateLevel(xp);
  const { percent: levelPercent, currentLevelXp, xpForNextLevel } = levelProgress(xp);
  const heroId: HeroId = stats?.heroId ?? "knight";
  // Hero grows slightly larger visually as the level increases, capping
  // out around level 5 so it doesn't scale indefinitely.
  const heroScale = 1 + Math.min(level - 1, 4) * 0.1;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header: title + tappable avatar (with a small level badge) leading to Profile */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <Pressable onPress={() => router.push("/profile")}>
          <View style={[styles.avatarSmall, { backgroundColor: theme.primary }]}>
            <Text style={styles.avatarSmallText}>{getInitials(userName)}</Text>
          </View>
          <View style={[styles.levelPill, { backgroundColor: theme.primary }]}>
            <Text style={styles.levelPillText}>Lv.{level}</Text>
          </View>
        </Pressable>
      </View>
      <Text style={styles.greeting}>Hello, {userName}</Text>
      <Text style={styles.subGreeting}>Let's make today productive!</Text>

      {/* Daily progress card - accent color follows the user's chosen theme */}
      <View style={[styles.dailyCard, { backgroundColor: theme.primary }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dailyCardTitle}>Daily Progress</Text>
          <Text style={styles.dailyCardSubtext}>
            {dueTodayCompleted} / {dueToday.length} tasks completed
          </Text>
          {stats && stats.streak > 0 && (
            <Text style={styles.streakText}>{stats.streak} day streak</Text>
          )}
        </View>
        <ProgressRing
          percent={dailyPercent}
          size={90}
          color="#ffffff"
          trackColor="rgba(255,255,255,0.3)"
          textColor="#ffffff"
        />
      </View>

      {/* Quick stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{totalCount}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{completedCount}</Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
        <View style={[styles.statCard, overdueCount > 0 && styles.statCardWarning]}>
          <Text style={styles.statNumber}>{overdueCount}</Text>
          <Text style={styles.statLabel}>Overdue</Text>
        </View>
      </View>

      {/* Everything below scrolls together in a single-item FlatList. */}
      <FlatList
        style={{ flex: 1 }}
        data={[{ key: "content" }]}
        keyExtractor={(item) => item.key}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={() => (
          <>
            {/* Upcoming assessments - colored subject icon, title, subject
                name, colored urgency label, and a priority pill. */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>Upcoming Assessments</Text>
              <Pressable onPress={() => router.push("/(tabs)/assessments")}>
                <Text style={[styles.viewAllText, { color: theme.primary }]}>View all</Text>
              </Pressable>
            </View>
            {upcoming.length === 0 ? (
              <Text style={styles.emptyText}>Nothing due right now.</Text>
            ) : (
              upcoming.map((item) => {
                const urgency = getUrgencyLevel(item.dueDate);
                return (
                  <View key={item.id} style={styles.upcomingCard}>
                    <AssessmentIcon color={subjectColorMap[item.subjectId]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.upcomingTitle}>{item.title}</Text>
                      <Text style={styles.upcomingSubtext}>{subjectName(item.subjectId)}</Text>
                      <Text
                        style={[
                          styles.upcomingDueLabel,
                          urgency === "overdue" && { color: "#dc2626" },
                          urgency === "urgent" && { color: "#c2410c" },
                          urgency === "soon" && { color: "#166534" },
                        ]}
                      >
                        {dueDateLabel(item.dueDate)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.priorityPill,
                        item.priority === "high" && styles.priorityHigh,
                        item.priority === "medium" && styles.priorityMedium,
                        item.priority === "low" && styles.priorityLow,
                      ]}
                    >
                      <Text style={styles.priorityPillText}>{item.priority}</Text>
                    </View>
                  </View>
                );
              })
            )}

            {/* Subject progress donut, reusing the same ring component and
                the same per-subject colors used on the Subjects/Progress tabs. */}
            <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Subject Progress</Text>
            <View style={styles.subjectRow}>
              <ProgressRing percent={overallSubjectPercent} size={100} color={theme.primary} />
              <View style={{ flex: 1, gap: 6 }}>
                {subjectBreakdown.map((s) => {
                  const pct = s.total === 0 ? 0 : Math.round((s.completed / s.total) * 100);
                  return (
                    <View key={s.id} style={styles.subjectLegendRow}>
                      <View
                        style={[styles.legendDot, { backgroundColor: subjectColorMap[s.id] }]}
                      />
                      <Text style={styles.subjectLegendText}>{s.name}</Text>
                      <Text style={styles.subjectLegendPercent}>{pct}%</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Level Up Your Journey - shows the user's hero, current level,
                XP progress, and a hint at the next milestone. */}
            <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Level Up Your Journey</Text>
            <View style={styles.journeyCard}>
              <HeroFigure heroId={heroId} size={100} scale={heroScale} />
              <View style={{ flex: 1 }}>
                <Text style={styles.journeyLevel}>Level {level}</Text>
                <Text style={styles.journeyXp}>
                  {currentLevelXp} / {xpForNextLevel} XP
                </Text>
                <View style={styles.journeyTrack}>
                  <View
                    style={[
                      styles.journeyFill,
                      { width: `${levelPercent}%`, backgroundColor: theme.primary },
                    ]}
                  />
                </View>
                <Text style={styles.journeyNextReward}>Reach Level {level + 1} to unlock</Text>
              </View>
            </View>

            {/* Focus Timer entry point - takes the user into a dedicated
                timer screen to start a focused study session. */}
            <Pressable
              style={[styles.focusCard, { backgroundColor: theme.primaryLight }]}
              onPress={() => router.push("/focus-timer")}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.focusCardTitle, { color: theme.primary }]}>
                  Start a Focus Session
                </Text>
                <Text style={styles.focusCardSubtext}>
                  Stay in the app for the full timer to earn bonus XP.
                </Text>
              </View>
              <Text style={[styles.focusCardArrow, { color: theme.primary }]}>{">"}</Text>
            </Pressable>
          </>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff", padding: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#111111" },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarSmallText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  levelPill: {
    position: "absolute",
    bottom: -6,
    right: -6,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  levelPillText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  greeting: { fontSize: 22, fontWeight: "bold", color: "#111111", marginTop: 12 },
  subGreeting: { fontSize: 13, color: "#666666", marginTop: 2, marginBottom: 16 },
  dailyCard: {
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  dailyCardTitle: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  dailyCardSubtext: { color: "rgba(255,255,255,0.9)", fontSize: 13, marginTop: 4 },
  streakText: { color: "#ffffff", fontSize: 12, marginTop: 8, fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  statCardWarning: { backgroundColor: "#fca5a5" },
  statNumber: { fontSize: 20, fontWeight: "bold", color: "#111111" },
  statLabel: { fontSize: 11, color: "#555555", marginTop: 2 },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionHeader: { fontSize: 15, fontWeight: "700", color: "#111111" },
  viewAllText: { fontSize: 12, fontWeight: "600" },
  emptyText: { fontSize: 13, color: "#999999", marginBottom: 12 },
  upcomingCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: "#fafafa",
    gap: 10,
  },
  assessmentIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  assessmentIconText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  upcomingTitle: { fontSize: 14, fontWeight: "600", color: "#111111" },
  upcomingSubtext: { fontSize: 11, color: "#666666", marginTop: 1 },
  upcomingDueLabel: { fontSize: 11, fontWeight: "700", color: "#555555", marginTop: 2 },
  priorityPill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  priorityHigh: { backgroundColor: "#fecaca" },
  priorityMedium: { backgroundColor: "#fde68a" },
  priorityLow: { backgroundColor: "#bbf7d0" },
  priorityPillText: { fontSize: 11, fontWeight: "700", color: "#111111" },
  subjectRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 8 },
  subjectLegendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  subjectLegendText: { fontSize: 12, color: "#333333", flex: 1 },
  subjectLegendPercent: { fontSize: 12, color: "#666666", fontWeight: "600" },
  journeyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  journeyLevel: { fontSize: 16, fontWeight: "700", color: "#111111" },
  journeyXp: { fontSize: 12, color: "#666666", marginTop: 2, marginBottom: 6 },
  journeyTrack: { height: 8, borderRadius: 4, backgroundColor: "#e5e7eb", overflow: "hidden" },
  journeyFill: { height: "100%", borderRadius: 4 },
  journeyNextReward: { fontSize: 11, color: "#888888", marginTop: 6 },
  focusCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  focusCardTitle: { fontSize: 15, fontWeight: "700" },
  focusCardSubtext: { fontSize: 12, color: "#555555", marginTop: 2 },
  focusCardArrow: { fontSize: 18, fontWeight: "700", marginLeft: 8 },
});





