import { auth, db } from "@/services/firebase";
import { useTheme } from "@/components/ThemeContext";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function RegisterScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  // These hold the current value typed into each input field.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false); // disables the button while registering

  async function handleRegister() {
    // Basic validation before we even talk to Firebase.
    if (!name || !email || !password) {
      Alert.alert("Missing info", "Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      // 1. Create the account in Firebase Authentication.
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Save the user's profile info in Firestore, matching our UserProfile interface.
      await setDoc(doc(db, "users", user.uid), {
        id: user.uid,
        name: name,
        email: email,
        createdAt: new Date().toISOString(),
      });

      // 3. Registration successful - send them to the onboarding screen first,
      // which then leads into hero selection, instead of straight to the dashboard.
      router.replace("/onboarding");
    } catch (error: any) {
      // Firebase gives descriptive error messages we can show directly.
      Alert.alert("Registration failed", error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      <TextInput
        style={styles.input}
        placeholder="Full Name"
        placeholderTextColor="#999999"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#999999"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#999999"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {/* Button color now follows the user's chosen app theme. */}
      <Pressable
        style={[styles.button, { backgroundColor: theme.primary }]}
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? "Creating account..." : "Register"}</Text>
      </Pressable>

      <Pressable onPress={() => router.push("/login")}>
        <Text style={[styles.link, { color: theme.primary }]}>Already have an account? Log in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    gap: 12,
    backgroundColor: "#fafafa",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
    color: "#1e293b",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#1e293b",
    backgroundColor: "#ffffff",
  },
  button: {
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  link: {
    textAlign: "center",
    marginTop: 16,
  },
});
