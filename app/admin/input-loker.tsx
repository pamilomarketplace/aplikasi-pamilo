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
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabaseConfig';

export default function InputLokerScreen() {
  const router = useRouter();
  const [posisi, setPosisi] = useState('');
  const [toko, setToko] = useState('');
  const [syarat, setSyarat] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSimpanLoker = async () => {
    if (!posisi.trim() || !toko.trim() || !syarat.trim() || !whatsapp.trim()) {
      return Alert.alert("Data Kosong 🚨", "Mohon lengkapi semua kolom sasis form Tuan Owner!");
    }

    // 🌟 SASIS VALIDASI WA: Bersihkan spasi/strip dan paksa ke format string angka bersih
    let waBersih = whatsapp.replace(/[^0-9]/g, '');
    if (waBersih.startsWith('0')) {
      waBersih = '62' + waBersih.slice(1);
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('loker_galuh')
        .insert([
          {
            posisi: posisi.trim(),
            nama_toko_perusahaan: toko.trim(),
            persyaratan: syarat.trim(),
            kontak_whatsapp: waBersih, // Mengirim string nomor internasional bersih
            is_valid: true // Otomatis aktif tayang di aplikasi warga
          }
        ]);

      if (error) throw error;

      Alert.alert("Sukses Publikasi! 🎉", "Lowongan kerja baru Tatar Galuh resmi disiarkan secara live.", [
        { text: "Siap, Owner", onPress: () => router.back() }
      ]);
    } catch (err) {
      Alert.alert("Pipa Database Mampet ❌", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.mainWrapper}>
      <Stack.Screen options={{ headerTitle: 'Input Loker Valid', headerTintColor: '#fff', headerStyle: { backgroundColor: '#4A3525' } }} />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <Text style={styles.fieldLabel}>💼 Posisi / Jabatan Pekerjaan</Text>
        <TextInput style={styles.inputBox} placeholder="Contoh: Barista Full-Time / Kasir Sembako" value={posisi} onChangeText={setPosisi} placeholderTextColor="#BCAAA4" />

        <Text style={styles.fieldLabel}>🏬 Nama Toko / Perusahaan Ciamis</Text>
        <TextInput style={styles.inputBox} placeholder="Contoh: Toko Berkah Alun-Alun / Cafe Galuh" value={toko} onChangeText={setToko} placeholderTextColor="#BCAAA4" />

        <Text style={styles.fieldLabel}>📱 WhatsApp HRD (Diawali 08... atau 62...)</Text>
        <TextInput style={styles.inputBox} placeholder="Contoh: 08123456789" keyboardType="phone-pad" value={whatsapp} onChangeText={setWhatsapp} placeholderTextColor="#BCAAA4" />

        <Text style={styles.fieldLabel}>📝 Kriteria & Persyaratan Lengkap</Text>
        <TextInput style={[styles.inputBox, { height: 120, textAlignVertical: 'top', paddingTop: 12 }]} multiline placeholder="Contoh: Pria/Wanita maks 25 tahun, jujur, berdomisili di wilayah Ciamis Kota, siap kerja shift harian." value={syarat} onChangeText={setSyarat} placeholderTextColor="#BCAAA4" />

        <TouchableOpacity style={styles.btnSimpan} onPress={handleSimpanLoker} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnSimpanText}>Publish Lowongan Kerja Kerja</Text>}
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