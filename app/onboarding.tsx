import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// A one-time welcome screen shown right after registration, before the
// user picks their hero. Plays a short animation to make the moment
// feel a bit more special than just landing straight on a form.
export default function OnboardingScreen() {
  const router = useRouter();
  const animationRef = useRef<LottieView>(null);

  function handleContinue() {
    // Move on to hero selection, replacing this screen so the back
    // button doesn't bring the user back to onboarding again.
    router.replace("/(tabs)/rewards");
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Welcome to StudyFlow</Text>
      <Text style={styles.subtitle}>Let's set up your hero before you begin.</Text>

      <View style={styles.animationWrapper}>
        <LottieView
          ref={animationRef}
          source={require("../assets/animations/intro-animation.json")}
          autoPlay
          loop={false}
          style={styles.animation}
        />
      </View>

      <Pressable style={styles.button} onPress={handleContinue}>
        <Text style={styles.buttonText}>Continue</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 24, fontWeight: "bold", color: "#111111", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#666666", marginTop: 8, marginBottom: 24, textAlign: "center" },
  animationWrapper: { width: 250, height: 250, marginBottom: 24 },
  animation: { width: "100%", height: "100%" },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});


