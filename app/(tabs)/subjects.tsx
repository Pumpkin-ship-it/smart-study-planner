import { auth, db } from "@/services/firebase";
import { Subject } from "@/types";
import { useTheme } from "@/components/ThemeContext";
import { buildSubjectColorMap } from "@/utils/subjectColors";
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

export default function SubjectsScreen() {
  const { theme } = useTheme();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  // Fields for the "add new subject" form.
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  // Tracks which subject (if any) is currently being edited.
  const [editingId, setEditingId] = useState<string | null>(null);

  // Fetches this user's subjects from Firestore.
  async function loadSubjects() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setLoading(true);
    try {
      // Only fetch subjects where userId matches the logged-in user.
      const q = query(
        collection(db, "subjects"),
        where("userId", "==", currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const results: Subject[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Subject, "id">),
      }));
      setSubjects(results);
    } catch (error: any) {
      Alert.alert("Error loading subjects", error.message);
    } finally {
      setLoading(false);
    }
  }

  // Reload subjects every time this screen comes into focus
  // (e.g. after navigating back from another tab).
  useFocusEffect(
    useCallback(() => {
      loadSubjects();
    }, [])
  );

  async function handleSave() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    if (!name.trim()) {
      Alert.alert("Missing info", "Please enter a subject name.");
      return;
    }

    try {
      if (editingId) {
        // Update an existing subject.
        await updateDoc(doc(db, "subjects", editingId), {
          name: name.trim(),
          code: code.trim() || null,
        });
      } else {
        // Create a new subject.
        await addDoc(collection(db, "subjects"), {
          userId: currentUser.uid,
          name: name.trim(),
          code: code.trim() || null,
          createdAt: new Date().toISOString(),
        });
      }

      // Reset the form and refresh the list.
      setName("");
      setCode("");
      setEditingId(null);
      loadSubjects();
    } catch (error: any) {
      Alert.alert("Error saving subject", error.message);
    }
  }

  function handleEdit(subject: Subject) {
    setEditingId(subject.id);
    setName(subject.name);
    setCode(subject.code ?? "");
  }

  function handleCancelEdit() {
    setEditingId(null);
    setName("");
    setCode("");
  }

  function handleDelete(id: string) {
    // Alert.alert's multi-button confirmation doesn't work reliably on web,
    // so we use the browser's built-in confirm() there, and the native
    // Alert on iOS/Android.
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Delete this subject? This cannot be undone.");
      if (confirmed) {
        deleteDoc(doc(db, "subjects", id)).then(() => loadSubjects());
      }
    } else {
      Alert.alert("Delete subject", "Are you sure? This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteDoc(doc(db, "subjects", id));
            loadSubjects();
          },
        },
      ]);
    }
  }

  return (
    // Outer container - this is the ONLY SafeAreaView on this screen.
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>Subjects</Text>

      {/* Add / Edit form */}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Subject name (e.g. Biology)"
          placeholderTextColor="#999999"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Code (optional, e.g. BIO301)"
          placeholderTextColor="#999999"
          value={code}
          onChangeText={setCode}
        />
        <View style={styles.formButtons}>
          {/* Button color now follows the app theme instead of a
              hardcoded blue. */}
          <Pressable
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={handleSave}
          >
            <Text style={styles.buttonText}>
              {editingId ? "Update Subject" : "Add Subject"}
            </Text>
          </Pressable>
          {editingId && (
            <Pressable style={styles.cancelButton} onPress={handleCancelEdit}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* List of subjects */}
      <FlatList
        style={{ flex: 1 }}
        data={subjects}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={loadSubjects}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>No subjects yet. Add one above.</Text>
          ) : null
        }
        renderItem={({ item }) => {
          const subjectColorMap = buildSubjectColorMap(subjects);
          // Each subject gets its own consistent color, matching the
          // Progress screen, so the same subject always looks the same
          // color everywhere in the app. This is a functional color
          // (identifying which subject is which), not a theme color,
          // so it stays independent of the user's chosen app theme.
          const color = subjectColorMap[item.id];
          return (
            <View style={styles.subjectCard}>
              {/* Colored dot identifying this subject */}
              <View style={[styles.colorDot, { backgroundColor: color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.subjectName}>{item.name}</Text>
                {item.code ? <Text style={styles.subjectCode}>{item.code}</Text> : null}
              </View>
              <Pressable onPress={() => handleEdit(item)} style={styles.iconButton}>
                <Text style={[styles.iconText, { color: theme.primary }]}>Edit</Text>
              </Pressable>
              <Pressable onPress={() => handleDelete(item.id)} style={styles.iconButton}>
                <Text style={[styles.iconText, { color: "#dc2626" }]}>Delete</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafafa",
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 12,
  },
  form: {
    gap: 8,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: "#1e293b",
    backgroundColor: "#ffffff",
  },
  formButtons: {
    flexDirection: "row",
    gap: 8,
  },
  button: {
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    flex: 1,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    flex: 1,
  },
  cancelButtonText: {
    color: "#1e293b",
    fontWeight: "600",
  },
  subjectCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#ffffff",
    gap: 10,
  },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  subjectName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  subjectCode: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  iconButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  iconText: {
    fontWeight: "600",
  },
  emptyText: {
    textAlign: "center",
    color: "#94a3b8",
    marginTop: 32,
  },
});

