import { auth, db } from "@/services/firebase";
import { Assessment, GamificationStats, Subject } from "@/types";
import { useTheme } from "@/components/ThemeContext";
import { showAlert } from "@/utils/alert";
import { dueDateLabel, getUrgencyLevel } from "@/utils/dueDate";
import { BADGES, checkNewBadges, petUnlockedByLevel, updateStreak, xpForAssessment, applyStarGain, applyStarLoss, calculateLevel } from "@/utils/gamification";
import { useFocusEffect } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PRIORITIES: Assessment["priority"][] = ["low", "medium", "high"];

function formatDateInput(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 8);
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  let result = year;
  if (month) result += "-" + month;
  if (day) result += "-" + day;
  return result;
}

// Urgency colors are FUNCTIONAL (overdue/urgent/soon/normal), not
// decorative, so they intentionally do NOT follow the user's chosen
// app theme - changing them would break the "at a glance" meaning.
function urgencyStyle(dueDate: string) {
  const level = getUrgencyLevel(dueDate);
  if (level === "overdue") return { borderColor: "#7f1d1d", backgroundColor: "#fca5a5" };
  if (level === "urgent") return { borderColor: "#854d0e", backgroundColor: "#fde047" };
  if (level === "soon") return { borderColor: "#166534", backgroundColor: "#86efac" };
  return { borderColor: "#e2e8f0", backgroundColor: "#ffffff" };
}

