// app/addresses/map-picker.tsx
import React from 'react';
// 🚀 PERBAIKAN: Menyuntikkan Alert ke dalam destructuring import dari react-native
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, StatusBar, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMapPicker } from '@/features/addresses/useMapPicker';

export default function MapPickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { loadingGps, selectedLocation, handleLockCurrentDeviceLocation } = useMapPicker();

  return (
    <View style={[styles.mainContainer, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor="#4A3420" />

      {/* HEADER ATAS PETA */}
      <View style={[styles.customNavBar, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.navBarTitle}>Tancap Pin Koordinat Kurir 🗺️</Text>
        <View style={{ width: 35 }} />
      </View>

      {/* VIEWPORT CANVAS MAP */}
      <View style={styles.mapCanvasViewport}>
        <Ionicons name="location-sharp" size={48} color="#E28743" style={styles.centerPinIconStack} />
        
        <TouchableOpacity style={styles.floatingGpsBtn} onPress={handleLockCurrentDeviceLocation}>
          {loadingGps ? <ActivityIndicator size="small" color="#4A3420" /> : <Ionicons name="locate" size={22} color="#4A3420" />}
        </TouchableOpacity>
      </View>

      {/* BAR PANEL DIALOG */}
      <View style={styles.footerPanelDetails}>
        <Text style={styles.detailsHeadingText}>Rincian Geospasial Terkunci</Text>
        <View style={styles.coordinateRowGrid}>
          <Text style={styles.geoValueText}>Lat: {selectedLocation.latitude.toFixed(5)}</Text>
          <Text style={styles.geoValueText}>Lng: {selectedLocation.longitude.toFixed(5)}</Text>
        </View>

        <TouchableOpacity 
          style={styles.btnConfirmCoordinateSave}
          onPress={() => {
            Alert.alert('Selesai ✨', 'Titik koordinat pin resmi disimpan ke form alamat utama warga.');
            router.back();
          }}
        >
          <Text style={styles.textBtnConfirmMap}>Gunakan Lokasi Ini</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FAF6F0' },
  customNavBar: { backgroundColor: '#4A3420', height: 95, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, elevation: 4 },
  backBtn: { width: 35, height: 40, justifyContent: 'center' },
  navBarTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  mapCanvasViewport: { flex: 1, backgroundColor: '#E0D0C0', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  centerPinIconStack: { marginBottom: 48 },
  floatingGpsBtn: { position: 'absolute', right: 16, bottom: 20, width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 4, borderWidth: 1, borderColor: '#E0D0C0' },
  footerPanelDetails: { backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E0D0C0', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, gap: 4 },
  detailsHeadingText: { fontSize: 13, fontWeight: 'bold', color: '#4A3420' },
  coordinateRowGrid: { flexDirection: 'row', gap: 14, marginVertical: 4 },
  geoValueText: { fontSize: 11, color: '#A1887F', backgroundColor: '#FAF6F0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 0.5, borderColor: '#E0D0C0', fontWeight: '600' },
  btnConfirmCoordinateSave: { backgroundColor: '#E28743', height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginTop: 10, elevation: 1 },
  textBtnConfirmMap: { color: '#FFF', fontSize: 12, fontWeight: 'bold' }
});