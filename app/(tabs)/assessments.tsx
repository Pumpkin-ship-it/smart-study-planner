import { auth, db } from "@/services/firebase";
import { Assessment, Subject } from "@/types";
import { showAlert } from "@/utils/alert";
import { useFocusEffect } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
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
// SafeAreaView automatically adds padding so content doesn't overlap
// the phone's notch, camera cutout, or status bar. Used ONCE, as the
// outermost container of the screen.
import { SafeAreaView } from "react-native-safe-area-context";

// The three allowed priority values, taken directly from our Assessment type.
const PRIORITIES: Assessment["priority"][] = ["low", "medium", "high"];

// Automatically inserts dashes as the user types digits,
// e.g. "20260915" -> "2026-09-15". This makes entering a date
// less error-prone than expecting the user to type the dashes themselves.
function formatDateInput(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 8); // keep only digits, max 8 (YYYYMMDD)
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  let result = year;
  if (month) result += "-" + month;
  if (day) result += "-" + day;
  return result;
}

export default function AssessmentsScreen() {
  // The full list of this user's assessments, loaded from Firestore.
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  // This user's subjects, needed to populate the subject picker.
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  // Form fields for adding/editing an assessment.
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(""); // stored as "YYYY-MM-DD"
  const [estimatedHours, setEstimatedHours] = useState("");
  const [priority, setPriority] = useState<Assessment["priority"]>("medium");
  const [subjectId, setSubjectId] = useState<string | null>(null);

  // If this holds an ID, we're editing that assessment instead of creating a new one.
  const [editingId, setEditingId] = useState<string | null>(null);

  // Loads both this user's subjects (for the picker) and their assessments.
  async function loadData() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setLoading(true);
    try {
      // Fetch only the subjects belonging to the logged-in user.
      const subjectsSnap = await getDocs(
        query(collection(db, "subjects"), where("userId", "==", currentUser.uid))
      );
      const loadedSubjects: Subject[] = subjectsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Subject, "id">),
      }));
      setSubjects(loadedSubjects);

      // If no subject is selected yet, default to the first one in the list.
      if (!subjectId && loadedSubjects.length > 0) {
        setSubjectId(loadedSubjects[0].id);
      }

      // Fetch only the assessments belonging to the logged-in user.
      const assessmentsSnap = await getDocs(
        query(collection(db, "assessments"), where("userId", "==", currentUser.uid))
      );
      const loadedAssessments: Assessment[] = assessmentsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Assessment, "id">),
      }));
      // Show the soonest-due assessments first.
      loadedAssessments.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      setAssessments(loadedAssessments);
    } catch (error: any) {
      showAlert("Error loading data", error.message);
    } finally {
      setLoading(false);
    }
  }

  // Reload data every time this screen comes into focus
  // (e.g. after switching tabs and coming back).
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // Clears the form fields, ready for adding a fresh assessment.
  function resetForm() {
    setTitle("");
    setDueDate("");
    setEstimatedHours("");
    setPriority("medium");
    setEditingId(null);
  }

  // Creates a new assessment, or updates one if we're in "editing" mode.
  async function handleSave() {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      showAlert("Not logged in", "Please log in again.");
      return;
    }

    // Basic validation before writing to Firestore.
    if (!title.trim() || !dueDate.trim() || !subjectId) {
      showAlert("Missing info", "Please fill in title, due date, and select a subject.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())) {
      showAlert("Invalid date", "Please enter the due date as YYYY-MM-DD (e.g. 2026-09-15).");
      return;
    }

    // Convert the hours text field into an actual number, defaulting to 0 if invalid.
    const hoursNumber = parseFloat(estimatedHours) || 0;

    try {
      if (editingId) {
        // We're editing an existing assessment - update just its fields.
        await updateDoc(doc(db, "assessments", editingId), {
          title: title.trim(),
          dueDate: dueDate.trim(),
          estimatedHours: hoursNumber,
          priority,
          subjectId,
        });
      } else {
        // We're creating a brand new assessment.
        await addDoc(collection(db, "assessments"), {
          userId: currentUser.uid,
          subjectId,
          title: title.trim(),
          dueDate: dueDate.trim(),
          estimatedHours: hoursNumber,
          priority,
          completed: false,
          createdAt: new Date().toISOString(),
        });
      }
      resetForm();
      loadData(); // refresh the list to show the change
    } catch (error: any) {
      showAlert("Error saving assessment", error.message);
    }
  }

  // Populates the form with an existing assessment's data so the user can edit it.
  function handleEdit(item: Assessment) {
    setEditingId(item.id);
    setTitle(item.title);
    setDueDate(item.dueDate);
    setEstimatedHours(String(item.estimatedHours));
    setPriority(item.priority);
    setSubjectId(item.subjectId);
  }

  // Deletes an assessment, after confirming with the user first.
  function handleDelete(id: string) {
    // Alert.alert's multi-button confirmation doesn't work reliably on web,
    // so we use the browser's built-in confirm() there, and the native
    // Alert on iOS/Android where it works correctly.
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

  // Flips an assessment's completed status when its checkbox is tapped.
  // This directly implements "Mark tasks as complete" from the MVP list.
  async function handleToggleComplete(item: Assessment) {
    await updateDoc(doc(db, "assessments", item.id), { completed: !item.completed });
    loadData();
  }

  // Looks up a subject's name by ID, for display in the assessment list.
  function subjectName(id: string) {
    const found = subjects.find((s) => s.id === id);
    return found ? found.name : "Unknown subject";
  }

  // If the user has no subjects yet, guide them to create one first,
  // since every assessment must belong to a subject.
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

      {/* Add / Edit form */}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Assessment title (e.g. Midterm Exam)"
          value={title}
          onChangeText={setTitle}
        />

        <TextInput
          style={styles.input}
          placeholder="Due date (e.g. 2026-09-15)"
          value={dueDate}
          onChangeText={(text) => setDueDate(formatDateInput(text))}
          keyboardType="numeric"
          maxLength={10}
        />

        <TextInput
          style={styles.input}
          placeholder="Estimated hours (e.g. 3)"
          value={estimatedHours}
          onChangeText={setEstimatedHours}
          keyboardType="numeric"
        />

        {/* Subject picker - shown as tappable "chips" instead of a native
            dropdown, since dropdowns behave inconsistently across web/iOS/Android. */}
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

        {/* Priority picker - same chip pattern as the subject picker above. */}
        <Text style={styles.label}>Priority:</Text>
        <View style={styles.rowWrap}>
          {PRIORITIES.map((p) => (
            <Pressable
              key={p}
              style={[styles.chip, priority === p && styles.chipSelected]}
              onPress={() => setPriority(p)}
            >
              <Text style={priority === p ? styles.chipTextSelected : styles.chipText}>
                {p}
              </Text>
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

      {/* List of this user's assessments, soonest due date first. */}
      <FlatList
        data={assessments}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={loadData}
        ListEmptyComponent={
          !loading ? <Text style={styles.emptyText}>No assessments yet.</Text> : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            {/* Tapping this toggles completed on/off */}
            <Pressable onPress={() => handleToggleComplete(item)} style={styles.checkbox}>
              <Text style={styles.checkboxText}>{item.completed ? "[Done]" : "[ ]"}</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              {/* Strike through the title when the assessment is completed */}
              <Text
                style={[
                  styles.cardTitle,
                  item.completed && { textDecorationLine: "line-through", color: "#999" },
                ]}
              >
                {item.title}
              </Text>
              <Text style={styles.cardSubtext}>
                {subjectName(item.subjectId)} - Due {item.dueDate} - {item.estimatedHours}h -{" "}
                <Text style={{ fontWeight: "700" }}>{item.priority}</Text>
              </Text>
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
    borderColor: "#eee",
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#fafafa",
    gap: 8,
  },
  checkbox: { paddingRight: 4 },
  checkboxText: { fontSize: 14, fontWeight: "700", color: "#2563eb" },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#111111" },
  cardSubtext: { fontSize: 12, color: "#666666", marginTop: 2 },
  iconButton: { paddingHorizontal: 6, paddingVertical: 4 },
  iconText: { color: "#2563eb", fontWeight: "600" },
  emptyText: { textAlign: "center", color: "#999999", marginTop: 32, paddingHorizontal: 16 },
});
