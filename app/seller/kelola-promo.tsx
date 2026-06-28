// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity, 
  StatusBar, ActivityIndicator, Alert 
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../supabaseConfig';

export default function KelolaPromoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [idToko, setIdToko] = useState<string | null>(null);

  const [tipePromoTerpilih, setTipePromoTerpilih] = useState<1 | 2 | 3>(1);

  const [nilaiPotongan, setNilaiPotongan] = useState('');
  const [minBelanja, setMinBelanja] = useState('0');
  const [kodeVoucher, setKodeVoucher] = useState('');
  const [kuota, setKuota] = useState('100');
  const [tipePotongan, setTipePotongan] = useState<'NOMINAL' | 'PERSEN'>('NOMINAL');

  const [daftarProduk, setDaftarProduk] = useState<any[]>([]);
  const [idProdukTerpilih, setIdProdukTerpilih] = useState<string | null>(null);

  // 🟢 STATE BARU: PENAMPUNG DAFTAR PROMO AKTIF
  const [daftarPromoAktif, setDaftarPromoAktif] = useState<any[]>([]);

  const fetchDataTokoDanProduk = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: dataToko } = await supabase
        .from('toko')
        .select('id_toko')
        .eq('user_id_toko', session.user.id)
        .maybeSingle();

      if (dataToko) {
        setIdToko(dataToko.id_toko);

        const { data: dataProd } = await supabase
          .from('produk')
          .select('id_produk, nama_produk, harga_produk')
          .eq('id_toko_produk', dataToko.id_toko);
        
        if (dataProd) setDaftarProduk(dataProd);

        // 🟢 TARIK DATA PROMO AKTIF TOKO INI
        const { data: promoData } = await supabase
          .from('promosi_toko')
          .select('*')
          .eq('id_toko_promo', dataToko.id_toko)
          .gt('kuota_promo', 0)
          .order('created_at', { ascending: false });
          
        if (promoData) setDaftarPromoAktif(promoData);
      }
    } catch (e) { console.log(e); }
  };

  useEffect(() => { fetchDataTokoDanProduk(); }, []);

  const handleSimpanPromoLapak = async () => {
    if (!idToko) return Alert.alert("Eror", "ID Toko Anda tidak terdeteksi.");
    if (!nilaiPotongan || parseInt(nilaiPotongan) <= 0) return Alert.alert("Input Salah", "Masukkan nilai potongan diskon yang valid.");

    try {
      setLoading(true);

      if (tipePromoTerpilih === 1) {
        if (!idProdukTerpilih) { setLoading(false); return Alert.alert("Produk Kosong", "Silakan pilih produk yang ingin didiskon."); }

        const produkDipilih = daftarProduk.find(p => p.id_produk === idProdukTerpilih);
        if (!produkDipilih) return;

        const hargaAsli = parseInt(produkDipilih.harga_produk);
        const diskon = parseInt(nilaiPotongan);
        const hargaBaru = tipePotongan === 'NOMINAL' ? (hargaAsli - diskon) : (hargaAsli - (hargaAsli * (diskon / 100)));

        if (hargaBaru <= 0) { setLoading(false); return Alert.alert("Gagal", "Nilai diskon tidak boleh melebihi atau sama dengan harga asli produk!"); }

        const { error } = await supabase
          .from('produk')
          .update({ harga_coret_produk: hargaAsli, harga_produk: Math.round(hargaBaru), is_promo: true })
          .eq('id_produk', idProdukTerpilih);

        if (error) throw error;
        Alert.alert("Sukses! 🏷️", `Harga produk "${produkDipilih.nama_produk}" resmi dicoret & didiskon di beranda warga.`);
      }

      else {
        if (tipePromoTerpilih === 2 && !kodeVoucher.trim()) {
          setLoading(false); return Alert.alert("Kode Kosong", "Ketik kode unik kupon voucher Anda, Tuan.");
        }

        const { error } = await supabase
          .from('promosi_toko')
          .insert([{
            id_toko_promo: idToko, jenis_promo: tipePromoTerpilih === 2 ? 'VOUCHER_KODE' : 'MIN_BELANJA',
            kode_promo: tipePromoTerpilih === 2 ? kodeVoucher.trim().toUpperCase() : null,
            tipe_potongan: tipePotongan, nilai_potongan: parseInt(nilaiPotongan),
            minimal_belanja: parseInt(minBelanja || '0'), kuota_promo: parseInt(kuota || '100')
          }]);

        if (error) throw error;
        Alert.alert("Sukses Terpasang! 🎉", tipePromoTerpilih === 2 ? `Kode Kupon Voucher "${kodeVoucher.toUpperCase()}" aktif mengudara.` : "Diskon otomatis minimum belanja berhasil diterapkan di lapak Tuan.");
      }

      setNilaiPotongan(''); setKodeVoucher(''); setMinBelanja('0');
      fetchDataTokoDanProduk();

    } catch (err: any) { Alert.alert("Gagal Menyimpan", err.message); } 
    finally { setLoading(false); }
  };

  const handleHapusPromo = async (id_promo: string) => {
    try {
        await supabase.from('promosi_toko').delete().eq('id', id_promo);
        fetchDataTokoDanProduk(); // Refresh daftar
    } catch (e) { console.log(e); }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Generator Promo Toko', headerStyle: { backgroundColor: '#4A3525' }, headerTintColor: '#fff' }} />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]} showsVerticalScrollIndicator={false}>
        
        <Text style={styles.sectionTitle}>PILIH JENIS STRATEGI DISKON TUAN</Text>
        
        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tabButton, tipePromoTerpilih === 1 && styles.tabButtonActive]} onPress={() => setTipePromoTerpilih(1)}>
            <FontAwesome5 name="tag" size={12} color={tipePromoTerpilih === 1 ? '#fff' : '#4A3525'} />
            <Text style={[styles.tabText, tipePromoTerpilih === 1 && styles.tabTextActive]}>Potong Harga</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.tabButton, tipePromoTerpilih === 2 && styles.tabButtonActive]} onPress={() => setTipePromoTerpilih(2)}>
            <FontAwesome5 name="ticket-alt" size={11} color={tipePromoTerpilih === 2 ? '#fff' : '#4A3525'} />
            <Text style={[styles.tabText, tipePromoTerpilih === 2 && styles.tabTextActive]}>Kupon Toko</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.tabButton, tipePromoTerpilih === 3 && styles.tabButtonActive]} onPress={() => setTipePromoTerpilih(3)}>
            <FontAwesome5 name="shopping-basket" size={11} color={tipePromoTerpilih === 3 ? '#fff' : '#4A3525'} />
            <Text style={[styles.tabText, tipePromoTerpilih === 3 && styles.tabTextActive]}>Min Belanja</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.memoBox}>
          <Text style={styles.memoText}>
            ℹ️ {tipePromoTerpilih === 1 && "Opsi Potong Harga: Harga lama akan dicoret di halaman depan warga, lalu ditimpa harga promo murah."}
            {tipePromoTerpilih === 2 && "Opsi Kupon Toko: Warga wajib mengetikkan kode unik kupon ini saat checkout untuk memicu diskon saldo."}
            {tipePromoTerpilih === 3 && "Opsi Min Belanja: Diskon saldo memotong tagihan warga secara otomatis jika total belanjaan di lapak Tuan menyentuh batas limit."}
          </Text>
        </View>

        <View style={styles.formCard}>
          
          {tipePromoTerpilih === 1 && (
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.labelInput}>Pilih Produk Lapak Anda</Text>
              <ScrollView style={styles.productPickerBox} nestedScrollEnabled={true}>
                {daftarProduk.map((prod) => {
                  const isSelected = idProdukTerpilih === prod.id_produk;
                  return (
                    <TouchableOpacity key={prod.id_produk} style={[styles.productSelectItem, isSelected && styles.productSelectedActive]} onPress={() => setIdProdukTerpilih(prod.id_produk)}>
                      <Text style={[styles.productSelectName, isSelected && {color: '#fff'}]}>{prod.nama_produk}</Text>
                      <Text style={[styles.productSelectPrice, {color: isSelected ? '#FFF3E0' : '#D35400'}]}>Rp {parseInt(prod.harga_produk).toLocaleString('id-ID')}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {tipePromoTerpilih === 2 && (
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.labelInput}>Ketik Kode Kupon Unik (Contoh: UNTUNG5K)</Text>
              <View style={styles.inputWrapper}>
                <FontAwesome5 name="key" size={12} color="#8D6E63" style={styles.inputIcon} />
                <TextInput style={styles.textInput} value={kodeVoucher} onChangeText={setKodeVoucher} placeholder="Masukkan kode promo kupon..." placeholderTextColor="#BCAAA4" autoCapitalize="characters" />
              </View>
            </View>
          )}

          {tipePromoTerpilih === 3 && (
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.labelInput}>Syarat Minimal Belanja Warga (Rp)</Text>
              <View style={styles.inputWrapper}>
                <FontAwesome5 name="money-bill-wave" size={12} color="#8D6E63" style={styles.inputIcon} />
                <TextInput style={styles.textInput} value={minBelanja} onChangeText={setMinBelanja} keyboardType="numeric" placeholder="Contoh: 50000" placeholderTextColor="#BCAAA4" />
              </View>
            </View>
          )}

          <Text style={styles.labelInput}>Tipe Skala Potongan</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity style={[styles.typeBtn, tipePotongan === 'NOMINAL' && styles.typeBtnActive]} onPress={() => setTipePotongan('NOMINAL')}>
              <Text style={[styles.typeBtnText, tipePotongan === 'NOMINAL' && {color: '#fff'}]}>Rupiah (Rp)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.typeBtn, tipePotongan === 'PERSEN' && styles.typeBtnActive]} onPress={() => setTipePotongan('PERSEN')}>
              <Text style={[styles.typeBtnText, tipePotongan === 'PERSEN' && {color: '#fff'}]}>Persentase (%)</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.labelInput}>Nilai Nominal / Persen Potongan</Text>
          <View style={styles.inputWrapper}>
            <FontAwesome5 name="percentage" size={12} color="#8D6E63" style={styles.inputIcon} />
            <TextInput style={styles.textInput} value={nilaiPotongan} onChangeText={setNilaiPotongan} keyboardType="numeric" placeholder={tipePotongan === 'NOMINAL' ? "Contoh: 5000 (Potong Rp 5rb)" : "Contoh: 10 (Diskon 10%)"} placeholderTextColor="#BCAAA4" />
          </View>

          {tipePromoTerpilih !== 1 && (
            <View>
              <Text style={styles.labelInput}>Kuota Penggunaan Kupon / Promo</Text>
              <View style={styles.inputWrapper}>
                <FontAwesome5 name="users" size={12} color="#8D6E63" style={styles.inputIcon} />
                <TextInput style={styles.textInput} value={kuota} onChangeText={setKuota} keyboardType="numeric" placeholder="100" placeholderTextColor="#BCAAA4" />
              </View>
            </View>
          )}

          <TouchableOpacity style={[styles.btnSave, loading && { backgroundColor: '#BCAAA4' }]} onPress={handleSimpanPromoLapak} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color="#fff" /> : (
              <><Ionicons name="flash-outline" size={15} color="#fff" style={{ marginRight: 6 }} /><Text style={styles.btnSaveText}>Aktifkan Kampanye Promo 🚀</Text></>
            )}
          </TouchableOpacity>
        </View>

        {/* 🟢 PANEL BARU: DAFTAR PROMO AKTIF */}
        <Text style={[styles.sectionTitle, {marginTop: 20}]}>ARSIP PROMO & VOUCHER AKTIF ANDA</Text>
        <View style={styles.formCard}>
            {daftarPromoAktif.length === 0 ? (
                <Text style={{fontSize:11, color:'#A1887F', fontStyle:'italic', textAlign:'center', paddingVertical:10}}>Tidak ada kupon atau syarat diskon aktif saat ini.</Text>
            ) : (
                daftarPromoAktif.map(promo => (
                    <View key={promo.id} style={styles.promoItemBox}>
                        <View style={{flex: 1}}>
                            <Text style={styles.promoItemTitle}>{promo.jenis_promo === 'VOUCHER_KODE' ? `🏷️ KUPON: ${promo.kode_promo}` : '🛒 DISKON MIN. BELANJA'}</Text>
                            <Text style={styles.promoItemDesc}>
                                Potongan: <Text style={{fontWeight:'bold', color:'#D35400'}}>{promo.tipe_potongan === 'NOMINAL' ? `Rp ${promo.nilai_potongan.toLocaleString()}` : `${promo.nilai_potongan}%`}</Text> • Sisa Kuota: {promo.kuota_promo}
                            </Text>
                            {promo.jenis_promo === 'MIN_BELANJA' && <Text style={{fontSize:9, color:'#8D6E63', marginTop:2}}>Syarat Min: Rp {parseInt(promo.minimal_belanja).toLocaleString('id-ID')}</Text>}
                        </View>
                        <TouchableOpacity onPress={() => handleHapusPromo(promo.id)} style={{padding:8}}>
                            <Ionicons name="trash" size={16} color="#C62828" />
                        </TouchableOpacity>
                    </View>
                ))
            )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDFCFB' },
  scrollContent: { padding: 16 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', color: '#A1887F', letterSpacing: 0.8, marginBottom: 12, paddingLeft: 2 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#EFEBE9', borderRadius: 12, padding: 4, gap: 4, marginBottom: 14 },
  tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, borderRadius: 8 },
  tabButtonActive: { backgroundColor: '#4A3525', elevation: 1 },
  tabText: { fontSize: 11, fontWeight: '700', color: '#4A3525' },
  tabTextActive: { color: '#fff' },
  memoBox: { backgroundColor: '#FFF8F1', borderWidth: 1, borderColor: '#FFECDB', padding: 12, borderRadius: 10, marginBottom: 14 },
  memoText: { fontSize: 10.5, color: '#A05C28', lineHeight: 16, fontWeight: '500' },
  formCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#EFEBE9', padding: 16, elevation: 0.5 },
  labelInput: { fontSize: 11, fontWeight: 'bold', color: '#4A3525', marginBottom: 6, marginTop: 4 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDFCFB', borderWidth: 1, borderColor: '#EFEBE9', borderRadius: 12, paddingHorizontal: 12, height: 40, marginBottom: 14 },
  inputIcon: { marginRight: 10, width: 14, textAlign: 'center' },
  textInput: { flex: 1, color: '#4A3525', fontSize: 12, paddingVertical: 0 },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  typeBtn: { flex: 1, height: 34, borderRadius: 10, borderWidth: 1, borderColor: '#D7CCC8', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF8F5' },
  typeBtnActive: { backgroundColor: '#D35400', borderColor: '#D35400' },
  typeBtnText: { fontSize: 11, fontWeight: '700', color: '#4A3525' },
  productPickerBox: { maxHeight: 150, borderWidth: 1, borderColor: '#EFEBE9', borderRadius: 12, backgroundColor: '#FAF8F5', padding: 4 },
  productSelectItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderBottomWidth: 1, borderBottomColor: '#EFEBE9', borderRadius: 8, marginBottom: 2 },
  productSelectedActive: { backgroundColor: '#4A3525', borderColor: '#4A3525' },
  productSelectName: { fontSize: 11.5, fontWeight: 'bold', color: '#4A3525', flex: 1, paddingRight: 10 },
  productSelectPrice: { fontSize: 11.5, fontWeight: '800' },
  btnSave: { backgroundColor: '#4A3525', flexDirection: 'row', height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginTop: 14, elevation: 1 },
  btnSaveText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  promoItemBox: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', marginBottom: 5 },
  promoItemTitle: { fontSize: 12, fontWeight: 'bold', color: '#4A3525' },
  promoItemDesc: { fontSize: 10, color: '#616161', marginTop: 3 }
});