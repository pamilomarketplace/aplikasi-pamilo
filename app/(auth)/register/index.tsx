// app/(auth)/register/index.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, StatusBar, Image, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/features/auth/useAuth';
import { Ionicons } from '@expo/vector-icons';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register, isLoading } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleExecuteRegister = async () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      Alert.alert('Perhatian', 'Seluruh kolom pendaftaran wajib diisi Tuan Master!');
      return;
    }

    const success = await register(email, password, name, phone);
    if (success) {
      Alert.alert(
        'Pendaftaran Sukses 🎉',
        `Akun warga atas nama ${name} berhasil dirakit!\n\nSilakan periksa kotak masuk email Anda untuk melakukan verifikasi tautan sebelum masuk ke aplikasi.`,
        [{ text: 'Siap, Masuk Login 🏁', onPress: () => router.replace('/(auth)/login' as any) }]
      );
    }
  };

  return (
    <ScrollView 
      style={{ backgroundColor: '#FAF3F0' }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]}
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
        <Text style={styles.appTitle}>Daftar Warga Baru</Text>
        <Text style={styles.appTagline}>Bergabung bersama ekosistem Pasar PAMILO Ciamis</Text>
      </View>

      {/* REGISTRATION CARD */}
      <View style={styles.formCard}>
        
        {/* INPUT NAMA */}
        <Text style={styles.label}>Nama Lengkap Sesuai KTP</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={18} color="#A1887F" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Contoh: Agus Galendo"
            placeholderTextColor="#C0A995"
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* INPUT EMAIL */}
        <Text style={styles.label}>Alamat Email Aktif</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="mail-outline" size={18} color="#A1887F" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="nama@email.com"
            placeholderTextColor="#C0A995"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {/* INPUT NOMOR HP (WHATSAPP) */}
        <Text style={styles.label}>Nomor HP / WhatsApp Aktif</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="phone-portrait-outline" size={18} color="#A1887F" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Contoh: 081234567xxx"
            placeholderTextColor="#C0A995"
            keyboardType="numeric"
            value={phone}
            onChangeText={setPhone}
          />
        </View>

        {/* INPUT KATA SANDI */}
        <Text style={styles.label}>Kata Sandi Baru</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={18} color="#A1887F" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#C0A995"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {/* TOMBOL EKSEKUSI DAFTAR */}
        <TouchableOpacity
          style={[styles.btnRegister, isLoading && styles.btnRegisterDisabled]}
          onPress={handleExecuteRegister}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.btnRegisterText}>Buat Akun PAMILO 🚀</Text>
          )}
        </TouchableOpacity>

      </View>

      {/* FOOTER LINK KE LOGIN */}
      <View style={styles.footerRow}>
        <Text style={styles.footerText}>Sudah terdaftar jadi warga? </Text>
        <TouchableOpacity onPress={() => router.replace('/(auth)/login' as any)}>
          <Text style={styles.loginLink}>Masuk Saja</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 25 },
  brandSection: { alignItems: 'center', marginBottom: 15 },
  appLogoImage: { width: 90, height: 90, marginBottom: 5 },
  appTitle: { fontSize: 20, fontWeight: 'bold', color: '#4A3420' },
  appTagline: { fontSize: 12, color: '#7A6450', textAlign: 'center', marginTop: 2 },
  
  formCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E0D0C0', elevation: 2 },
  label: { fontSize: 11, fontWeight: 'bold', color: '#A1887F', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAF3F0', borderWidth: 1, borderColor: '#E0D0C0', borderRadius: 10, marginBottom: 15, paddingHorizontal: 12 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, height: 44, fontSize: 14, color: '#4A3420' },
  
  btnRegister: { height: 48, backgroundColor: '#4A3420', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10, elevation: 2 },
  btnRegisterDisabled: { backgroundColor: '#C0A995', elevation: 0 },
  btnRegisterText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: '#7A6450', fontSize: 13 },
  loginLink: { color: '#4A3420', fontSize: 13, fontWeight: 'bold', textDecorationLine: 'underline' }
});