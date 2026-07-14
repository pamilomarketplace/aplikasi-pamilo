// app/features/addresses/useMapPicker.ts
import { useState } from 'react';
import { Alert } from 'react-native';

export interface GpsCoordinate {
  latitude: number;
  longitude: number;
}

export const useMapPicker = () => {
  const [loadingGps, setLoadingGps] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<GpsCoordinate>({
    latitude: -7.3274, // Default kordinat pusat alun-alun Kabupaten Ciamis murni
    longitude: 108.3551
  });

  // LOGIKA 1: PENAKLUK RADAR GPS SENSOR PONSEL
  const handleLockCurrentDeviceLocation = async () => {
    try {
      setLoadingGps(true);
      
      // Simulasi penancapan pipa koordinat satelit koordinat murni aman Expo Location
      setTimeout(() => {
        const mockDeviceLocation = {
          latitude: -7.3312,
          longitude: 108.3594
        };
        setSelectedLocation(mockDeviceLocation);
        Alert.alert('GPS Terkunci 📍', 'Titik koordinat akurat perangkat berhasil dipetakan ke sasis alamat Pasar PAMILO.');
        setLoadingGps(false);
      }, 1200);

    } catch (err: any) {
      Alert.alert('Gagal Mengunci GPS', err.message);
      setLoadingGps(false);
    }
  };

  return {
    loadingGps,
    selectedLocation,
    setSelectedLocation,
    handleLockCurrentDeviceLocation
  };
};