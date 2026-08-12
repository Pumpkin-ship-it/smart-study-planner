import { auth, db } from "@/services/firebase";
import { useTheme } from "@/components/ThemeContext";
import { ProgressRing } from "@/components/ProgressRing";
import { showAlert } from "@/utils/alert";
import { getSubjectColor } from "@/utils/subjectColors";
import { Assessment, GamificationStats } from "@/types";
import { checkNewBadges, petsUnlockedByBadges, updateStreak } from "@/utils/gamification";
import { useFocusEffect, useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  AppStateStatus,
  BackHandler,
  Keyboard,
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

// Preset session lengths, in minutes. The user can also type a custom
// value instead of picking one of these.
const DURATIONS = [5, 15, 25, 45];

// How much bonus XP a completed focus session grants.
const FOCUS_SESSION_XP = 25;

// setup    - choosing an assessment + duration, not started yet
// running  - actively counting down
// finished - either completed successfully, or failed by leaving early
type TimerPhase = "setup" | "running" | "finished";

export default function FocusTimerScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(15);
  // Raw text of the custom duration field, kept separate from the actual
  // numeric durationMinutes so the input can be empty/invalid while typing.
  const [customDurationText, setCustomDurationText] = useState("");

  const [phase, setPhase] = useState<TimerPhase>("setup");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [sessionSucceeded, setSessionSucceeded] = useState(false);

  const appStateRef = useRef(AppState.currentState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const failedRef = useRef(false);

  async function loadAssessments() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const snap = await getDocs(
      query(collection(db, "assessments"), where("userId", "==", currentUser.uid))
    );
    const results: Assessment[] = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Assessment, "id">) }))
      .filter((a) => !a.completed);
    setAssessments(results);
    if (!selectedAssessmentId && results.length > 0) {
      setSelectedAssessmentId(results[0].id);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadAssessments();
    }, [])
  );

  // Watches for the app being backgrounded while a session is running.
  // If that happens, the session immediately fails.
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

  // Blocks the Android hardware/gesture back button while a session is
  // running, so the only way to leave mid-session is to actually leave
  // the app (which fails it via the AppState listener above).
  useEffect(() => {
    function handleBackPress() {
      if (phase === "running") {
        return true;
      }
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

  // Updates the custom duration text field, and if it's a valid positive
  // number, applies it as the actual selected duration too.
  function handleCustomDurationChange(text: string) {
    const digitsOnly = text.replace(/\D/g, "");
    setCustomDurationText(digitsOnly);
    const parsed = parseInt(digitsOnly, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setDurationMinutes(parsed);
    }
  }

  function selectPreset(minutes: number) {
    setDurationMinutes(minutes);
    setCustomDurationText(""); // clear custom field so the preset chip shows as selected
  }

  function startSession() {
    if (!selectedAssessmentId) {
      showAlert("Pick an assessment", "Choose which assessment you're focusing on.");
      return;
    }
    if (!durationMinutes || durationMinutes <= 0) {
      showAlert("Invalid duration", "Please choose or enter a valid focus duration.");
      return;
    }

    failedRef.current = false;
    setSessionSucceeded(false);
    setSecondsLeft(durationMinutes * 60);
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

  // Called when the countdown reaches zero without the user leaving the
  // app. Grants bonus XP and checks for newly earned badges/pets.
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
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  const selectedAssessment = assessments.find((a) => a.id === selectedAssessmentId);
  const totalSeconds = durationMinutes * 60;
  const ringPercent = totalSeconds === 0 ? 0 : Math.round((secondsLeft / totalSeconds) * 100);

  return (
    <SafeAreaView style={styles.container}>
      {/* Tapping anywhere outside the text input dismisses the keyboard,
          without interfering with taps on buttons/chips underneath. */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={{ flex: 1 }}>
      {phase === "setup" && (
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Text style={[styles.backRowText, { color: theme.primary }]}>{"<"} Back to Dashboard</Text>
        </Pressable>
      )}

      <Text style={styles.title}>Focus Timer</Text>

      {phase === "setup" && (
        <>
          <Text style={styles.subtitle}>
            Pick what you're working on and how long you'll focus. Stay in the
            app for the whole session to earn bonus XP - leaving early fails it.
          </Text>

          {assessments.length === 0 ? (
            <Text style={styles.emptyText}>
              No pending assessments to focus on. Add one from the Assessments tab.
            </Text>
          ) : (
            <>
              <Text style={styles.label}>What are you focusing on?</Text>
              <View style={styles.cardGrid}>
                {assessments.map((a) => {
                  const isSelected = selectedAssessmentId === a.id;
                  return (
                    <Pressable
                      key={a.id}
                      style={[
                        styles.assessmentCard,
                        isSelected && {
                          borderColor: theme.primary,
                          backgroundColor: theme.primaryLight,
                        },
                      ]}
                      onPress={() => setSelectedAssessmentId(a.id)}
                    >
                      <View
                        style={[
                          styles.assessmentCardIcon,
                          { backgroundColor: getSubjectColor(a.subjectId) },
                        ]}
                      />
                      <Text style={styles.assessmentCardText} numberOfLines={2}>
                        {a.title}
                      </Text>
                      {isSelected && (
                        <View style={[styles.checkBadge, { backgroundColor: theme.primary }]}>
                          <Text style={styles.checkBadgeText}>✓</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>How long will you focus?</Text>
              <View style={styles.chipRow}>
                {DURATIONS.map((d) => (
                  <Pressable
                    key={d}
                    style={[
                      styles.chip,
                      customDurationText === "" &&
                        durationMinutes === d && {
                          backgroundColor: theme.primary,
                          borderColor: theme.primary,
                        },
                    ]}
                    onPress={() => selectPreset(d)}
                  >
                    <Text
                      style={
                        customDurationText === "" && durationMinutes === d
                          ? styles.chipTextSelected
                          : styles.chipText
                      }
                    >
                      {d} min
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Custom duration - lets the user type their own number of
                  minutes instead of using a preset. */}
              <Text style={styles.label}>Or enter a custom time (minutes)</Text>
              <TextInput
                style={styles.customInput}
                placeholder="e.g. 20"
                placeholderTextColor="#999999"
                keyboardType="numeric"
                value={customDurationText}
                onChangeText={handleCustomDurationChange}
              />

              <View style={[styles.reminderCard, { backgroundColor: theme.primaryLight }]}>
                <Text style={[styles.reminderTitle, { color: theme.primary }]}>
                  Stay focused. Earn more!
                </Text>
                <Text style={styles.reminderSubtext}>
                  Complete the full session to earn bonus XP. Leaving early will not count.
                </Text>
              </View>

              <Pressable
                style={[styles.startButton, { backgroundColor: theme.primary }]}
                onPress={startSession}
              >
                <Text style={styles.startButtonText}>Start Focus Session</Text>
              </Pressable>
            </>
          )}
        </>
      )}

      {phase === "running" && (
        <View style={styles.runningContainer}>
          <Text style={styles.runningLabel}>Focusing on</Text>
          <Text style={styles.runningTitle}>{selectedAssessment?.title}</Text>

          {/* Small looping animation shown during the session, purely
              decorative to make the countdown feel less static. */}
          <LottieView
            source={require("../assets/animations/intro-animation.json")}
            autoPlay
            loop
            style={styles.sessionAnimation}
          />

          <View style={styles.ringWrapper}>
            <ProgressRing percent={ringPercent} size={220} color={theme.primary} showLabel={false} />
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
              {/* Trophy celebration animation, plays once on success. */}
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
                You left the app before the timer finished, so no XP was awarded.
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
  subtitle: { fontSize: 13, color: "#666666", marginBottom: 20, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: "600", color: "#333333", marginBottom: 8, marginTop: 12 },
  cardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  assessmentCard: {
    width: "47%",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#fafafa",
    position: "relative",
  },
  assessmentCardIcon: { width: 22, height: 22, borderRadius: 5, marginBottom: 8 },
  assessmentCardText: { fontSize: 13, fontWeight: "600", color: "#111111" },
  checkBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
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
  customInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: "#111111",
    backgroundColor: "#f9f9f9",
  },
  reminderCard: { borderRadius: 12, padding: 14, marginTop: 20 },
  reminderTitle: { fontSize: 14, fontWeight: "700" },
  reminderSubtext: { fontSize: 12, color: "#555555", marginTop: 4 },
  startButton: {
    borderRadius: 10,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: "center",
    marginTop: 20,
    minWidth: 260,
  },
  startButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  emptyText: { fontSize: 13, color: "#999999", marginTop: 12 },
  runningContainer: { alignItems: "center", marginTop: 20 },
  runningLabel: { fontSize: 13, color: "#888888" },
  runningTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111111",
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
  timerText: { fontSize: 40, fontWeight: "bold" },
  warningText: { fontSize: 12, color: "#dc2626", marginTop: 24, textAlign: "center" },
  resultTitleSuccess: { fontSize: 22, fontWeight: "bold", color: "#166534" },
  resultTitleFail: { fontSize: 22, fontWeight: "bold", color: "#dc2626" },
  resultSubtext: { fontSize: 13, color: "#555555", marginTop: 8, textAlign: "center" },
  backLink: { textAlign: "center", marginTop: 16 },
});




