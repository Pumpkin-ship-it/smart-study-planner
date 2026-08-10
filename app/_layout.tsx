import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

// Expo Router uses this to know which group of screens to treat as the
// "default" starting point when the app loads.
export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  // Detects whether the device is set to light or dark mode, so we can
  // adjust the navigation theme (tab bar, headers) to match automatically.
  const colorScheme = useColorScheme();

  return (
    // ThemeProvider controls colors for navigation elements (tab bar, headers).
    // Our own screen content (Login, Register, Subjects, Assessments) sets its
    // own explicit colors, so it stays readable regardless of this setting.
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        {/* The main app (tabs) - shown once the user is logged in */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* Auth screens - shown before login */}
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
      </Stack>
      {/* "auto" makes the status bar icons light or dark depending on device theme */}
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}