// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  ScrollView, Alert, ActivityIndicator, Image, Platform, Modal, FlatList 
} from 'react-native';
import { supabase } from '../../supabaseConfig'; 
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location'; 
import MapView, { Marker } from 'react-native-maps'; 
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

// 🟢 DATA MASTER WILAYAH CIAMIS LENGKAP (27 KECAMATAN)
const DATA_WILAYAH_CIAMIS = [
  {
    "kota": "Kabupaten Ciamis",
    "kecamatan": [
      { "nama": "Banjarsari", "desa": ["Banjarsari", "Cibadak", "Cicapar", "Ciherang", "Ciulu", "Kawasen", "Purwasari", "Ratawangi", "Sindangasih", "Sindanghayu", "Sindangsari", "Sukasarana"] },
      { "nama": "Baregbeg", "desa": ["Baregbeg", "Awiluar", "Jelat", "Karangampel", "Mekarjaya", "Petirhilir", "Pusakanagara", "Saguling", "Sukamaju"] },
      { "nama": "Ciamis", "desa": ["Ciamis", "Benteng", "Cigembor", "Kertasari", "Linggasari", "Maleber", "Sindangrasa"] },
      { "nama": "Cidolog", "desa": ["Cidolog", "Ciparay", "Hegarkasih", "Janggala", "Jelegong", "Mekarjaya"] },
      { "nama": "Cijeungjing", "desa": ["Cijeungjing", "Bojongmengger", "Ciharalang", "Dewasari", "Handapherang", "Karangkamulyan", "Kertabumi", "Kertaharja", "Pamalayan", "Utama"] },
      { "nama": "Cikoneng", "desa": ["Cikoneng", "Cimari", "Darmacaang", "Gegempalan", "Kujang", "Margaluyu", "Nasol", "Panaragan", "Sindangsari"] },
      { "nama": "Cimaragas", "desa": ["Cimaragas", "Beber", "Bojongmalang", "Jayaraksa", "Raksabaya"] },
      { "nama": "Cipaku", "desa": ["Cipaku", "Bangbayang", "Buniseuri", "Cieurih", "Gereba", "Jalatrang", "Mekarhari", "Muktisari", "Pusakasari", "Salakaria", "Selacai", "Selamanik", "Sukawening"] },
      { "nama": "Cisaga", "desa": ["Cisaga", "Bangunharja", "Cideli", "Danaputra", "Girimukti", "Karyamulya", "Mekarmukti", "Tanjungjaya", "Wangunjaya"] },
      { "nama": "Jatinagara", "desa": ["Jatinagara", "Awiluar", "Bayasari", "Cintanagara", "Dayeuhpertiwi", "Sukanagara"] },
      { "nama": "Kawali", "desa": ["Kawali", "Citeureup", "Karangpawitan", "Kawalimukti", "Linggapura", "Margamulya", "Purwasari", "Selaraja", "Sindangsari", "Talagasari", "Winduraja"] },
      { "nama": "Lakbok", "desa": ["Lakbok", "Barekbek", "Cintajaya", "Cintaratu", "Kalapasawit", "Kertajaya", "Puloerang", "Sidaharja", "Sukanagara", "Tambakreja"] },
      { "nama": "Lumbung", "desa": ["Lumbung", "Awiluar", "Cikupa", "Darmaraja", "Lumbungsari", "Rawa", "Sadewata", "Sukarisa"] },
      { "nama": "Pamarican", "desa": ["Pamarican", "Bangkelfung", "Bantarsari", "Kertahayu", "Margajaya", "Neglasari", "Pasirnagara", "Sidaharja", "Sukahurip", "Sukamukti"] },
      { "nama": "Panawangan", "desa": ["Panawangan", "Bangunjaya", "Capanagara", "Gardujaya", "Giridipa", "Indragiri", "Jagabaya", "Kertayasa", "Mekarbuana", "Nagaragasal", "Nagarajati", "Nagarwangi"] },
      { "nama": "Panjalu", "desa": ["Panjalu", "Bahara", "Ciomas", "Hujungtiwul", "Kertamandala", "Mandalare", "Maparah", "Sandingtaman"] },
      { "nama": "Panumbangan", "desa": ["Panumbangan", "Banjarangsana", "Banjarsari", "BuanaMekar", "Golát", "Jayagiri", "Medanglayang", "Payungagung", "Payungsari", "Sindangherang", "Sindangmukti", "Sukaluyu", "Tanjungmulya"] },
      { "nama": "Purwadadi", "desa": ["Purwadadi", "Bantardawa", "Karangpaningal", "Kutamukti", "Padaringo", "Pasirlawang", "Purwajaya", "Sidarahayu", "Sukaresik"] },
      { "nama": "Rajadesa", "desa": ["Rajadesa", "Andapraja", "Purwaraja", "Sirnabaya", "Sirnajaya", "Sukaharja", "Sukajaya", "Tanjungjaya", "Tanjungsari", "Tanjungsukur"] },
      { "nama": "Rancah", "desa": ["Rancah", "Bojonggedang", "Cileungsir", "Cisontrol", "Dadiharja", "Giriharja", "Jangkurang", "Karangpari", "Kawanglarang", "Patakaharja"] },
      { "nama": "Sadananya", "desa": ["Sadananya", "Bendasari", "Gunungsari", "Mangkubumi", "Mekarwangi", "Sukajadi", "Tanjungsari", "Werasari"] },
      { "nama": "Sindangkasih", "desa": ["Sindangkasih", "Budiasih", "Budiharja", "Gunungcupu", "Sukamanah", "Sukasari", "Wanasigra"] },
      { "nama": "Sukadana", "desa": ["Sukadana", "Bunter", "Ciparigi", "Margaharja", "Margajaya", "Salakaria"] },
      { "nama": "Sukamantri", "desa": ["Sukamantri", "Cibeureum", "Mekarwangi", "Sindanglaya", "Tenggerraharja"] },
      { "nama": "Tambaksari", "desa": ["Tambaksari", "Kadupandak", "Kaso", "Mekarsari", "Sukasarana", "Urug"] }
    ]
  }
];

