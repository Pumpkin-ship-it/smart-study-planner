import { auth, db } from "@/services/firebase";
import { useTheme } from "@/components/ThemeContext";
import { Note } from "@/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
// SafeAreaView automatically adds padding so content doesn't overlap
// the phone's notch, camera cutout, or status bar.
import { SafeAreaView } from "react-native-safe-area-context";

// Formats an ISO timestamp into a short, readable date + time,
// e.g. "May 17, 2026, 3:45 PM".
function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NotesScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  // subjectId comes from the URL, e.g. /notes/abc123 -> subjectId = "abc123"
  const { subjectId, subjectName } = useLocalSearchParams<{
    subjectId: string;
    subjectName?: string;
  }>();

  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadNotes() {
    const currentUser = auth.currentUser;
    if (!currentUser || !subjectId) return;

    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "notes"),
          where("userId", "==", currentUser.uid),
          where("subjectId", "==", subjectId)
        )
      );
      const results: Note[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Note, "id">),
      }));
      // Newest first, like a journal.
      results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setNotes(results);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotes();
  }, [subjectId]);

  async function handleAddNote() {
    const currentUser = auth.currentUser;
    if (!currentUser || !subjectId) return;

    if (!newNoteText.trim()) {
      return;
    }

    await addDoc(collection(db, "notes"), {
      userId: currentUser.uid,
      subjectId,
      content: newNoteText.trim(),
      createdAt: new Date().toISOString(),
    });
    setNewNoteText("");
    Keyboard.dismiss();
    loadNotes();
  }

  function handleDeleteNote(id: string) {
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Delete this note? This cannot be undone.");
      if (confirmed) {
        deleteDoc(doc(db, "notes", id)).then(() => loadNotes());
      }
    } else {
      Alert.alert("Delete note", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteDoc(doc(db, "notes", id));
            loadNotes();
          },
        },
      ]);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1 }}>
          <Pressable onPress={() => router.back()} style={styles.backRow}>
            <Text style={[styles.backRowText, { color: theme.primary }]}>{"<"} Back to Subjects</Text>
          </Pressable>

          <Text style={styles.title}>Notes</Text>
          <Text style={styles.subtitle}>{subjectName || "Subject"}</Text>

          <View style={styles.addForm}>
            <TextInput
              style={styles.input}
              placeholder="Write a note..."
              placeholderTextColor="#999999"
              value={newNoteText}
              onChangeText={setNewNoteText}
              multiline
            />
            <Pressable
              style={[styles.addButton, { backgroundColor: theme.primary }]}
              onPress={handleAddNote}
            >
              <Text style={styles.addButtonText}>Add Note</Text>
            </Pressable>
          </View>

          <FlatList
            style={{ flex: 1 }}
            data={notes}
            keyExtractor={(item) => item.id}
            refreshing={loading}
            onRefresh={loadNotes}
            contentContainerStyle={{ paddingBottom: 40 }}
            ListEmptyComponent={
              !loading ? (
                <Text style={styles.emptyText}>No notes yet. Add one above.</Text>
              ) : null
            }
            renderItem={({ item }) => (
              <View style={styles.noteCard}>
                <Text style={styles.noteTimestamp}>{formatTimestamp(item.createdAt)}</Text>
                <Text style={styles.noteContent}>{item.content}</Text>
                <Pressable onPress={() => handleDeleteNote(item.id)} style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
              </View>
            )}
          />
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa", padding: 16 },
  backRow: { marginBottom: 12 },
  backRowText: { fontSize: 13, fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "bold", color: "#1e293b" },
  subtitle: { fontSize: 14, color: "#64748b", marginTop: 2, marginBottom: 16 },
  addForm: { marginBottom: 16, gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: "#1e293b",
    backgroundColor: "#ffffff",
    minHeight: 80,
    textAlignVertical: "top",
  },
  addButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  addButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  noteCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  noteTimestamp: { fontSize: 11, color: "#94a3b8", marginBottom: 6 },
  noteContent: { fontSize: 14, color: "#1e293b", lineHeight: 20 },
  deleteButton: { alignSelf: "flex-end", marginTop: 8 },
  deleteButtonText: { fontSize: 12, color: "#dc2626", fontWeight: "600" },
  emptyText: { textAlign: "center", color: "#94a3b8", marginTop: 32 },
});
