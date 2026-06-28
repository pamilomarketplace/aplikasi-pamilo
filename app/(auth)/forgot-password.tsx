// @ts-nocheck
import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ScrollView
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '@/supabaseConfig';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  
  const [step, setStep] = useState(1); // Step 1: Email, Step 2: OTP, Step 3: Password Baru
  const [loading, setLoading] = useState(false);
  
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 🔐 STEP 1: KIRIM KODE OTP KE EMAIL WARGA
  const handleKirimOtpEmail = async () => {
    if (!email.trim()) {
      return Alert.alert("Input Kosong 🚨", "Harap masukkan alamat email Anda yang terdaftar.");
    }

    setLoading(true);
    try {
      // Perintah Supabase untuk mengirimkan token pemulihan (recovery token/OTP)
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      
      if (error) throw error;

      Alert.alert("OTP Terkirim! ✉️", "Silakan periksa kotak masuk atau folder spam email Anda untuk melihat kode OTP 6 Digit.");
      setStep(2); // Lanjut ke sasis verifikasi OTP
    } catch (error: any) {
      Alert.alert("Gagal Mengirim", error.message || "Pastikan email Anda benar dan internet stabil.");
    } finally {
      setLoading(false);
    }
  };

  // 🔐 STEP 2: VALIDASI KODE OTP 6 DIGIT
  const handleVerifikasiOtp = async () => {
    if (!otp.trim() || otp.trim().length < 6) {
      return Alert.alert("OTP Tidak Valid 🚨", "Harap masukkan 6 digit kode OTP dengan benar.");
    }

    setLoading(true);
    try {
      // Melakukan verifikasi OTP tipe recovery di sistem Supabase
      const { data, error } = await supabase.auth.verifyOTP({
        email: email.trim(),
        token: otp.trim(),
        type: 'recovery',
      });

      if (error) throw error;

      // Jika sukses, Supabase otomatis membuatkan sesi login sementara untuk user ini agar bisa ganti password
      Alert.alert("Verifikasi Sukses 🔓", "Kode OTP cocok. Silakan buat password baru Anda.");
      setStep(3);
    } catch (error: any) {
      Alert.alert("Verifikasi Gagal ❌", error.message || "Kode OTP salah atau sudah kedaluwarsa.");
    } finally {
      setLoading(false);
    }
  };

  // 🔐 STEP 3: SUNTIK PASSWORD BARU KE DATABASE
  const handleUpdatePasswordBaru = async () => {
    if (!newPassword || !confirmPassword) {
      return Alert.alert("Form Kosong 🚨", "Harap isi kedua kolom password.");
    }
    if (newPassword.length < 6) {
      return Alert.alert("Terlalu Lemah 🔒", "Password minimal harus terdiri dari 6 karakter.");
    }
    if (newPassword !== confirmPassword) {
      return Alert.alert("Tidak Cocok ❌", "Konfirmasi password tidak sama dengan password baru.");
    }

    setLoading(true);
    try {
      // Mengganti password user yang sedang aktif di sesi recovery saat ini
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      Alert.alert(
        "Sandi Diperbarui! 🎉", 
        "Password baru Anda berhasil disimpan. Silakan masuk kembali menggunakan sandi baru.",
        [{ text: "Buka Layar Login", onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (error: any) {
      Alert.alert("Gagal Menyimpan", error.message || "Terjadi kesalahan saat memperbarui sandi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: true, title: 'Pemulihan Akun', headerStyle: { backgroundColor: '#4A3525' }, headerTintColor: '#fff' }} />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />
      
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* ICON KONDISIONAL SESUAI STEP */}
        <View style={styles.logoSection}>
          <View style={styles.iconCircleBg}>
            <Ionicons 
              name={step === 1 ? "mail-open-outline" : step === 2 ? "key-outline" : "lock-open-outline"} 
              size={36} 
              color="#D35400" 
            />
          </View>
          <h2 style={styles.titleText}>
            {step === 1 ? "Lupa Password?" : step === 2 ? "Ketik Kode OTP" : "Buat Sandi Baru"}
          </h2>
          <Text style={styles.subtitleText}>
            {step === 1 ? "Tenang Tuan, masukkan email akun PAMILO Anda di bawah untuk menerima kode kunci pemulihan." : 
             step === 2 ? `Sistem telah mengirimkan 6 digit angka rahasia ke email ${email}.` : 
             "Gunakan kombinasi sandi yang kuat dan mudah Tuan ingat."}
          </Text>
        </View>

        {/* INPUT KONDISIONAL BERDASARKAN STEP JALUR */}
        <View style={styles.formSection}>
          
          {/* STEP 1: INPUT EMAIL */}
          {step === 1 && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Alamat Email Akun *</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail" size={16} color="#A1887F" style={styles.inputIcon} />
                <TextInput 
                  style={styles.textInput} 
                  placeholder="contoh@email.com" 
                  placeholderTextColor="#BCAAA4" 
                  value={email} 
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <TouchableOpacity style={styles.btnAction} onPress={handleKirimOtpEmail} disabled={loading}>
                {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnActionText}>KIRIM KODE OTP 🚀</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2: INPUT KODE OTP */}
          {step === 2 && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Kode OTP 6 Digit *</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="key" size={16} color="#A1887F" style={styles.inputIcon} />
                <TextInput 
                  style={styles.textInput} 
                  placeholder="Masukkan 6 angka OTP" 
                  placeholderTextColor="#BCAAA4" 
                  value={otp} 
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
              <TouchableOpacity style={styles.btnAction} onPress={handleVerifikasiOtp} disabled={loading}>
                {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnActionText}>VERIFIKASI KODE KUNCI 🔓</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnBackStep} onPress={() => setStep(1)}>
                <Text style={styles.btnBackStepText}>Ganti Alamat Email</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 3: INPUT PASSWORD BARU */}
          {step === 3 && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password Baru Tuan *</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed" size={16} color="#A1887F" style={styles.inputIcon} />
                <TextInput 
                  style={styles.textInput} 
                  placeholder="Minimal 6 karakter" 
                  placeholderTextColor="#BCAAA4" 
                  secureTextEntry
                  value={newPassword} 
                  onChangeText={setNewPassword}
                />
              </View>

              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Konfirmasi Password Baru *</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="shield-checkmark" size={16} color="#A1887F" style={styles.inputIcon} style={styles.inputIcon} />
                <TextInput 
                  style={styles.textInput} 
                  placeholder="Ulangi password baru" 
                  placeholderTextColor="#BCAAA4" 
                  secureTextEntry
                  value={confirmPassword} 
                  onChangeText={setConfirmPassword}
                />
              </View>

              <TouchableOpacity style={[styles.btnAction, { backgroundColor: '#2E7D32' }]} onPress={handleUpdatePasswordBaru} disabled={loading}>
                {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnActionText}>SIMPAN SANDI BARU 🎉</Text>}
              </TouchableOpacity>
            </View>
          )}

        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5' },
  scrollContent: { padding: 24, alignItems: 'center', paddingTop: 40 },
  logoSection: { alignItems: 'center', marginBottom: 30, width: '100%' },
  iconCircleBg: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderColors: '#FFCCBC', borderWidth: 1 },
  titleText: { fontSize: 18, fontWeight: '900', color: '#4A3525', textAlign: 'center' },
  subtitleText: { fontSize: 12, color: '#8D6E63', textAlign: 'center', marginTop: 8, lineHeight: 18, paddingHorizontal: 10 },
  formSection: { width: '100%', marginTop: 10 },
  inputGroup: { width: '100%', marginBottom: 16 },
  inputLabel: { fontSize: 11, fontWeight: '900', color: '#4A3525', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#EFEBE9', paddingHorizontal: 14, height: 50 },
  inputIcon: { marginRight: 10 },
  textInput: { flex: 1, fontSize: 14, color: '#4A3525', fontWeight: '600' },
  btnAction: { backgroundColor: '#D35400', height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginTop: 24, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
  btnActionText: { color: '#fff', fontSize: 13, fontWeight: 'bold', letterSpacing: 0.5 },
  btnBackStep: { marginTop: 16, alignItems: 'center' },
  btnBackStepText: { color: '#8D6E63', fontSize: 12, fontWeight: 'bold', textDecorationLine: 'underline' }
});