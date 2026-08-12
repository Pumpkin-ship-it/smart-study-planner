import { auth, db } from "@/services/firebase";
import { Assessment, GamificationStats } from "@/types";
import { calculateLevel } from "@/utils/gamification";
import { getSubjectColor } from "@/utils/subjectColors";
import { useFocusEffect, useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
// SafeAreaView automatically adds padding so content doesn't overlap
// the phone's notch, camera cutout, or status bar.
import { SafeAreaView } from "react-native-safe-area-context";

// One segment of the monthly progress bar - how many assessments
// were completed this month for a given subject.
type MonthlySubjectSegment = {
  subjectId: string;
  subjectName: string;
  count: number;
};

export default function ProfileScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [monthlySegments, setMonthlySegments] = useState<MonthlySubjectSegment[]>([]);
  const [loading, setLoading] = useState(true);

  // Loads the user's profile info, gamification stats, and a breakdown of
  // assessments completed this calendar month, grouped by subject.
  async function loadData() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setLoading(true);
    try {
      setEmail(currentUser.email ?? "");

      // Basic profile info (name).
      const userSnap = await getDoc(doc(db, "users", currentUser.uid));
      if (userSnap.exists()) {
        setName(userSnap.data().name ?? "");
      }

      // Gamification stats (level, XP, streak, badges).
      const statsSnap = await getDoc(doc(db, "gamification", currentUser.uid));
      if (statsSnap.exists()) {
        setStats(statsSnap.data() as GamificationStats);
      }

      // This user's subjects, needed to label and color each segment.
      const subjectsSnap = await getDocs(
        query(collection(db, "subjects"), where("userId", "==", currentUser.uid))
      );
      const subjectNames: Record<string, string> = {};
      subjectsSnap.docs.forEach((d) => {
        subjectNames[d.id] = d.data().name;
      });

      // This user's assessments, to work out what was completed this month.
      const assessmentsSnap = await getDocs(
        query(collection(db, "assessments"), where("userId", "==", currentUser.uid))
      );
      const assessments = assessmentsSnap.docs.map((d) => d.data() as Assessment);

      // "This month" is determined by the assessment's due date falling in
      // the current calendar month/year - a reasonable proxy for "the work
      // the user has been doing recently."
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const countsBySubject: Record<string, number> = {};
      assessments.forEach((a) => {
        if (!a.completed) return;
        const due = new Date(a.dueDate);
        if (due.getMonth() === currentMonth && due.getFullYear() === currentYear) {
          countsBySubject[a.subjectId] = (countsBySubject[a.subjectId] ?? 0) + 1;
        }
      });

      const segments: MonthlySubjectSegment[] = Object.entries(countsBySubject).map(
        ([subjectId, count]) => ({
          subjectId,
          subjectName: subjectNames[subjectId] ?? "Unknown",
          count,
        })
      );
      setMonthlySegments(segments);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function handleLogout() {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (error: any) {
      Alert.alert("Error signing out", error.message);
    }
  }

  const level = stats ? calculateLevel(stats.xp) : 1;
  const monthlyTotal = monthlySegments.reduce((sum, s) => sum + s.count, 0);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.infoCard}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{name || "-"}</Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{email || "-"}</Text>
      </View>

      {/* Achievement summary - same color language as the Rewards tab,
          so a user's progress feels consistent across screens. */}
      <Text style={styles.sectionHeader}>Achievements</Text>
      <View style={styles.achievementRow}>
        <View style={[styles.achievementCard, { backgroundColor: "#eef2ff" }]}>
          <Text style={[styles.achievementNumber, { color: "#4f46e5" }]}>{level}</Text>
          <Text style={styles.achievementLabel}>Level</Text>
        </View>
        <View style={[styles.achievementCard, { backgroundColor: "#fff7ed" }]}>
          <Text style={[styles.achievementNumber, { color: "#c2410c" }]}>
            {stats?.streak ?? 0}
          </Text>
          <Text style={styles.achievementLabel}>Streak</Text>
        </View>
        <View style={[styles.achievementCard, { backgroundColor: "#fef9c3" }]}>
          <Text style={[styles.achievementNumber, { color: "#a16207" }]}>
            {stats?.badges.length ?? 0}
          </Text>
          <Text style={styles.achievementLabel}>Badges</Text>
        </View>
      </View>

      {/* Monthly progress - a single bar split into colored segments,
          one per subject, using the SAME colors shown in Subjects/Progress. */}
      <Text style={styles.sectionHeader}>This Month</Text>
      {monthlyTotal === 0 ? (
        <Text style={styles.emptyText}>No assessments completed yet this month.</Text>
      ) : (
        <>
          <View style={styles.monthlyBar}>
            {monthlySegments.map((segment) => (
              <View
                key={segment.subjectId}
                style={{
                  flex: segment.count,
                  backgroundColor: getSubjectColor(segment.subjectId),
                }}
              />
            ))}
          </View>
          <View style={styles.legendWrap}>
            {monthlySegments.map((segment) => (
              <View key={segment.subjectId} style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: getSubjectColor(segment.subjectId) },
                  ]}
                />
                <Text style={styles.legendText}>
                  {segment.subjectName} ({segment.count})
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </Pressable>

      <Pressable onPress={() => router.back()}>
        <Text style={styles.backLink}>Back</Text>
      </Pressable>

      {/* Small app info footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>StudyFlow v1.0.0</Text>
        <Text style={styles.footerText}>
          Hero icons by game-icons.net (CC BY 3.0). Animations via LottieFiles.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff", padding: 16 },
  title: { fontSize: 24, fontWeight: "bold", color: "#111111", marginBottom: 16 },
  infoCard: {
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  label: { fontSize: 12, color: "#888888", marginTop: 8 },
  value: { fontSize: 16, color: "#111111", fontWeight: "600" },
  sectionHeader: { fontSize: 15, fontWeight: "700", color: "#111111", marginBottom: 8 },
  achievementRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  achievementCard: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  achievementNumber: { fontSize: 22, fontWeight: "bold" },
  achievementLabel: { fontSize: 12, color: "#555555", marginTop: 2 },
  monthlyBar: {
    flexDirection: "row",
    height: 14,
    borderRadius: 7,
    overflow: "hidden",
    backgroundColor: "#e5e7eb",
    marginBottom: 10,
  },
  legendWrap: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: "#444444" },
  emptyText: { fontSize: 13, color: "#999999", marginBottom: 20 },
  logoutButton: {
    backgroundColor: "#dc2626",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  logoutButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  backLink: { color: "#2563eb", textAlign: "center", marginBottom: 24 },
  footer: { alignItems: "center", gap: 4 },
  footerText: { fontSize: 11, color: "#aaaaaa", textAlign: "center" },
});
