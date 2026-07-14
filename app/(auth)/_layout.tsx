// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        // Sembunyikan header bawaan global untuk seluruh layar otentikasi
        headerShown: false,
        // Efek transisi perpindahan antar-layar yang mulus dan elegan
        animation: 'fade',
        contentStyle: { backgroundColor: '#FAF3F0' }
      }}
    >
      {/* Daftarkan rute index dari masing-masing sub-folder secara eksplisit */}
      <Stack.Screen name="login/index" />
      <Stack.Screen name="register/index" />
      <Stack.Screen name="forgot-password/index" />
      <Stack.Screen name="reset-password/index" />
    </Stack>
  );
}