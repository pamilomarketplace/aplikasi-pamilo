import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image'; 
import { supabase } from '@/supabaseConfig';

export default function FormProdukMitraScreen() {
  const router = useRouter();
  
  // 🎯 SENSOR MODE: Jika id_produk ada = Mode Edit, Jika tidak = Mode Tambah
  const { id_produk } = useLocalSearchParams();
  const isEditMode = !!id_produk;

  const [loadingAwal, setLoadingAwal] = useState(isEditMode); 
  const [saving, setSaving] = useState(false);

  // --- STATE FORMULIR ---
  const [nama, setNama] = useState('');
  const [harga, setHarga] = useState('');
  const [stok, setStok] = useState('10'); 
  const [kategori, setKategori] = useState('FOOD'); 
  const [varian, setVarian] = useState(''); // 🟢 STATE BARU UNTUK VARIAN PRODUK
  const [deskripsi, setDeskripsi] = useState('');
  const [fotoLamaUrl, setFotoLamaUrl] = useState(''); 
  const [fotoBaruUri, setFotoBaruUri] = useState<string | null>(null); 

  const daftarKategori = [
    { id: 'FOOD', label: '🍔 Pamilo Food' },
    { id: 'MART', label: '🛒 Pamilo Mart' },
    { id: 'SERVIS', label: '🛠️ Pamilo Servis' },
  ];

  // 📡 EKSEKUSI RADAR: Menarik data jika Mode Edit
  useEffect(() => {
    if (isEditMode) ambilDetailProdukLama();
  }, [id_produk]);

  const ambilDetailProdukLama = async () => {
    try {
      const { data, error } = await supabase.from('produk').select('*').eq('id_produk', id_produk).single();
      if (error) throw error;

      if (data) {
        setNama(data.nama_produk || '');
        setHarga(String(data.harga_produk || 0));
        setStok(String(data.stok_ready_produk ?? 0));
        setKategori((data.kategori_produk || 'FOOD').toUpperCase().trim());
        setVarian(data.pilihan_varian || ''); // 🟢 MENARIK DATA VARIAN LAMA
        setDeskripsi(data.deskripsi_produk || '');
        setFotoLamaUrl(data.foto_produk || '');
      }
    } catch (error: any) {
      Alert.alert("Gagal", error.message);
      router.back();
    }  finally {
      setLoadingAwal(false);
    }
  };

  const handlePilihGambar = async () => {
    Alert.alert(
      "Sumber Foto Produk", "Silakan pilih jalur gambar:",
      [
        {
          text: "Buka Kamera",
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') return Alert.alert("Ditolak", "Butuh izin kamera.");
            let hasil = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5 });
            if (!hasil.canceled) setFotoBaruUri(hasil.assets[0].uri);
          }
        },
        {
          text: "Ambil dari Galeri HP",
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') return Alert.alert("Ditolak", "Butuh izin galeri.");
            let hasil = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5 });
            if (!hasil.canceled) setFotoBaruUri(hasil.assets[0].uri);
          }
        },
        { text: "Batal", style: "cancel" }
      ]
    );
  };

  const prosesUploadFotoCloud = async (uri: string): Promise<string | null> => {
    try {
      if (isEditMode && fotoLamaUrl && fotoLamaUrl.includes('pamilo-assets')) {
        const namaFileLama = fotoLamaUrl.split('/').pop();
        if (namaFileLama) await supabase.storage.from('pamilo-assets').remove([`toko/${namaFileLama}`]);
      }

      const ekstensi = uri.split('.').pop() || 'jpg';
      const namaFileUnik = `toko/prod_${Date.now()}.${ekstensi}`;
      const formData = new FormData();
      formData.append('file', { uri, name: namaFileUnik, type: `image/${ekstensi === 'png' ? 'png' : 'jpeg'}` } as any);

      const { error } = await supabase.storage.from('pamilo-assets').upload(namaFileUnik, formData, { upsert: true });
      if (error) throw error;

      const { data: publicUrlData } = supabase.storage.from('pamilo-assets').getPublicUrl(namaFileUnik);
      return publicUrlData.publicUrl;
    } catch (error) {
      return null;
    }
  };

  const handleSimpanProduk = async () => {
    if (!nama.trim() || !harga.trim() || !stok.trim() || !kategori) {
      return Alert.alert("Peringatan", "Mohon lengkapi formulir wajib (*).");
    }
    if (!isEditMode && !fotoBaruUri) {
      return Alert.alert("Foto Belum Ada", "Wajib melampirkan foto produk dagangan.");
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Sesi login tidak valid.");

      let urlGambarFinal = fotoLamaUrl; 
      if (fotoBaruUri) {
        const hasilUpload = await prosesUploadFotoCloud(fotoBaruUri);
        if (!hasilUpload) throw new Error("Gagal mengunggah gambar ke server.");
        urlGambarFinal = hasilUpload;
      }

      const payloadData = {
        nama_produk: nama.trim(),
        harga_produk: parseFloat(harga) || 0,
        stok_ready_produk: parseInt(stok, 10) || 0,
        kategori_produk: kategori, 
        kategori_label_produk: kategori, 
        pilihan_varian: varian.trim() ? varian.trim() : null, // 🟢 MENGUNCI DATA VARIAN KE DATABASE
        deskripsi_produk: deskripsi.trim(),
        foto_produk: urlGambarFinal
      };

      if (isEditMode) {
        const { error } = await supabase.from('produk').update(payloadData).eq('id_produk', id_produk);
        if (error) throw error;
        Alert.alert("Sukses", "Data produk berhasil diperbarui!", [{ text: "OK", onPress: () => router.back() }]);
      } else {
        const { data: dataToko } = await supabase.from('toko').select('id_toko').eq('user_id_toko', session.user.id).maybeSingle();
        if (!dataToko) throw new Error("Profil tokomu tidak ditemukan. Buat toko terlebih dahulu.");

        const { error } = await supabase.from('produk').insert([{ ...payloadData, id_toko_produk: dataToko.id_toko, terjual: 0 }]);
        if (error) throw error;
        Alert.alert("Rilis Berhasil!", "Produk barumu sukses masuk etalase.", [{ text: "OK", onPress: () => router.back() }]);
      }

    } catch (error: any) {
      Alert.alert("Gagal Memproses", error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loadingAwal) {
    return (
      <View style={styles.centerLoading}>
        <ActivityIndicator size="large" color="#4A3525" />
        <Text style={styles.loadingText}>Membongkar arsip produk...</Text>
      </View>
    );
  }

  const displayImageUri = fotoBaruUri || fotoLamaUrl;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen 
        options={{ 
          title: isEditMode ? 'Edit Informasi Produk' : 'Tambah Produk Baru', 
          headerStyle: { backgroundColor: '#4A3525' }, 
          headerTintColor: '#fff' 
        }} 
      />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />
      
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* BAGIAN FOTO */}
        <View style={styles.imageSection}>
          <Text style={styles.inputLabel}>Foto Produk Dagangan {isEditMode ? '' : '*'}</Text>
          <TouchableOpacity style={styles.imagePickerBox} onPress={handlePilihGambar} activeOpacity={0.8}>
            {displayImageUri ? (
              <>
                <Image source={{ uri: displayImageUri }} style={styles.previewImage} contentFit="cover" transition={200} />
                <View style={styles.badgeEditFoto}><Ionicons name="camera" size={14} color="#fff" /></View>
              </>
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Ionicons name="camera-outline" size={32} color="#8D6E63" />
                <Text style={styles.uploadText}>Klik untuk Pilih Foto (1:1)</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* BAGIAN FORMULIR */}
        <View style={styles.formSection}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nama Produk *</Text>
            <View style={styles.inputWrapper}>
              <FontAwesome5 name="box" size={13} color="#A1887F" style={styles.inputIcon} />
              <TextInput style={styles.textInput} placeholder="Contoh: Nasi Goreng Spesial" placeholderTextColor="#BCAAA4" value={nama} onChangeText={setNama} />
            </View>
          </View>

          <View style={styles.rowInputs}>
            <View style={[styles.inputGroup, { flex: 1.8, marginRight: 12 }]}>
              <Text style={styles.inputLabel}>Harga Jual (Rp) *</Text>
              <View style={styles.inputWrapper}>
                <FontAwesome5 name="money-bill-wave" size={11} color="#A1887F" style={styles.inputIcon} />
                <TextInput style={styles.textInput} keyboardType="numeric" placeholder="15000" placeholderTextColor="#BCAAA4" value={harga} onChangeText={setHarga} />
              </View>
            </View>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Stok Siap *</Text>
              <View style={styles.inputWrapper}>
                <FontAwesome5 name="layer-group" size={11} color="#A1887F" style={styles.inputIcon} />
                <TextInput style={styles.textInput} keyboardType="numeric" placeholder="10" placeholderTextColor="#BCAAA4" value={stok} onChangeText={setStok} />
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Kategori Pilar Utama *</Text>
            <View style={styles.chipsContainer}>
              {daftarKategori.map((kat) => (
                <TouchableOpacity key={kat.id} style={[styles.chip, kategori === kat.id && styles.chipSelected]} onPress={() => setKategori(kat.id)}>
                  <Text style={[styles.chipText, kategori === kat.id && styles.chipTextSelected]}>{kat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 🟢 BAGIAN INPUT VARIAN PRODUK (OPSIONAL) */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Pilihan Varian (Opsional)</Text>
            <View style={styles.inputWrapper}>
              <FontAwesome5 name="tags" size={11} color="#A1887F" style={styles.inputIcon} />
              <TextInput 
                style={styles.textInput} 
                placeholder="Contoh: Merah, Biru, Hitam" 
                placeholderTextColor="#BCAAA4" 
                value={varian} 
                onChangeText={setVarian} 
              />
            </View>
            <Text style={styles.helperText}>💡 Pisahkan dengan koma jika ada lebih dari 1 pilihan (Cth: Biasa, Pedas, Sedang).</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Deskripsi Lengkap</Text>
            <TextInput 
              style={styles.textAreaInput} 
              placeholder="Jelaskan detail keunggulan produk/jasa Tuan..." 
              placeholderTextColor="#BCAAA4" 
              multiline 
              numberOfLines={4} 
              textAlignVertical="top" 
              value={deskripsi} 
              onChangeText={setDeskripsi} 
            />
          </View>

          <TouchableOpacity style={[styles.btnSave, saving && { backgroundColor: '#A1887F' }]} onPress={handleSimpanProduk} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : (
              <View style={styles.btnInnerContent}>
                <Ionicons name={isEditMode ? "save-outline" : "cloud-upload-outline"} size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.btnSaveText}>{isEditMode ? "Simpan Perubahan" : "Rilis Produk Baru"}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5', padding: 18 },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF8F5' },
  loadingText: { marginTop: 10, fontSize: 12, color: '#8D6E63', fontWeight: 'bold' },
  imageSection: { marginBottom: 18, alignItems: 'center' },
  imagePickerBox: { width: 140, height: 140, borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: '#D7CCC8', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  previewImage: { width: '100%', height: '100%', borderRadius: 14 },
  uploadPlaceholder: { alignItems: 'center' },
  uploadText: { fontSize: 11, color: '#8D6E63', fontWeight: 'bold', marginTop: 8 },
  badgeEditFoto: { position: 'absolute', bottom: -6, right: -6, backgroundColor: '#D35400', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FAF8F5', elevation: 2 },
  formSection: { marginTop: 4 },
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 11, fontWeight: '900', color: '#4A3525', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#EFEBE9', paddingHorizontal: 12, height: 46 },
  inputIcon: { marginRight: 8 },
  textInput: { flex: 1, fontSize: 13, color: '#4A3525', fontWeight: '600' },
  helperText: { fontSize: 9, color: '#8D6E63', marginTop: 6, fontStyle: 'italic', paddingHorizontal: 4 }, // 🟢 STYLE BANTUAN VARIAN
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 },
  chip: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#EFEBE9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 6, marginBottom: 8 },
  chipSelected: { backgroundColor: '#4A3525', borderColor: '#4A3525', elevation: 1 },
  chipText: { fontSize: 11, color: '#8D6E63', fontWeight: '600' },
  chipTextSelected: { color: '#fff', fontWeight: 'bold' },
  textAreaInput: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#EFEBE9', padding: 14, fontSize: 13, color: '#4A3525', fontWeight: '500', minHeight: 100 },
  btnSave: { backgroundColor: '#D35400', height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginTop: 14, elevation: 2 },
  btnInnerContent: { flexDirection: 'row', alignItems: 'center' },
  btnSaveText: { color: '#fff', fontSize: 13, fontWeight: 'bold', letterSpacing: 0.5 }
});