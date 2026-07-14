// app/auth/hub.tsx
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import { useRoleCheck } from '@/features/auth/useRoleCheck';

export default function AuthHubScreen() {
  // Aktifkan radar pemeriksaan sasis peran user secara otomatis begitu layar menyala
  const { checking } = useRoleCheck();

  return (
    <View style={styles.hubContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#4A3420" />
      <View style={styles.boxLogoCard}>
        <Text style={styles.logoText}>PAMILO</Text>
        <ActivityIndicator size="small" color="#E28743" style={{ marginTop: 12 }} />
        <Text style={styles.loadingRoleText}>Memverifikasi identitas gembok akun...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hubContainer: { flex: 1, backgroundColor: '#4A3420', justifyContent: 'center', alignItems: 'center' },
  boxLogoCard: { alignItems: 'center', gap: 4 },
  logoText: { fontSize: 26, fontWeight: 'bold', color: '#FFF', letterSpacing: 4 },
  loadingRoleText: { fontSize: 11, color: '#C0A995', marginTop: 6, fontWeight: '500' }
});