export default function AssessmentsScreen() {
  const { theme } = useTheme();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [priority, setPriority] = useState<Assessment["priority"]>("medium");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function penalizeOverdueAssessments(overdueItems: Assessment[]) {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Mark each one so it never gets penalized again on future loads.
    await Promise.all(
      overdueItems.map((item) =>
        updateDoc(doc(db, "assessments", item.id), { overduePenalized: true })
      )
    );

    const statsRef = doc(db, "gamification", currentUser.uid);
    const statsSnap = await getDoc(statsRef);
    const emptyStats: GamificationStats = {
      userId: currentUser.uid,
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
    const existing: GamificationStats = statsSnap.exists()
      ? { ...emptyStats, ...(statsSnap.data() as Partial<GamificationStats>) }
      : emptyStats;

    // Apply one loss-progress unit per newly-overdue assessment - every
    // 2 overdue items costs a full star.
    let progress = existing.assessmentLossProgress;
    let tier = existing.rankTier;
    let stars = existing.rankStars;
    for (let i = 0; i < overdueItems.length; i++) {
      const result = applyStarLoss(progress, tier, stars);
      progress = result.progress;
      tier = result.rankTier;
      stars = result.rankStars;
    }

    await setDoc(statsRef, {
      ...existing,
      assessmentLossProgress: progress,
      rankTier: tier,
      rankStars: stars,
    });
  }

  async function loadData() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setLoading(true);
    try {
      const subjectsSnap = await getDocs(
        query(collection(db, "subjects"), where("userId", "==", currentUser.uid))
      );
      const loadedSubjects: Subject[] = subjectsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Subject, "id">),
      }));
      setSubjects(loadedSubjects);
      if (!subjectId && loadedSubjects.length > 0) {
        setSubjectId(loadedSubjects[0].id);
      }
      const assessmentsSnap = await getDocs(
        query(collection(db, "assessments"), where("userId", "==", currentUser.uid))
      );
      const loadedAssessments: Assessment[] = assessmentsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Assessment, "id">),
      }));
      loadedAssessments.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      setAssessments(loadedAssessments);

      // Check for any assessments that have newly become overdue (past
      // their due date, still incomplete, not yet penalized) and deduct
      // rank star progress for each - this only ever happens ONCE per
      // assessment, thanks to the overduePenalized flag.
      const todayStr = new Date().toISOString().slice(0, 10);
      const newlyOverdue = loadedAssessments.filter(
        (a) => !a.completed && a.dueDate < todayStr && !a.overduePenalized
      );
      if (newlyOverdue.length > 0) {
        await penalizeOverdueAssessments(newlyOverdue);
      }
    } catch (error: any) {
      showAlert("Error loading data", error.message);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  function resetForm() {
    setTitle("");
    setDueDate("");
    setEstimatedHours("");
    setPriority("medium");
    setEditingId(null);
  }

  async function handleSave() {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      showAlert("Not logged in", "Please log in again.");
      return;
    }
    if (!title.trim() || !dueDate.trim() || !subjectId) {
      showAlert("Missing info", "Please fill in title, due date, and select a subject.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())) {
      showAlert("Invalid date", "Please enter the due date as YYYY-MM-DD (e.g. 2026-09-15).");
      return;
    }
    const hoursNumber = parseFloat(estimatedHours) || 0;
    try {
      if (editingId) {
        await updateDoc(doc(db, "assessments", editingId), {
          title: title.trim(),
          dueDate: dueDate.trim(),
          estimatedHours: hoursNumber,
          priority,
          subjectId,
        });
      } else {
        await addDoc(collection(db, "assessments"), {
          userId: currentUser.uid,
          subjectId,
          title: title.trim(),
          dueDate: dueDate.trim(),
          estimatedHours: hoursNumber,
          priority,
          completed: false,
          xpAwarded: false,
          createdAt: new Date().toISOString(),
        });
      }
      resetForm();
      loadData();
    } catch (error: any) {
      showAlert("Error saving assessment", error.message);
    }
  }

  function handleEdit(item: Assessment) {
    setEditingId(item.id);
    setTitle(item.title);
    setDueDate(item.dueDate);
    setEstimatedHours(String(item.estimatedHours));
    setPriority(item.priority);
    setSubjectId(item.subjectId);
  }

  function handleDelete(id: string) {
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Delete this assessment? This cannot be undone.");
      if (confirmed) {
        deleteDoc(doc(db, "assessments", id)).then(() => loadData());
      }
    } else {
      Alert.alert("Delete assessment", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteDoc(doc(db, "assessments", id));
            loadData();
          },
        },
      ]);
    }
  }

  async function handleToggleComplete(item: Assessment) {
    const newCompleted = !item.completed;
    const todayStr = new Date().toISOString().slice(0, 10);
    await updateDoc(doc(db, "assessments", item.id), {
      completed: newCompleted,
      completedAt: newCompleted ? todayStr : null,
    });

    if (newCompleted && !item.xpAwarded) {
      await awardCompletion(item);
    }
    loadData();
  }

  async function awardCompletion(item: Assessment) {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    await updateDoc(doc(db, "assessments", item.id), { xpAwarded: true });

    const statsRef = doc(db, "gamification", currentUser.uid);
    const statsSnap = await getDoc(statsRef);
    const emptyStats: GamificationStats = {
      userId: currentUser.uid,
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
    // Merge with defaults so any fields missing from an older Firestore
    // document (e.g. accounts created before pets/heroId existed) get
    // safe fallback values instead of causing a crash.
    const existing: GamificationStats = statsSnap.exists()
      ? { ...emptyStats, ...(statsSnap.data() as Partial<GamificationStats>) }
      : emptyStats;

    const { streak, today } = updateStreak(existing.lastCompletedDate, existing.streak);
    const newXp = existing.xp + xpForAssessment(item.priority);
    const totalCompleted = assessments.filter((a) => a.completed).length + 1;

    const updatedStats: GamificationStats = {
      ...existing,
      userId: currentUser.uid,
      xp: newXp,
      streak,
      lastCompletedDate: today,
    };

    // Award rank star progress if this assessment was completed ON TIME
    // (completed date on or before its due date). Every 2 on-time
    // completions grants a full star.
    const completedOnTime = today <= item.dueDate;
    if (completedOnTime) {
      const result = applyStarGain(
        existing.assessmentGainProgress,
        existing.rankTier,
        existing.rankStars,
        existing.totalStarsEarned ?? 0
      );
      updatedStats.assessmentGainProgress = result.progress;
      updatedStats.rankTier = result.rankTier;
      updatedStats.rankStars = result.rankStars;
      updatedStats.totalStarsEarned = result.totalStarsEarned;
    }

    const newlyEarnedBadges = checkNewBadges(updatedStats, totalCompleted);
    if (newlyEarnedBadges.length > 0) {
      updatedStats.badges = [...existing.badges, ...newlyEarnedBadges];
    }
    const newPet = petUnlockedByLevel(updatedStats.xp, existing.pets);
    if (newPet) {
      updatedStats.pets = [...existing.pets, newPet];
    }

    await setDoc(statsRef, updatedStats);

    if (newlyEarnedBadges.length > 0) {
      const badgeNames = newlyEarnedBadges
        .map((id) => BADGES.find((b) => b.id === id)?.name)
        .filter(Boolean)
        .join(", ");
      const petText = newlyEarnedPets.length > 0 ? ` New pet: ${newlyEarnedPets.join(", ")}!` : "";
      showAlert("Badge earned!", badgeNames + petText);
    }
  }

  function subjectName(id: string) {
    const found = subjects.find((s) => s.id === id);
    return found ? found.name : "Unknown subject";
  }

  if (subjects.length === 0 && !loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Text style={styles.title}>Assessments</Text>
        <Text style={styles.emptyText}>
          You need to add a subject first before creating assessments. Go to the Subjects tab.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>Assessments</Text>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Assessment title (e.g. Midterm Exam)"
          placeholderTextColor="#999999"
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={styles.input}
          placeholder="Due date (e.g. 2026-09-15)"
          placeholderTextColor="#999999"
          value={dueDate}
          onChangeText={(text) => setDueDate(formatDateInput(text))}
          keyboardType="numeric"
          maxLength={10}
        />
        <TextInput
          style={styles.input}
          placeholder="Estimated hours (e.g. 3)"
          placeholderTextColor="#999999"
          value={estimatedHours}
          onChangeText={setEstimatedHours}
          keyboardType="numeric"
        />
        <Text style={styles.label}>Subject:</Text>
        <View style={styles.rowWrap}>
          {subjects.map((s) => (
            <Pressable
              key={s.id}
              style={[
                styles.chip,
                subjectId === s.id && { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
              onPress={() => setSubjectId(s.id)}
            >
              <Text style={subjectId === s.id ? styles.chipTextSelected : styles.chipText}>
                {s.name}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Priority:</Text>
        <View style={styles.rowWrap}>
          {PRIORITIES.map((p) => (
            <Pressable
              key={p}
              style={[
                styles.chip,
                priority === p && { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
              onPress={() => setPriority(p)}
            >
              <Text style={priority === p ? styles.chipTextSelected : styles.chipText}>{p}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.formButtons}>
          <Pressable
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={handleSave}
          >
            <Text style={styles.buttonText}>
              {editingId ? "Update Assessment" : "Add Assessment"}
            </Text>
          </Pressable>
          {editingId && (
            <Pressable style={styles.cancelButton} onPress={resetForm}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          )}
        </View>
      </View>
      <FlatList
        style={{ flex: 1 }}
        data={assessments}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={loadData}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          !loading ? <Text style={styles.emptyText}>No assessments yet.</Text> : null
        }
        renderItem={({ item }) => (
          <View style={[styles.card, urgencyStyle(item.dueDate)]}>
            <Pressable onPress={() => handleToggleComplete(item)} style={styles.checkbox}>
              <Text style={[styles.checkboxText, { color: "#1e293b" }]}>
                {item.completed ? "[Done]" : "[ ]"}
              </Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.cardTitle,
                  item.completed && { textDecorationLine: "line-through", color: "#999" },
                ]}
              >
                {item.title}
              </Text>
              <Text style={styles.cardSubtext}>
                {subjectName(item.subjectId)} - {item.estimatedHours}h -{" "}
                <Text style={{ fontWeight: "700" }}>{item.priority}</Text>
              </Text>
              {!item.completed && (
                <Text style={styles.urgencyText}>{dueDateLabel(item.dueDate)}</Text>
              )}
            </View>
            <Pressable onPress={() => handleEdit(item)} style={styles.iconButton}>
              <Text style={[styles.iconText, { color: "#1e293b" }]}>Edit</Text>
            </Pressable>
            <Pressable onPress={() => handleDelete(item.id)} style={styles.iconButton}>
              <Text style={[styles.iconText, { color: "#dc2626" }]}>Delete</Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa", padding: 16 },
  title: { fontSize: 24, fontWeight: "bold", color: "#1e293b", marginBottom: 12 },
  form: { gap: 8, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: "#1e293b",
    backgroundColor: "#ffffff",
  },
  label: { fontSize: 13, color: "#64748b", marginTop: 4 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  chipText: { color: "#333" },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
  formButtons: { flexDirection: "row", gap: 8, marginTop: 8 },
  button: {
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    flex: 1,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
  cancelButton: {
    backgroundColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    flex: 1,
  },
  cancelButtonText: { color: "#1e293b", fontWeight: "600" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  checkbox: { paddingRight: 4 },
  checkboxText: { fontSize: 14, fontWeight: "700" },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#1e293b" },
  cardSubtext: { fontSize: 12, color: "#64748b", marginTop: 2 },
  urgencyText: { fontSize: 12, fontWeight: "700", color: "#dc2626", marginTop: 2 },
  iconButton: { paddingHorizontal: 6, paddingVertical: 4 },
  iconText: { fontWeight: "600" },
  emptyText: { textAlign: "center", color: "#94a3b8", marginTop: 32, paddingHorizontal: 16 },
});











