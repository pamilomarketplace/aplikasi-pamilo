// features/register/useRegisterSeller.ts
import { useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/utils/supabaseClient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { decode } from 'base64-arraybuffer';
import MapView from 'react-native-maps';

export const useRegisterSeller = () => {
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [statusPendaftaran, setStatusPendaftaran] = useState<'BELUM' | 'MENUNGGU' | 'DITERIMA'>('BELUM');

  const [namaToko, setNamaToko] = useState('');
  const [kategori, setKategori] = useState('Pamilo Food');
  const [whatsapp, setWhatsapp] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [jamOperasional, setJamOperasional] = useState('08:00 - 20:00');
  const [kecamatan, setKecamatan] = useState('');
  const [desa, setDesa] = useState('');
  const [detailJalan, setDetailJalan] = useState('');
  
  const [fotoToko, setFotoToko] = useState<string | null>(null);
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isMapVisible, setIsMapVisible] = useState(false);
  const [tempLat, setTempLat] = useState(-7.3274); // Default Ciamis
  const [tempLng, setTempLng] = useState(108.3532);

  useEffect(() => {
    const checkStatus = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      setUserId(authData.user.id);

      // Mengecek langsung ke tabel toko sesuai skema
      const { data: tokoData } = await supabase
        .from('toko')
        .select('is_verified')
        .eq('user_id_toko', authData.user.id)
        .maybeSingle();

      if (tokoData) {
        setStatusPendaftaran(tokoData.is_verified ? 'DITERIMA' : 'MENUNGGU');
      }
      
      setLoading(false);
    };
    checkStatus();
  }, []);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setFotoToko(result.assets[0].uri);
      setFotoBase64(result.assets[0].base64);
    }
  };

  const bukaPeta = async () => {
    setIsMapVisible(true);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      let location = await Location.getCurrentPositionAsync({});
      setTempLat(location.coords.latitude);
      setTempLng(location.coords.longitude);
    }
  };

  const konfirmasiLokasi = () => {
    setLatitude(tempLat);
    setLongitude(tempLng);
    setIsMapVisible(false);
  };

  const handleSubmit = async () => {
    if (!namaToko || !whatsapp || !kecamatan || !desa || !detailJalan || !latitude || !fotoBase64 || !userId) {
      Alert.alert('Data Belum Lengkap', 'Mohon isi semua form, pilih foto toko, dan kunci lokasi di Peta.');
      return;
    }

    setSubmitting(true);
    try {
      const fileExt = 'jpg';
      const fileName = `toko_${userId}_${Date.now()}.${fileExt}`;
      const filePath = `foto_toko/${fileName}`;

      // Upload ke bucket berkas-mitra sesuai instruksi
      const { error: uploadError } = await supabase.storage
        .from('berkas-mitra')
        .upload(filePath, decode(fotoBase64), { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('berkas-mitra').getPublicUrl(filePath);
      
      // Insert langsung ke tabel toko sesuai skema yang diberikan
      const alamatLengkap = `${detailJalan}, Desa ${desa}, Kec. ${kecamatan}, Ciamis`;
      
      const { error: insertError } = await supabase.from('toko').insert({
        user_id_toko: userId,
        nama_toko: namaToko,
        kategori_toko: kategori,
        whatsapp_toko: whatsapp,
        deskripsi: deskripsi,
        jam_operasional: jamOperasional,
        alamat_toko: alamatLengkap,
        kecamatan_toko: kecamatan,
        desa_toko: desa,
        detail_jalan_toko: detailJalan,
        latitude_toko: latitude,
        longitude_toko: longitude,
        foto_toko: urlData.publicUrl,
        is_verified: false,
        status_toko: 'TUTUP',
        kota_toko: 'Kabupaten Ciamis' // Mengikuti nilai default skema
      });

      if (insertError) throw insertError;

      Alert.alert('Pendaftaran Berhasil! 🎉', 'Data Toko Anda sedang ditinjau oleh Admin PAMILO. Mohon bersabar.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/profile' as any) }
      ]);
    } catch (error: any) {
      Alert.alert('Gagal Mendaftar', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return {
    loading, submitting, statusPendaftaran, router, mapRef,
    namaToko, setNamaToko, kategori, setKategori, whatsapp, setWhatsapp,
    deskripsi, setDeskripsi, jamOperasional, setJamOperasional,
    kecamatan, setKecamatan, desa, setDesa, detailJalan, setDetailJalan,
    fotoToko, latitude, longitude, isMapVisible, setIsMapVisible,
    tempLat, setTempLat, tempLng, setTempLng,
    pickImage, bukaPeta, konfirmasiLokasi, handleSubmit
  };
};