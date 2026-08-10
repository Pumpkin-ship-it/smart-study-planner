import { Text } from "react-native";
// SafeAreaView automatically adds padding so content doesn't overlap
// the phone's notch, camera cutout, or status bar.
import { SafeAreaView } from "react-native-safe-area-context";

// Placeholder for now - we will build the real Progress tracking UI
// (e.g. percentage of assessments completed, per-subject breakdown)
// once the Dashboard and core Assessments features are finished.
export default function ProgressScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff", padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "bold", color: "#111111" }}>
        Progress
      </Text>
      <Text style={{ fontSize: 16, color: "#666666", marginTop: 8 }}>
        Progress tracking coming soon.
      </Text>
    </SafeAreaView>
  );
}
