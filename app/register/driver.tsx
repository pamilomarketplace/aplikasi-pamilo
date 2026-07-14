// app/register/driver.tsx
import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Image, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRegisterDriver } from '@/features/register/useRegisterDriver';

export default function RegisterDriverScreen() {
  const insets = useSafeAreaInsets();
  
  // MENGONSUMSI HOOK LOGIKA
  const {
    loading, submitting, statusPendaftaran, router,
    namaDriver, setNamaDriver, platNomor, setPlatNomor,
    merekKendaraan, setMerekKendaraan, jenisKendaraan, setJenisKendaraan,
    kecamatan, setKecamatan, desa, setDesa, detailJalan, setDetailJalan,
    fotoWajah, setFotoWajah, fotoSim, setFotoSim, fotoStnk, setFotoStnk,
    pickImage, handleSubmit
  } = useRegisterDriver();

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#4A3420" /></View>;

  if (statusPendaftaran === 'MENUNGGU') {
    return (
      <View style={styles.center}>
        <Ionicons name="time-outline" size={80} color="#E28743" />
        <Text style={styles.waitTitle}>Menunggu Verifikasi</Text>
        <Text style={styles.waitSub}>Berkas pendaftaran Driver Migo Anda sedang dalam antrean pengecekan manual oleh Admin PAMILO.</Text>
        <TouchableOpacity style={styles.btnBack} onPress={() => router.back()}><Text style={styles.btnBackText}>Kembali</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF6F0" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}><Text style={styles.headerTitle}>Pendaftaran Mitra Migo</Text></View>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Pilih Jenis Armada</Text>
        <View style={styles.vehicleRow}>
          <TouchableOpacity style={[styles.vehicleCard, jenisKendaraan === 'Motor' && styles.vehicleCardActive]} onPress={() => setJenisKendaraan('Motor')}>
            <Ionicons name="bicycle" size={40} color={jenisKendaraan === 'Motor' ? '#E28743' : '#C0A995'} />
            <Text style={[styles.vehicleText, jenisKendaraan === 'Motor' && styles.vehicleTextActive]}>Migo Motor</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.vehicleCard, jenisKendaraan === 'Mobil' && styles.vehicleCardActive]} onPress={() => setJenisKendaraan('Mobil')}>
            <Ionicons name="car" size={40} color={jenisKendaraan === 'Mobil' ? '#E28743' : '#C0A995'} />
            <Text style={[styles.vehicleText, jenisKendaraan === 'Mobil' && styles.vehicleTextActive]}>Migo Mobil</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Nama Lengkap (Sesuai KTP)</Text>
        <TextInput style={styles.input} placeholder="Contoh: Budi Santoso" value={namaDriver} onChangeText={setNamaDriver} />

        <Text style={styles.label}>Merek Kendaraan</Text>
        <TextInput style={styles.input} placeholder={jenisKendaraan === 'Motor' ? "Contoh: Honda Vario 150" : "Contoh: Toyota Avanza"} value={merekKendaraan} onChangeText={setMerekKendaraan} />
        
        <Text style={styles.label}>Plat Nomor Kendaraan</Text>
        <TextInput style={styles.input} placeholder="Contoh: Z 1234 XY" autoCapitalize="characters" value={platNomor} onChangeText={setPlatNomor} />

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Alamat Domisili</Text>
        
        <Text style={styles.label}>Kecamatan</Text>
        <TextInput style={styles.input} placeholder="Contoh: Ciamis" value={kecamatan} onChangeText={setKecamatan} />
        <Text style={styles.label}>Desa / Kelurahan</Text>
        <TextInput style={styles.input} placeholder="Contoh: Sindangrasa" value={desa} onChangeText={setDesa} />
        <Text style={styles.label}>Detail Jalan / Patokan</Text>
        <TextInput style={styles.input} placeholder="Contoh: Jl. Sudirman No 12" value={detailJalan} onChangeText={setDetailJalan} />

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Unggah Berkas (Wajib)</Text>
        
        <Text style={styles.label}>1. Pas Foto Wajah Jelas</Text>
        <TouchableOpacity style={styles.photoBox} onPress={() => pickImage(setFotoWajah)}>
          {fotoWajah ? <Image source={{ uri: fotoWajah.uri }} style={styles.photoImg} /> : <><Ionicons name="person-circle" size={30} color="#A1887F" /><Text style={styles.photoText}>Unggah Foto Wajah</Text></>}
        </TouchableOpacity>

        <Text style={styles.label}>2. Foto SIM Aktif</Text>
        <TouchableOpacity style={styles.photoBox} onPress={() => pickImage(setFotoSim)}>
          {fotoSim ? <Image source={{ uri: fotoSim.uri }} style={styles.photoImg} /> : <><Ionicons name="card" size={30} color="#A1887F" /><Text style={styles.photoText}>Unggah Foto SIM</Text></>}
        </TouchableOpacity>

        <Text style={styles.label}>3. Foto STNK Kendaraan</Text>
        <TouchableOpacity style={styles.photoBox} onPress={() => pickImage(setFotoStnk)}>
          {fotoStnk ? <Image source={{ uri: fotoStnk.uri }} style={styles.photoImg} /> : <><Ionicons name="document-text" size={30} color="#A1887F" /><Text style={styles.photoText}>Unggah Foto STNK</Text></>}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btnSubmit, submitting && styles.btnDisabled]} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnSubmitText}>Kirim Berkas Pendaftaran</Text>}
        </TouchableOpacity>
      </ScrollView>
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
  divider: { height: 1, backgroundColor: '#E0D0C0', marginVertical: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#4A3420', marginBottom: 10 },
  vehicleRow: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  vehicleCard: { flex: 1, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#E0D0C0', borderRadius: 16, paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },
  vehicleCardActive: { borderColor: '#E28743', backgroundColor: '#FFF3E0' },
  vehicleText: { fontSize: 14, fontWeight: 'bold', color: '#A1887F', marginTop: 8 },
  vehicleTextActive: { color: '#E28743' },
  photoBox: { height: 120, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E0D0C0', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoText: { fontSize: 12, color: '#A1887F', marginTop: 8 },
  btnSubmit: { backgroundColor: '#2ECC71', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 30 },
  btnDisabled: { backgroundColor: '#95A5A6' },
  btnSubmitText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});