// @ts-nocheck
import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Alert,
  StatusBar
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { supabase } from '../../supabaseConfig';

export default function InputWisataScreen() {
  const router = useRouter();
  const [nama, setNama] = useState('');
  const [zona, setZona] = useState('Ciamis Pusat'); 
  const [desc, setDesc] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSimpanWisata = async () => {
    if (!nama.trim() || !zona.trim() || !desc.trim() || !lat.trim() || !lng.trim()) {
      return Alert.alert("Data Belum Lengkap 🚨", "Nama, Zona, Koordinat GPS, dan Deskripsi wajib diisi Tuan!");
    }

    // 🌟 SASIS DESIMAL FILTER: Mengubah string ketikan keyboard HP menjadi tipe data float angka murni
    const latitudeNumerik = parseFloat(lat);
    const longitudeNumerik = parseFloat(lng);

    if (isNaN(latitudeNumerik) || isNaN(longitudeNumerik)) {
      return Alert.alert("Format GPS Salah ❌", "Titik koordinat Latitude & Longitude harus berupa angka desimal murni titik! (Contoh: -7.3274)");
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('wisata_galuh')
        .insert([
          {
            nama_destinasi: nama.trim(),
            zona_wilayah: zona.trim(),
            deskripsi: desc.trim(),
            link_foto_url: fotoUrl.trim() || 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=500', // Foto default jika admin mengosongkan URL
            latitude_lokasi: latitudeNumerik, // Sukses terkirim sebagai angka numerik float
            longitude_lokasi: longitudeNumerik  // Sukses terkirim sebagai angka numerik float
          }
        ]);

      if (error) throw error;

      Alert.alert("Lokasi Wisata Dikunci! 🗺️", "Destinasi / Kuliner legendaris Galuh resmi nangkring di radar peta warga.", [
        { text: "Beres, Owner", onPress: () => router.back() }
      ]);
    } catch (err) {
      Alert.alert("Gagal Menyimpan ❌", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.mainWrapper}>
      <Stack.Screen options={{ headerTitle: 'Input Pesona & Kuliner', headerTintColor: '#fff', headerStyle: { backgroundColor: '#4A3525' } }} />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <Text style={styles.fieldLabel}>🗺️ Nama Destinasi / Rumah Makan Kuliner</Text>
        <TextInput style={styles.inputBox} placeholder="Contoh: Situ Lengkong Panjalu / Mie Bakso H. Oding" value={nama} onChangeText={setNama} placeholderTextColor="#BCAAA4" />

        <Text style={styles.fieldLabel}>📍 Zona Wilayah (Sesuai 5 Pilar Karpet Cokelat)</Text>
        <TextInput style={styles.inputBox} placeholder="Ketik persis: Ciamis Pusat / Ciamis Utara / Ciamis Timur" value={zona} onChangeText={setZona} placeholderTextColor="#BCAAA4" />

        <Text style={styles.fieldLabel}>📸 Link URL Foto Gambar Unsplash / Internet</Text>
        <TextInput style={styles.inputBox} placeholder="Masukkan tautan link langsung gambar berakhiran .jpg/.png" value={fotoUrl} onChangeText={setFotoUrl} placeholderTextColor="#BCAAA4" />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>🌐 Latitude GPS (Angka)</Text>
            <TextInput style={styles.inputBox} placeholder="Contoh: -7.3274" keyboardType="numeric" value={lat} onChangeText={setLat} placeholderTextColor="#BCAAA4" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>🌐 Longitude GPS (Angka)</Text>
            <TextInput style={styles.inputBox} placeholder="Contoh: 108.3551" keyboardType="numeric" value={lng} onChangeText={setLng} placeholderTextColor="#BCAAA4" />
          </View>
        </View>

        <Text style={styles.fieldLabel}>📖 Narasi Ringkas Cerita Daya Tarik Wisata</Text>
        <TextInput style={[styles.inputBox, { height: 120, textAlignVertical: 'top', paddingTop: 12 }]} multiline placeholder="Tuliskan ulasan ringkas keindahan atau kelezatan menunya agar warga terhipnotis mengklik tombol Pesan MIGO..." value={desc} onChangeText={setDesc} placeholderTextColor="#BCAAA4" />

        <TouchableOpacity style={styles.btnSimpan} onPress={handleSimpanWisata} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnSimpanText}>Kunci & Siarkan di Aplikasi</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: '#FAF8F5' },
  scrollContent: { padding: 16 },
  fieldLabel: { fontSize: 11, fontWeight: 'bold', color: '#4A3525', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
  inputBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#EFEBE9', borderRadius: 12, paddingHorizontal: 14, height: 46, color: '#4A3525', fontSize: 13 },
  btnSimpan: { backgroundColor: '#D35400', height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginTop: 28, elevation: 2 },
  btnSimpanText: { color: '#fff', fontSize: 13, fontWeight: 'bold' }
});