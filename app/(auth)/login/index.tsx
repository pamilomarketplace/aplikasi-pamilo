// app/(auth)/login/index.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, StatusBar, Image, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/features/auth/useAuth';
import { Ionicons } from '@expo/vector-icons'; 

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, loginWithGoogle, isLoading } = useAuth(); // 🌟 Mengonsumsi fungsi Google asli dari hook

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false); 

  const handleExecuteLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Perhatian', 'Email dan kata sandi wajib diisi Tuan!');
      return;
    }
    const success = await login(email, password);
    if (success) {
      router.replace('/hub' as any);
    }
  };

  const handleExecuteGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      // 🌟 KUNCI UTAMA: Cukup pemicu OAuth saja.
      // JANGAN panggil router.replace manual di sini.
      // Mekanisme onAuthStateChange di app/_layout.tsx milik Tuan Master 
      // yang akan menarik warga ke /(tabs) saat verifikasi browser selesai.
      await loginWithGoogle(); 
    } catch (error) {
      console.error(error);
    } finally {
      // Matikan indikator loading setelah browser eksternal berhasil dipicu
      setIsGoogleLoading(false); 
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF3F0" />
      
      {/* LOGO & BRANDING PREMIUM */}
      <View style={styles.brandSection}>
        <Image 
          source={require('@/assets/images/new_icon.png')} 
          style={styles.appLogoImage}
          resizeMode="contain"
        />
        <Text style={styles.appTagline}>
          Bela Tetangga, Beli di Tetangga {'\n'}Tatar Galuh Ciamis
        </Text>
      </View>

      {/* FORM INPUT */}
      <View style={styles.formCard}>
        <Text style={styles.label}>Alamat Email Warga</Text>
        <TextInput
          style={styles.input}
          placeholder="nama@email.com"
          placeholderTextColor="#A1887F"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Kata Sandi Brankas</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#A1887F"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {/* LUPA PASSWORD */}
        <TouchableOpacity 
          style={styles.forgotBtn}
          onPress={() => router.push('/(auth)/forgot-password' as any)}
        >
          <Text style={styles.forgotText}>Lupa kata sandi Tuan?</Text>
        </TouchableOpacity>

        {/* TOMBOL MASUK EMAIL NATIVE */}
        <TouchableOpacity
          style={[styles.btnLogin, styles.btnEmail, isLoading && styles.btnLoginDisabled]}
          onPress={handleExecuteLogin}
          disabled={isLoading || isGoogleLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.btnLoginText}>Masuk Aplikasi 🏁</Text>
          )}
        </TouchableOpacity>

        {/* PEMISAH VISUAL (DIVIDER) */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>atau</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* TOMBOL LOGIN GOOGLE PREMIUM */}
        <TouchableOpacity
          style={[styles.btnLogin, styles.btnGoogle, isGoogleLoading && styles.btnLoginDisabled]}
          onPress={handleExecuteGoogleLogin}
          disabled={isLoading || isGoogleLoading}
          activeOpacity={0.8}
        >
          {isGoogleLoading ? (
            <ActivityIndicator size="small" color="#4A3420" />
          ) : (
            <View style={styles.googleContentRow}>
              <Ionicons name="logo-google" size={18} color="#DB4437" />
              <Text style={styles.btnGoogleText}>Masuk dengan Google</Text>
            </View>
          )}
        </TouchableOpacity>

      </View>

      {/* FOOTER LINK KE REGISTER */}
      <View style={styles.footerRow}>
        <Text style={styles.footerText}>Belum terdaftar sebagai warga? </Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/register' as any)}>
          <Text style={styles.registerLink}>Daftar Akun</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF3F0', paddingHorizontal: 25 },
  brandSection: { alignItems: 'center', marginBottom: 20 },
  appLogoImage: { width: 120, height: 120, marginBottom: 8 },
  appTagline: { fontSize: 13, color: '#7A6450', textAlign: 'center', marginTop: 2, lineHeight: 18, fontWeight: '500' },
  formCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E0D0C0', elevation: 2 },
  label: { fontSize: 11, fontWeight: 'bold', color: '#A1887F', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#FAF3F0', borderWidth: 1, borderColor: '#E0D0C0', borderRadius: 10, padding: 12, fontSize: 14, color: '#4A3420', marginBottom: 15 },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 20 },
  forgotText: { color: '#E28743', fontSize: 12, fontWeight: '600' },
  
  btnLogin: { height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  btnLoginDisabled: { backgroundColor: '#C0A995', elevation: 0 },
  
  btnEmail: { backgroundColor: '#4A3420' },
  btnLoginText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E0D0C0' },
  dividerText: { color: '#A1887F', paddingHorizontal: 10, fontSize: 12, fontWeight: '600' },
  
  btnGoogle: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E0D0C0' },
  googleContentRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnGoogleText: { color: '#4A3420', fontSize: 14, fontWeight: 'bold' },
  
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 25 },
  footerText: { color: '#7A6450', fontSize: 13 },
  registerLink: { color: '#4A3420', fontSize: 13, fontWeight: 'bold', textDecorationLine: 'underline' }
});