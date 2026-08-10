import { Alert, Platform } from "react-native";

// Alert.alert does not reliably show on React Native Web, so this helper
// uses the browser's native alert() there, and the real Alert.alert on
// iOS/Android where it works correctly.
export function showAlert(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}
