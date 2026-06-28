// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  ScrollView, Alert, ActivityIndicator, Image, StatusBar 
} from 'react-native';
import { supabase } from '../../supabaseConfig'; 
import { useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function InputBeritaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // 🟢 STATE NAVIGASI TAB (Tujuan Publikasi)
  const [activeTab, setActiveTab] = useState<'BERANDA' | 'BANNER_GALUH' | 'KABAR_GALUH'>('BERANDA');

  // STATE FORM INPUT
  const [judul, setJudul] = useState('');
  const [isi, setIsi] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // STATE RIWAYAT TAYANGAN
  const [riwayatKonten, setRiwayatKonten] = useState<any[]>([]);
  const [loadingRiwayat, setLoadingRiwayat] = useState(true);

  // --- 🟢 TAHAP 1: AMBIL RIWAYAT BERDASARKAN TAB AKTIF ---
  const muatRiwayatKonten = async () => {
    try {
      setLoadingRiwayat(true);
      
      let dataSasis = [];
      if (activeTab === 'BERANDA') {
        const { data } = await supabase.from('berita').select('*').order('created_at', { ascending: false });
        dataSasis = data || [];
      } 
      else if (activeTab === 'BANNER_GALUH') {
        const { data } = await supabase.from('berita_website').select('*').order('created_at', { ascending: false });
        dataSasis = data || [];
      } 
      else if (activeTab === 'KABAR_GALUH') {
        const { data } = await supabase.from('berita_galuh').select('*').order('created_at', { ascending: false });
        dataSasis = data || [];
      }

      setRiwayatKonten(dataSasis);
    } catch (err: any) {
      console.error("Gagal memuat riwayat konten:", err);
    } finally {
      setLoadingRiwayat(false);
    }
  };

  useEffect(() => {
    muatRiwayatKonten();
    // Bersihkan form saat pindah tab
    setJudul(''); setIsi(''); setImageUri(null);
  }, [activeTab]);

  // --- AMBIL GAMBAR DARI GALERI ---
  const pickBannerImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Izin Ditolak", "Aplikasi butuh izin akses galeri untuk mengunggah foto banner.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [22, 10], 
      quality: 0.8,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  // --- UPLOAD GAMBAR KE SUPABASE STORAGE ---
  const uploadBannerToStorage = async () => {
    if (!imageUri) return null;
    const ext = imageUri.split('.').pop() || 'jpg';
    const fileName = `berita/banner_${Date.now()}.${ext}`;
    
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      name: fileName,
      type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    } as any);

    const { error } = await supabase.storage.from('pamilo-assets').upload(fileName, formData, { upsert: true });
    if (error) throw error;

    const { data: publicUrlData } = supabase.storage.from('pamilo-assets').getPublicUrl(fileName);
    return publicUrlData.publicUrl;
  };

  // --- 🟢 EKSEKUSI PENERBITAN KONTEN (SMART ROUTER) ---
  const handlePublishBerita = async () => {
    if (!judul || !isi) return Alert.alert("Data Kosong", "Judul dan deskripsi informasi wajib diisi.");
    if (activeTab !== 'KABAR_GALUH' && !imageUri) return Alert.alert("Gambar Kosong", "Desain banner wajib diunggah.");

    setLoading(true);
    try {
      let fotoUrl = null;
      if (activeTab !== 'KABAR_GALUH') {
        fotoUrl = await uploadBannerToStorage();
        if (!fotoUrl) throw new Error("Gagal mengunggah gambar banner ke satelit.");
      }

      // 🔀 CABANG 1: TABEL BERANDA UTAMA (berita)
      if (activeTab === 'BERANDA') {
        const { error } = await supabase.from('berita').insert([{
          judul_berita: judul.trim(), isi_berita: isi.trim(), gambar_berita: fotoUrl, is_iklan: false
        }]);
        if (error) throw error;
      } 
      // 🔀 CABANG 2: TABEL BANNER INFO GALUH (berita_website)
      else if (activeTab === 'BANNER_GALUH') {
        const slugText = judul.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now();
        const { error } = await supabase.from('berita_website').insert([{
          judul: judul.trim(), slug: slugText, kategori: 'Info Galuh', konten: isi.trim(), gambar_thumbnail: fotoUrl, status: 'published'
        }]);
        if (error) throw error;
      } 
      // 🔀 CABANG 3: TABEL KABAR TEKS HARIAN GALUH (berita_galuh)
      else if (activeTab === 'KABAR_GALUH') {
        const tanggalHariIni = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const { error } = await supabase.from('berita_galuh').insert([{
          judul: judul.trim(), deskripsi_pendek: isi.trim(), tanggal_tayang: tanggalHariIni, tipe_ikon: 'newspaper', warna_tema: '#0288D1'
        }]);
        if (error) throw error;
      }

      Alert.alert("Penerbitan Sukses! 📢", "Konten informasi baru berhasil mengudara.");
      setJudul(''); setIsi(''); setImageUri(null);
      muatRiwayatKonten();

    } catch (error: any) {
      Alert.alert("Gagal Mengudara ❌", error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 🟢 EKSEKUSI HAPUS KONTEN ---
  const handleHapusKonten = (idRecord: string, judulKonten: string) => {
    Alert.alert(
      "Konfirmasi Hapus 🚨",
      `Apakah Owner yakin ingin mencabut dan menghapus permanen tayangan: "${judulKonten}"?`,
      [
        { text: "Batal", style: "cancel" },
        { 
          text: "Ya, Hapus", 
          style: "destructive",
          onPress: async () => {
            try {
              let errorRes = null;

              if (activeTab === 'BERANDA') {
                const { error } = await supabase.from('berita').delete().eq('id_berita', idRecord);
                errorRes = error;
              } else if (activeTab === 'BANNER_GALUH') {
                const { error } = await supabase.from('berita_website').delete().eq('id', idRecord);
                errorRes = error;
              } else if (activeTab === 'KABAR_GALUH') {
                const { error } = await supabase.from('berita_galuh').delete().eq('id', idRecord);
                errorRes = error;
              }

              if (errorRes) throw errorRes;
              Alert.alert("Terhapus! 🗑️", "Tayangan telah dicabut dari aplikasi warga.");
              muatRiwayatKonten();
            } catch (err: any) {
              Alert.alert("Gagal Menghapus", err.message);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.mainWrapper}>
      <Stack.Screen options={{ headerTitle: 'Master Berita & Banner', headerStyle: { backgroundColor: '#1A0F05' }, headerTintColor: '#fff', headerTitleStyle: { fontSize: 15 } }} />
      <StatusBar barStyle="light-content" backgroundColor="#1A0F05" />

      {/* 🟢 TOP NAVIGATION TAB (SELECTOR TARGET PUBLIKASI) */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'BERANDA' && styles.tabBtnActive]} onPress={() => setActiveTab('BERANDA')}>
            <Ionicons name="home" size={14} color={activeTab === 'BERANDA' ? "#fff" : "#8D6E63"} style={{marginRight: 6}} />
            <Text style={[styles.tabTxt, activeTab === 'BERANDA' && styles.tabTxtActive]}>Banner Beranda</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'BANNER_GALUH' && styles.tabBtnActive]} onPress={() => setActiveTab('BANNER_GALUH')}>
            <FontAwesome5 name="landmark" size={12} color={activeTab === 'BANNER_GALUH' ? "#fff" : "#8D6E63"} style={{marginRight: 6}} />
            <Text style={[styles.tabTxt, activeTab === 'BANNER_GALUH' && styles.tabTxtActive]}>Banner Galuh</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'KABAR_GALUH' && styles.tabBtnActive]} onPress={() => setActiveTab('KABAR_GALUH')}>
            <Ionicons name="newspaper" size={14} color={activeTab === 'KABAR_GALUH' ? "#fff" : "#8D6E63"} style={{marginRight: 6}} />
            <Text style={[styles.tabTxt, activeTab === 'KABAR_GALUH' && styles.tabTxtActive]}>Teks Kabar Galuh</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        
        {/* PANEL INPUT FORM */}
        <View style={styles.formCard}>
          <Text style={styles.mainGroupTitle}>
            📢 BUAT {activeTab === 'KABAR_GALUH' ? 'KABAR HARIAN' : 'BANNER PROMO'} BARU
          </Text>
          
          <Text style={styles.label}>Judul Sorotan / Promo</Text>
          <TextInput style={styles.input} placeholder="Contoh: Diskon Gila Pasar..." value={judul} onChangeText={setJudul} placeholderTextColor="#BCAAA4" />

          <Text style={styles.label}>{activeTab === 'KABAR_GALUH' ? 'Isi Deskripsi Berita Singkat' : 'Isi Keterangan Promo'}</Text>
          <TextInput style={[styles.input, styles.textArea]} placeholder="Tulis detail agar warga tertarik..." value={isi} onChangeText={setIsi} multiline numberOfLines={4} placeholderTextColor="#BCAAA4" />

          {/* 🟢 HIDE IMAGE PICKER JIKA MODE KABAR_GALUH (Karena tabel tidak punya kolom gambar) */}
          {activeTab !== 'KABAR_GALUH' && (
            <>
              <Text style={styles.label}>Desain Banner Slider (Wajib - Rasio 2.2)</Text>
              <TouchableOpacity style={styles.imagePickerBtn} onPress={pickBannerImage}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <MaterialIcons name="add-photo-alternate" size={28} color="#8D6E63" />
                    <Text style={styles.imagePlaceholderText}>Pilih Brosur Pamflet / Banner Galeri</Text>
                  </View>
                )}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.btnSubmit} onPress={handlePublishBerita} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>TERBITKAN KONTEN SEKARANG 🚀</Text>}
          </TouchableOpacity>
        </View>

        {/* PANEL RIWAYAT TAYANGAN */}
        <Text style={styles.sectionDividerTitle}>📋 DAFTAR KONTEN {activeTab === 'KABAR_GALUH' ? 'KABAR TEKS' : 'BANNER'} TAYANG</Text>

        {loadingRiwayat ? (
          <ActivityIndicator size="small" color="#4A3525" style={{ marginTop: 20 }} />
        ) : riwayatKonten.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="folder-open" size={24} color="#D7CCC8" />
            <Text style={styles.emptyText}>Belum ada arsip tayangan untuk kategori ini.</Text>
          </View>
        ) : (
          riwayatKonten.map((item) => {
            const currentId = activeTab === 'BERANDA' ? item.id_berita : item.id;
            const currentJudul = activeTab === 'BERANDA' ? item.judul_berita : item.judul;
            const currentDesc = activeTab === 'BERANDA' ? item.isi_berita : (activeTab === 'BANNER_GALUH' ? item.konten : item.deskripsi_pendek);
            const currentImg = activeTab === 'BERANDA' ? item.gambar_berita : item.gambar_thumbnail;

            return (
              <View key={currentId} style={styles.historyCard}>
                {activeTab !== 'KABAR_GALUH' ? (
                  <Image source={{ uri: currentImg }} style={styles.historyImage} resizeMode="cover" />
                ) : (
                  <View style={styles.historyIconTextBg}><Ionicons name="newspaper" size={22} color="#0288D1" /></View>
                )}
                
                <View style={styles.historyInfo}>
                  <Text style={styles.historyTitle} numberOfLines={1}>{currentJudul}</Text>
                  <Text style={styles.historySub} numberOfLines={2}>{currentDesc}</Text>
                  <Text style={styles.historyDate}>
                    📅 {item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                  </Text>
                </View>
                
                <TouchableOpacity style={styles.btnDelete} onPress={() => handleHapusKonten(currentId, currentJudul)}>
                  <Ionicons name="trash-bin" size={18} color="#C62828" />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: '#FAF8F5' },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  tabContainer: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EFEBE9', paddingVertical: 10, elevation: 2 },
  tabScrollContent: { paddingHorizontal: 16, gap: 10, alignItems: 'center' },
  tabBtn: { flexDirection: 'row', backgroundColor: '#F5EFEA', paddingHorizontal: 16, height: 34, borderRadius: 17, alignItems: 'center', borderWidth: 1, borderColor: '#D7CCC8' },
  tabBtnActive: { backgroundColor: '#4A3525', borderColor: '#4A3525' },
  tabTxt: { fontSize: 11, fontWeight: 'bold', color: '#8D6E63' },
  tabTxtActive: { color: '#fff' },
  mainGroupTitle: { fontSize: 11, fontWeight: 'bold', color: '#D35400', letterSpacing: 1, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F5EFEA', paddingBottom: 8 },
  formCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#EFEBE9', elevation: 1 },
  label: { fontSize: 11, fontWeight: 'bold', color: '#4A3525', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#FDFBF9', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#D7CCC8', color: '#4A3525', fontSize: 13 },
  textArea: { height: 80, textAlignVertical: 'top' },
  imagePickerBtn: { width: '100%', aspectRatio: 2.2, borderRadius: 12, borderWidth: 2, borderColor: '#D7CCC8', borderStyle: 'dashed', backgroundColor: '#FDFBF9', justifyContent: 'center', alignItems: 'center', marginBottom: 20, overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%' },
  imagePlaceholder: { alignItems: 'center' },
  imagePlaceholderText: { color: '#8D6E63', fontSize: 11, marginTop: 6, fontWeight: '600' },
  btnSubmit: { backgroundColor: '#D35400', padding: 14, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 13, letterSpacing: 0.8 },
  sectionDividerTitle: { fontSize: 10, fontWeight: 'bold', color: '#A1887F', letterSpacing: 1, marginBottom: 12, marginTop: 24, paddingLeft: 2 },
  emptyContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#EFEBE9' },
  emptyText: { color: '#8D6E63', fontSize: 11, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
  historyCard: { backgroundColor: '#fff', borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#EFEBE9', elevation: 1 },
  historyImage: { width: 70, height: 45, borderRadius: 6, backgroundColor: '#FAF8F5' },
  historyIconTextBg: { width: 50, height: 45, borderRadius: 6, backgroundColor: '#E1F5FE', justifyContent: 'center', alignItems: 'center' },
  historyInfo: { flex: 1, marginLeft: 12, paddingRight: 8 },
  historyTitle: { fontSize: 12, fontWeight: 'bold', color: '#4A3525' },
  historySub: { fontSize: 10, color: '#8D6E63', marginTop: 2, lineHeight: 14 },
  historyDate: { fontSize: 9, color: '#BCAAA4', fontWeight: 'bold', marginTop: 4 },
  btnDelete: { padding: 10, backgroundColor: '#FFEBEE', borderRadius: 8, borderWidth: 0.5, borderColor: '#FFCDD2', justifyContent: 'center', alignItems: 'center' }
});