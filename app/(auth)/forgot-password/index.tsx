// app/(auth)/forgot-password/index.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, StatusBar, ActivityIndicator } from 'react-native'; // 🌟 Ditambahkan: ActivityIndicator
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/features/auth/useAuth';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { forgotPassword, isLoading } = useAuth();

  const [email, setEmail] = useState('');

  const handleExecuteForgot = async () => {
    const success = await forgotPassword(email);
    if (success) {
      // Jika instruksi berhasil dikirim, kembalikan warga ke halaman masuk
      router.replace('/(auth)/login');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF3F0" />
      
      {/* BRANDING SECTION */}
      <View style={styles.brandSection}>
        <Text style={styles.appLogo}>📬</Text>
        <Text style={styles.appName}>Pemulihan Sandi</Text>
        <Text style={styles.appSubtitle}>Masukkan email terdaftar Anda. We akan mengirimkan tautan khusus untuk mereset kata sandi brankas Akun Anda.</Text>
      </View>

      {/* FORM CARD */}
      <View style={styles.formCard}>
        <Text style={styles.label}>Alamat Email Terdaftar</Text>
        <TextInput
          style={styles.input}
          placeholder="nama@email.com"
          placeholderTextColor="#A1887F"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        {/* 🌟 TOMBOL KIRIM INLINE NATIVE (Menggantikan BaseButton) */}
        <TouchableOpacity
          style={[styles.btnKirim, isLoading && styles.btnKirimDisabled]}
          onPress={handleExecuteForgot}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.btnKirimText}>Kirim Tautan Pemulihan 🚀</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* FOOTER LINK UNTUK KEMBALI */}
      <View style={styles.footerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.backText}>⬅️ Kembali ke Halaman Masuk</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF3F0', paddingHorizontal: 25 },
  brandSection: { alignItems: 'center', marginBottom: 30 },
  appLogo: { fontSize: 50, marginBottom: 10 },
  appName: { fontSize: 24, fontWeight: 'bold', color: '#4A3420', letterSpacing: 0.5 },
  appSubtitle: { fontSize: 13, color: '#7A6450', textAlign: 'center', marginTop: 8, lineHeight: 18, paddingHorizontal: 10 },
  formCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E0D0C0', elevation: 2 },
  label: { fontSize: 11, fontWeight: 'bold', color: '#A1887F', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#FAF3F0', borderWidth: 1, borderColor: '#E0D0C0', borderRadius: 10, padding: 12, fontSize: 14, color: '#4A3420', marginBottom: 20 },
  
  // 🌟 Kumpulan Gaya Tombol Baru PAMILO
  btnKirim: { backgroundColor: '#4A3420', height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  btnKirimDisabled: { backgroundColor: '#C0A995', elevation: 0 },
  btnKirimText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 30 },
  backBtn: { padding: 10 },
  backText: { color: '#4A3420', fontSize: 13, fontWeight: 'bold', textDecorationLine: 'underline' }
});