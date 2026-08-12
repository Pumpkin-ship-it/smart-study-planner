import { auth, db } from "@/services/firebase";
import { Assessment, GamificationStats, Subject } from "@/types";
import { showAlert } from "@/utils/alert";
import { dueDateLabel, getUrgencyLevel } from "@/utils/dueDate";
import { BADGES, checkNewBadges, petsUnlockedByBadges, updateStreak, xpForAssessment } from "@/utils/gamification";
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

function urgencyStyle(dueDate: string) {
  const level = getUrgencyLevel(dueDate);
  if (level === "overdue") return { borderColor: "#7f1d1d", backgroundColor: "#fca5a5" };
  if (level === "urgent") return { borderColor: "#854d0e", backgroundColor: "#fde047" };
  if (level === "soon") return { borderColor: "#166534", backgroundColor: "#86efac" };
  return { borderColor: "#eee", backgroundColor: "#fafafa" };
}

export default function AssessmentsScreen() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [priority, setPriority] = useState<Assessment["priority"]>("medium");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  // Toggles an assessment's completed status. Awarding XP/streak/badges/pets
  // only happens the first time it is marked complete (see awardCompletion).
  async function handleToggleComplete(item: Assessment) {
    const newCompleted = !item.completed;
    await updateDoc(doc(db, "assessments", item.id), { completed: newCompleted });

    if (newCompleted && !item.xpAwarded) {
      await awardCompletion(item);
    }
    loadData();
  }

  // Handles all gamification side-effects of completing an assessment for
  // the first time: grants XP, updates the daily streak, checks for newly
  // earned badges, and unlocks any pets tied to those badges.
  async function awardCompletion(item: Assessment) {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Mark this specific assessment so it can never grant XP again,
    // even if the user un-ticks and re-ticks it later.
    await updateDoc(doc(db, "assessments", item.id), { xpAwarded: true });

    // Load this user's existing gamification stats, or start fresh
    // if this is their very first completed assessment.
    const statsRef = doc(db, "gamification", currentUser.uid);
    const statsSnap = await getDoc(statsRef);
    const existing: GamificationStats = statsSnap.exists()
      ? (statsSnap.data() as GamificationStats)
      : { userId: currentUser.uid, xp: 0, streak: 0, lastCompletedDate: null, badges: [], heroId: null, pets: [] };

    // Work out today's streak based on when they last completed something.
    const { streak, today } = updateStreak(existing.lastCompletedDate, existing.streak);

    // Add XP based on this assessment's priority.
    const newXp = existing.xp + xpForAssessment(item.priority);

    // Total completed count (including this one) is used for milestone badges.
    const totalCompleted = assessments.filter((a) => a.completed).length + 1;

    const updatedStats: GamificationStats = {
      ...existing,
      userId: currentUser.uid,
      xp: newXp,
      streak,
      lastCompletedDate: today,
    };

    // Check if this update just unlocked any new badges.
    const newlyEarnedBadges = checkNewBadges(updatedStats, totalCompleted);
    if (newlyEarnedBadges.length > 0) {
      updatedStats.badges = [...existing.badges, ...newlyEarnedBadges];
    }

    // Check if any of those new badges also unlock a pet companion.
    const newlyEarnedPets = petsUnlockedByBadges(newlyEarnedBadges, existing.pets);
    if (newlyEarnedPets.length > 0) {
      updatedStats.pets = [...existing.pets, ...newlyEarnedPets];
    }

    // Save the updated stats document (creates it if it's the first time).
    await setDoc(statsRef, updatedStats);

    // Show a quick alert if a new badge (and/or pet) was just unlocked.
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
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Assessments</Text>
        <Text style={styles.emptyText}>
          You need to add a subject first before creating assessments. Go to the Subjects tab.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Assessments</Text>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Assessment title (e.g. Midterm Exam)" placeholderTextColor="#999999"
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={styles.input}
          placeholder="Due date (e.g. 2026-09-15)" placeholderTextColor="#999999"
          value={dueDate}
          onChangeText={(text) => setDueDate(formatDateInput(text))}
          keyboardType="numeric"
          maxLength={10}
        />
        <TextInput
          style={styles.input}
          placeholder="Estimated hours (e.g. 3)" placeholderTextColor="#999999"
          value={estimatedHours}
          onChangeText={setEstimatedHours}
          keyboardType="numeric"
        />
        <Text style={styles.label}>Subject:</Text>
        <View style={styles.rowWrap}>
          {subjects.map((s) => (
            <Pressable
              key={s.id}
              style={[styles.chip, subjectId === s.id && styles.chipSelected]}
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
              style={[styles.chip, priority === p && styles.chipSelected]}
              onPress={() => setPriority(p)}
            >
              <Text style={priority === p ? styles.chipTextSelected : styles.chipText}>{p}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.formButtons}>
          <Pressable style={styles.button} onPress={handleSave}>
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
        data={assessments}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={loadData}
        ListEmptyComponent={
          !loading ? <Text style={styles.emptyText}>No assessments yet.</Text> : null
        }
        renderItem={({ item }) => (
          <View style={[styles.card, urgencyStyle(item.dueDate)]}>
            <Pressable onPress={() => handleToggleComplete(item)} style={styles.checkbox}>
              <Text style={styles.checkboxText}>{item.completed ? "[Done]" : "[ ]"}</Text>
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
              <Text style={styles.iconText}>Edit</Text>
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
  container: { flex: 1, backgroundColor: "#ffffff", padding: 16 },
  title: { fontSize: 24, fontWeight: "bold", color: "#111111", marginBottom: 12 },
  form: { gap: 8, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: "#111111",
    backgroundColor: "#f9f9f9",
  },
  label: { fontSize: 13, color: "#555", marginTop: 4 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#f9f9f9",
  },
  chipSelected: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { color: "#333" },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
  formButtons: { flexDirection: "row", gap: 8, marginTop: 8 },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    flex: 1,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
  cancelButton: {
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    flex: 1,
  },
  cancelButtonText: { color: "#111111", fontWeight: "600" },
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
  checkboxText: { fontSize: 14, fontWeight: "700", color: "#2563eb" },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#111111" },
  cardSubtext: { fontSize: 12, color: "#666666", marginTop: 2 },
  urgencyText: { fontSize: 12, fontWeight: "700", color: "#dc2626", marginTop: 2 },
  iconButton: { paddingHorizontal: 6, paddingVertical: 4 },
  iconText: { color: "#2563eb", fontWeight: "600" },
  emptyText: { textAlign: "center", color: "#999999", marginTop: 32, paddingHorizontal: 16 },
});

