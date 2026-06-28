// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  ScrollView, Alert, ActivityIndicator, Image, Modal, FlatList 
} from 'react-native';
import { supabase } from '../../supabaseConfig'; 
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location'; 
import MapView, { Marker } from 'react-native-maps'; 
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

// 🟢 DAFTAR KATEGORI SAKRAL 3 PILAR PAMILO
const LIST_KATEGORI_PAMILO = [
  { id: 'FOOD', label: 'Pamilo Food (Kuliner & Makanan)', icon: 'restaurant' },
  { id: 'MART', label: 'Pamilo Mart (Pasar, Sembako, Oleh-Oleh)', icon: 'shopping-bag' },
  { id: 'SERVIS', label: 'Pamilo Servis (Jasa & Panggilan)', icon: 'build' },
];

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
      { "nama": "Panawangan", "desa": ["Panawangan", "Bangunjaya", "Capanagara", "Gardujaya", "Giridipa", "Indragiri", "Jagabaya", "Kertayasa", "Mekarbuana", "Nagaragasal", "Nagarajati", "Nagarawangi"] },
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

export default function RegistrasiMitra() {
  const router = useRouter();
  const [namaToko, setNamaToko] = useState('');
  const [kategoriSelected, setKategoriSelected] = useState<string[]>([]); 
  const [whatsapp, setWhatsapp] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // --- STATES ALAMAT TERSTRUKTUR CASCADING ---
  const [kotaSelected, setKotaSelected] = useState('Kabupaten Ciamis');
  const [kecamatanSelected, setKecamatanSelected] = useState<string | null>(null);
  const [desaSelected, setDesaSelected] = useState<string | null>(null);
  const [detailAlamat, setDetailAlamat] = useState('');
  const [modalType, setModalType] = useState<'kecamatan' | 'desa' | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // --- STATES KOORDINAT PETA MAPS ---
  const [region, setRegion] = useState({
    latitude: -7.3262, longitude: 108.3541, latitudeDelta: 0.005, longitudeDelta: 0.005,
  });
  const [coordinate, setCoordinate] = useState({ latitude: -7.3262, longitude: 108.3541 });
  const [loadingMap, setLoadingMap] = useState(false);

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
      const posisiGpsRiil = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      
      setCoordinate(posisiGpsRiil);
      setRegion(prev => ({ ...prev, ...posisiGpsRiil }));

      let geoRiset = await Location.reverseGeocodeAsync(posisiGpsRiil);
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
      if (!isInitial) Alert.alert("GPS Terkunci 📍", "Titik koordinat lapak toko Anda berhasil diselaraskan otomatis.");
    } catch (e) {
      console.log("GPS terhambat:", e);
    } finally {
      setLoadingMap(false);
    }
  };

  const daftarKecamatan = DATA_WILAYAH_CIAMIS[0]?.kecamatan || [];
  const objekKecamatanAktif = daftarKecamatan.find(k => k.nama === kecamatanSelected);
  const daftarDesa = objekKecamatanAktif ? objekKecamatanAktif.desa : [];

  const bukaModalWilayah = (type: 'kecamatan' | 'desa') => {
    if (type === 'desa' && !kecamatanSelected) {
      return Alert.alert("Kecamatan Kosong", "Mohon pilih wilayah Kecamatan terlebih dahulu.");
    }
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

  const handleToggleKategori = (id: string) => {
    if (kategoriSelected.includes(id)) {
      setKategoriSelected(kategoriSelected.filter(item => item !== id));
    } else {
      setKategoriSelected([...kategoriSelected, id]);
    }
  };

  const cariLokasiPeta = async () => {
    const queryPencarian = `${detailAlamat} ${desaSelected || ''} ${kecamatanSelected || ''} Ciamis Jawa Barat`;
    if (!detailAlamat && !desaSelected) {
      return Alert.alert("Informasi", "Pilih Desa atau isi detail jalan terlebih dahulu agar peta bisa mencari.");
    }

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
        Alert.alert("Lokasi Tidak Ditemukan", "Coba ketik nama patokan yang lebih terkenal, atau geser pin peta secara manual.");
      }
    } catch (error) {
      console.log(error);
      Alert.alert("Gagal", "Tidak dapat menghubungi server Peta. Pastikan GPS aktif atau geser pin manual.");
    } finally {
      setLoadingMap(false);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Izin Ditolak", "Aplikasi butuh izin untuk mengakses galeri foto Anda.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const uploadImage = async (userId: string) => {
    if (!imageUri) return null;
    const ext = imageUri.split('.').pop() || 'jpg';
    const fileName = `toko/${userId}_${Date.now()}.${ext}`;
    const formData = new FormData();
    formData.append('file', { uri: imageUri, name: fileName, type: `image/${ext === 'jpg' ? 'jpeg' : ext}` } as any);

    const { error } = await supabase.storage.from('pamilo-assets').upload(fileName, formData, { upsert: true });
    if (error) throw error;
    const { data: publicUrlData } = supabase.storage.from('pamilo-assets').getPublicUrl(fileName);
    return publicUrlData.publicUrl;
  };

  const handlePendaftaran = async () => {
    if (!namaToko || kategoriSelected.length === 0 || !kecamatanSelected || !desaSelected || !detailAlamat || !whatsapp || !imageUri) {
      return Alert.alert("Data Tidak Lengkap", "Semua data form, pilihan kategori (minimal 1), wilayah dropdown, detail jalan, dan foto wajib diisi.");
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Sesi pengguna tidak ditemukan.");
      const userId = session.user.id;

      const fotoUrl = await uploadImage(userId);
      if (!fotoUrl) throw new Error("Gagal mengunggah foto toko.");

      const alamatFisikGabungan = `${detailAlamat.trim()}, Desa/Kel. ${desaSelected}, Kec. ${kecamatanSelected}, ${kotaSelected}`;
      const stringKategoriGabungan = kategoriSelected.join(',');

      const { error: upsertError } = await supabase
        .from('toko')
        .upsert([{
          user_id_toko: userId,
          nama_toko: namaToko.trim(),
          kategori_toko: stringKategoriGabungan, 
          alamat_toko: alamatFisikGabungan,
          foto_toko: fotoUrl,
          whatsapp_toko: whatsapp.trim(),
          is_verified: false,      
          status_toko: 'TUTUP',    
          rating_toko: 5.00,        
          kota_toko: kotaSelected,
          kecamatan_toko: kecamatanSelected,
          desa_toko: desaSelected,
          detail_jalan_toko: detailAlamat.trim(),
          latitude_toko: coordinate.latitude,
          longitude_toko: coordinate.longitude
        }], { onConflict: 'user_id_toko' }); 

      if (upsertError) throw upsertError;

      await supabase.from('notifications').insert([{
        user_id_notif: null, 
        judul_notif: 'Pendaftaran Mitra Baru! 🏪',
        pesan_notif: `Toko "${namaToko}" mendaftar di wilayah ${kecamatanSelected} dengan ${kategoriSelected.length} kategori.`,
        tipe_notif: 'REGISTRASI_MITRA',
        is_read_notif: false
      }]);

      Alert.alert(
        "Berkas Dikirim", 
        "Pendaftaran toko Anda berhasil dikirim! Dashboard penjualan akan aktif setelah diverifikasi oleh Admin.", 
        [{ text: "Kembali ke Profil", onPress: () => router.replace('/(tabs)/profile') }]
      );
    } catch (error: any) {
      console.error(error);
      Alert.alert("Gagal", error.message || "Terjadi kesalahan saat mendaftarkan toko.");
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
          <Text style={styles.title}>Buka Toko Mitra</Text>
          <Text style={styles.subtitle}>Mulai digitalisasi usaha UMKM Anda bersama PAMILO</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>Nama Toko / Usaha</Text>
          <TextInput style={styles.input} placeholder="Contoh: Dimsum Kukus Alun-Alun" value={namaToko} onChangeText={setNamaToko} placeholderTextColor="#BCAAA4" />

          <Text style={styles.label}>Kategori Jualan Usaha (Bisa Pilih Lebih Dari Satu)</Text>
          <View style={styles.categoryGroup}>
            {LIST_KATEGORI_PAMILO.map((item) => {
              const isSelected = kategoriSelected.includes(item.id);
              return (
                <TouchableOpacity 
                  key={item.id}
                  style={[styles.categoryOptionCard, isSelected && styles.categoryOptionCardActive]}
                  onPress={() => handleToggleKategori(item.id)}
                >
                  <View style={[styles.iconWrapper, { backgroundColor: isSelected ? '#fff' : '#FFF8F4' }]}>
                    <MaterialIcons name={item.icon as any} size={16} color={isSelected ? '#D35400' : '#8D6E63'} />
                  </View>
                  <Text style={[styles.categoryOptionLabel, isSelected && styles.categoryOptionLabelActive]}>
                    {item.label}
                  </Text>
                  <View style={[styles.checkboxSquare, isSelected && styles.checkboxSquareActive]}>
                    {isSelected && <Ionicons name="checkmark" size={12} color="#D35400" />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Nomor WhatsApp Aktif Toko</Text>
          <TextInput style={styles.input} placeholder="Contoh: 081234567xxx" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" placeholderTextColor="#BCAAA4" />

          <Text style={styles.label}>Kabupaten / Kota</Text>
          <View style={[styles.input, styles.disabledInput]}>
            <Text style={{ color: '#5E35B1', fontWeight: 'bold' }}>{kotaSelected} (Kluster Utama)</Text>
          </View>

          <Text style={styles.label}>Kecamatan</Text>
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

          <Text style={styles.label}>Detail Alamat Jalan (RT/RW / No. Rumah)</Text>
          <View style={styles.searchMapRow}>
            <TextInput 
              style={[styles.input, styles.textArea, { flex: 1, marginBottom: 0, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]} 
              placeholder="Ketik patokan/jalan, lalu klik tombol 🔍" 
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

          <Text style={styles.label}>Akurasi Peta Lokasi Toko (Tahan lalu Geser Pin)</Text>
          <View style={styles.mapContainer}>
            {loadingMap ? (
              <ActivityIndicator size="small" color="#D35400" />
            ) : (
              <MapView style={styles.mapFisik} region={region} onRegionChangeComplete={(r) => setRegion(r)}>
                <Marker 
                  draggable 
                  coordinate={coordinate} 
                  onDragEnd={(e) => setCoordinate(e.nativeEvent.coordinate)}
                  title="Posisi Lapak Toko Saya"
                  description="Geser pin ini se-akurat mungkin untuk mempermudah Kurir MIGO!"
                />
              </MapView>
            )}
          </View>
          <Text style={styles.mapNote}>📍 Koordinat Satelit: Lat {coordinate.latitude.toFixed(5)}, Lng {coordinate.longitude.toFixed(5)}</Text>

          <Text style={styles.label}>Foto Lokasi / Logo Toko (Wajib)</Text>
          <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
            {imageUri ? <Image source={{ uri: imageUri }} style={styles.previewImage} /> : (
              <View style={styles.imagePlaceholder}>
                <MaterialIcons name="add-a-photo" size={28} color="#8D6E63" />
                <Text style={styles.imagePlaceholderText}>Pilih Foto Galeri / Kamera</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnSubmit} onPress={handlePendaftaran} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>KIRIM BERKAS & KOORDINAT TOKO</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

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
  container: { flex: 1, padding: 16 },
  header: { marginTop: 10, marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#4A3525' },
  subtitle: { fontSize: 12, color: '#8D6E63', marginTop: 4, lineHeight: 18 },
  formCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#EFEBE9', marginBottom: 40, elevation: 1 },
  label: { fontSize: 10, fontWeight: 'bold', color: '#4A3525', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  input: { backgroundColor: '#FDFBF9', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#D7CCC8', color: '#4A3525', fontSize: 14 },
  disabledInput: { backgroundColor: '#EDE7F6', borderColor: '#B39DDB', justifyContent: 'center' },
  dropdownSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDFBF9', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#D7CCC8', justifyContent: 'space-between' },
  dropdownSelectorText: { fontSize: 14, color: '#BCAAA4' },
  textSelected: { color: '#4A3525', fontWeight: '500' },
  textArea: { height: 60, textAlignVertical: 'top' },
  searchMapRow: { flexDirection: 'row', marginBottom: 14, alignItems: 'stretch' },
  btnSearchMap: { backgroundColor: '#D35400', paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#D35400' },
  btnGpsMap: { backgroundColor: '#00796B', paddingHorizontal: 12, borderTopRightRadius: 10, borderBottomRightRadius: 10, justifyContent: 'center', alignItems: 'center' },
  categoryGroup: { marginBottom: 14, gap: 6 },
  categoryOptionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8F4', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#FFE0B2' },
  categoryOptionCardActive: { backgroundColor: '#D35400', borderColor: '#D35400' },
  iconWrapper: { width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  categoryOptionLabel: { flex: 1, fontSize: 12, fontWeight: '600', color: '#5D4037', marginLeft: 10 },
  categoryOptionLabelActive: { color: '#fff' },
  checkboxSquare: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#BCAAA4', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  checkboxSquareActive: { borderColor: '#fff' },
  mapContainer: { width: '100%', height: 180, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#D7CCC8', justifyContent: 'center', alignItems: 'center', backgroundColor: '#E0F2F1', marginBottom: 4 },
  mapFisik: { width: '100%', height: '100%' },
  mapNote: { fontSize: 11, color: '#00796B', fontWeight: '600', marginBottom: 14, textAlign: 'right' },
  imagePickerBtn: { width: '100%', height: 120, borderRadius: 12, borderWidth: 2, borderColor: '#D7CCC8', borderStyle: 'dashed', backgroundColor: '#FDFBF9', justifyContent: 'center', alignItems: 'center', marginBottom: 25, overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%' },
  imagePlaceholder: { alignItems: 'center' },
  imagePlaceholderText: { color: '#8D6E63', fontSize: 12, marginTop: 8, fontWeight: '600' },
  btnSubmit: { backgroundColor: '#D35400', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 5 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 14, letterSpacing: 0.8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxHeight: '70%', backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 5 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#EFEBE9', paddingBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#4A3525' },
  modalOptionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  modalOptionText: { fontSize: 14, color: '#4A3525', fontWeight: '500' }
});