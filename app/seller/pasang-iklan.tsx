// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  ScrollView, Alert, ActivityIndicator, Image, StatusBar 
} from 'react-native';
import { supabase } from '../../supabaseConfig'; 
import { useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// KONFIGURASI PAKET IKLAN STRATEGIS PAMILO-PAY
const PILIHAN_PAKET = [
  { id: 'P3', nama: 'Paket Kilat (3 Hari)', durasiHari: 3, harga: 30000 },
  { id: 'P7', nama: 'Paket Booster (7 Hari)', durasiHari: 7, harga: 60000 },
];

interface ProdukItem {
  id_produk: string;
  nama_produk: string;
}

export default function PasangIklanSellerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingProses, setLoadingProses] = useState(false);
  
  // State Identitas Toko & Saldo Berbasis DDL Baru
  const [idToko, setIdToko] = useState<string | null>(null);
  const [saldoToko, setSaldoToko] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  // State Form Iklan
  const [judulIklan, setJudulIklan] = useState('');
  const [deskripsiIklan, setDeskripsiIklan] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [paketTerpilih, setPaketTerpilih] = useState(PILIHAN_PAKET[0]);

  // State Pilihan Produk Dagangan Toko
  const [daftarProduk, setDaftarProduk] = useState<ProdukItem[]>([]);
  const [produkTerpilihId, setProdukTerpilihId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [namaProdukTerpilih, setNamaProdukTerpilih] = useState('Pilih Produk yang Mau Diiklankan');

  // --- 🟢 TAHAP 1: SINKRONISASI MASTER SELLER BERBASIS DDL REAL ---
  const muatDataMasterSeller = async () => {
    try {
      setLoadingInitial(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return router.back();
      
      const uid = session.user.id;
      setUserId(uid);

      // 1. Ambil id_toko berdasarkan user_id_toko asli DDL
      const { data: dataToko } = await supabase
        .from('toko')
        .select('id_toko') 
        .eq('user_id_toko', uid) 
        .maybeSingle();

      if (!dataToko) {
        Alert.alert("Akses Ditolak", "Tuan belum mendaftarkan toko/mitra.");
        return router.back();
      }
      setIdToko(dataToko.id_toko);

      // 2. 🎯 KALIBRASI SALDO: Ambil langsung dari users.saldo sesuai DDL utama Tuan
      const { data: dataUser } = await supabase
        .from('users')
        .select('saldo')
        .eq('user_id', uid)
        .maybeSingle();
      
      if (dataUser) setSaldoToko(Number(dataUser.saldo) || 0);

      // 3. Tarik seluruh katalog produk milik toko ini (id_toko_produk & nama_produk)
      const { data: produkData } = await supabase
        .from('produk')
        .select('id_produk, nama_produk')
        .eq('id_toko_produk', dataToko.id_toko);

      setDaftarProduk(produkData || []);

    } catch (err) {
      console.error("Gagal menyusun sasis awal form iklan:", err);
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    muatDataMasterSeller();
  }, []);

  // --- AMBIL GAMBAR BANNER PROMO ---
  const pickImageIklan = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) return Alert.alert("Izin Ditolak", "Butuh izin galeri untuk upload banner.");

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [22, 10], 
      quality: 0.6,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  // --- UPLOAD BANNER IKLAN KE STORAGE ---
  const uploadBannerIklan = async () => {
    if (!imageUri) return null;
    const ext = imageUri.split('.').pop() || 'jpg';
    const fileName = `iklan/banner_toko_${Date.now()}.${ext}`;
    
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      name: fileName,
      type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    } as any);

    const { error } = await supabase.storage
      .from('pamilo-assets')
      .upload(fileName, formData, { upsert: true });

    if (error) throw error;

    const { data } = supabase.storage.from('pamilo-assets').getPublicUrl(fileName);
    return data.publicUrl;
  };

  // --- 🚀 EKSEKUSI POTONG SALDO & TAYANGKAN IKLAN ---
  const handleEksekusiBayarIklan = async () => {
    if (!judulIklan || !deskripsiIklan || !imageUri || !produkTerpilihId || !idToko || !userId) {
      return Alert.alert("Data Belum Lengkap", "Mohon isi semua data, pilih produk, dan upload foto banner promosi Tuan.");
    }

    if (saldoToko < paketTerpilih.harga) {
      return Alert.alert("Saldo Kurang 🚨", "Saldo PAMILO-Pay Toko Tuan tidak mencukupi untuk membeli paket iklan ini. Silakan lakukan top-up terlebih dahulu.");
    }

    Alert.alert(
      "Konfirmasi Pembayaran 💳",
      `Saldo PAMILO-Pay Toko akan dipotong sebesar Rp ${paketTerpilih.harga.toLocaleString('id-ID')} untuk durasi ${paketTerpilih.durasiHari} Hari. Lanjutkan?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Ya, Bayar Sekarang",
          onPress: async () => {
            setLoadingProses(true);
            try {
              // 1. Upload file gambar spanduk banner promo ke storage cloud
              const publicBannerUrl = await uploadBannerIklan();
              if (!publicBannerUrl) throw new Error("Gagal memproses upload gambar promo.");

              // 2. 🎯 POTONG KAS UTAMA: Kurangi kolom saldo di tabel users secara mutlak
              const { error: errorPotongSaldo } = await supabase
                .from('users')
                .update({ saldo: saldoToko - paketTerpilih.harga })
                .eq('user_id', userId);

              if (errorPotongSaldo) throw new Error("Gagal melakukan pemotongan saldo finansial PAMILO-Pay Tuan.");

              // 3. 🎯 SATU BUKU MUTASI: Masukkan log pembelian ke transaksi_saldo dengan status SUKSES
              await supabase.from('transaksi_saldo').insert([{
                user_id: userId,
                tipe_transaksi: 'IKLAN_PROMO',
                jumlah: paketTerpilih.harga,
                status_transaksi: 'SUKSES',
                catatan_admin: `Pembayaran ${paketTerpilih.nama} | Produk: ID #${produkTerpilihId.substring(0, 5).toUpperCase()}`
              }]);

              // 4. Hitung tanggal kedaluwarsa iklan otomatis
              const tanggalExpired = new Date();
              tanggalExpired.setDate(tanggalExpired.getDate() + paketTerpilih.durasiHari);

              // 5. Suntikkan iklan langsung ke tabel berita beranda warga Ciamis
              const { error: errorIklan } = await supabase
                .from('berita')
                .insert([{
                  judul_berita: judulIklan.trim(),
                  isi_berita: deskripsiIklan.trim(),
                  gambar_berita: publicBannerUrl,
                  id_produk_berita: produkTerpilihId,
                  is_iklan: true,
                  expired_at: tanggalExpired.toISOString()
                }]);

              if (errorIklan) throw errorIklan;

              Alert.alert(
                "Iklan Sukses Tayang! 🎉",
                `Selamat! Iklan produk Tuan berhasil mengudara di halaman utama selama ${paketTerpilih.durasiHari} hari ke depan.`,
                [{ text: "Mantap", onPress: () => router.replace('/seller') }]
              );

            } catch (err: any) {
              Alert.alert("Gangguan Transaksi", err.message || "Terjadi kesalahan koneksi sirkuit database.");
            } finally {
              setLoadingProses(false);
            }
          }
        }
      ]
    );
  };

  if (loadingInitial) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A3525" />
        <Text style={styles.loadingText}>Menghubungkan ke gerbang periklanan digital...</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Stack.Screen options={{ headerTitle: 'Promosikan Produk (Sponsor)', headerStyle: { backgroundColor: '#4A3525' }, headerTintColor: '#fff' }} />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]} showsVerticalScrollIndicator={false}>
        
        {/* INFO CARD DOMPET SELLER */}
        <View style={styles.walletCard}>
          <View>
            <Text style={styles.walletLabel}>Saldo PAMILO-Pay Toko Anda</Text>
            <Text style={styles.walletValue}>Rp {saldoToko.toLocaleString('id-ID')}</Text>
          </View>
          <FontAwesome5 name="wallet" size={22} color="#fff" />
        </View>

        <View style={styles.formCard}>
          {/* INPUT DROPDOWN PRODUK PILIHAN */}
          <Text style={styles.label}>1. Pilih Produk Jualan Anda</Text>
          <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowDropdown(!showDropdown)}>
            <Text style={[styles.dropdownBtnText, produkTerpilihId !== null && { color: '#212121', fontWeight: 'bold' }]}>
              {namaProdukTerpilih}
            </Text>
            <Ionicons name={showDropdown ? "chevron-up" : "chevron-down"} size={16} color="#4A3525" />
          </TouchableOpacity>

          {showDropdown && (
            <View style={styles.dropdownBox}>
              {daftarProduk.length === 0 ? (
                <Text style={styles.emptyProdukText}>Toko Tuan belum memiliki produk untuk diiklankan.</Text>
              ) : (
                daftarProduk.map((item) => (
                  <TouchableOpacity 
                    key={item.id_produk} 
                    style={styles.dropdownItem} 
                    onPress={() => {
                      setProdukTerpilihId(item.id_produk);
                      setNamaProdukTerpilih(item.nama_produk);
                      setShowDropdown(false);
                    }}
                  >
                    <FontAwesome5 name="box" size={11} color="#A1887F" style={{ marginRight: 8 }} />
                    <Text style={styles.dropdownItemText}>{item.nama_produk}</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* INPUT TEKS BANNER */}
          <Text style={styles.label}>2. Kalimat Judul Banner Promo</Text>
          <TextInput 
            style={styles.input}
            placeholder="Contoh: Diskon Maksi 50% Khusus Hari Ini!"
            value={judulIklan}
            onChangeText={setJudulIklan}
            placeholderTextColor="#BCAAA4"
          />

          <Text style={styles.label}>3. Detail Keterangan Singkat</Text>
          <TextInput 
            style={[styles.input, styles.textArea]}
            placeholder="Tulis info pendukung biar pembeli ngiler untuk klik..."
            value={deskripsiIklan}
            onChangeText={setDeskripsiIklan}
            multiline
            numberOfLines={3}
            placeholderTextColor="#BCAAA4"
          />

          {/* CHOOSE BANNER BROSUR */}
          <Text style={styles.label}>4. Upload Desain Brosur Spanduk (Rasio 2.2)</Text>
          <TouchableOpacity style={styles.pickerBox} onPress={pickImageIklan}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
            ) : (
              <View style={styles.placeholderGroup}>
                <MaterialIcons name="add-photo-alternate" size={32} color="#D35400" />
                <Text style={styles.placeholderText}>Pilih Foto Banner Kreatif Dari Galeri</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* PILIHAN DURASI PAKET BERBAYAR */}
          <Text style={styles.label}>5. Pilih Paket Durasi Tayang Sponsor</Text>
          <View style={styles.paketRow}>
            {PILIHAN_PAKET.map((p) => (
              <TouchableOpacity 
                key={p.id} 
                style={[styles.paketBtn, paketTerpilih.id === p.id && styles.paketBtnActive]}
                onPress={() => setPaketTerpilih(p)}
                activeOpacity={0.7}
              >
                <Text style={[styles.paketTitle, paketTerpilih.id === p.id && { color: '#D35400' }]}>{p.nama}</Text>
                <Text style={[styles.paketPrice, paketTerpilih.id === p.id && { color: '#D35400' }]}>Rp {p.harga.toLocaleString('id-ID')}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ACTION BUTTON TRANSAKSI */}
          <TouchableOpacity 
            style={[styles.btnBeli, (saldoToko < paketTerpilih.harga || loadingProses) && styles.btnDisabled]}
            onPress={handleEksekusiBayarIklan}
            disabled={saldoToko < paketTerpilih.harga || loadingProses}
            activeOpacity={0.8}
          >
            {loadingProses ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnBeliText}>BAYAR & KIBARKAN SPONSOR 🚀</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#FAF8F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF8F5', padding: 20 },
  loadingText: { marginTop: 12, color: '#4A3525', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  scrollContent: { padding: 16 },
  walletCard: { backgroundColor: '#4A3525', borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, elevation: 2 },
  walletLabel: { fontSize: 11, color: '#FFF3E0', fontWeight: '500' },
  walletValue: { fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 4 },
  formCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#EFEBE9', elevation: 1 },
  label: { fontSize: 11, fontWeight: 'bold', color: '#4A3525', marginTop: 6, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#FDFBF9', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#D7CCC8', color: '#212121', fontSize: 13 },
  textArea: { height: 70, textAlignVertical: 'top' },
  dropdownBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FDFBF9', borderWidth: 1, borderColor: '#D7CCC8', borderRadius: 10, padding: 12, marginBottom: 14 },
  dropdownBtnText: { fontSize: 13, color: '#BCAAA4' },
  dropdownBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D7CCC8', borderRadius: 10, marginTop: -10, marginBottom: 14, maxHeight: 150, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  dropdownItemText: { fontSize: 13, color: '#4A3525' },
  emptyProdukText: { padding: 12, fontSize: 11, color: '#8D6E63', fontStyle: 'italic', textAlign: 'center' },
  pickerBox: { width: '100%', aspectRatio: 2.2, borderRadius: 12, borderWidth: 2, borderColor: '#D7CCC8', borderStyle: 'dashed', backgroundColor: '#FDFBF9', justifyContent: 'center', alignItems: 'center', marginBottom: 16, overflow: 'hidden' },
  preview: { width: '100%', height: '100%' },
  placeholderGroup: { alignItems: 'center' },
  placeholderText: { fontSize: 11, color: '#8D6E63', marginTop: 6, fontWeight: '600' },
  paketRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  paketBtn: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#EFEBE9', borderRadius: 12, padding: 12, alignItems: 'center' },
  paketBtnActive: { borderColor: '#D35400', backgroundColor: '#FFFAF1', borderWidth: 1.5 },
  paketTitle: { fontSize: 11, fontWeight: 'bold', color: '#4A3525' },
  paketPrice: { fontSize: 13, fontWeight: '900', color: '#8D6E63', marginTop: 4 },
  btnBeli: { backgroundColor: '#D35400', padding: 14, borderRadius: 25, alignItems: 'center', elevation: 2 },
  btnDisabled: { backgroundColor: '#BCAAA4', elevation: 0 },
  btnBeliText: { color: '#fff', fontWeight: 'bold', fontSize: 13, letterSpacing: 0.5 }
});