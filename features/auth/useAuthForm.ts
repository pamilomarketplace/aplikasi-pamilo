// features/auth/useAuthForm.ts
import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/utils/supabaseClient';

export const useAuthForm = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // LOGIKA MASUK AKUN (LOGIN)
  const handleLogin = async (email: string, kataSandi: string) => {
    if (!email.trim() || !kataSandi.trim()) {
      Alert.alert('Perhatian ⚠️', 'Email dan Kata Sandi wajib diisi!');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: kataSandi,
      });

      if (error) throw error;

      // Sukses: Lempar ke file flat hub.tsx untuk seleksi peran
      router.replace('/hub' as any);

    } catch (err: any) {
      Alert.alert('Gagal Masuk ❌', err.message || 'Periksa kembali email dan sandi Anda.');
    } finally {
      setLoading(false);
    }
  };

  // LOGIKA DAFTAR AKUN (REGISTER)
  const handleRegister = async (nama: string, email: string, kataSandi: string, peranDaftar: 'BUYER' | 'DRIVER') => {
    if (!nama.trim() || !email.trim() || !kataSandi.trim()) {
      Alert.alert('Perhatian ⚠️', 'Semua kolom form wajib diisi!');
      return;
    }

    try {
      setLoading(true);

      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: email,
        password: kataSandi,
        options: {
          data: { user_name: nama }
        }
      });

      if (authErr) throw authErr;
      if (!authData.user) throw new Error('Gagal menciptakan kredensial akun.');

      // Suntik data ke tabel public.users milik Tuan Master
      const { error: profileErr } = await supabase
        .from('users')
        .insert({
          user_id: authData.user.id,
          user_name: nama,
          role: peranDaftar
        });

      if (profileErr) throw profileErr;

      Alert.alert('Pendaftaran Berhasil 🎉', 'Akun Pasar PAMILO Anda siap digunakan. Silakan langsung masuk!');
      router.replace('/login' as any);

    } catch (err: any) {
      Alert.alert('Gagal Mendaftar ❌', err.message);
    } finally {
      setLoading(false);
    }
  };

  return { loading, handleLogin, handleRegister };
};