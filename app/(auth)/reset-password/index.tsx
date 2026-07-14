// app/(auth)/reset-password/index.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, StatusBar, Image, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/features/auth/useAuth';
import { Ionicons } from '@expo/vector-icons';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resetPassword, isLoading } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleExecuteReset = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert('Perhatian', 'Semua kolom wajib diisi Tuan Master!');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Sandi Terlalu Lemah', 'Kata sandi baru minimal harus 6 karakter Tuan!');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Konfirmasi Gagal', 'Kata sandi baru dan konfirmasi sandi tidak cocok!');
      return;
    }

    const success = await resetPassword(newPassword);
    if (success) {
      // Otomatis menendang user ke halaman login setelah sandi baru sukses dikunci
      router.replace('/(auth)/login' as any);
    }
  };

  return (
    <ScrollView 
      style={{ backgroundColor: '#FAF3F0' }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 30, paddingBottom: insets.bottom + 20 }]}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FAF3F0" />
      
      {/* BRANDING SECTION */}
      <View style={styles.brandSection}>
        <Image 
          source={require('@/assets/images/new_icon.png')} 
          style={styles.appLogoImage}
          resizeMode="contain"
        />
        <Text style={styles.appTitle}>Sandi Baru Warga</Text>
        <Text style={styles.appTagline}>Kunci kembali brankas akun Pasar PAMILO Anda</Text>
      </View>

      {/* RESET CARD */}
      <View style={styles.formCard}>
        
        {/* INPUT SANDI BARU */}
        <Text style={styles.label}>Kata Sandi Baru</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="lock-open-outline" size={18} color="#A1887F" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Minimal 6 karakter"
            placeholderTextColor="#C0A995"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
        </View>

        {/* INPUT KONFIRMASI SANDI */}
        <Text style={styles.label}>Ulangi Kata Sandi Baru</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={18} color="#A1887F" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Pastikan ketikan sama"
            placeholderTextColor="#C0A995"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </View>

        {/* TOMBOL EKSEKUSI */}
        <TouchableOpacity
          style={[styles.btnExecute, isLoading && styles.btnExecuteDisabled]}
          onPress={handleExecuteReset}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.btnExecuteText}>Simpan & Perbarui Sandi 🔒</Text>
          )}
        </TouchableOpacity>

      </View>

      {/* FOOTER KEMBALI */}
      <View style={styles.footerRow}>
        <TouchableOpacity onPress={() => router.replace('/(auth)/login' as any)}>
          <Text style={styles.backLink}>Batal, Kembali ke Login</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 25 },
  brandSection: { alignItems: 'center', marginBottom: 25 },
  appLogoImage: { width: 90, height: 90, marginBottom: 10 },
  appTitle: { fontSize: 22, fontWeight: 'bold', color: '#4A3420' },
  appTagline: { fontSize: 13, color: '#7A6450', textAlign: 'center', marginTop: 4, paddingHorizontal: 10 },
  
  formCard: { backgroundColor: '#FFF', padding: 25, borderRadius: 16, borderWidth: 1, borderColor: '#E0D0C0', elevation: 2 },
  label: { fontSize: 11, fontWeight: 'bold', color: '#A1887F', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAF3F0', borderWidth: 1, borderColor: '#E0D0C0', borderRadius: 10, marginBottom: 18, paddingHorizontal: 12 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, height: 44, fontSize: 14, color: '#4A3420' },
  
  btnExecute: { height: 48, backgroundColor: '#4A3420', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 5, elevation: 2 },
  btnExecuteDisabled: { backgroundColor: '#C0A995', elevation: 0 },
  btnExecuteText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 25 },
  backLink: { color: '#7A6450', fontSize: 13, fontWeight: 'bold', textDecorationLine: 'underline' }
});