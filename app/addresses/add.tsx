// app/addresses/add.tsx
import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Switch, ActivityIndicator, StatusBar, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
// Mengonsumsi pipa mesin logika formulir terisolasi
import { useAddAddress } from '@/features/addresses/useAddAddress';

export default function AddAddressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    label, setLabel,
    namaPenerima, setNamaPenerima,
    detailLengkap, setDetailLengkap,
    isUtama, setIsUtama,
    region, setRegion,
    updateAddressTextFromCoords,
    searchQuery, setSearchQuery,
    isSearching, isFetchingGPS,
    handleSearchLocation,
    handleGetGPSLocation,
    isSubmitting,
    handleSaveAddress
  } = useAddAddress();

  const executeSubmit = async () => {
    const hasil = await handleSaveAddress();
    if (hasil.success) {
      router.back();
    } else {
      Alert.alert('Gagal Menyimpan Alamat ❌', hasil.message);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.mainContainer}
    >
      <StatusBar barStyle="light-content" backgroundColor="#4A3420" />

      {/* NAVIGASI HEADER ATAS */}
      <View style={[styles.customNavBar, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.navBarTitle}>Tambah Alamat Baru</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
        
        {/* FORM PENCARIAN PETA */}
        <Text style={styles.inputLabel}>Cari Alamat / Patokan Jalan 🔍</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInputField}
            placeholder="Ketik lokasi (Misal: Alun-alun Ciamis, Jl. Juanda)..."
            placeholderTextColor="#A1887F"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchLocation}
          />
          <TouchableOpacity 
            style={styles.btnSearchExecute} 
            onPress={handleSearchLocation}
            disabled={isSearching}
          >
            {isSearching ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="search" size={20} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>

        {/* PETA INTERAKTIF + TOMBOL DETEKSI GPS */}
        <View style={styles.mapWrapper}>
          <MapView
            style={styles.map}
            region={region}
            onRegionChangeComplete={async (newRegion, details) => {
              setRegion(newRegion);
              // 🚀 KUNCI PERBAIKAN: Hanya timpa alamat teks jika dipicu geseran tangan asli warga (isGesture)
              // Langkah ini mencegah keyboard mereset/mengunci teks pengetikan manual Tuan Master
              if (details?.isGesture) {
                await updateAddressTextFromCoords(newRegion.latitude, newRegion.longitude);
              }
            }}
          >
            <Marker
              coordinate={{ latitude: region.latitude, longitude: region.longitude }}
              draggable
              onDragEnd={async (e) => {
                const lat = e.nativeEvent.coordinate.latitude;
                const lon = e.nativeEvent.coordinate.longitude;
                setRegion({ ...region, latitude: lat, longitude: lon });
                await updateAddressTextFromCoords(lat, lon);
              }}
              title="Lokasi Pengantaran"
            />
          </MapView>
          
          {/* Jarum Pointer Penanda Tepat di Tengah Peta */}
          <View style={styles.mapPinOverlay}>
            <Ionicons name="location" size={32} color="#E74C3C" />
          </View>

          {/* TOMBOL PENGAMBILAN GPS SMARTPHONE */}
          <TouchableOpacity 
            style={styles.floatingGpsBtn} 
            onPress={handleGetGPSLocation}
            disabled={isFetchingGPS}
            activeOpacity={0.8}
          >
            {isFetchingGPS ? (
              <ActivityIndicator size="small" color="#4A3420" />
            ) : (
              <Ionicons name="locate" size={22} color="#4A3420" />
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.mapHint}>📍 Lat: {region.latitude.toFixed(6)} | Lon: {region.longitude.toFixed(6)}</Text>

        {/* PILIHAN LABEL KATEGORI (BERSIH DARI TYPO VARIABEL) */}
        <Text style={styles.inputLabel}>Label Tempat</Text>
        <View style={styles.selectorRow}>
          {(['RUMAH', 'KANTOR', 'LAINNYA'] as const).map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.selectorTab, label === item && styles.selectorTabActive]}
              onPress={() => setLabel(item)}
            >
              <Text style={[styles.selectorTabText, label === item && styles.selectorTabTextActive]}>
                {item === 'RUMAH' ? '🏠 Rumah' : item === 'KANTOR' ? '💼 Kantor' : '📍 Lainnya'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* INPUT DATA PENERIMA */}
        <Text style={styles.inputLabel}>Nama Penerima Paket</Text>
        <TextInput
          style={styles.textInputField}
          placeholder="Contoh: Kang Cecep Galuh"
          placeholderTextColor="#A1887F"
          value={namaPenerima}
          onChangeText={setNamaPenerima}
        />

        {/* INPUT DETAIL ALAMAT JALAN LENGKAP (KINI BEBAS DIEDIT SECARA DINAMIS) */}
        <Text style={styles.inputLabel}>Detail Alamat Lengkap & Patokan Jalan</Text>
        <TextInput
          style={[styles.textInputField, styles.textAreaField]}
          placeholder="Geser peta atau tulis manual nama jalan, nomor rumah, RT/RW, kelurahan, kecamatan..."
          placeholderTextColor="#A1887F"
          multiline
          numberOfLines={4}
          value={detailLengkap}
          onChangeText={setDetailLengkap} // Kini berjalan murni tanpa interupsi
        />

        {/* SWITCH OPSI ALAMAT UTAMA */}
        <View style={styles.switchCardContainer}>
          <View style={styles.switchTextCol}>
            <Text style={styles.switchMainTitle}>Jadikan Alamat Utama</Text>
            <Text style={styles.switchSubTitle}>Setiap checkout belanjaan otomatis dikirim ke titik koordinat lokasi ini.</Text>
          </View>
          <Switch
            trackColor={{ false: '#E0D0C0', true: '#C0A995' }}
            thumbColor={isUtama ? '#4A3420' : '#FAF6F0'}
            onValueChange={setIsUtama}
            value={isUtama}
          />
        </View>

      </ScrollView>

      {/* FLOATING ACTION BOTTOM BUTTON */}
      <View style={[styles.bottomActionContainer, { paddingBottom: insets.bottom + 14 }]}>
        <TouchableOpacity
          style={[styles.btnSimpanAlamat, isSubmitting && styles.btnSimpanDisabled]}
          onPress={executeSubmit}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.btnSimpanText}>Simpan & Kunci Alamat 🏁</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FAF6F0' },
  customNavBar: { backgroundColor: '#4A3420', height: 90, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, elevation: 4 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  navBarTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  scrollBody: { padding: 16, paddingBottom: 120 },
  
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  searchInputField: { flex: 1, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E0D0C0', borderRadius: 12, paddingHorizontal: 14, height: 44, fontSize: 13, color: '#4A3420' },
  btnSearchExecute: { backgroundColor: '#4A3420', width: 46, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 1 },

  mapWrapper: { height: 200, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#E0D0C0', marginBottom: 4, position: 'relative', elevation: 1 },
  map: { flex: 1 },
  mapPinOverlay: { position: 'absolute', top: '50%', left: '50%', marginTop: -26, marginLeft: -16, pointerEvents: 'none' },
  floatingGpsBtn: { position: 'absolute', bottom: 12, right: 12, backgroundColor: '#FFF', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 4, borderWidth: 1, borderColor: '#E0D0C0' },
  mapHint: { fontSize: 10, fontFamily: 'monospace', color: '#7A6450', fontWeight: 'bold', marginBottom: 12, paddingLeft: 2 },

  inputLabel: { fontSize: 11, fontWeight: 'bold', color: '#7A6450', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10, marginBottom: 8, paddingLeft: 2 },
  textInputField: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E0D0C0', borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 13, color: '#4A3420', marginBottom: 4 },
  textAreaField: { height: 90, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
  
  selectorRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  selectorTab: { flex: 1, height: 42, backgroundColor: '#FFF', borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E0D0C0', elevation: 1 },
  selectorTabActive: { backgroundColor: '#4A3420', borderColor: '#4A3420', elevation: 2 },
  selectorTabText: { fontSize: 12, fontWeight: '600', color: '#7A6450' },
  selectorTabTextActive: { color: '#FFF', fontWeight: 'bold' },
  
  switchCardContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E0D0C0', marginTop: 18, elevation: 1 },
  switchTextCol: { flex: 1, paddingRight: 16 },
  switchMainTitle: { fontSize: 13, fontWeight: 'bold', color: '#4A3420' },
  switchSubTitle: { fontSize: 10, color: '#A1887F', marginTop: 2, lineHeight: 14, fontWeight: '500' },
  
  bottomActionContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E0D0C0', elevation: 8 },
  btnSimpanAlamat: { backgroundColor: '#E28743', height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  btnSimpanDisabled: { backgroundColor: '#C0A995', elevation: 0 },
  btnSimpanText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' }
});