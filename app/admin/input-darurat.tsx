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

export default function InputDaruratScreen() {
  const router = useRouter();
  const [kecamatan, setKecamatan] = useState('');
  const [kategori, setKategori] = useState('Keamanan'); 
  const [instansi, setInstansi] = useState('');
  const [telepon, setTelepon] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSimpanDarurat = async () => {
    if (!kecamatan.trim() || !kategori.trim() || !instansi.trim() || !telepon.trim()) {
      return Alert.alert("Sasis Kosong 🚨", "Mohon isi seluruh data instansi rescue kecamatan Tuan!");
    }

    // 🌟 ANTI-SPASI LIAR: Bersihkan ujung teks agar string kecamatan klop 100% dengan tombol modal warga
    const kecamatanFix = kecamatan.trim();
    const instansiFix = instansi.trim();
    const nomorTelFix = telepon.replace(/[^0-9]/g, ''); // Kunci hanya menampung angka murni telepon

    try {
      setLoading(true);
      const { error } = await supabase
        .from('darurat_galuh')
        .insert([
          {
            kecamatan: kecamatanFix,
            kategori: kategori.trim(),
            nama_instansi: instansiFix,
            nomor_telepon: nomorTelFix
          }
        ]);

      if (error) throw error;

      Alert.alert("Rescue Siaga! 🚨", `Nomor darurat untuk kecamatan ${kecamatanFix} resmi terikat aktif di cloud.`, [
        { text: "Beres, Owner", onPress: () => router.back() }
      ]);
    } catch (err) {
      Alert.alert("Gagal Input ❌", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.mainWrapper}>
      <Stack.Screen options={{ headerTitle: 'Manajemen Kontak Rescue', headerTintColor: '#fff', headerStyle: { backgroundColor: '#4A3525' } }} />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <Text style={styles.fieldLabel}>🏢 Nama Kecamatan Wilayah Ciamis (Klopkan Teks)</Text>
        <TextInput style={styles.inputBox} placeholder="Contoh persis: Sadananya / Kawali / Ciamis Kota" value={kecamatan} onChangeText={setKecamatan} placeholderTextColor="#BCAAA4" />

        <Text style={styles.fieldLabel}>🚨 Kategori Unit (Ketik murni: Keamanan / Kesehatan / Damkar)</Text>
        <TextInput style={styles.inputBox} placeholder="Contoh: Keamanan" value={kategori} onChangeText={setKategori} placeholderTextColor="#BCAAA4" />

        <Text style={styles.fieldLabel}>🛡️ Nama Instansi / Pos Komando Rescue</Text>
        <TextInput style={styles.inputBox} placeholder="Contoh: Polsek Sadananya / Puskesmas DTP" value={instansi} onChangeText={setInstansi} placeholderTextColor="#BCAAA4" />

        <Text style={styles.fieldLabel}>📞 Nomor Telepon Kontak Darurat Lokal</Text>
        <TextInput style={styles.inputBox} placeholder="Contoh: 0265772115" keyboardType="phone-pad" value={telepon} onChangeText={setTelepon} placeholderTextColor="#BCAAA4" />

        <TouchableOpacity style={styles.btnSimpan} onPress={handleSimpanDarurat} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnSimpanText}>Daftarkan Nomor Penyelamat</Text>}
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