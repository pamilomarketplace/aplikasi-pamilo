// features/auth/useAuth.ts
import { useState } from 'react';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
// 🌟 KUNCI UTAMA: Potong jalur authService, langsung panggil supabaseClient ke hulu
import { supabase } from '@/utils/supabaseClient';

WebBrowser.maybeCompleteAuthSession();

const parseAuthTokensFromUrl = (url: string) => {
  const params: { [key: string]: string } = {};
  const parts = url.split('#');
  if (parts.length > 1) {
    const hash = parts[1];
    const pairs = hash.split('&');
    pairs.forEach((pair) => {
      const [key, value] = pair.split('=');
      if (key && value) params[key] = decodeURIComponent(value);
    });
  }
  return params;
};

/**
 * Hook Otentikasi Terpusat - Bebas dari Circular Dependency
 */
export const useAuth = () => {
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Logika Masuk Aplikasi (Login Email & Password)
   */
  const login = async (email: string, password: string): Promise<boolean> => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Form Belum Lengkap', 'Email dan kata sandi wajib diisi Tuan!');
      return false;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return true;
    } catch (error: any) {
      Alert.alert('Gagal Masuk ❌', error.message || 'Terjadi kendala otentikasi jaringan.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logika Masuk Instan Google OAuth
   */
  const loginWithGoogle = async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const schemeRedirect = Linking.createURL('auth-callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: schemeRedirect,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, schemeRedirect);
        if (result.type === 'success' && result.url) {
          const tokens = parseAuthTokensFromUrl(result.url);
          if (tokens.access_token && tokens.refresh_token) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
            });
            if (sessionError) throw sessionError;
            return true;
          }
        }
      }
      return false;
    } catch (error: any) {
      Alert.alert('Gagal Masuk Google ❌', error.message || 'Terjadi gangguan sistem masuk Google.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logika Pendaftaran Akun Warga Baru dengan Nomor HP Terintegrasi
   */
  const register = async (email: string, password: string, name: string, phone: string): Promise<boolean> => {
    if (!email.trim() || !password.trim() || !name.trim() || !phone.trim()) {
      Alert.alert('Form Belum Lengkap', 'Nama, email, nomor HP, dan kata sandi wajib diisi Tuan Master!');
      return false;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            // 🚀 SINKRONISASI TOTAL: Menyamakan nama key agar terbaca utuh oleh database trigger
            user_name: name,   // ✅ Diubah dari 'nama' menjadi 'user_name'
            user_phone: phone, // ✅ Diubah dari 'phone' menjadi 'user_phone'
            role: 'WARGA',
          },
        },
      });

      if (error) throw error;
      return true;
    } catch (error: any) {
      Alert.alert('Gagal Mendaftar ❌', error.message || 'Terjadi kesalahan sistem pendaftaran.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logika Permintaan Reset Kata Sandi
   */
  const forgotPassword = async (email: string): Promise<boolean> => {
    if (!email.trim()) {
      Alert.alert('Form Belum Lengkap', 'Silakan masukkan alamat email Tuan.');
      return false;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'pamiloapp://(auth)/reset-password',
      });
      if (error) throw error;
      Alert.alert('Email Terkirim 📬', 'Tautan pengaturan ulang kata sandi berhasil dikirim ke email Anda.');
      return true;
    } catch (error: any) {
      Alert.alert('Gagal Mengirim ❌', error.message || 'Gagal memproses permintaan reset password.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logika Mengunci Sandi Baru
   */
  const resetPassword = async (password: string): Promise<boolean> => {
    if (!password.trim()) {
      Alert.alert('Form Belum Lengkap', 'Kata sandi baru tidak boleh kosong Tuan!');
      return false;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Alert.alert('Sandi Diperbarui 🔒', 'Kata sandi brankas akun Anda berhasil diubah! Silakan login kembali.');
      return true;
    } catch (error: any) {
      Alert.alert('Gagal Memperbarui ❌', error.message || 'Gagal mengunci kata sandi baru.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    login,
    loginWithGoogle,
    register,
    forgotPassword,
    resetPassword
  };
};

// 🌟 PERTAHANAN GANDA: Ekspor Named dan Default sekaligus agar kebal salah import
export default useAuth;