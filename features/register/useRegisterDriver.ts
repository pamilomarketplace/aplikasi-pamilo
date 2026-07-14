// features/register/useRegisterDriver.ts
import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/utils/supabaseClient';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

export const useRegisterDriver = () => {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [statusPendaftaran, setStatusPendaftaran] = useState<'BELUM' | 'MENUNGGU' | 'DITERIMA'>('BELUM');

  const [namaDriver, setNamaDriver] = useState('');
  const [platNomor, setPlatNomor] = useState('');
  const [merekKendaraan, setMerekKendaraan] = useState('');
  const [jenisKendaraan, setJenisKendaraan] = useState<'Motor' | 'Mobil'>('Motor');
  const [kecamatan, setKecamatan] = useState('');
  const [desa, setDesa] = useState('');
  const [detailJalan, setDetailJalan] = useState('');
  
  const [fotoWajah, setFotoWajah] = useState<{ uri: string, base64: string } | null>(null);
  const [fotoSim, setFotoSim] = useState<{ uri: string, base64: string } | null>(null);
  const [fotoStnk, setFotoStnk] = useState<{ uri: string, base64: string } | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      setUserId(authData.user.id);

      const { data: driverData } = await supabase
        .from('drivers')
        .select('is_verified')
        .eq('user_id_driver', authData.user.id)
        .single();

      if (driverData) {
        setStatusPendaftaran(driverData.is_verified ? 'DITERIMA' : 'MENUNGGU');
      }
      setLoading(false);
    };
    checkStatus();
  }, []);

  const pickImage = async (setter: React.Dispatch<React.SetStateAction<any>>) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setter({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
    }
  };

  const uploadToStorage = async (base64String: string, pathPrefix: string) => {
    const fileName = `${pathPrefix}_${userId}_${Date.now()}.jpg`;
    const filePath = `berkas_driver/${fileName}`;
    
    const { error } = await supabase.storage
      .from('berkas-mitra')
      .upload(filePath, decode(base64String), { contentType: 'image/jpeg' });
    
    if (error) throw error;
    const { data } = supabase.storage.from('berkas-mitra').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!namaDriver || !platNomor || !merekKendaraan || !kecamatan || !desa || !detailJalan || !fotoWajah || !fotoSim || !fotoStnk || !userId) {
      Alert.alert('Data Belum Lengkap', 'Mohon isi semua form teks dan unggah ketiga foto persyaratan (Wajah, SIM, STNK).');
      return;
    }

    setSubmitting(true);
    try {
      const [urlWajah, urlSim, urlStnk] = await Promise.all([
        uploadToStorage(fotoWajah.base64, 'wajah'),
        uploadToStorage(fotoSim.base64, 'sim'),
        uploadToStorage(fotoStnk.base64, 'stnk')
      ]);

      const { error: insertError } = await supabase.from('drivers').insert({
        user_id_driver: userId,
        nama_driver: namaDriver,
        plat_nomor: platNomor.toUpperCase(),
        jenis_kendaraan: jenisKendaraan,
        merek_kendaraan: merekKendaraan,
        kecamatan_driver: kecamatan,
        desa_driver: desa,
        detail_jalan_driver: detailJalan,
        foto_wajah: urlWajah,
        foto_sim: urlSim,
        foto_stnk: urlStnk,
        is_verified: false,
        status_driver: 'OFFLINE'
      });

      if (insertError) throw insertError;

      Alert.alert('Pendaftaran Berhasil! 🛵', 'Berkas Driver Migo Anda sedang ditinjau oleh Admin PAMILO. Mohon bersabar.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/profile' as any) }
      ]);
    } catch (error: any) {
      Alert.alert('Gagal Mendaftar', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return {
    loading, submitting, statusPendaftaran, router,
    namaDriver, setNamaDriver, platNomor, setPlatNomor,
    merekKendaraan, setMerekKendaraan, jenisKendaraan, setJenisKendaraan,
    kecamatan, setKecamatan, desa, setDesa, detailJalan, setDetailJalan,
    fotoWajah, setFotoWajah, fotoSim, setFotoSim, fotoStnk, setFotoStnk,
    pickImage, handleSubmit
  };
};