import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { ThemeProvider } from '@/components/ThemeContext';
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
    // Our custom ThemeProvider (accent color choice) wraps everything, so
    // any screen in the app can read the user's chosen color via useTheme().
    <ThemeProvider>
      {/* NavigationThemeProvider controls colors for navigation chrome
          (tab bar, headers) based on device light/dark mode - this is
          separate from our own accent-color theming above. */}
      <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          {/* The main app (tabs) - shown once the user is logged in */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* Auth screens - shown before login */}
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ headerShown: false }} />
          {/* One-time welcome screen shown right after registration */}
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          {/* Profile / account settings screen, reached via an icon on the Dashboard */}
          <Stack.Screen name="profile" options={{ headerShown: false }} />
        </Stack>
        {/* "auto" makes the status bar icons light or dark depending on device theme */}
        <StatusBar style="auto" />
      </NavigationThemeProvider>
    </ThemeProvider>
  );
}
