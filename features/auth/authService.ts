// features/auth/authService.ts
import { supabase } from '@/utils/supabaseClient';

export const authService = {
  /**
   * Logika Masuk Aplikasi menggunakan Email & Kata Sandi
   */
  async loginWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }
    return data;
  },

  /**
   * 🌟 LOGIKA PENDAFTARAN AKUN WARGA BARU (Sudah Mendukung 5 Argumen Lengkap)
   * Parameter 'phone' disisipkan di urutan ke-4 sebelum 'role'
   */
  async registerUser(email: string, password: string, name: string, phone: string, role: string = 'WARGA') {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          // 🚀 SINKRONISASI TOTAL: Disamakan persis dengan satpam database trigger
          user_name: name,   // ✅ Diubah dari 'nama' menjadi 'user_name'
          user_phone: phone, // ✅ Diubah dari 'phone' menjadi 'user_phone'
          role: role,
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },

  /**
   * Permintaan Tautan Pengaturan Ulang Kata Sandi (Lupa Password)
   */
  async resetPasswordRequest(email: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'pamiloapp://(auth)/reset-password', // Sesuaikan dengan skema URL redirect aplikasi Tuan Master
    });

    if (error) {
      throw new Error(error.message);
    }
    return data;
  },

  /**
   * Memperbarui Kata Sandi Pengguna ke yang Baru
   */
  async updatePassword(password: string) {
    const { data, error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      throw new Error(error.message);
    }
    return data;
  }
};