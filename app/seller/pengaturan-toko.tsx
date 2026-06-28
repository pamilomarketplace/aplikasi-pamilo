// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  StatusBar, 
  ActivityIndicator, 
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker'; 
import { supabase } from '../../supabaseConfig';

export default function PengaturanTokoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // State Identitas Berdasarkan DDL Hasil Migrasi Baru
  const [idToko, setIdToko] = useState<string | null>(null); 
  const [namaToko, setNamaToko] = useState('');
  const [alamatToko, setAlamatToko] = useState('');
  const [whatsappToko, setWhatsappToko] = useState('');
  const [deskripsiToko, setDeskripsiToko] = useState('');
  const [jamOperasional, setJamOperasional] = useState('');
  const [fotoUrl, setFotoUrl] = useState(''); 
  const [fotoBaruUri, setFotoBaruUri] = useState<string | null>(null);

  const fetchProfilToko = async () => {
    try {
      setLoadingInitial(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return router.back();
      const uid = session.user.id;

      // Tarik Data Toko Sesuai DDL Baru (Termasuk deskripsi & jam_operasional)
      const { data, error } = await supabase
        .from('toko') 
        .select('id_toko, nama_toko, alamat_toko, whatsapp_toko, foto_toko, deskripsi, jam_operasional')
        .eq('user_id_toko', uid)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setIdToko(data.id_toko); 
        setNamaToko(data.nama_toko || '');
        setAlamatToko(data.alamat_toko || '');
        setWhatsappToko(data.whatsapp_toko || '');
        setDeskripsiToko(data.deskripsi || '');
        setJamOperasional(data.jam_operasional || '08:00 - 20:00');
        setFotoUrl(data.foto_toko || ''); 
      }
    } catch (err) {
      console.log("Gagal membaca sasis profil toko:", err.message);
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    fetchProfilToko();
  }, []);

  const handlePilihLogoToko = async () => {
    const izin = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!izin.granted) {
      Alert.alert("Izin Ditolak", "Aplikasi PAMILO membutuhkan akses galeri untuk mengganti foto profil toko.");
      return;
    }

    const hasil = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1], 
      quality: 0.6,
    });

    if (!hasil.canceled && hasil.assets && hasil.assets.length > 0) {
      setFotoBaruUri(hasil.assets[0].uri);
    }
  };

  const uploadLogoTokoBaru = async (uri: string): Promise<string | null> => {
    try {
      if (fotoUrl && fotoUrl.includes('pamilo-assets')) {
        const namaFileLama = fotoUrl.split('/').pop();
        if (namaFileLama) {
          await supabase.storage.from('pamilo-assets').remove([`toko/${namaFileLama}`]);
        }
      }

      const ekstensi = uri.split('.').pop() || 'jpg';
      const namaFile = `logo_${Date.now()}.${ekstensi}`;
      const pathFile = `toko/${namaFile}`;

      const formData = new FormData();
      formData.append('file', {
        uri,
        name: namaFile,
        type: `image/${ekstensi === 'png' ? 'png' : 'jpeg'}`,
      } as any);

      const { error } = await supabase.storage
        .from('pamilo-assets')
        .upload(pathFile, formData, { upsert: true });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('pamilo-assets')
        .getPublicUrl(pathFile);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error("Gagal mengaktifkan upload logo baru:", error);
      return null;
    }
  };

  const handleSimpanPengaturan = async () => {
    if (!namaToko.trim() || !alamatToko.trim() || !whatsappToko.trim() || !jamOperasional.trim()) {
      Alert.alert("Form Belum Lengkap", "Nama Toko, Alamat, WhatsApp, dan Jam Operasional wajib diisi.");
      return;
    }

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const uid = session.user.id;

      let urlGambarFinal = fotoUrl;

      if (fotoBaruUri) {
        const hasilUpload = await uploadLogoTokoBaru(fotoBaruUri);
        if (hasilUpload) urlGambarFinal = hasilUpload;
      }

      // 🎯 UPDATE DATABASE SINKRON KE KOLOM BARU HASIL MIGRASI SQL
      const { error: tokoError } = await supabase
        .from('toko')
        .update({
          nama_toko: namaToko.trim(),
          alamat_toko: alamatToko.trim(),
          whatsapp_toko: whatsappToko.trim(),
          deskripsi: deskripsiToko.trim(),
          jam_operasional: jamOperasional.trim(),
          foto_toko: urlGambarFinal 
        })
        .eq('user_id_toko', uid);

      if (tokoError) throw tokoError;

      await supabase.from('users').update({ user_name: namaToko.trim() }).eq('user_id', uid);

      Alert.alert("Sukses 🎉", "Profil operasional merchant PAMILO berhasil diperbarui!", [
        { text: "Mantap", onPress: () => router.back() }
      ]);
      
    } catch (error: any) {
      Alert.alert("Gagal Menyimpan", `Sirkuit database terhambat: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loadingInitial) {
    return (
      <View style={styles.centerLoading}>
        <ActivityIndicator size="large" color="#4A3525" />
        <Text style={styles.loadingText}>Membaca konfigurasi lapak Tuan...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen 
        options={{
          headerShown: true,
          headerTitle: 'Edit Profil Toko',
          headerTintColor: '#fff',
          headerStyle: { backgroundColor: '#4A3525' },
          headerTitleStyle: { fontWeight: 'bold', fontSize: 13 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingVertical: 4 }}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          ),
        }} 
      />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 30 }]}>
        <View style={styles.formCard}>
          
          {/* SELEKTOR BULAT LOGO/FOTO TOKO */}
          <Text style={styles.formGroupTitle}>FOTO PROFIL / LOGO BRAND TOKO</Text>
          <View style={styles.logoSectionContainer}>
            <TouchableOpacity style={styles.logoImagePickerBox} onPress={handlePilihLogoToko} activeOpacity={0.8}>
              {fotoBaruUri ? (
                <Image source={{ uri: fotoBaruUri }} style={styles.logoPreviewImage} />
              ) : fotoUrl ? (
                <Image source={{ uri: fotoUrl }} style={styles.logoPreviewImage} />
              ) : (
                <View style={styles.logoEmptyBox} >
                  <MaterialIcons name="storefront" size={28} color="#BCAAA4" />
                  <Text style={styles.logoEmptyBoxText}>Pilih Foto</Text>
                </View>
              )}
              <View style={styles.logoBadgeEditCircle}>
                <Ionicons name="camera" size={12} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={styles.logoHintText}>Ketuk lingkaran untuk mengganti gambar profil toko Tuan</Text>
          </View>

          <Text style={styles.formGroupTitle}>INFORMASI IDENTITAS LAPAK</Text>

          {/* INPUT NAMA TOKO */}
          <Text style={styles.labelInput}>Nama Toko / Brand Dagang *</Text>
          <View style={styles.inputWrapper}>
            <FontAwesome5 name="store" size={11} color="#8D6E63" style={styles.inputIcon} />
            <TextInput 
              style={styles.textInput}
              value={namaToko}
              onChangeText={setNamaToko}
              placeholder="Contoh: Toko Berkah Ciamis"
              placeholderTextColor="#BCAAA4"
            />
          </View>

          {/* INPUT WHATSAPP TOKO */}
          <Text style={styles.labelInput}>Nomor WhatsApp Operasional *</Text>
          <View style={styles.inputWrapper}>
            <FontAwesome5 name="whatsapp" size={13} color="#2E7D32" style={styles.inputIcon} />
            <TextInput 
              style={styles.textInput}
              value={whatsappToko}
              onChangeText={setWhatsappToko}
              placeholder="Contoh: 081234567890"
              placeholderTextColor="#BCAAA4"
              keyboardType="phone-pad"
            />
          </View>

          {/* 🟢 INPUT JAM OPERASIONAL BARU */}
          <Text style={styles.labelInput}>Jam Operasional Toko *</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="time-outline" size={14} color="#8D6E63" style={styles.inputIcon} />
            <TextInput 
              style={styles.textInput}
              value={jamOperasional}
              onChangeText={setJamOperasional}
              placeholder="Contoh: 08:00 - 21:00"
              placeholderTextColor="#BCAAA4"
            />
          </View>

          {/* 🟢 INPUT DESKRIPSI SINGKAT BARU */}
          <Text style={styles.labelInput}>Deskripsi Singkat Jualan Toko</Text>
          <View style={[styles.inputWrapper, { alignItems: 'flex-start', paddingTop: 10, height: 75 }]}>
            <FontAwesome5 name="align-left" size={11} color="#8D6E63" style={[styles.inputIcon, { marginTop: 2 }]} />
            <TextInput 
              style={[styles.textInput, { height: 55, textAlignVertical: 'top' }]}
              value={deskripsiToko}
              onChangeText={setDeskripsiToko}
              placeholder="Jelaskan produk atau makanan andalan lapak Tuan..."
              placeholderTextColor="#BCAAA4"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* INPUT ALAMAT TOKO */}
          <Text style={styles.labelInput}>Alamat Lengkap Toko *</Text>
          <View style={[styles.inputWrapper, { alignItems: 'flex-start', paddingTop: 10, height: 75 }]}>
            <FontAwesome5 name="map-marker-alt" size={12} color="#C62828" style={[styles.inputIcon, { marginTop: 2 }]} />
            <TextInput 
              style={[styles.textInput, { height: 55, textAlignVertical: 'top' }]}
              value={alamatToko}
              onChangeText={setAlamatToko}
              placeholder="Tulis nama jalan, RT/RW, nomor ruko, dan kecamatan..."
              placeholderTextColor="#BCAAA4"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* BUTTON SIMPAN DATA */}
          <TouchableOpacity style={[styles.btnSave, loading && { backgroundColor: '#BCAAA4' }]} onPress={handleSimpanPengaturan} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color="#fff" /> : (
              <><Ionicons name="cloud-upload-outline" size={15} color="#fff" style={{ marginRight: 6 }} /><Text style={styles.btnSaveText}>Simpan Konfigurasi Toko</Text></>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5' },
  scrollContent: { padding: 16 },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF8F5' },
  loadingText: { marginTop: 10, fontSize: 12, color: '#8D6E63', fontWeight: '500' },
  formCard: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#EFEBE9', padding: 16 },
  formGroupTitle: { fontSize: 9, fontWeight: 'bold', color: '#A1887F', letterSpacing: 1.2, marginBottom: 12, marginTop: 12, textTransform: 'uppercase' },
  labelInput: { fontSize: 12, fontWeight: 'bold', color: '#4A3525', marginBottom: 6 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#EFEBE9', borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 14 },
  inputIcon: { marginRight: 10, width: 14, textAlign: 'center' },
  textInput: { flex: 1, color: '#1A0F05', fontSize: 13, paddingVertical: 0 },
  btnSave: { backgroundColor: '#4A3525', flexDirection: 'row', height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginTop: 20, elevation: 1 },
  btnSaveText: { color: '#fff', fontSize: 13, fontWeight: 'bold', letterSpacing: 0.3 },
  logoSectionContainer: { alignItems: 'center', marginVertical: 8, width: '100%' },
  logoImagePickerBox: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EFEBE9', justifyContent: 'center', alignItems: 'center', elevation: 1, position: 'relative' },
  logoPreviewImage: { width: '100%', height: '100%', borderRadius: 45, resizeMode: 'cover' },
  logoEmptyBox: { alignItems: 'center' },
  logoEmptyBoxText: { fontSize: 8, color: '#BCAAA4', marginTop: 4, fontWeight: 'bold' },
  logoBadgeEditCircle: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#D35400', width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff', elevation: 2 },
  logoHintText: { fontSize: 10, color: '#8D6E63', marginTop: 10, fontStyle: 'italic', textAlign: 'center' }
});