export default function RegistrasiDriver() {
  const router = useRouter();
  const [namaLengkap, setNamaLengkap] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [jenisKendaraan, setJenisKendaraan] = useState<'Motor' | 'Mobil' | null>(null);
  
  // 🟢 FIX 1: Typo State diperbaiki menjadi merekKendaraan
  const [merekKendaraan, setMerekKendaraan] = useState(''); 
  const [nopol, setNopol] = useState('');
  const [fotoKtp, setFotoKtp] = useState<string | null>(null);
  const [fotoStnk, setFotoStnk] = useState<string | null>(null);
  const [fotoWajah, setFotoWajah] = useState<string | null>(null); 
  const [loading, setLoading] = useState(false);

  // --- STATES ALAMAT & PETA ---
  const [kotaSelected, setKotaSelected] = useState('Kabupaten Ciamis');
  const [kecamatanSelected, setKecamatanSelected] = useState<string | null>(null);
  const [desaSelected, setDesaSelected] = useState<string | null>(null);
  const [detailAlamat, setDetailAlamat] = useState('');
  const [modalType, setModalType] = useState<'kecamatan' | 'desa' | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingMap, setLoadingMap] = useState(false);
  const [region, setRegion] = useState({
    latitude: -7.3262, longitude: 108.3541, latitudeDelta: 0.005, longitudeDelta: 0.005,
  });
  const [coordinate, setCoordinate] = useState({ latitude: -7.3262, longitude: 108.3541 });

  useEffect(() => {
    ambilLokasiGpsSekarang(true);
  }, []);

  const ambilLokasiGpsSekarang = async (isInitial = false) => {
    try {
      setLoadingMap(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!isInitial) Alert.alert("Akses GPS Ditolak", "Mohon izinkan akses lokasi pada pengaturan HP Anda.");
        setLoadingMap(false);
        return;
      }
      
      let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const posisiGps = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      
      setCoordinate(posisiGps);
      setRegion(prev => ({ ...prev, ...posisiGps }));

      let geoRiset = await Location.reverseGeocodeAsync(posisiGps);
      if (geoRiset.length > 0) {
        const hasil = geoRiset[0];
        if (hasil.district) {
          const cekKec = DATA_WILAYAH_CIAMIS[0].kecamatan.find(k => k.nama.toLowerCase() === hasil.district.toLowerCase());
          if (cekKec) {
            setKecamatanSelected(cekKec.nama);
            if (hasil.street) setDetailAlamat(hasil.street);
          }
        }
      }
      if (!isInitial) Alert.alert("GPS Terkunci 📍", "Koordinat domisili Anda berhasil disesuaikan dengan posisi HP sekarang.");
    } catch (e) {
      console.log("GPS error:", e);
    } finally {
      setLoadingMap(false);
    }
  };

  const daftarKecamatan = DATA_WILAYAH_CIAMIS[0]?.kecamatan || [];
  const objekKecamatanAktif = daftarKecamatan.find(k => k.nama === kecamatanSelected);
  const daftarDesa = objekKecamatanAktif ? objekKecamatanAktif.desa : [];

  const bukaModalWilayah = (type: 'kecamatan' | 'desa') => {
    if (type === 'desa' && !kecamatanSelected) return Alert.alert("Kecamatan Kosong", "Pilih Kecamatan dulu.");
    setModalType(type);
    setModalVisible(true);
  };

  const pilihWilayahDariModal = (namaWilayah: string) => {
    if (modalType === 'kecamatan') {
      setKecamatanSelected(namaWilayah);
      setDesaSelected(null); 
    } else if (modalType === 'desa') {
      setDesaSelected(namaWilayah);
    }
    setModalVisible(false);
  };

  const cariLokasiPeta = async () => {
    const queryPencarian = `${detailAlamat} ${desaSelected || ''} ${kecamatanSelected || ''} Ciamis Jawa Barat`;
    if (!detailAlamat && !desaSelected) return Alert.alert("Informasi", "Ketik patokan/alamat untuk dicari.");
    
    setLoadingMap(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryPencarian)}&limit=1`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'PAMILO-Ciamis-SuperApp-Production-Agent'
        }
      });
      const data = await response.json();
      if (data && data.length > 0) {
        const titikBaru = { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
        setCoordinate(titikBaru);
        setRegion({ ...titikBaru, latitudeDelta: 0.005, longitudeDelta: 0.005 });
      } else {
        Alert.alert("Lokasi Tidak Ditemukan", "Sistem tidak mendeteksi patokan tersebut. Silakan geser pin merah secara manual.");
      }
    } catch (error) {
      console.log(error);
      Alert.alert("Gagal", "Tidak dapat menghubungi server Peta. Pastikan GPS aktif atau geser pin manual.");
    } finally {
      setLoadingMap(false);
    }
  };

  const pickImage = async (target: 'ktp' | 'stnk' | 'wajah') => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) return Alert.alert("Izin Ditolak", "Aplikasi butuh izin.");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], 
      allowsEditing: true,
      aspect: target === 'wajah' ? [1, 1] : undefined, 
      quality: 0.5, 
    });
    if (!result.canceled) {
      if (target === 'ktp') setFotoKtp(result.assets[0].uri);
      else if (target === 'stnk') setFotoStnk(result.assets[0].uri);
      else if (target === 'wajah') setFotoWajah(result.assets[0].uri);
    }
  };

  const uploadDocument = async (userId: string, uri: string, folderName: string) => {
    const ext = uri.split('.').pop() || 'jpg';
    const fileName = `drivers/${folderName}/${userId}_${Date.now()}.${ext}`;
    const formData = new FormData();
    formData.append('file', { uri: uri, name: fileName, type: `image/${ext === 'jpg' ? 'jpeg' : ext}` } as any);

    const { error } = await supabase.storage.from('pamilo-assets').upload(fileName, formData, { upsert: true });
    if (error) throw error;
    const { data: publicUrlData } = supabase.storage.from('pamilo-assets').getPublicUrl(fileName);
    return publicUrlData.publicUrl;
  };

  const handlePendaftaran = async () => {
    if (!namaLengkap || !whatsapp || !jenisKendaraan || !fotoKtp || !fotoWajah || !kecamatanSelected || !desaSelected || !detailAlamat) {
      return Alert.alert("Data Tidak Lengkap", "Pastikan Alamat, Kendaraan, dan Foto telah diisi.");
    }
    // 🟢 VALIDASI TAMBAHAN FIX
    if ((jenisKendaraan === 'Motor' || jenisKendaraan === 'Mobil') && (!nopol || !fotoStnk || !merekKendaraan.trim())) {
      return Alert.alert("Dokumen Kurang", "Merk Kendaraan, Nomor Polisi, dan Foto STNK wajib dilampirkan.");
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Sesi pengguna tidak ditemukan.");
      const userId = session.user.id;

      const urlKtp = await uploadDocument(userId, fotoKtp, 'ktp');
      const urlWajah = await uploadDocument(userId, fotoWajah, 'wajah'); 
      let urlStnk = null;
      if (fotoStnk) urlStnk = await uploadDocument(userId, fotoStnk, 'stnk');

      const { error: insertError } = await supabase
        .from('drivers')
        .insert([{
          user_id_driver: userId,
          nama_driver: namaLengkap.trim(),
          jenis_kendaraan: jenisKendaraan.toUpperCase(), 
          
          // 🟢 FIX 2: PERBAIKAN FATAL KOLOM DATABASE SUPABASE
          merek_kendaraan: merekKendaraan.trim().toUpperCase(),
          
          plat_nomor: nopol.trim().toUpperCase(),
          status_driver: 'OFFLINE',
          kota_driver: kotaSelected,
          kecamatan_driver: kecamatanSelected,
          desa_driver: desaSelected,
          detail_jalan_driver: detailAlamat.trim(),
          latitude_driver: coordinate.latitude,
          longitude_driver: coordinate.longitude,
          foto_sim: urlKtp,
          foto_stnk: urlStnk,
          foto_wajah: urlWajah 
        }]);

      if (insertError) throw insertError;

      await supabase.from('notifications').insert([{
        user_id_notif: null, 
        judul_notif: 'Pendaftaran Kurir Baru! 🛵',
        pesan_notif: `Calon Driver "${namaLengkap}" telah mengunggah berkas driver.`,
        tipe_notif: 'REGISTRASI_KURIR',
        is_read_notif: false
      }]);

      Alert.alert("Pendaftaran Dikirim", "Data Anda berhasil dikirim ke Admin PAMILO.", [{ text: "OK", onPress: () => router.replace('/(tabs)/profile') }]);
    } catch (error: any) {
      console.error(error);
      Alert.alert("Gagal", error.message || "Terjadi kesalahan saat mendaftar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.mainWrapper}>
      <ScrollView 
        style={styles.container} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Gabung Kurir MIGO</Text>
          <Text style={styles.subtitle}>Mulai hasilkan pendapatan harian bersama PAMILO</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>Nama Lengkap (Sesuai KTP)</Text>
          <TextInput style={styles.input} placeholder="Masukkan nama lengkap" value={namaLengkap} onChangeText={setNamaLengkap} placeholderTextColor="#BCAAA4" />

          <Text style={styles.label}>Nomor WhatsApp</Text>
          <TextInput style={styles.input} placeholder="Contoh: 0852xxxxxxxx" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" placeholderTextColor="#BCAAA4" />

          <Text style={styles.label}>Jenis Kendaraan Anda</Text>
          <View style={styles.radioGroup}>
            <TouchableOpacity style={[styles.radioBtn, jenisKendaraan === 'Motor' && styles.radioBtnActive]} onPress={() => setJenisKendaraan('Motor')}>
              <Ionicons name="bicycle" size={18} color={jenisKendaraan === 'Motor' ? '#fff' : '#D35400'} />
              <Text style={[styles.radioText, jenisKendaraan === 'Motor' && styles.radioTextActive]}>Sepeda Motor</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.radioBtn, jenisKendaraan === 'Mobil' && styles.radioBtnActive]} onPress={() => setJenisKendaraan('Mobil')}>
              <Ionicons name="car" size={18} color={jenisKendaraan === 'Mobil' ? '#fff' : '#D35400'} />
              <Text style={[styles.radioText, jenisKendaraan === 'Mobil' && styles.radioTextActive]}>Mobil Armada</Text>
            </TouchableOpacity>
          </View>

          {/* 🟢 INPUT DINAMIS UNTUK MERK KENDARAAN (STATE SUDAH DIPERBAIKI) */}
          {(jenisKendaraan === 'Motor' || jenisKendaraan === 'Mobil') && (
            <View>
              <Text style={styles.label}>Merk / Tipe {jenisKendaraan}</Text>
              <TextInput 
                style={styles.input} 
                placeholder={jenisKendaraan === 'Motor' ? "Contoh: Honda Beat 2022, Yamaha NMAX" : "Contoh: Toyota Avanza, Suzuki Carry PickUp"} 
                value={merekKendaraan} 
                onChangeText={setMerekKendaraan} 
                placeholderTextColor="#BCAAA4" 
              />
            </View>
          )}

          <Text style={styles.label}>Kecamatan Domisili</Text>
          <TouchableOpacity style={styles.dropdownSelector} onPress={() => bukaModalWilayah('kecamatan')}>
            <Text style={[styles.dropdownSelectorText, kecamatanSelected && styles.textSelected]}>
              {kecamatanSelected || "--- Klik Untuk Memilih Kecamatan ---"}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#8D6E63" />
          </TouchableOpacity>

          <Text style={styles.label}>Desa / Kelurahan</Text>
          <TouchableOpacity style={styles.dropdownSelector} onPress={() => bukaModalWilayah('desa')}>
            <Text style={[styles.dropdownSelectorText, desaSelected && styles.textSelected]}>
              {desaSelected || "--- Klik Untuk Memilih Desa/Kelurahan ---"}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#8D6E63" />
          </TouchableOpacity>

          <Text style={styles.label}>Detail Alamat Domisili</Text>
          <View style={styles.searchMapRow}>
            <TextInput 
              style={[styles.input, styles.textArea, { flex: 1, marginBottom: 0, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]} 
              placeholder="Ketik alamat Anda, lalu klik tombol 🔍" 
              value={detailAlamat} 
              onChangeText={setDetailAlamat} 
              multiline 
              numberOfLines={2} 
              placeholderTextColor="#BCAAA4" 
            />
            <TouchableOpacity style={styles.btnSearchMap} onPress={cariLokasiPeta}>
              <Ionicons name="search" size={20} color="#fff" />
              <Text style={{color: '#fff', fontSize: 8, fontWeight: 'bold', marginTop: 1}}>CARI</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.btnGpsMap} onPress={() => ambilLokasiGpsSekarang(false)}>
              <Ionicons name="location" size={20} color="#fff" />
              <Text style={{color: '#fff', fontSize: 8, fontWeight: 'bold', marginTop: 1}}>GPS</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Titik Peta Rumah / Domisili Anda (Bisa Digeser)</Text>
          <View style={styles.mapContainer}>
            {loadingMap ? (
              <ActivityIndicator size="small" color="#D35400" />
            ) : (
              <MapView style={styles.mapFisik} region={region} onRegionChangeComplete={(r) => setRegion(r)}>
                <Marker 
                  draggable 
                  coordinate={coordinate} 
                  onDragEnd={(e) => setCoordinate(e.nativeEvent.coordinate)}
                  title="Posisi Rumah Anda"
                />
              </MapView>
            )}
          </View>

          {(jenisKendaraan === 'Motor' || jenisKendaraan === 'Mobil') && (
            <View style={{marginTop: 15}}>
              <Text style={styles.label}>Nomor Polisi (Plat Nomor)</Text>
              <TextInput style={styles.input} placeholder="Contoh: Z 1234 VA" value={nopol} onChangeText={setNopol} autoCapitalize="characters" placeholderTextColor="#BCAAA4" />

              <Text style={styles.label}>Foto STNK Kendaraan</Text>
              <TouchableOpacity style={styles.imagePickerBtn} onPress={() => pickImage('stnk')}>
                {fotoStnk ? <Image source={{ uri: fotoStnk }} style={styles.previewImage} /> : (
                  <View style={styles.imagePlaceholder}>
                    <MaterialIcons name="receipt" size={24} color="#D35400" />
                    <Text style={styles.imagePlaceholderText}>Unggah Foto STNK</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.label}>Foto Setengah Badan / Pas Foto Wajah (Wajib)</Text>
          <TouchableOpacity style={styles.imagePickerBtn} onPress={() => pickImage('wajah')}>
            {fotoWajah ? <Image source={{ uri: fotoWajah }} style={styles.previewImage} /> : (
              <View style={styles.imagePlaceholder}>
                <MaterialIcons name="face" size={24} color="#D35400" />
                <Text style={styles.imagePlaceholderText}>Unggah Foto Wajah Jelas (Selfie/Pasfoto)</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>Foto KTP / SIM Pengemudi</Text>
          <TouchableOpacity style={styles.imagePickerBtn} onPress={() => pickImage('ktp')}>
            {fotoKtp ? <Image source={{ uri: fotoKtp }} style={styles.previewImage} /> : (
              <View style={styles.imagePlaceholder}>
                <MaterialIcons name="badge" size={24} color="#D35400" />
                <Text style={styles.imagePlaceholderText}>Unggah Foto KTP / SIM</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnSubmit} onPress={handlePendaftaran} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>KIRIM BERKAS PENDAFTARAN</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* MODAL WILAYAH */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pilih {modalType === 'kecamatan' ? 'Kecamatan' : 'Desa / Kelurahan'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={24} color="#D35400" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={modalType === 'kecamatan' ? daftarKecamatan.map(k => k.nama) : daftarDesa}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalOptionRow} onPress={() => pilihWilayahDariModal(item)}>
                  <MaterialIcons name="location-city" size={16} color="#8D6E63" style={{ marginRight: 10 }} />
                  <Text style={styles.modalOptionText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: '#FDFCFB' },
  container: { flex: 1, padding: 20 },
  header: { marginTop: 20, marginBottom: 25 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#D35400' },
  subtitle: { fontSize: 13, color: '#8D6E63', marginTop: 5 },
  formCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#FFE0B2', marginBottom: 40, elevation: 1 },
  label: { fontSize: 11, fontWeight: 'bold', color: '#D35400', marginBottom: 8, textTransform: 'uppercase' },
  input: { backgroundColor: '#FDFBF9', borderRadius: 10, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: '#FFE0B2', color: '#4A3525', fontSize: 14 },
  radioGroup: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  radioBtn: { flexDirection: 'row', flex: 0.48, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#FFE0B2', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8F4' },
  radioBtnActive: { backgroundColor: '#D35400', borderColor: '#D35400' },
  radioText: { marginLeft: 6, fontWeight: '600', color: '#D35400', fontSize: 13 },
  radioTextActive: { color: '#fff' },
  dropdownSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDFBF9', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#FFE0B2', justifyContent: 'space-between' },
  dropdownSelectorText: { fontSize: 14, color: '#BCAAA4' },
  textSelected: { color: '#4A3525', fontWeight: '500' },
  textArea: { height: 60, textAlignVertical: 'top' },
  searchMapRow: { flexDirection: 'row', marginBottom: 14, alignItems: 'stretch' },
  btnSearchMap: { backgroundColor: '#D35400', paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#D35400' },
  btnGpsMap: { backgroundColor: '#00796B', paddingHorizontal: 12, borderTopRightRadius: 10, borderBottomRightRadius: 10, justifyContent: 'center', alignItems: 'center' },
  mapContainer: { width: '100%', height: 180, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#FFE0B2', justifyContent: 'center', alignItems: 'center', backgroundColor: '#E0F2F1', marginBottom: 15 },
  mapFisik: { width: '100%', height: '100%' },
  imagePickerBtn: { width: '100%', height: 130, borderRadius: 12, borderWidth: 2, borderColor: '#FFE0B2', borderStyle: 'dashed', backgroundColor: '#FDFBF9', justifyContent: 'center', alignItems: 'center', marginBottom: 20, overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%' },
  imagePlaceholder: { alignItems: 'center' },
  imagePlaceholderText: { color: '#8D6E63', fontSize: 11, marginTop: 6, fontWeight: '600' },
  btnSubmit: { backgroundColor: '#D35400', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxHeight: '70%', backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 5 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#EFEBE9', paddingBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#4A3525' },
  modalOptionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  modalOptionText: { fontSize: 14, color: '#4A3525', fontWeight: '500', marginLeft: 10 }
});