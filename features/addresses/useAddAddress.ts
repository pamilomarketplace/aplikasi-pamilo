// app/features/addresses/useAddAddress.ts
import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/utils/supabaseClient';
import * as Location from 'expo-location';

export const useAddAddress = () => {
  const [label, setLabel] = useState<'RUMAH' | 'KANTOR' | 'LAINNYA'>('RUMAH');
  const [namaPenerima, setNamaPenerima] = useState('');
  const [detailLengkap, setDetailLengkap] = useState('');
  const [isUtama, setIsUtama] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // STATE KOORDINAT PETA (Default Pusat Ciamis Kota)
  const [region, setRegion] = useState({
    latitude: -7.3274,
    longitude: 108.3553,
    latitudeDelta: 0.003,
    longitudeDelta: 0.003,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingGPS, setIsFetchingGPS] = useState(false);

  // 🚀 SINKRONISASI MURNI: Mengonversi koordinat pin menjadi nama jalan/tempat bersih (Tanpa Plus Code)
  const updateAddressTextFromCoords = async (lat: number, lon: number) => {
    try {
      const response = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      if (response && response.length > 0) {
        const place = response[0];
        const komponenAlamat: string[] = [];

        // 🌟 KUNCI FILTER: Mengabaikan string yang mengandung kode acak Google Maps (Plus Code memiliki tanda '+')
        const isValidPlaceName = (text: string | null | undefined) => {
          if (!text) return false;
          return !text.includes('+');
        };

        if (place.street && isValidPlaceName(place.street)) komponenAlamat.push(place.street);
        if (place.name && place.name !== place.street && isValidPlaceName(place.name)) komponenAlamat.push(place.name);
        if (place.district && isValidPlaceName(place.district)) komponenAlamat.push(place.district); 
        if (place.subregion && isValidPlaceName(place.subregion)) komponenAlamat.push(place.subregion); 
        if (place.city && place.city !== place.subregion && isValidPlaceName(place.city)) komponenAlamat.push(place.city);

        const hasilRakitAlamat = komponenAlamat.join(', ');
        setDetailLengkap(hasilRakitAlamat);
      }
    } catch (error) {
      console.log("Gagal reverse geocode koordinat:", error);
    }
  };

  // Fungsi penarik koordinat GPS perangkat keras HP
  const handleGetGPSLocation = useCallback(async (showAlert = false) => {
    try {
      setIsFetchingGPS(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin Dolak', 'Aplikasi membutuhkan akses GPS untuk fitur ini.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.002,
        longitudeDelta: 0.002,
      };

      setRegion(newRegion);
      await updateAddressTextFromCoords(newRegion.latitude, newRegion.longitude);

      if (showAlert) {
        Alert.alert('GPS Berhasil 📍', 'Peta telah digeser ke titik koordinat GPS Anda saat ini.');
      }
    } catch (err: any) {
      Alert.alert('Gagal Deteksi GPS', err.message);
    } finally {
      setIsFetchingGPS(false);
    }
  }, []);

  useEffect(() => {
    handleGetGPSLocation(false);
  }, [handleGetGPSLocation]);

  const handleSearchLocation = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Perhatian', 'Silakan masukkan nama lokasi tujuan pendaftaran, Tuan Master!');
      return;
    }

    try {
      setIsSearching(true);
      const result = await Location.geocodeAsync(searchQuery.trim());
      
      if (result && result.length > 0) {
        const newRegion = {
          latitude: result[0].latitude,
          longitude: result[0].longitude,
          latitudeDelta: 0.003,
          longitudeDelta: 0.003,
        };
        setRegion(newRegion);
        await updateAddressTextFromCoords(newRegion.latitude, newRegion.longitude);
      } else {
        Alert.alert('Tidak Ditemukan', 'Lokasi tidak terdeteksi di server peta.');
      }
    } catch (err: any) {
      Alert.alert('Eror Pencarian', err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveAddress = async () => {
    if (!namaPenerima.trim() || !detailLengkap.trim()) {
      return { success: false, message: 'Seluruh kolom formulir wajib diisi Tuan Master!' };
    }

    try {
      setIsSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sesi terputus, silakan login kembali.');

      const { data: userData, error: userErr } = await supabase
        .from('users')
        .select('user_phone')
        .eq('user_id', user.id)
        .single();

      if (userErr) throw userErr;
      const centralizedPhone = userData?.user_phone || '-';

      if (isUtama) {
        await supabase
          .from('user_addresses')
          .update({ is_utama: false })
          .eq('user_id', user.id);
      }

      const combinedAlamat = `[${namaPenerima.trim()}|${centralizedPhone}] ${detailLengkap.trim()}`;

      const { error } = await supabase.from('user_addresses').insert({
        user_id: user.id,
        label_alamat: label,
        alamat_lengkap: combinedAlamat,
        latitude: region.latitude,
        longitude: region.longitude,
        is_utama: isUtama
      });

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    label, setLabel,
    namaPenerima, setNamaPenerima,
    detailLengkap, setDetailLengkap,
    isUtama, setIsUtama,
    region, setRegion,
    updateAddressTextFromCoords,
    searchQuery, setSearchQuery,
    isSearching, isFetchingGPS,
    handleSearchLocation,
    handleGetGPSLocation: () => handleGetGPSLocation(true),
    isSubmitting,
    handleSaveAddress
  };
};