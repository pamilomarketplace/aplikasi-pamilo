// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, 
  Platform, Image 
} from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '../../supabaseConfig'; 
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Mencegat URL Google agar browser tertutup mulus
WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    checkSessionOnLoad();
  }, []);

  const checkSessionOnLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        router.replace('/(tabs)'); 
      }
    } catch (error) {
      console.log("Gagal memeriksa gerbang login:", error);
    }
  };

  const ekstrakTokenDariURL = (url: string) => {
    let params: any = {};
    const queryString = url.split('#')[1] || url.split('?')[1];
    if (queryString) {
      queryString.split('&').forEach(param => {
        const [key, value] = param.split('=');
        params[key] = decodeURIComponent(value);
      });
    }
    return params;
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();

      // 🟢 FIX MUTLAK: Isi dengan 'login' agar Expo Router mengenali rute panggilannya
      const redirectUrl = Linking.createURL('login'); 
      console.log("👉 ISI REDIRECT_URL DARI EXPO:", redirectUrl);  

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true, 
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          }
        },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        
        if (result.type === 'success' && result.url) {
          console.log("🔒 URL Ditangkap langsung di login.tsx!");
          
          const tokens = ekstrakTokenDariURL(result.url); 

          if (tokens.access_token && tokens.refresh_token) {
            console.log("🔑 Mengunci sesi Supabase...");
            
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
            });

            if (sessionError) throw sessionError;
            
            console.log("✅ Sesi sah! Menyerahkan kemudi rute ke _layout.tsx...");
            setLoading(false);
            return;
          }
        }
        
        setLoading(false);
      }
    } catch (error: any) {
      setLoading(false); 
      console.log("Detail error Google Auth:", error);
      Alert.alert("Gagal", "Otorisasi Google gagal. Silakan coba kembali.");
    }
  };

  const handleLoginSupabase = async () => {
    if (!email || !password) {
      return Alert.alert("Data Kosong", "Mohon isi Email dan Kata Sandi Anda terlebih dahulu.");
    }
    setLoading(true);
    const emailSteril = email.trim().toLowerCase();

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: emailSteril,
        password: password.trim(),
      });

      if (error) throw error;
      console.log("🚀 Login Email Sukses! Mendobrak langsung ke Beranda...");
      
      router.replace('/(tabs)');
      
      setTimeout(() => {
        setLoading(false);
      }, 1000);

    } catch (error: any) {
      setLoading(false);
      console.log("Sinyal Ditolak: Detail auth email salah ->", error.message);
      
      const pesanBule = error.message?.toLowerCase() || "";

      if (pesanBule.includes("email not confirmed")) {
        Alert.alert(
          "Email Belum Terverifikasi ✉️❌",
          "SILAHKAN CEK KOTAK MASUK GMAIL ANDA!\n\nAnda harus mengeklik tautan konfirmasi email yang kami kirimkan saat mendaftar sebelum bisa masuk ke aplikasi PAMILO."
        );
      } else if (pesanBule.includes("invalid login credentials")) {
        Alert.alert("Login Gagal ❌", "Email atau password yang Anda masukkan salah.");
      } else {
        Alert.alert("Gagal Masuk", "Terjadi kesalahan sistem: " + error.message);
      }
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={{ justifyContent: 'center', flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.logoContainer}>
            <Image source={require('../../assets/images/new_icon.png')} style={styles.logoImage} resizeMode="contain" />
          </View>

          <Text style={styles.title}>Masuk PAMILO</Text>
          <Text style={styles.subtitle}>Pasar Mitra Lokal - Kabupaten Ciamis</Text>
          
          <Text style={styles.label}>Alamat Email</Text>
          <TextInput style={styles.input} placeholder="Contoh: warga@pamilo.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor="#BCAAA4" />
          
          <Text style={styles.label}>Kata Sandi (Password)</Text>
          <View style={styles.passwordWrapper}>
            <TextInput style={styles.passwordInput} placeholder="Masukkan password Anda" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" placeholderTextColor="#BCAAA4" />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons name={showPassword ? "eye-off" : "eye"} size={18} color="#8D6E63" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            onPress={() => router.push('/(auth)/forgot-password')}
            style={{ alignItems: 'flex-end', marginTop: 10 }}
          >
          <Text style={{ color: '#D35400', fontSize: 12, fontWeight: 'bold' }}>
          Lupa Password?
          </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.btnMain} onPress={handleLoginSupabase} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>LOG IN</Text>}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.orText}>ATAU</Text>
            <View style={styles.line} />
          </View>

          <TouchableOpacity style={[styles.btnGoogle, loading && { opacity: 0.5 }]} onPress={handleGoogleLogin} disabled={loading}>
            <Ionicons name="logo-google" size={20} color="#EA4335" />
            <Text style={styles.btnGoogleText}> Lanjutkan dengan Google</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/register')} style={styles.toggleBtn}>
            <Text style={styles.toggleText}>Belum punya akun? Daftar Disini</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#5D4037', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 25, padding: 25, elevation: 5 },
  logoContainer: { alignItems: 'center', marginBottom: 10 },
  logoImage: { width: 90, height: 90 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: '#5D4037', marginTop: 5 },
  subtitle: { fontSize: 12, textAlign: 'center', color: '#8D6E63', marginBottom: 20, fontWeight: '600', letterSpacing: 0.5 },
  label: { fontSize: 10, fontWeight: 'bold', color: '#5D4037', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#FDFBF9', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#D7CCC8', color: '#4A3525' },
  passwordWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDFBF9', borderRadius: 12, borderWidth: 1, borderColor: '#D7CCC8', marginBottom: 15 },
  passwordInput: { flex: 1, padding: 15, color: '#4A3525' },
  eyeIcon: { paddingHorizontal: 14 },
  btnMain: { backgroundColor: '#D35400', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 5 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 15 },
  line: { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
  orText: { marginHorizontal: 10, color: '#BCAAA4', fontSize: 11, fontWeight: '600' },
  btnGoogle: { flexDirection: 'row', backgroundColor: '#fff', padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D7CCC8' },
  btnGoogleText: { color: '#5D4037', fontWeight: '600', marginLeft: 10 },
  toggleBtn: { marginTop: 25, alignItems: 'center' },
  toggleText: { color: '#D35400', fontWeight: 'bold', fontSize: 14 }
});