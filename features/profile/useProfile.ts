// features/profile/useProfile.ts
import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/utils/supabaseClient';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

export const useProfile = () => {
  const [profile, setProfile] = useState<any | null>(null);
  const [address, setAddress] = useState<any | null>(null);
  const [bankAccount, setBankAccount] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Status indikator mutasi mesin logic
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // 📡 FUNGSI INTI: Penarik Data Massal
  const loadAllAccountData = useCallback(async (targetId: string) => {
    try {
      setLoading(true);
      setError(null);

      const [usersRes, addressRes, bankRes] = await Promise.all([
        supabase.from('users').select('*').eq('user_id', targetId),
        supabase.from('user_addresses').select('*').eq('user_id', targetId).order('is_utama', { ascending: false }),
        supabase.from('user_bank_accounts').select('*').eq('user_id', targetId)
      ]);

      if (usersRes.error) throw usersRes.error;
      if (addressRes.error) throw addressRes.error;
      if (bankRes.error) throw bankRes.error;

      if (usersRes.data && usersRes.data.length > 0) {
        setProfile(usersRes.data[0]);
      } else {
        setProfile(null);
      }
      
      if (addressRes.data && addressRes.data.length > 0) {
        setAddress(addressRes.data[0]);
      } else {
        setAddress(null);
      }

      if (bankRes.data && bankRes.data.length > 0) {
        setBankAccount(bankRes.data[0]);
      } else {
        setBankAccount(null);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal menyedot data akun');
    } finally {
      setLoading(false);
    }
  }, []);

  // 1. Pipa Pemantau Sesi Login Warga
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const id = session?.user?.id || null;
      setUserId(id);
      if (id) loadAllAccountData(id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const id = session?.user?.id || null;
      setUserId(id);
      if (id) loadAllAccountData(id);
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [loadAllAccountData]);

  // 2. Pipa Otomatis Realtime jika ada pembaruan data di tabel users
  useEffect(() => {
    if (!userId) return;

    let realtimeChannel: any = null;
    const uniqueChannel = `profile_dashboard_${userId}_${Math.random().toString(36).substring(7)}`;

    realtimeChannel = supabase
      .channel(uniqueChannel)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `user_id=eq.${userId}` }, () => {
        loadAllAccountData(userId);
      })
      .subscribe();

    return () => {
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    };
  }, [userId, loadAllAccountData]);

  const handleManualRefetch = () => {
    if (userId) loadAllAccountData(userId);
  };

  // 🌟 FUNGSI LOGIKA AKSI 1: MEMPERBARUI NAMA KE TABEL USERS
  const updateProfileName = async (inputName: string) => {
    if (!inputName.trim()) {
      Alert.alert('Perhatian', 'Nama tidak boleh kosong!');
      return false;
    }
    try {
      setSaving(true);
      const { error: updateError } = await supabase
        .from('users')
        .update({ user_name: inputName })
        .eq('user_id', userId);

      if (updateError) throw updateError;
      Alert.alert('Sukses', 'Nama profil berhasil diperbarui.');
      handleManualRefetch();
      return true;
    } catch (err: any) {
      Alert.alert('Gagal', err.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  // 🌟 FUNGSI LOGIKA AKSI 2: IMAGE PICKER & STORAGE UPLOAD (SINKRON ULTRA-INSTAN & AMAN TS)
  const uploadAvatarPhoto = async () => {
    const targetUserId = profile?.user_id || userId;
    
    if (!targetUserId) {
      Alert.alert('Perhatian', 'UUID Warga tidak terdeteksi di dalam sasis.');
      return;
    }

    try {
      // 1. Meminta Akses Galeri HP
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Akses Ditolak', 'Aplikasi memerlukan izin galeri untuk mengganti foto profil!');
        return;
      }

      // 2. Buka Galeri & Pilih Gambar Instan
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // 🚀 KUNCI INSTAN: Diubah jadi false agar langsung terunggah tanpa layar potong yang membingungkan
        quality: 0.3, // 🔥 ULTRA-COMPRESSION: Ukuran avatar menyusut drastis, menghemat kapasitas storage pamilo-assets
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const assetTarget = result.assets[0];
      
      // 🚀 TAMENG TYPESCRIPT: Ekstraksi string lokal konstan untuk memotong potensi nilai undefined/null
      const base64DataData = assetTarget.base64;
      if (!base64DataData) {
        Alert.alert('Gagal', 'Data biner kompresi gambar tidak ditemukan oleh sistem HP.');
        return;
      }

      setUploadingPhoto(true);
      const fileExt = assetTarget.uri.split('.').pop() || 'jpg';
      const filePath = `avatars/${targetUserId}/profile_${Date.now()}.${fileExt}`;

      // 3. Jalankan Operasi Unggah ke Storage Bucket 'pamilo-assets'
      const { error: uploadError } = await supabase.storage
        .from('pamilo-assets')
        .upload(filePath, decode(base64DataData), {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // 4. Ambil URL Publik Gambar
      const { data: urlData } = supabase.storage
        .from('pamilo-assets')
        .getPublicUrl(filePath);

      const publicUrl = urlData?.publicUrl;

      // Ambil data sesi auth internal sebagai tameng cadangan data kosong
      const { data: { user: authUser } } = await supabase.auth.getUser();

      // 5. Mengubah .update() menjadi .upsert() terproteksi bawaan Tuan Master
      const { data: upsertData, error: upsertTableError } = await supabase
        .from('users')
        .upsert({
          user_id: targetUserId,
          user_avatar: publicUrl,
          user_email: profile?.user_email || authUser?.email || '-',
          user_name: profile?.user_name || authUser?.user_metadata?.user_name || 'Warga PAMILO',
          user_phone: profile?.user_phone || authUser?.phone || 'BELUM_ISI',
          saldo: profile?.saldo || 0,
          kode_referral_saya: profile?.kode_referral_saya || `PML-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          role: profile?.role || 'WARGA',
          is_driver: profile?.is_driver || false
        }, { onConflict: 'user_id' })
        .select();

      if (upsertTableError) throw upsertTableError;

      console.log('[PAMILO DATABASE] 📝 Sukses Sinkronisasi Avatar Lapis Baja:', upsertData);

      Alert.alert('Sukses 🎉', 'Foto profil warga berhasil diperbarui!');
      handleManualRefetch(); 
    } catch (err: any) {
      console.error('[PAMILO AVATAR ERROR]', err.message);
      Alert.alert('Gagal Mengubah Foto', err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // 🌟 FUNGSI LOGIKA AKSI 3: KELUAR SISTEM
  const executeSignOut = async () => {
    await supabase.auth.signOut();
  };

  return { 
    profile, 
    address, 
    bankAccount, 
    loading, 
    error, 
    refetch: handleManualRefetch,
    saving,
    uploadingPhoto,
    updateProfileName,
    uploadAvatarPhoto,
    executeSignOut
  };
};