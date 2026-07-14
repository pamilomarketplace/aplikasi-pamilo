// features/location/useCurrentLocation.ts
import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

export const useCurrentLocation = () => {
  const [locationName, setLocationName] = useState<string>('Mencari GPS...');
  const [loadingLocation, setLoadingLocation] = useState<boolean>(true);

  useEffect(() => {
    const dapatkanLokasiRiilWarga = async () => {
      try {
        setLoadingLocation(true);

        // 1. Minta izin akses pintu GPS ke sistem HP Warga
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('[GPS RADAR] Izin akses GPS ditolak pengguna.');
          setLocationName('Ciamis');
          setLoadingLocation(false);
          return;
        }

        // 2. Ambil koordinat presisi dari satelit HP
        const posisiSekarang = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        
        const { latitude, longitude } = posisiSekarang.coords;

        // 3. Tembak reverse geocode ke OpenStreetMap untuk menyaring nama kelurahan/desa
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
          { headers: { 'User-Agent': 'PAMILO_Marketplace_Ciamis_App_Production' } }
        );
        const data = await response.json();

        if (data && data.address) {
          const addr = data.address;
          
          // Hirarki penyaringan daerah: Desa -> Kelurahan -> Kecamatan -> Kabupaten
          const namaLokasiLokal = addr.village || addr.suburb || addr.town || addr.city_district || 'Ciamis';
          
          console.log(`[GPS RADAR] 🎯 Posisi Riil Warga Terdeteksi: ${namaLokasiLokal}`);
          setLocationName(namaLokasiLokal);
        } else {
          setLocationName('Ciamis');
        }
      } catch (err) {
        console.error('[GPS RADAR ERROR] Gagal melacak satelit:', err);
        setLocationName('Ciamis'); // Fallback aman jika kuota internet tipis / offline
      } finally {
        setLoadingLocation(false);
      }
    };

    dapatkanLokasiRiilWarga();
  }, []);

  return { locationName, loadingLocation };
};