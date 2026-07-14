// app/setting/index.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
// Mengonsumsi pipa mesin logika terisolasi sesuai aturan baku arsitektur bersih
import { useSetting } from '@/features/setting/useSetting';

export default function SettingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const { profile, isLoading, handleLogout } = useSetting();

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#4A3420" />
        <ActivityIndicator size="large" color="#E28743" />
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#4A3420" />

      {/* HEADER UTAMA PROFILE JUMBOTRON */}
      <View style={[styles.profileHeaderCard, { paddingTop: insets.top + 20 }]}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {profile?.nama ? profile.nama.charAt(0).toUpperCase() : 'W'}
          </Text>
        </View>
        <Text style={styles.profileNameText}>{profile?.nama}</Text>
        <Text style={styles.profileEmailText}>{profile?.email}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
        
        {/* GRUP MENU AKUN & LOGISTIK WARGA */}
        <Text style={styles.groupSectionLabel}>Pengaturan Akun</Text>
        <View style={styles.menuGroupCard}>
          <TouchableOpacity 
            style={styles.menuRowItem} 
            onPress={() => router.push('/addresses' as any)}
          >
            <View style={styles.menuLeftCol}>
              <Ionicons name="location-outline" size={20} color="#4A3420" />
              <Text style={styles.menuItemText}>Daftar Alamat Pengiriman</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#C0A995" />
          </TouchableOpacity>
        </View>

        {/* GRUP MENU INFORMASI HUKUM & APLIKASI */}
        <Text style={styles.groupSectionLabel}>Informasi Pamilo</Text>
        <View style={styles.menuGroupCard}>
          <TouchableOpacity 
            style={styles.menuRowItem} 
            onPress={() => router.push('/kebijakan' as any)}
          >
            <View style={styles.menuLeftCol}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#4A3420" />
              <Text style={styles.menuItemText}>Kebijakan Privasi Warga</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#C0A995" />
          </TouchableOpacity>

          <View style={styles.menuDividerLine} />

          <View style={styles.menuRowItemTextOnly}>
            <View style={styles.menuLeftCol}>
              <Ionicons name="information-circle-outline" size={20} color="#4A3420" />
              <Text style={styles.menuItemText}>Versi Aplikasi</Text>
            </View>
            <Text style={styles.versionBadgeText}>v1.0.0-Galuh</Text>
          </View>
        </View>

        {/* TOMBOL AKSI UTAMA KELUAR AKUN */}
        <TouchableOpacity 
          style={styles.btnLogOutAction} 
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color="#FFF" />
          <Text style={styles.btnLogOutText}>Keluar dari Akun Warga</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FAF6F0' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF6F0' },
  scrollBody: { padding: 16, paddingBottom: 40 },
  
  // Profile Jumbotron Header Styles
  profileHeaderCard: { backgroundColor: '#4A3420', alignItems: 'center', paddingBottom: 25, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, elevation: 4 },
  avatarCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#E28743', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF', marginBottom: 12 },
  avatarText: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  profileNameText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', letterSpacing: 0.3 },
  profileEmailText: { color: '#C0A995', fontSize: 12, marginTop: 4, fontWeight: '500' },
  
  // Menu Container Structuring
  groupSectionLabel: { fontSize: 11, fontWeight: 'bold', color: '#7A6450', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 20, marginBottom: 8, paddingLeft: 4 },
  menuGroupCard: { backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E0D0C0', paddingHorizontal: 14, elevation: 1 },
  menuRowItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  menuRowItemTextOnly: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  menuLeftCol: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuItemText: { fontSize: 13, fontWeight: '600', color: '#4A3420' },
  menuDividerLine: { height: 1, backgroundColor: '#FAF6F0' },
  versionBadgeText: { fontSize: 12, color: '#A1887F', fontWeight: 'bold' },
  
  // Logout Button Component
  btnLogOutAction: { backgroundColor: '#E74C3C', height: 48, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 32, elevation: 2 },
  btnLogOutText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' }
});