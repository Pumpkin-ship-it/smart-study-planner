import { HeroFigure } from "@/components/HeroFigure";
import { MultiSegmentRing, RingSegment } from "@/components/MultiSegmentRing";
import { useTheme } from "@/components/ThemeContext";
import { auth, db } from "@/services/firebase";
import { Assessment, GamificationStats, HeroId, Subject } from "@/types";
import { dueDateLabel, getUrgencyLevel } from "@/utils/dueDate";
import { buildSubjectColorMap } from "@/utils/subjectColors";
import { calculateLevel, getRankTitle, levelProgress, xpForAssessment } from "@/utils/gamification";
import { useFocusEffect, useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
// SafeAreaView automatically adds padding so content doesn't overlap
// the phone's notch, camera cutout, or status bar.
import { SafeAreaView } from "react-native-safe-area-context";

// How many tasks to recommend for today's goal.
const DAILY_TASK_GOAL = 3;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const todayStr = new Date().toISOString().slice(0, 10);

  const totalCount = assessments.length;
  const completedCount = assessments.filter((a) => a.completed).length;
  const overdueCount = assessments.filter((a) => !a.completed && a.dueDate < todayStr).length;

  // Recommended tasks for today: pending assessments, overdue first (most
  // urgent), then soonest-due, capped at DAILY_TASK_GOAL. This gives a
  // realistic, achievable daily target rather than showing every pending
  // task at once.
  const pending = assessments.filter((a) => !a.completed);
  const overduePending = pending.filter((a) => a.dueDate < todayStr);
  const upcomingPending = pending.filter((a) => a.dueDate >= todayStr);
  const recommendedToday = [...overduePending, ...upcomingPending].slice(0, DAILY_TASK_GOAL);

  // How many of TODAY's completions count toward the daily goal, and how
  // much XP was earned today - both based on the completedAt field set
  // when an assessment is marked complete.
  const completedTodayList = assessments.filter((a) => a.completedAt === todayStr);
  const tasksCompletedToday = completedTodayList.length;
  const xpEarnedToday = completedTodayList.reduce(
    (sum, a) => sum + xpForAssessment(a.priority),
    0
  );

  // Daily XP goal: the XP that completing all of today's recommended
  // tasks would grant - a natural target tied to real remaining work.
  const dailyXpGoal = recommendedToday.reduce((sum, a) => sum + xpForAssessment(a.priority), 0);

  const taskGoalCount = Math.max(recommendedToday.length, 1); // avoid divide-by-zero
  const dailyTaskPercent = Math.min(
    100,
    Math.round((Math.min(tasksCompletedToday, taskGoalCount) / taskGoalCount) * 100)
  );

  const upcoming = pending.slice(0, 4);

  function subjectName(id: string) {
    return subjects.find((s) => s.id === id)?.name ?? "";
  }

  const subjectColorMap = buildSubjectColorMap(subjects);

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
  const ringSegments: RingSegment[] = subjectBreakdown
    .filter((s) => s.completed > 0)
    .map((s) => ({
      percent: totalCount === 0 ? 0 : (s.completed / totalCount) * 100,
      color: subjectColorMap[s.id],
    }));

  const xp = stats?.xp ?? 0;
  const level = calculateLevel(xp);
  const { percent: levelPercent, currentLevelXp, xpForNextLevel } = levelProgress(xp);
  const heroId: HeroId = stats?.heroId ?? "knight";
  const heroScale = 1 + Math.min(level - 1, 4) * 0.1;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <View style={[styles.avatarLarge, { backgroundColor: theme.primaryLight }]}>
          <HeroFigure heroId={heroId} size={56} crop="bust" />
        </View>
      </View>
      <Text style={styles.greeting}>Hello, {getRankTitle(level)} {userName.split(" ")[0]}</Text>
      <Text style={styles.subGreeting}>Let's make today productive!</Text>

      {/* Daily progress card - shows a recommended task goal for today
          plus the XP that completing it would earn, and how much of
          both have actually been achieved today so far. */}
      <View style={[styles.dailyCard, { backgroundColor: theme.primary }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dailyCardTitle}>Today's Goal</Text>
          <Text style={styles.dailyCardSubtext}>
            {Math.min(tasksCompletedToday, taskGoalCount)} / {recommendedToday.length} recommended
            tasks
          </Text>
          <Text style={styles.dailyCardSubtext}>
            {xpEarnedToday} / {dailyXpGoal} XP today
          </Text>
          {stats && stats.streak > 0 && (
            <Text style={styles.streakText}>{stats.streak} day streak</Text>
          )}
        </View>
        <MultiSegmentRing
          segments={[{ percent: dailyTaskPercent, color: "#9ca3af" }]}
          totalPercent={dailyTaskPercent}
          size={90}
          strokeWidth={14}
          trackColor="#111111"
          textColor="#111111"
        />
      </View>

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

      <FlatList
        style={{ flex: 1 }}
        data={[{ key: "content" }]}
        keyExtractor={(item) => item.key}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={() => (
          <>
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

            <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Subject Progress</Text>
            <View style={styles.subjectRow}>
              <MultiSegmentRing
                segments={ringSegments}
                totalPercent={overallSubjectPercent}
                size={100}
                strokeWidth={18}
              />
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
  container: { flex: 1, backgroundColor: "#fafafa", padding: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#1e293b" },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  greeting: { fontSize: 22, fontWeight: "bold", color: "#1e293b", marginTop: 12 },
  subGreeting: { fontSize: 13, color: "#64748b", marginTop: 2, marginBottom: 16 },
  dailyCard: {
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  dailyCardTitle: { color: "#111111", fontSize: 16, fontWeight: "700" },
  dailyCardSubtext: { color: "#111111", fontSize: 13, marginTop: 4 },
  streakText: { color: "#111111", fontSize: 12, marginTop: 8, fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  statCardWarning: { backgroundColor: "#fca5a5", borderColor: "#fca5a5" },
  statNumber: { fontSize: 20, fontWeight: "bold", color: "#1e293b" },
  statLabel: { fontSize: 11, color: "#64748b", marginTop: 2 },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionHeader: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  viewAllText: { fontSize: 12, fontWeight: "600" },
  emptyText: { fontSize: 13, color: "#94a3b8", marginBottom: 12 },
  upcomingCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: "#ffffff",
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
  upcomingTitle: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  upcomingSubtext: { fontSize: 11, color: "#64748b", marginTop: 1 },
  upcomingDueLabel: { fontSize: 11, fontWeight: "700", color: "#64748b", marginTop: 2 },
  priorityPill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  priorityHigh: { backgroundColor: "#fecaca" },
  priorityMedium: { backgroundColor: "#fde68a" },
  priorityLow: { backgroundColor: "#bbf7d0" },
  priorityPillText: { fontSize: 11, fontWeight: "700", color: "#1e293b" },
  subjectRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 8 },
  subjectLegendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  subjectLegendText: { fontSize: 12, color: "#333333", flex: 1 },
  subjectLegendPercent: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  journeyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  journeyLevel: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  journeyXp: { fontSize: 12, color: "#64748b", marginTop: 2, marginBottom: 6 },
  journeyTrack: { height: 8, borderRadius: 4, backgroundColor: "#e2e8f0", overflow: "hidden" },
  journeyFill: { height: "100%", borderRadius: 4 },
  journeyNextReward: { fontSize: 11, color: "#94a3b8", marginTop: 6 },
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








