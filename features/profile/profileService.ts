// features/profile/profileService.ts
import { supabase } from '@/utils/supabaseClient';

export const profileService = {
  /**
   * Mengambil data profil, status mitra toko, dan status driver secara paralel
   */
  async getFullProfileData(userId: string) {
    const [resUser, resToko, resDriver] = await Promise.all([
      supabase.from('users').select('user_name, role, user_avatar, is_seller, is_driver').eq('user_id', userId).maybeSingle(),
      supabase.from('toko').select('id_toko, is_verified').eq('user_id_toko', userId).maybeSingle(),
      supabase.from('drivers').select('id_driver, is_verified').eq('user_id_driver', userId).maybeSingle()
    ]);

    if (resUser.error) throw new Error(resUser.error.message);

    // Hitung status verifikasi Mitra Toko
    let statusMitra: 'BELUM_DAFTAR' | 'PENDING' | 'APPROVED' | 'REJECTED' = 'BELUM_DAFTAR';
    if (resUser.data?.is_seller === true || resToko.data?.is_verified === true || resUser.data?.role === 'ADMIN') {
      statusMitra = 'APPROVED';
    } else if (resToko.data) {
      statusMitra = 'PENDING';
    }

    // Hitung status verifikasi Driver Migo
    let statusDriver: 'BELUM_DAFTAR' | 'PENDING' | 'APPROVED' | 'REJECTED' = 'BELUM_DAFTAR';
    if (resUser.data?.is_driver === true || resDriver.data?.is_verified === true || resUser.data?.role === 'ADMIN') {
      statusDriver = 'APPROVED';
    } else if (resDriver.data) {
      statusDriver = 'PENDING';
    }

    return {
      profile: resUser.data,
      statusMitra,
      statusDriver
    };
  },

  /**
   * Memperbarui nama lengkap pengguna
   */
  async updateProfileName(userId: string, newName: string) {
    const { error } = await supabase
      .from('users')
      .update({ user_name: newName })
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  },

  /**
   * Mengunggah berkas avatar biner ke Supabase Storage Bucket
   */
  async uploadAvatarStorage(userId: string, uriLokal: string) {
    const formatFile = uriLokal.split('.').pop() || 'jpg';
    const namaFileUnik = `avatars/usr_${userId}_${Date.now()}.${formatFile}`;
    
    const formData = new FormData();
    formData.append('file', {
      uri: uriLokal,
      name: namaFileUnik,
      type: `image/${formatFile === 'jpg' ? 'jpeg' : formatFile}`
    } as any);

    const { error: uploadError } = await supabase.storage
      .from('pamilo-assets')
      .upload(namaFileUnik, formData, { contentType: 'multipart/form-data', upsert: true });

    if (uploadError) throw uploadError;

    const { data: urlPublik } = supabase.storage.from('pamilo-assets').getPublicUrl(namaFileUnik);
    
    // Simpan link publik tersebut ke kolom user_avatar di tabel users
    const { error: updateError } = await supabase
      .from('users')
      .update({ user_avatar: urlPublik.publicUrl })
      .eq('user_id', userId);

    if (updateError) throw updateError;

    return urlPublik.publicUrl;
  },

  /**
   * Menghapus akun permanen lewat sistem Remote Procedure Call (RPC) database
   */
  async deleteAccountPermanently() {
    const { error } = await supabase.rpc('hapus_akun_pamilo_permanen');
    if (error) throw error;
    return true;
  }
};