// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, Image, RefreshControl, StatusBar, Platform } from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { supabase } from '@/supabaseConfig';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; 

// DAFTAR REKENING PUSAT PAMILO
const REKENING_ADMIN_LIST = [
  { id: 'MANDIRI', bank: "BANK MANDIRI", nomor: "", atas_nama: "PT PAMILO DIGITAL CIAMIS" },
  { id: 'BCA', bank: "BANK BCA", nomor: "515-0298-042", atas_nama: "SEPTIAN GILANG PERMANA" },
  { id: 'DANA', bank: "DANA", nomor: "0831-9558-5892", atas_nama: "SEPTIAN GILANG PERMANA" },
];

export default function SaldoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets(); 

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [saldoAktif, setSaldoAktif] = useState<number>(0);
  const [riwayat, setRiwayat] = useState<any[]>([]);
  
  // 🟢 KONEKTOR PENARIKAN (Menarik data akun bank user dari database)
  const [rekeningTujuan, setRekeningTujuan] = useState<any>(null);

  // State Modal Kendali
  const [modalTopUp, setModalTopUp] = useState(false);
  const [modalWD, setModalWD] = useState(false);
  const [tombolLoading, setTombolLoading] = useState(false);

  // Form Input State UTAMA TOPUP
  const [nominal, setNominal] = useState('');
  const [namaPengirim, setNamaPengirim] = useState(''); 
  const [bankPengirim, setBankPengirim] = useState(''); 
  const [buktiGambar, setBuktiGambar] = useState<string | null>(null); 
  const [rekeningTerpilih, setRekeningTerpilih] = useState(REKENING_ADMIN_LIST[0]);

  useEffect(() => {
    muatDataSasis();
  }, []);

  const muatDataSasis = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: dataUser } = await supabase.from('users').select('saldo').eq('user_id', user.id).maybeSingle();
      setSaldoAktif(Number(dataUser?.saldo || 0));

      // Menarik data bank user untuk Withdrawal
      const { data: dataBank } = await supabase.from('user_bank_accounts').select('*').eq('user_id', user.id).maybeSingle();
      setRekeningTujuan(dataBank || null);

      const { data: dataRiwayat, error } = await supabase
        .from('transaksi_saldo')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRiwayat(dataRiwayat || []);
    } catch (err) {
      Alert.alert("Eror Gardu", "Gagal menyinkronkan data dompet Tuan.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const pilihStrukTransfer = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Izin Ditolak", "PAMILO butuh akses galeri untuk mengambil foto struk.");
      return;
    }

    let hasil = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.6,
    });

    if (!hasil.canceled) {
      setBuktiGambar(hasil.assets[0].uri);
    }
  };

  const eksekusiTopUpManual = async () => {
    const nilaiInput = parseInt(nominal);
    if (!nilaiInput || nilaiInput < 10000) {
      Alert.alert("Nominal Lemah", "Minimal top up saldo adalah Rp 10.000, Tuan.");
      return;
    }
    if (!namaPengirim.trim() || !bankPengirim.trim()) {
      Alert.alert("Form Kosong", "Harap isi nama dan bank pengirim untuk verifikasi mutasi Admin.");
      return;
    }
    if (!buktiGambar) {
      Alert.alert("Struk Kosong", "Silakan foto atau lampirkan gambar struk transfer Tuan.");
      return;
    }

    try {
      setTombolLoading(true);

      // 🟢 FIX BUG BASE64: Menggunakan metode unggah FormData Baja Murni
      let urlGambarPublik = '';
      const formatFile = buktiGambar.split('.').pop() || 'jpg';
      const pathUnik = `struk-topup/${userId}_${Date.now()}.${formatFile}`;
      
      const paketData = new FormData();
      paketData.append('file', {
        uri: Platform.OS === 'android' ? buktiGambar : buktiGambar.replace('file://', ''),
        name: pathUnik,
        type: `image/${formatFile === 'png' ? 'png' : 'jpeg'}`
      } as any);

      const { error: uploadError } = await supabase.storage
        .from('pamilo-assets')
        .upload(pathUnik, paketData, { contentType: 'multipart/form-data', upsert: true });

      if (uploadError) throw new Error("Gagal mengunggah foto struk ke server.");

      const { data: { publicUrl } } = supabase.storage.from('pamilo-assets').getPublicUrl(pathUnik);
      urlGambarPublik = publicUrl;

      const { error: insertLedgerError } = await supabase.from('transaksi_saldo').insert({
        user_id: userId,
        tipe_transaksi: 'TOPUP',
        jumlah: nilaiInput,
        bukti_transfer_url: urlGambarPublik, 
        status_transaksi: 'PENDING',
        catatan_admin: `Target: ${rekeningTerpilih.bank} | Dari: ${bankPengirim.toUpperCase()} a/n ${namaPengirim.toUpperCase()}` 
      });

      if (insertLedgerError) throw insertLedgerError;

      Alert.alert("Pengajuan Terkirim 🚀", "Bukti Top Up berhasil mendarat di meja Pusat. Mohon bersabar menunggu validasi maksimal 10 menit.");

      setModalTopUp(false);
      bersihkanForm();
      muatDataSasis();
    } catch (err: any) {
      Alert.alert("Gagal Memproses", err.message);
    } finally {
      setTombolLoading(false);
    }
  };

  const eksekusiTarikSaldo = async () => {
    if (!rekeningTujuan) {
      Alert.alert("Rekening Belum Diatur 🚨", "Tuan belum mengatur akun bank pencairan. Silakan kembali ke Profil dan isi Pengaturan Bank terlebih dahulu.");
      return;
    }

    const nilaiInput = parseInt(nominal);
    if (!nilaiInput || nilaiInput < 50000) {
      Alert.alert("Batas Limit", "Minimal penarikan saldo dana adalah Rp 50.000, Tuan.");
      return;
    }
    if (nilaiInput > saldoAktif) {
      Alert.alert("Saldo Kurang", "Isi dompet PAMILO Tuan tidak mencukupi untuk penarikan nominal ini.");
      return;
    }

    try {
      setTombolLoading(true);

      const { error: insertError } = await supabase.from('transaksi_saldo').insert({
        user_id: userId,
        tipe_transaksi: 'WITHDRAWAL',
        jumlah: nilaiInput,
        nama_bank: rekeningTujuan.nama_bank,
        nomor_rekening: rekeningTujuan.nomor_rekening,
        nama_pemilik_rekening: rekeningTujuan.nama_pemilik,
        status_transaksi: 'PENDING',
        catatan_admin: `Penarikan mandiri via aplikasi`
      });

      if (insertError) throw insertError;

      Alert.alert("Penarikan Diproses ⏳", "Request penarikan saldo berhasil dikunci.");
      setModalWD(false);
      bersihkanForm();
      muatDataSasis();
    } catch (err: any) {
      Alert.alert("Gagal Tarik", err.message);
    } finally {
      setTombolLoading(false);
    }
  };

  const bersihkanForm = () => {
    setNominal('');
    setNamaPengirim('');
    setBankPengirim('');
    setBuktiGambar(null);
    setRekeningTerpilih(REKENING_ADMIN_LIST[0]);
  };

  const dapatkanWarnaStatus = (status: string) => {
    const s = String(status).toUpperCase().trim();
    if (s === 'SUKSES' || s === 'BERHASIL') return '#2E7D32';
    if (s === 'DITOLAK') return '#C62828';
    return '#E65100'; 
  };

  if (loading) {
    return (
      <View style={styles.centerLoading}>
        <ActivityIndicator size="large" color="#4A3525" />
        <Text style={{ marginTop: 8, color: '#8D6E63', fontWeight: 'bold', fontSize: 11 }}>Membuka brankas dompet...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <FontAwesome5 name="arrow-left" size={14} color="#4A3525" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dompet Terpusat PAMILO</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        contentContainerStyle={{ padding: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); muatDataSasis(); }} colors={["#4A3525"]} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cardSaldo}>
          <Text style={styles.labelSaldo}>SALDO AKTIF UTAMA</Text>
          <Text style={styles.angkaSaldo}>Rp {saldoAktif.toLocaleString('id-ID')}</Text>
          <View style={styles.badgeKawat}>
            <FontAwesome5 name="shield-alt" size={10} color="#FFF" />
            <Text style={styles.badgeText}>Sasis Keuangan Terintegrasi DDL Pusat</Text>
          </View>
        </View>

        <View style={styles.rowTombol}>
          <TouchableOpacity style={[styles.btnAksi, { backgroundColor: '#4A3525' }]} onPress={() => setModalTopUp(true)} activeOpacity={0.8}>
            <FontAwesome5 name="plus-circle" size={14} color="#FFF" />
            <Text style={styles.btnAksiText}>Top Up Saldo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.btnAksi, { backgroundColor: '#8D6E63' }]} onPress={() => setModalWD(true)} activeOpacity={0.8}>
            <FontAwesome5 name="wallet" size={14} color="#FFF" />
            <Text style={styles.btnAksiText}>Tarik Tunai</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.titleSection}>Riwayat Mutasi Finansial</Text>
        
        {riwayat.length === 0 ? (
          <View style={styles.boxKosong}>
            <FontAwesome5 name="folder-open" size={32} color="#D7CCC8" />
            <Text style={styles.textKosong}>Belum ada rekam jejak keuangan di brankas dompet Tuan.</Text>
          </View>
        ) : (
          riwayat.map((item) => {
            const isTopUp = item.tipe_transaksi === 'TOPUP' || item.tipe_transaksi === 'PENDAPATAN' || item.tipe_transaksi === 'REFUND';
            return (
              <View key={item.id} style={styles.itemRiwayat}>
                <View style={styles.riwayatKiri}>
                  <View style={[styles.lingkaranIcon, { backgroundColor: isTopUp ? '#E8F5E9' : '#FFEBEE' }]}>
                    <FontAwesome5 
                      name={isTopUp ? 'arrow-alt-circle-down' : 'arrow-alt-circle-up'} 
                      size={15} 
                      color={isTopUp ? '#2E7D32' : '#C62828'} 
                    />
                  </View>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={styles.textTipe}>
                      {item.tipe_transaksi === 'TOPUP' ? 'Top Up Saldo' : item.tipe_transaksi === 'WITHDRAWAL' ? 'Tarik Tunai' : String(item.tipe_transaksi).replace('_', ' ')}
                    </Text>
                    <Text style={styles.textTanggal}>{new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} WIB</Text>
                    {item.catatan_admin ? (
                      <Text style={styles.textTargetBank} numberOfLines={1}>{item.catatan_admin}</Text>
                    ) : null}
                  </View>
                </View>

                <View style={{ alignItems: 'flex-end', marginLeft: 6 }}>
                  <Text style={[styles.textJumlah, { color: isTopUp ? '#2E7D32' : '#C62828' }]}>
                    {isTopUp ? '+' : '-'} Rp {Number(item.jumlah || 0).toLocaleString('id-ID')}
                  </Text>
                  <View style={[styles.badgeStatus, { backgroundColor: dapatkanWarnaStatus(item.status_transaksi || 'PENDING') + '15' }]}>
                    <Text style={[styles.textStatus, { color: dapatkanWarnaStatus(item.status_transaksi || 'PENDING') }]}>
                      {item.status_transaksi || 'PENDING'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ==================== MODAL TOP UP ==================== */}
      <Modal visible={modalTopUp} animationType="slide" transparent onRequestClose={() => { setModalTopUp(false); bersihkanForm(); }}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { setModalTopUp(false); bersihkanForm(); }}>
          <TouchableOpacity activeOpacity={1} style={[styles.modalContent, { paddingBottom: insets.bottom > 0 ? insets.bottom + 12 : 20 }]}>
            <Text style={styles.modalTitle}>Form Pengajuan Top Up Saldo</Text>
            
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
              <Text style={styles.inputLabel}>Pilih Bank Tujuan Transfer:</Text>
              <View style={styles.rowBankSelector}>
                {REKENING_ADMIN_LIST.map((rek) => {
                  const isTerpilih = rekeningTerpilih.id === rek.id;
                  return (
                    <TouchableOpacity key={rek.id} style={[styles.cardBankOpsi, isTerpilih && styles.cardBankOpsiActive]} onPress={() => setRekeningTerpilih(rek)} activeOpacity={0.8}>
                      <FontAwesome5 name="university" size={11} color={isTerpilih ? '#FFF' : '#8D6E63'} />
                      <Text style={[styles.textBankOpsi, isTerpilih && styles.textBankOpsiActive]}>{rek.id}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.boxInstruksi}>
                <Text style={styles.insJudul}>Silakan Transfer Manual Ke Rekening Pusat ({rekeningTerpilih.id}):</Text>
                <Text style={styles.insDetail}>🏦 {rekeningTerpilih.bank}</Text>
                <Text style={styles.insRek}>{rekeningTerpilih.nomor}</Text>
                <Text style={styles.insAn}>a/n {rekeningTerpilih.atas_nama}</Text>
              </View>

              <Text style={styles.inputLabel}>Nominal Uang Transfer (Rp)</Text>
              <TextInput style={styles.input} placeholder="Contoh: 50000" keyboardType="numeric" value={nominal} onChangeText={setNominal} />

              <Text style={styles.inputLabel}>Nama Lengkap Pengirim (Sesuai Struk)</Text>
              <TextInput style={styles.input} placeholder="Contoh: AGUS SETIAWAN" value={namaPengirim} onChangeText={setNamaPengirim} />

              <Text style={styles.inputLabel}>Bank Asal Pengirim</Text>
              <TextInput style={styles.input} placeholder="Contoh: BCA / BRI / MANDIRI" value={bankPengirim} onChangeText={setBankPengirim} />

              <Text style={styles.inputLabel}>Foto Bukti Struk Transfer</Text>
              <TouchableOpacity style={styles.btnUpload} onPress={pilihStrukTransfer} activeOpacity={0.8}>
                {buktiGambar ? (
                  <Image source={{ uri: buktiGambar }} style={styles.previewGambar} />
                ) : (
                  <View style={{ alignItems: 'center' }}><FontAwesome5 name="camera" size={18} color="#8D6E63" /><Text style={styles.btnUploadText}>Ambil Gambar / Struk ATM</Text></View>
                )}
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.stickyButtonContainer}>
              <TouchableOpacity style={styles.btnSubmit} onPress={eksekusiTopUpManual} disabled={tombolLoading} activeOpacity={0.8}>
                {tombolLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnSubmitText}>TOPUP DANA 🚀</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnBatal} onPress={() => { setModalTopUp(false); bersihkanForm(); }} activeOpacity={0.7}><Text style={styles.btnBatalText}>Batalkan Pengajuan</Text></TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ==================== MODAL WITHDRAWAL (VERSI ELEGAN) ==================== */}
      <Modal visible={modalWD} animationType="slide" transparent onRequestClose={() => { setModalWD(false); bersihkanForm(); }}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { setModalWD(false); bersihkanForm(); }}>
          <TouchableOpacity activeOpacity={1} style={[styles.modalContent, { paddingBottom: insets.bottom > 0 ? insets.bottom + 12 : 20, maxHeight: '60%' }]}>
            <Text style={styles.modalTitle}>Tarik Tunai Ke Rekening</Text>
            
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
              {/* 🟢 Menampilkan Akun Bank Yang Sudah Dikunci */}
              {rekeningTujuan ? (
                <View style={styles.rekeningTerkunciBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Ionicons name="shield-checkmark" size={16} color="#2E7D32" />
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1B5E20', marginLeft: 6 }}>AKUN PENCAIRAN AKTIF</Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: '#1B5E20' }}>{rekeningTujuan.nama_bank.toUpperCase()}</Text>
                  {rekeningTujuan.nama_bank.toLowerCase() === 'qris' ? (
                    <Text style={{ fontSize: 11, color: '#2E7D32', marginTop: 4 }}>Pencairan via Scan QRIS Warung Anda</Text>
                  ) : (
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#2E7D32', marginTop: 4, letterSpacing: 1 }}>{rekeningTujuan.nomor_rekening}</Text>
                  )}
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#4CAF50', marginTop: 4 }}>A/n: {rekeningTujuan.nama_pemilik.toUpperCase()}</Text>
                </View>
              ) : (
                <View style={styles.boxInstruksi}>
                  <Text style={styles.insJudul}>Harap Atur Rekening Dahulu di Pengaturan Bank.</Text>
                </View>
              )}

              <Text style={[styles.inputLabel, { marginTop: 20 }]}>Nominal Yang Ingin Ditarik (Rp)</Text>
              <TextInput style={[styles.input, { height: 50, fontSize: 16, fontWeight: 'bold' }]} placeholder="Minimal 50.000" keyboardType="numeric" value={nominal} onChangeText={setNominal} />
            </ScrollView>

            <View style={styles.stickyButtonContainer}>
              <TouchableOpacity style={styles.btnSubmit} onPress={eksekusiTarikSaldo} disabled={tombolLoading || !rekeningTujuan} activeOpacity={0.8}>
                {tombolLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnSubmitText}>AJUKAN TARIK TUNAI 💰</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnBatal} onPress={() => { setModalWD(false); bersihkanForm(); }} activeOpacity={0.7}><Text style={styles.btnBatalText}>Batalkan Penarikan</Text></TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5' }, centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF8F5' }, headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#EFEBE9' }, backButton: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF8F5', borderRadius: 18, borderWidth: 1, borderColor: '#E0D4CE' }, headerTitle: { fontSize: 15, fontWeight: 'bold', color: '#4A3525' }, cardSaldo: { backgroundColor: '#4A3525', padding: 22, borderRadius: 20, elevation: 2 }, labelSaldo: { fontSize: 10, fontWeight: 'bold', color: '#D7CCC8', letterSpacing: 0.8 }, angkaSaldo: { fontSize: 26, fontWeight: '900', color: '#FFB74D', marginTop: 4 }, badgeKawat: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, marginTop: 12 }, badgeText: { fontSize: 9, color: '#FAF8F5', marginLeft: 6, fontWeight: '600' }, rowTombol: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, gap: 10 }, btnAksi: { flex: 1, flexDirection: 'row', height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 12, gap: 6 }, btnAksiText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' }, titleSection: { fontSize: 11, fontWeight: 'bold', color: '#A1887F', letterSpacing: 1, marginTop: 24, marginBottom: 12, textTransform: 'uppercase' }, boxKosong: { alignItems: 'center', marginTop: 40, paddingHorizontal: 40 }, textKosong: { fontSize: 11, color: '#A1887F', textAlign: 'center', marginTop: 10, lineHeight: 16, fontStyle: 'italic' }, itemRiwayat: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#EFEBE9' }, riwayatKiri: { flexDirection: 'row', alignItems: 'center', flex: 1 }, lingkaranIcon: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' }, textTipe: { fontSize: 13, fontWeight: 'bold', color: '#4A3525' }, textTanggal: { fontSize: 10, color: '#BCAAA4', marginTop: 2 }, textTargetBank: { fontSize: 10, color: '#004D40', fontWeight: 'bold', marginTop: 5, backgroundColor: '#E0F2F1', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, lineHeight: 14 }, textJumlah: { fontSize: 14, fontWeight: '900' }, badgeStatus: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, alignSelf: 'flex-end' }, textStatus: { fontSize: 9, fontWeight: '900' }, modalOverlay: { flex: 1, backgroundColor: 'rgba(26, 15, 5, 0.5)', justifyContent: 'flex-end' }, modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%', minHeight: '60%' }, modalTitle: { fontSize: 15, fontWeight: 'bold', color: '#4A3525', marginBottom: 16, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 }, rowBankSelector: { flexDirection: 'row', gap: 6, marginBottom: 12 }, cardBankOpsi: { flex: 1, flexDirection: 'row', height: 38, backgroundColor: '#FAF8F5', borderRadius: 10, justifyContent: 'center', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#E0D4CE' }, cardBankOpsiActive: { backgroundColor: '#4A3525', borderColor: '#4A3525' }, textBankOpsi: { fontSize: 11, fontWeight: 'bold', color: '#8D6E63' }, textBankOpsiActive: { color: '#FFF' }, boxInstruksi: { backgroundColor: '#FAF8F5', padding: 14, borderRadius: 12, marginBottom: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E0D4CE' }, insJudul: { fontSize: 11, color: '#6D4C41', fontWeight: 'bold', textAlign: 'center' }, insDetail: { fontSize: 13, fontWeight: 'bold', color: '#4A3525', marginTop: 6 }, insRek: { fontSize: 20, fontWeight: '900', color: '#4A3525', marginTop: 4, letterSpacing: 0.5 }, insAn: { fontSize: 11, color: '#8D6E63', fontWeight: '600', marginTop: 4 }, inputLabel: { fontSize: 11, fontWeight: 'bold', color: '#4A3525', marginBottom: 4, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.3 }, input: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E0D4CE', height: 42, borderRadius: 10, paddingHorizontal: 12, fontSize: 13, color: '#4A3525', marginBottom: 4 }, btnUpload: { backgroundColor: '#FFF', borderWidth: 1, borderStyle: 'dashed', borderColor: '#A1887F', height: 80, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 4, overflow: 'hidden' }, btnUploadText: { fontSize: 10, color: '#8D6E63', fontWeight: '600', marginTop: 4 }, previewGambar: { width: '100%', height: '100%', resizeMode: 'cover' }, stickyButtonContainer: { width: '100%', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F5EBE6', backgroundColor: '#FFF' }, btnSubmit: { backgroundColor: '#4A3525', height: 46, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10 }, btnSubmitText: { color: '#FFF', fontWeight: 'bold', fontSize: 13, letterSpacing: 0.5 }, btnBatal: { height: 40, justifyContent: 'center', alignItems: 'center', marginTop: 6 }, btnBatalText: { color: '#C62828', fontWeight: 'bold', fontSize: 12 },
  rekeningTerkunciBox: { backgroundColor: '#E8F5E9', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#A5D6A7', marginBottom: 10 }
});