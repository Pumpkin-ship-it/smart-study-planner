import { auth, db } from "@/services/firebase";
import { useTheme } from "@/components/ThemeContext";
import { ProgressRing } from "@/components/ProgressRing";
import { showAlert } from "@/utils/alert";
import { GamificationStats } from "@/types";
import { checkNewBadges, petsUnlockedByBadges, updateStreak } from "@/utils/gamification";
import { useRouter } from "expo-router";
import { Picker } from "@react-native-picker/picker";
import LottieView from "lottie-react-native";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  AppState,
  AppStateStatus,
  BackHandler,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
// SafeAreaView automatically adds padding so content doesn't overlap
// the phone's notch, camera cutout, or status bar.
import { SafeAreaView } from "react-native-safe-area-context";

const FOCUS_SESSION_XP = 25;

type SessionCategory = "study" | "assessment" | "test" | "exam";

const CATEGORIES: { id: SessionCategory; label: string; color: string }[] = [
  { id: "study", label: "Study", color: "#2563eb" },
  { id: "assessment", label: "Assessment", color: "#9333ea" },
  { id: "test", label: "Test", color: "#ea580c" },
  { id: "exam", label: "Exam", color: "#dc2626" },
];

type TimerPhase = "setup" | "running" | "finished";

export default function FocusTimerScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [category, setCategory] = useState<SessionCategory>("study");
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(15);
  const [seconds, setSeconds] = useState(0);

  const [phase, setPhase] = useState<TimerPhase>("setup");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalSessionSeconds, setTotalSessionSeconds] = useState(0);
  const [sessionSucceeded, setSessionSucceeded] = useState(false);

  const appStateRef = useRef(AppState.currentState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const failedRef = useRef(false);

  useEffect(() => {
    function handleAppStateChange(nextState: AppStateStatus) {
      const wasActive = appStateRef.current === "active";
      const isNowInactive = nextState !== "active";
      if (wasActive && isNowInactive && phase === "running") {
        failSession();
      }
      appStateRef.current = nextState;
    }
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [phase]);

  useEffect(() => {
    function handleBackPress() {
      if (phase === "running") return true;
      return false;
    }
    const subscription = BackHandler.addEventListener("hardwareBackPress", handleBackPress);
    return () => subscription.remove();
  }, [phase]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function startSession() {
    const total = hours * 3600 + minutes * 60 + seconds;
    if (total <= 0) {
      showAlert("Invalid duration", "Please set a focus time greater than zero.");
      return;
    }
    failedRef.current = false;
    setSessionSucceeded(false);
    setTotalSessionSeconds(total);
    setSecondsLeft(total);
    setPhase("running");

    intervalRef.current = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          completeSession();
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }

  function failSession() {
    if (failedRef.current) return;
    failedRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSessionSucceeded(false);
    setPhase("finished");
  }

  async function completeSession() {
    setSessionSucceeded(true);
    setPhase("finished");

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const statsRef = doc(db, "gamification", currentUser.uid);
    const statsSnap = await getDoc(statsRef);
    const existing: GamificationStats = statsSnap.exists()
      ? (statsSnap.data() as GamificationStats)
      : {
          userId: currentUser.uid,
          xp: 0,
          streak: 0,
          lastCompletedDate: null,
          badges: [],
          heroId: null,
          pets: [],
        };

    const { streak, today } = updateStreak(existing.lastCompletedDate, existing.streak);
    const newXp = existing.xp + FOCUS_SESSION_XP;

    const updatedStats: GamificationStats = {
      ...existing,
      userId: currentUser.uid,
      xp: newXp,
      streak,
      lastCompletedDate: today,
    };

    const newlyEarnedBadges = checkNewBadges(updatedStats, 0);
    if (newlyEarnedBadges.length > 0) {
      updatedStats.badges = [...existing.badges, ...newlyEarnedBadges];
    }
    const newlyEarnedPets = petsUnlockedByBadges(newlyEarnedBadges, existing.pets);
    if (newlyEarnedPets.length > 0) {
      updatedStats.pets = [...existing.pets, ...newlyEarnedPets];
    }

    await setDoc(statsRef, updatedStats);
  }

  function resetToSetup() {
    setPhase("setup");
    setSecondsLeft(0);
  }

  function formatTime(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
        .toString()
        .padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  const ringPercent =
    totalSessionSeconds === 0 ? 0 : Math.round((secondsLeft / totalSessionSeconds) * 100);
  const selectedCategory = CATEGORIES.find((c) => c.id === category)!;

  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1 }}>
          {phase === "setup" && (
            <>
              <Pressable onPress={() => router.back()} style={styles.backRow}>
                <Text style={[styles.backRowText, { color: theme.primary }]}>
                  {"<"} Back to Dashboard
                </Text>
              </Pressable>

              <Text style={styles.title}>Focus Timer</Text>
              <Text style={styles.subtitle}>
                Choose what type of session this is and how long you'll focus.
                Stay in the app for the whole session to earn bonus XP -
                leaving early fails it.
              </Text>

              {/* Each section below has its own generous internal padding
                  (a "card" feel), rather than relying on large gaps
                  between sections. */}
              <View style={styles.sectionCard}>
                <Text style={styles.label}>What are you focusing on?</Text>
                <View style={styles.chipRow}>
                  {CATEGORIES.map((c) => (
                    <Pressable
                      key={c.id}
                      style={[
                        styles.chip,
                        category === c.id && { backgroundColor: c.color, borderColor: c.color },
                      ]}
                      onPress={() => setCategory(c.id)}
                    >
                      <Text style={category === c.id ? styles.chipTextSelected : styles.chipText}>
                        {c.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.label}>How long will you focus?</Text>
                <View style={styles.pickerRow}>
                  <View style={styles.pickerColumnOuter}>
                    <View style={styles.pickerClip}>
                      <Picker selectedValue={hours} onValueChange={setHours} style={styles.picker}>
                        {Array.from({ length: 6 }, (_, i) => i).map((h) => (
                          <Picker.Item key={h} label={`${h}`} value={h} />
                        ))}
                      </Picker>
                    </View>
                    <Text style={styles.pickerLabel}>hours</Text>
                  </View>
                  <View style={styles.pickerColumnOuter}>
                    <View style={styles.pickerClip}>
                      <Picker selectedValue={minutes} onValueChange={setMinutes} style={styles.picker}>
                        {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                          <Picker.Item key={m} label={`${m}`} value={m} />
                        ))}
                      </Picker>
                    </View>
                    <Text style={styles.pickerLabel}>min</Text>
                  </View>
                  <View style={styles.pickerColumnOuter}>
                    <View style={styles.pickerClip}>
                      <Picker selectedValue={seconds} onValueChange={setSeconds} style={styles.picker}>
                        {Array.from({ length: 60 }, (_, i) => i).map((s) => (
                          <Picker.Item key={s} label={`${s}`} value={s} />
                        ))}
                      </Picker>
                    </View>
                    <Text style={styles.pickerLabel}>sec</Text>
                  </View>
                </View>
              </View>

              <View style={styles.sectionCard}>
                <View style={[styles.reminderCard, { backgroundColor: theme.primaryLight }]}>
                  <Text style={[styles.reminderTitle, { color: theme.primary }]}>
                    Stay focused. Earn more!
                  </Text>
                  <Text style={styles.reminderSubtext}>
                    Complete the full session to earn bonus XP. Leaving early
                    will not count.
                  </Text>
                </View>

                <Pressable
                  style={[styles.startButton, { backgroundColor: theme.primary }]}
                  onPress={startSession}
                >
                  <Text style={styles.startButtonText}>Start Focus Session</Text>
                </Pressable>
              </View>
            </>
          )}

          {phase === "running" && (
            <View style={styles.runningContainer}>
              <Text style={styles.runningLabel}>Focusing on</Text>
              <Text style={[styles.runningTitle, { color: selectedCategory.color }]}>
                {selectedCategory.label}
              </Text>

              <LottieView
                source={require("../assets/animations/intro-animation.json")}
                autoPlay
                loop
                style={styles.sessionAnimation}
              />

              <View style={styles.ringWrapper}>
                <ProgressRing
                  percent={ringPercent}
                  size={220}
                  color={theme.primary}
                  showLabel={false}
                />
                <View style={styles.ringTextOverlay}>
                  <Text style={[styles.timerText, { color: theme.primary }]}>
                    {formatTime(secondsLeft)}
                  </Text>
                </View>
              </View>

              <Text style={styles.warningText}>
                Stay in the app! Leaving will fail this session.
              </Text>
            </View>
          )}

          {phase === "finished" && (
            <View style={styles.runningContainer}>
              {sessionSucceeded ? (
                <>
                  <LottieView
                    source={require("../assets/animations/trophy-animation.json")}
                    autoPlay
                    loop={false}
                    style={styles.trophyAnimation}
                  />
                  <Text style={styles.resultTitleSuccess}>Session Complete!</Text>
                  <Text style={styles.resultSubtext}>
                    +{FOCUS_SESSION_XP} XP earned for staying focused.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.resultTitleFail}>Session Failed</Text>
                  <Text style={styles.resultSubtext}>
                    You left the app before the timer finished, so no XP was
                    awarded.
                  </Text>
                </>
              )}
              <Pressable
                style={[styles.startButton, { backgroundColor: theme.primary, marginTop: 20 }]}
                onPress={resetToSetup}
              >
                <Text style={styles.startButtonText}>Start Another Session</Text>
              </Pressable>
              <Pressable onPress={() => router.back()}>
                <Text style={[styles.backLink, { color: theme.primary }]}>Back to Dashboard</Text>
              </Pressable>
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff", padding: 20 },
  backRow: { marginBottom: 12 },
  backRowText: { fontSize: 13, fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "bold", color: "#111111", marginBottom: 8 },
  subtitle: { fontSize: 13, color: "#666666", lineHeight: 18 },
  // Generous internal padding gives each section a spacious "card" feel,
  // rather than relying on large gaps between sections.
  sectionCard: { paddingVertical: 20 },
  label: { fontSize: 13, fontWeight: "600", color: "#333333", marginBottom: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#f9f9f9",
  },
  chipText: { color: "#333" },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
  pickerRow: { flexDirection: "row", justifyContent: "space-between" },
  pickerColumnOuter: { flex: 1, alignItems: "center" },
  pickerClip: { width: "100%", height: 150, overflow: "hidden" },
  picker: { width: "100%", height: 150 },
  pickerLabel: { fontSize: 14, color: "#333333", fontWeight: "600", marginTop: 4 },
  reminderCard: { borderRadius: 12, padding: 16, marginBottom: 16 },
  reminderTitle: { fontSize: 14, fontWeight: "700" },
  reminderSubtext: { fontSize: 12, color: "#555555", marginTop: 4 },
  startButton: {
    borderRadius: 10,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: "center",
    minWidth: 260,
  },
  startButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  runningContainer: { alignItems: "center", marginTop: 20 },
  runningLabel: { fontSize: 13, color: "#888888" },
  runningTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 8,
    textAlign: "center",
  },
  sessionAnimation: { width: 200, height: 200, marginBottom: 8 },
  trophyAnimation: { width: 420, height: 420, marginBottom: 8 },
  ringWrapper: { width: 220, height: 220, alignItems: "center", justifyContent: "center" },
  ringTextOverlay: {
    position: "absolute",
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  timerText: { fontSize: 36, fontWeight: "bold" },
  warningText: { fontSize: 12, color: "#dc2626", marginTop: 24, textAlign: "center" },
  resultTitleSuccess: { fontSize: 22, fontWeight: "bold", color: "#166534" },
  resultTitleFail: { fontSize: 22, fontWeight: "bold", color: "#dc2626" },
  resultSubtext: { fontSize: 13, color: "#555555", marginTop: 8, textAlign: "center" },
  backLink: { textAlign: "center", marginTop: 16 },
});
