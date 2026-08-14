import { auth, db } from "@/services/firebase";
import { Assessment, Subject } from "@/types";
import { MultiSegmentRing, RingSegment } from "@/components/MultiSegmentRing";
import { buildSubjectColorMap } from "@/utils/subjectColors";
import { useFocusEffect } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
// SafeAreaView automatically adds padding so content doesn't overlap
// the phone's notch, camera cutout, or status bar.
import { SafeAreaView } from "react-native-safe-area-context";

// One row of the per-subject breakdown list.
type SubjectProgress = {
  subjectId: string;
  subjectName: string;
  total: number;
  completed: number;
};

export default function ProgressScreen() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  // Loads this user's subjects and assessments so we can calculate progress.
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

      const assessmentsSnap = await getDocs(
        query(collection(db, "assessments"), where("userId", "==", currentUser.uid))
      );
      const loadedAssessments: Assessment[] = assessmentsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Assessment, "id">),
      }));
      setAssessments(loadedAssessments);
    } finally {
      setLoading(false);
    }
  }

  // Reload every time this tab comes into focus, so progress always
  // reflects the latest completed/uncompleted state.
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // Overall stats across every assessment, regardless of subject.
  const subjectColorMap = buildSubjectColorMap(subjects);
  const totalCount = assessments.length;
  const completedCount = assessments.filter((a) => a.completed).length;
  const overallPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  // Build a per-subject breakdown: how many assessments each subject has,
  // and how many of those are completed.
  const subjectBreakdown: SubjectProgress[] = subjects.map((subject) => {
    const subjectAssessments = assessments.filter((a) => a.subjectId === subject.id);
    const completed = subjectAssessments.filter((a) => a.completed).length;
    return {
      subjectId: subject.id,
      subjectName: subject.name,
      total: subjectAssessments.length,
      completed,
    };
  });

  // Turns each subject's completed count into its share of the FULL
  // circle (out of the total assessment count across all subjects), so
  // the segments together add up to exactly the overall completion
  // percentage - the rest of the ring stays the gray "track" color.
  const ringSegments: RingSegment[] = subjectBreakdown
    .filter((s) => s.completed > 0)
    .map((s) => ({
      percent: totalCount === 0 ? 0 : (s.completed / totalCount) * 100,
      color: subjectColorMap[s.subjectId],
    }));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>Progress</Text>

      {/* Overall progress ring - now split into colored segments per
          subject instead of one solid color, so you can see at a glance
          which subjects make up your completed work. Thicker stroke
          (24px vs the default 14px) makes the segments easier to read. */}
      <View style={styles.overallCard}>
        <MultiSegmentRing segments={ringSegments} totalPercent={overallPercent} strokeWidth={24} />
        <Text style={styles.overallLabel}>
          {completedCount} of {totalCount} assessments completed
        </Text>
      </View>

      <Text style={styles.sectionHeader}>By Subject</Text>

      <FlatList
        style={{ flex: 1 }}
        data={subjectBreakdown}
        keyExtractor={(item) => item.subjectId}
        refreshing={loading}
        onRefresh={loadData}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>
              Add subjects and assessments to see your progress here.
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          const percent = item.total === 0 ? 0 : Math.round((item.completed / item.total) * 100);
          const color = subjectColorMap[item.subjectId];
          return (
            <View style={styles.subjectCard}>
              <View style={styles.subjectHeaderRow}>
                <View style={styles.subjectNameRow}>
                  <View style={[styles.colorDot, { backgroundColor: color }]} />
                  <Text style={styles.subjectName}>{item.subjectName}</Text>
                </View>
                <Text style={styles.subjectCount}>
                  {item.completed}/{item.total}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${percent}%`, backgroundColor: color },
                  ]}
                />
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa", padding: 16 },
  title: { fontSize: 24, fontWeight: "bold", color: "#1e293b", marginBottom: 16 },
  overallCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: "center",
  },
  overallLabel: { fontSize: 13, color: "#64748b", marginTop: 12 },
  sectionHeader: { fontSize: 16, fontWeight: "700", color: "#1e293b", marginBottom: 8 },
  progressTrack: {
    width: "100%",
    height: 10,
    backgroundColor: "#e2e8f0",
    borderRadius: 6,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 6,
  },
  subjectCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  subjectHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  subjectNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  subjectName: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  subjectCount: { fontSize: 13, color: "#64748b" },
  emptyText: { textAlign: "center", color: "#94a3b8", marginTop: 32, paddingHorizontal: 16 },
});

