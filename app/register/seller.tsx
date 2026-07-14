// app/register/seller.tsx
import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Image, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRegisterSeller } from '@/features/register/useRegisterSeller';

export default function RegisterSellerScreen() {
  const insets = useSafeAreaInsets();
  
  // MENGONSUMSI HOOK LOGIKA
  const {
    loading, submitting, statusPendaftaran, router, mapRef,
    namaToko, setNamaToko, kategori, setKategori, whatsapp, setWhatsapp,
    deskripsi, setDeskripsi, jamOperasional, setJamOperasional,
    kecamatan, setKecamatan, desa, setDesa, detailJalan, setDetailJalan,
    fotoToko, latitude, longitude, isMapVisible,
    tempLat, setTempLat, tempLng, setTempLng,
    pickImage, bukaPeta, konfirmasiLokasi, handleSubmit
  } = useRegisterSeller();

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#4A3420" /></View>;

  if (statusPendaftaran === 'MENUNGGU') {
    return (
      <View style={styles.center}>
        <Ionicons name="time-outline" size={80} color="#E28743" />
        <Text style={styles.waitTitle}>Menunggu Verifikasi</Text>
        <Text style={styles.waitSub}>Berkas pendaftaran UMKM Anda sedang ditinjau secara manual oleh Admin PAMILO. Mohon cek kembali nanti.</Text>
        <TouchableOpacity style={styles.btnBack} onPress={() => router.back()}><Text style={styles.btnBackText}>Kembali</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF6F0" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}><Text style={styles.headerTitle}>Pendaftaran Mitra Toko</Text></View>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.label}>Nama Toko / Usaha</Text>
        <TextInput style={styles.input} placeholder="Contoh: Seblak Mang Ujang" value={namaToko} onChangeText={setNamaToko} />

        <Text style={styles.label}>Kluster Kategori</Text>
        <View style={styles.kategoriRow}>
          {/* PERUBAHAN: Hanya menampilkan 3 kategori utama PAMILO */}
          {['Pamilo Food', 'Pamilo Mart', 'Pamilo Service'].map(kat => (
            <TouchableOpacity key={kat} style={[styles.katBtn, kategori === kat && styles.katBtnActive]} onPress={() => setKategori(kat)}>
              <Text style={[styles.katBtnText, kategori === kat && styles.katBtnTextActive]}>{kat}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Nomor WhatsApp Aktif</Text>
        <TextInput style={styles.input} placeholder="08123456789" keyboardType="phone-pad" value={whatsapp} onChangeText={setWhatsapp} />
        
        <Text style={styles.label}>Jam Operasional</Text>
        <TextInput style={styles.input} placeholder="08:00 - 20:00" value={jamOperasional} onChangeText={setJamOperasional} />
        
        <Text style={styles.label}>Deskripsi Singkat</Text>
        <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Jelaskan apa yang Anda jual..." multiline value={deskripsi} onChangeText={setDeskripsi} />

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Titik Lokasi & Alamat</Text>

        <TouchableOpacity style={styles.mapBtn} onPress={bukaPeta}>
          <Ionicons name="location" size={24} color="#E74C3C" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.mapBtnTitle}>{latitude ? "Koordinat GPS Terkunci" : "Set Lokasi Toko di Peta"}</Text>
            <Text style={styles.mapBtnSub}>{latitude ? `${latitude}, ${longitude}` : "Wajib untuk hitungan ongkir Migo"}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#A1887F" />
        </TouchableOpacity>

        <Text style={styles.label}>Kecamatan</Text>
        <TextInput style={styles.input} placeholder="Contoh: Ciamis" value={kecamatan} onChangeText={setKecamatan} />
        <Text style={styles.label}>Desa / Kelurahan</Text>
        <TextInput style={styles.input} placeholder="Contoh: Sindangrasa" value={desa} onChangeText={setDesa} />
        <Text style={styles.label}>Detail Jalan / Patokan</Text>
        <TextInput style={styles.input} placeholder="Contoh: Jl. Sudirman No 12, Pagar Hitam" value={detailJalan} onChangeText={setDetailJalan} />

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Foto Depan Toko</Text>
        <TouchableOpacity style={styles.photoBox} onPress={pickImage}>
          {fotoToko ? <Image source={{ uri: fotoToko }} style={styles.photoImg} /> : <><Ionicons name="camera" size={30} color="#A1887F" /><Text style={styles.photoText}>Klik untuk Unggah Foto</Text></>}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btnSubmit, submitting && styles.btnDisabled]} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnSubmitText}>Kirim Formulir Pendaftaran</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL PETA LOKASI */}
      <Modal visible={isMapVisible} animationType="slide">
        <View style={styles.mapContainer}>
          <MapView 
            ref={mapRef} style={styles.mapView} provider={PROVIDER_DEFAULT}
            initialRegion={{ latitude: tempLat, longitude: tempLng, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
            onRegionChangeComplete={(region) => { setTempLat(region.latitude); setTempLng(region.longitude); }}
          />
          <View style={styles.centerPinMarker}><Ionicons name="location" size={46} color="#E74C3C" /></View>
          <View style={styles.mapHeader}><Text style={styles.mapHeaderText}>Geser Peta ke Titik Toko Anda</Text></View>
          <View style={styles.mapFooter}>
            <TouchableOpacity style={styles.btnConfirmMap} onPress={konfirmasiLokasi}><Text style={styles.btnConfirmMapText}>Kunci Koordinat Ini</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF6F0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#FAF6F0' },
  waitTitle: { fontSize: 20, fontWeight: 'bold', color: '#4A3420', marginTop: 16 },
  waitSub: { fontSize: 14, color: '#7A6450', textAlign: 'center', marginTop: 8, lineHeight: 22 },
  btnBack: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#E28743', borderRadius: 10 },
  btnBackText: { color: '#FFF', fontWeight: 'bold' },
  header: { backgroundColor: '#FFF', paddingBottom: 16, alignItems: 'center', elevation: 2 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#4A3420' },
  scrollContent: { padding: 20, paddingBottom: 50 },
  label: { fontSize: 12, fontWeight: 'bold', color: '#7A6450', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E0D0C0', borderRadius: 10, paddingHorizontal: 14, height: 48, fontSize: 14, color: '#4A3420' },
  kategoriRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  katBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#E0D0C0', backgroundColor: '#FFF' },
  katBtnActive: { backgroundColor: '#E28743', borderColor: '#E28743' },
  katBtnText: { fontSize: 12, color: '#7A6450' },
  katBtnTextActive: { color: '#FFF', fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#E0D0C0', marginVertical: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#4A3420', marginBottom: 10 },
  mapBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E0D0C0' },
  mapBtnTitle: { fontSize: 14, fontWeight: 'bold', color: '#4A3420' },
  mapBtnSub: { fontSize: 11, color: '#A1887F', marginTop: 2 },
  photoBox: { height: 150, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E0D0C0', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoText: { fontSize: 12, color: '#A1887F', marginTop: 8 },
  btnSubmit: { backgroundColor: '#2ECC71', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 30 },
  btnDisabled: { backgroundColor: '#95A5A6' },
  btnSubmitText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  mapContainer: { flex: 1, backgroundColor: '#FAF6F0' },
  mapView: { ...StyleSheet.absoluteFillObject },
  centerPinMarker: { position: 'absolute', top: '50%', left: '50%', marginTop: -40, marginLeft: -23, zIndex: 10 },
  mapHeader: { position: 'absolute', top: 40, left: 20, right: 20, backgroundColor: '#FFF', padding: 14, borderRadius: 10, elevation: 4, alignItems: 'center' },
  mapHeaderText: { fontWeight: 'bold', color: '#4A3420' },
  mapFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  btnConfirmMap: { backgroundColor: '#E28743', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnConfirmMapText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});