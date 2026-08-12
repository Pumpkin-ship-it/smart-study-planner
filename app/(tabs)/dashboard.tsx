import { auth, db } from "@/services/firebase";
import { Assessment } from "@/types";
import { dueDateLabel, getUrgencyLevel } from "@/utils/dueDate";
import { useFocusEffect, useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
// SafeAreaView automatically adds padding so content doesn't overlap
// the phone's notch, camera cutout, or status bar.
import { SafeAreaView } from "react-native-safe-area-context";

// Maps an urgency level to a border/background color, matching the same
// scheme used on the Assessments screen: red = overdue, yellow = urgent,
// green = due soon, gray = normal / far away.
function urgencyStyle(dueDate: string) {
  const level = getUrgencyLevel(dueDate);
  if (level === "overdue") return { borderColor: "#7f1d1d", backgroundColor: "#fca5a5" };
  if (level === "urgent") return { borderColor: "#854d0e", backgroundColor: "#fde047" };
  if (level === "soon") return { borderColor: "#166534", backgroundColor: "#86efac" };
  return { borderColor: "#eee", backgroundColor: "#fafafa" };
}

export default function DashboardScreen() {
  const router = useRouter();
  // The user's assessments, loaded fresh each time this screen is focused.
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  // The user's display name, fetched from their Firestore profile document
  // (not from Firebase Auth, since we only stored the name in Firestore).
  const [userName, setUserName] = useState<string>("");

  // Fetches this user's profile (for their name) and their assessments.
  async function loadData() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setLoading(true);
    try {
      // Look up this user's profile document in the "users" collection.
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.exists()) {
        setUserName(userDoc.data().name || currentUser.email || "there");
      } else {
        setUserName(currentUser.email || "there");
      }

      // Load this user's assessments.
      const snapshot = await getDocs(
        query(collection(db, "assessments"), where("userId", "==", currentUser.uid))
      );
      const results: Assessment[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Assessment, "id">),
      }));
      // Soonest due date first, so the most urgent items appear at the top.
      results.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      setAssessments(results);
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

  // Today's date as "YYYY-MM-DD", used to figure out what is overdue vs upcoming.
  const todayStr = new Date().toISOString().slice(0, 10);

  // Split the assessments into useful groups for the summary cards.
  const completedCount = assessments.filter((a) => a.completed).length;
  const totalCount = assessments.length;
  const overdue = assessments.filter((a) => !a.completed && a.dueDate < todayStr);
  const upcoming = assessments.filter((a) => !a.completed && a.dueDate >= todayStr);

  // For the main list, show overdue items first, then upcoming ones.
  // Completed items are left out of this list entirely - it's about what's
  // left to do, not a full history.
  const listData = [...overdue, ...upcoming];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header row: title + welcome message on the left, profile icon on the right */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.subtitle}>Welcome back, {userName}</Text>
        </View>
        <Pressable style={styles.profileButton} onPress={() => router.push("/profile")}>
          <Text style={styles.profileButtonText}>Profile</Text>
        </Pressable>
      </View>

      {/* Summary row - quick at-a-glance stats */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{totalCount}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{completedCount}</Text>
          <Text style={styles.summaryLabel}>Completed</Text>
        </View>
        <View style={[styles.summaryCard, overdue.length > 0 && styles.summaryCardWarning]}>
          <Text style={styles.summaryNumber}>{overdue.length}</Text>
          <Text style={styles.summaryLabel}>Overdue</Text>
        </View>
      </View>

      <Text style={styles.sectionHeader}>Upcoming Assessments</Text>

      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={loadData}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>
              Nothing due right now. Add assessments from the Assessments tab.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={[styles.card, urgencyStyle(item.dueDate)]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSubtext}>
                {item.estimatedHours}h -{" "}
                <Text style={{ fontWeight: "700" }}>{item.priority}</Text>
              </Text>
              {/* Human-readable urgency label, e.g. "Due in 2 days" or "Overdue by 1 day" */}
              <Text style={styles.urgencyText}>{dueDateLabel(item.dueDate)}</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff", padding: 16 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: "bold", color: "#111111" },
  subtitle: { fontSize: 14, color: "#666666", marginTop: 2 },
  profileButton: {
    backgroundColor: "#f3f4f6",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  profileButtonText: { color: "#111111", fontWeight: "600", fontSize: 12 },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  summaryCard: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  summaryCardWarning: { backgroundColor: "#fca5a5" },
  summaryNumber: { fontSize: 22, fontWeight: "bold", color: "#111111" },
  summaryLabel: { fontSize: 12, color: "#555555", marginTop: 2 },
  sectionHeader: { fontSize: 16, fontWeight: "700", color: "#111111", marginBottom: 8 },
  card: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#111111" },
  cardSubtext: { fontSize: 12, color: "#666666", marginTop: 2 },
  urgencyText: { fontSize: 12, fontWeight: "700", color: "#111111", marginTop: 2 },
  emptyText: { textAlign: "center", color: "#999999", marginTop: 32, paddingHorizontal: 16 },
});
