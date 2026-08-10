import { auth, db } from "@/services/firebase";
import { Assessment, Subject } from "@/types";
import { getSubjectColor } from "@/utils/subjectColors";
import { useFocusEffect } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
// SafeAreaView automatically adds padding so content doesn't overlap
// the phone's notch, camera cutout, or status bar.
import { SafeAreaView } from "react-native-safe-area-context";
// Used to draw the circular progress ring.
import Svg, { Circle } from "react-native-svg";

// One row of the per-subject breakdown list.
type SubjectProgress = {
  subjectId: string;
  subjectName: string;
  total: number;
  completed: number;
};

// Draws a circular progress ring. Made up of two overlapping circles:
// a light gray "track" circle (the full ring), and a colored "progress"
// circle drawn on top, whose visible portion is controlled by
// strokeDashoffset - this is the standard SVG trick for circular progress.
function ProgressRing({ percent, size = 140 }: { percent: number; size?: number }) {
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // How much of the circle's outline to "hide" so only `percent`% shows as drawn.
  const strokeDashoffset = circumference * (1 - percent / 100);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Background track - the full, unfilled circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Foreground progress - only shows `percent`% of the circle's outline */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#2563eb"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {/* Percentage text, centered on top of the ring using absolute positioning */}
      <View style={styles.ringTextOverlay}>
        <Text style={styles.ringPercentText}>{percent}%</Text>
      </View>
    </View>
  );
}

export default function ProgressScreen() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

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

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const totalCount = assessments.length;
  const completedCount = assessments.filter((a) => a.completed).length;
  const overallPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

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

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Progress</Text>

      <View style={styles.overallCard}>
        <ProgressRing percent={overallPercent} />
        <Text style={styles.overallLabel}>
          {completedCount} of {totalCount} assessments completed
        </Text>
      </View>

      <Text style={styles.sectionHeader}>By Subject</Text>

      <FlatList
        data={subjectBreakdown}
        keyExtractor={(item) => item.subjectId}
        refreshing={loading}
        onRefresh={loadData}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>
              Add subjects and assessments to see your progress here.
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          const percent = item.total === 0 ? 0 : Math.round((item.completed / item.total) * 100);
          // Each subject gets its own consistent color from our palette.
          const color = getSubjectColor(item.subjectId);
          return (
            <View style={styles.subjectCard}>
              <View style={styles.subjectHeaderRow}>
                <View style={styles.subjectNameRow}>
                  {/* Small colored dot matching this subject's progress bar color */}
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
  container: { flex: 1, backgroundColor: "#ffffff", padding: 16 },
  title: { fontSize: 24, fontWeight: "bold", color: "#111111", marginBottom: 16 },
  overallCard: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: "center",
  },
  ringTextOverlay: {
    position: "absolute",
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  ringPercentText: { fontSize: 28, fontWeight: "bold", color: "#111111" },
  overallLabel: { fontSize: 13, color: "#555555", marginTop: 12 },
  sectionHeader: { fontSize: 16, fontWeight: "700", color: "#111111", marginBottom: 8 },
  progressTrack: {
    width: "100%",
    height: 10,
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 6,
  },
  subjectCard: {
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#eee",
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
  subjectName: { fontSize: 15, fontWeight: "600", color: "#111111" },
  subjectCount: { fontSize: 13, color: "#666666" },
  emptyText: { textAlign: "center", color: "#999999", marginTop: 32, paddingHorizontal: 16 },
});
