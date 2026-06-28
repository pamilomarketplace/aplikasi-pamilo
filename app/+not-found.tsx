import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useRouter } from 'expo-router';

export default function NotFoundScreen() {
  const router = useRouter();

  useEffect(() => {
    // JARING PENGAMAN: 
    // Hapus garis miring di akhir agar TypeScript Expo Router tidak protes.
    const timer = setTimeout(() => {
      router.replace('/(tabs)');
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#4A3525' }}>
      <ActivityIndicator size="large" color="#D35400" />
      <Text style={{ marginTop: 12, color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
        Menyinkronkan Sesi Autentikasi...
      </Text>
    </View>
  );
}