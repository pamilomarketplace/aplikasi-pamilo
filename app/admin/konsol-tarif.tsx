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
  Alert 
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// BACKEND: KONEKTOR UTAMA SUPABASE
import { supabase } from '../../supabaseConfig';

export default function KonsolTarifAdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [loadingSave, setLoadingSave] = useState(false);
  
  // Parameter Ekonomi PAMILO Terkalibrasi
  const [tarifMotor, setTarifMotor] = useState('2500');
  const [tarifMobil, setTarifMobil] = useState('5000');
  const [potonganSeller, setPotonganSeller] = useState('5'); 
  const [potonganDriver, setPotonganDriver] = useState('10'); 

  // FINTECH CONTROL: Biaya administrasi ekosistem
  const [adminTopup, setAdminTopup] = useState('2000');
  const [adminBelanja, setAdminBelanja] = useState('1500');
  const [adminWd, setAdminWd] = useState('2500');

  // RADAR CONTEXT: Radius penyebaran blast orderan MIGO
  const [radiusBlast, setRadiusBlast] = useState('5');

  // 🔥 SUNTIKAN BARU: BIAYA LAYANAN & MINIMUM PAYMENT
  const [biayaLayanan, setBiayaLayanan] = useState('1000');
  const [minimumPayment, setMinimumPayment] = useState('10000');

  // --- 🟢 TAHAP 1: SEDOT DATA KONFIGURASI AKTIF DARI TABEL BARU ---
  const fetchConfigSistem = async () => {
    try {
      setLoading(true);
      
      // 💡 KALIBRASI: Mengambil data berbasis Key-Value dari pengaturan_aplikasi
      const { data, error } = await supabase
        .from('pengaturan_aplikasi')
        .select('kunci_konfigurasi, nilai_konfigurasi');

      if (error) throw error;

      if (data && data.length > 0) {
        // Petakan array menjadi objek kamus (Map) agar mudah diekstrak ke state
        const configMap = new Map(data.map(item => [item.kunci_konfigurasi, item.nilai_konfigurasi]));
        
        setTarifMotor(configMap.get('ONGKIR_PER_KM') || '2500');
        setTarifMobil(configMap.get('ONGKIR_MOBIL_PER_KM') || '5000');
        setPotonganSeller(configMap.get('POTONGAN_SELLER_PERSEN') || '10');
        setPotonganDriver(configMap.get('POTONGAN_DRIVER_PERSEN') || '10');
        
        setAdminTopup(configMap.get('MINIMUM_TARIK_SALDO') || '10000'); 
        setAdminBelanja(configMap.get('BIAYA_ADMIN_APLIKASI') || '2000');
        setAdminWd(configMap.get('BIAYA_ADMIN_WD') || '2500');

        // Sedot parameter jangkauan radar blast orderan
        setRadiusBlast(configMap.get('RADIUS_BLAST_MIGO') || '5');

        // 🔥 TANGKAP DATA BIAYA LAYANAN & MINIMUM PAYMENT
        setBiayaLayanan(configMap.get('BIAYA_LAYANAN_TRANSAKSI') || '1000');
        setMinimumPayment(configMap.get('MINIMUM_PAYMENT_ORDER') || '10000');
      }
    } catch (error: any) {
      console.error("Gagal membaca sasis config:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigSistem();
  }, []);

  // --- 🟢 TAHAP 2: KUNCI UPDATE PARAMETER ROW BY ROW KILAT (ANTI-MOGOK) ---
  const handleSimpanTarifAdmin = async () => { 
    if (
      !tarifMotor.trim() || !tarifMobil.trim() || !potonganSeller.trim() || !potonganDriver.trim() ||
      !adminTopup.trim() || !adminBelanja.trim() || !adminWd.trim() || !radiusBlast.trim() ||
      !biayaLayanan.trim() || !minimumPayment.trim()
    ) {
      Alert.alert("Data Kosong", "Semua kolom parameter logistik, komisi, biaya layanan, and minimum payment wajib diisi, Tuan Owner!");
      return;
    }

    try {
      setLoadingSave(true);

      // Prepare data pembaruan baris bertingkat sesuai cetak biru tabel pengaturan_aplikasi
      const payloadKonfig = [
        { kunci_konfigurasi: 'ONGKIR_PER_KM', nilai_konfigurasi: tarifMotor.trim() },
        { kunci_konfigurasi: 'ONGKIR_MOBIL_PER_KM', nilai_konfigurasi: tarifMobil.trim() },
        { kunci_konfigurasi: 'POTONGAN_SELLER_PERSEN', nilai_konfigurasi: potonganSeller.trim() },
        { kunci_konfigurasi: 'POTONGAN_DRIVER_PERSEN', nilai_konfigurasi: potonganDriver.trim() },
        { kunci_konfigurasi: 'MINIMUM_TARIK_SALDO', nilai_konfigurasi: adminTopup.trim() },
        { kunci_konfigurasi: 'BIAYA_ADMIN_APLIKASI', nilai_konfigurasi: adminBelanja.trim() },
        { kunci_konfigurasi: 'BIAYA_ADMIN_WD', nilai_konfigurasi: adminWd.trim() },
        { kunci_konfigurasi: 'RADIUS_BLAST_MIGO', nilai_konfigurasi: radiusBlast.trim() },
        // 🔥 INJEKSI PAYLOAD BARU
        { kunci_konfigurasi: 'BIAYA_LAYANAN_TRANSAKSI', nilai_konfigurasi: biayaLayanan.trim() },
        { kunci_konfigurasi: 'MINIMUM_PAYMENT_ORDER', nilai_konfigurasi: minimumPayment.trim() }
      ];

      // 💡 KALIBRASI: Eksekusi UPSERT massal berdasarkan constraint UNIQUE (kunci_konfigurasi)
      const { error } = await supabase
        .from('pengaturan_aplikasi')
        .upsert(payloadKonfig, { onConflict: 'kunci_konfigurasi' });

      if (error) throw error;

      Alert.alert(
        "Sasis Ekonomi Terkunci! 📊",
        "Pembaruan sukses dimasukkan ke brankas cloud PAMILO. Seluruh rumus hitungan logistik, pemotongan biaya layanan ke driver/toko, serta minimum payment resmi diperbarui secara real-time!"
      );
      
      fetchConfigSistem();
    } catch (error: any) {
      console.error("Gagal menyimpan:", error);
      Alert.alert("Gagal Mengunci", "Terjadi kesalahan sasis koneksi saat melakukan pembaruan parameter cloud.");
    } finally {
      setLoadingSave(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: true,
          headerTitle: 'Master Konsol Admin PAMILO',
          headerTintColor: '#fff',
          headerStyle: { backgroundColor: '#4A3525' },
          headerTitleStyle: { fontWeight: 'bold', fontSize: 15 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 5, marginRight: 15 }}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          ),
        }} 
      />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4A3525" />
          <Text style={styles.loadingText}>Menghubungkan ke jangkar pusat finansial...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 30 }]}>
          
          {/* KARTU BANNER HEADER */}
          <View style={styles.bannerCard}>
            <FontAwesome5 name="sliders-h" size={20} color="#fff" />
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text style={styles.bannerTitleText}>Pusat Kendali Biaya & Tarif</Text>
              <Text style={styles.bannerSubTitleText}>Atur roda ekonomi operasional aplikasi langsung dalam genggaman Tuan Septian.</Text>
            </View>
          </View>

          <View style={styles.formCard}>
            
            {/* 🔥 NEW SUB-GRUP: BIAYA LAYANAN TRANSAKSI (YANG AKAN MEMOTONG SALDO MITRA) */}
            <Text style={[styles.formGroupTitle, { color: '#D35400' }]}>POTONGAN BIAYA LAYANAN & MINIMUM PAYMENT</Text>

            <Text style={styles.labelInput}>Biaya Layanan (Dipotong dari Saldo Driver/Seller)</Text>
            <View style={[styles.inputWrapper, { borderColor: '#FFCCAB', backgroundColor: '#FFF8F4' }]}>
              <Text style={styles.currencyPrefix}>Rp</Text>
              <TextInput 
                style={styles.textInput}
                value={biayaLayanan}
                onChangeText={(txt) => setBiayaLayanan(txt.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="Misal: 1000"
              />
              <FontAwesome5 name="hand-holding-usd" size={13} color="#D35400" style={styles.inputIcon} />
            </View>

            <Text style={styles.labelInput}>Minimum Payment (Batas Minimal Transaksi/TopUp)</Text>
            <View style={[styles.inputWrapper, { borderColor: '#FFCCAB', backgroundColor: '#FFF8F4' }]}>
              <Text style={styles.currencyPrefix}>Rp</Text>
              <TextInput 
                style={styles.textInput}
                value={minimumPayment}
                onChangeText={(txt) => setMinimumPayment(txt.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="Misal: 10000"
              />
              <FontAwesome5 name="money-check" size={11} color="#D35400" style={styles.inputIcon} />
            </View>

            {/* SUB-GRUP 1: LOGISTIK MOTOR & MOBIL */}
            <Text style={styles.formGroupTitle}>CONFIGURATION ONGKOS KIRIM MIGO</Text>

            <Text style={styles.labelInput}>Tarif MIGO Motor (Per Kilometer)</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.currencyPrefix}>Rp</Text>
              <TextInput 
                style={styles.textInput}
                value={tarifMotor}
                onChangeText={(txt) => setTarifMotor(txt.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
              />
              <FontAwesome5 name="motorcycle" size={13} color="#8D6E63" style={styles.inputIcon} />
            </View>

            <Text style={styles.labelInput}>Tarif MIGO Mobil (Per Kilometer)</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.currencyPrefix}>Rp</Text>
              <TextInput 
                style={styles.textInput}
                value={tarifMobil}
                onChangeText={(txt) => setTarifMobil(txt.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
              />
              <FontAwesome5 name="car" size={13} color="#8D6E63" style={styles.inputIcon} />
            </View>

            {/* RADAR & REKAYASA RADIAL ORDERAN */}
            <Text style={styles.formGroupTitle}>PARAMETER JANGKAUAN RADAR OPERASIONAL</Text>

            <Text style={styles.labelInput}>Radius Batasan Blast Orderan MIGO</Text>
            <View style={styles.inputWrapper}>
              <FontAwesome5 name="map-marker-alt" size={11} color="#8D6E63" style={{ marginRight: 10, marginLeft: 2 }} />
              <TextInput 
                style={styles.textInput}
                value={radiusBlast}
                onChangeText={(txt) => setRadiusBlast(txt.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="Contoh: 5"
              />
              <Text style={styles.unitSuffix}>KM (Jarak Maks)</Text>
            </View>

            {/* SUB-GRUP 2: BAGI HASIL PERSENTASE */}
            <Text style={styles.formGroupTitle}>BAGI HASIL & POTONGAN KOMISI MITRA</Text>

            <Text style={styles.labelInput}>Potongan Komisi Toko / Seller (%)</Text>
            <View style={styles.inputWrapper}>
              <FontAwesome5 name="store" size={10} color="#8D6E63" style={{ marginRight: 10, marginLeft: 2 }} />
              <TextInput 
                style={styles.textInput}
                value={potonganSeller}
                onChangeText={(txt) => setPotonganSeller(txt.replace(/[^0-9.]/g, ''))}
                keyboardType="numeric"
              />
              <Text style={styles.unitSuffix}>% Potongan</Text>
            </View>

            <Text style={styles.labelInput}>Potongan Komisi Driver / Kurir MIGO (%)</Text>
            <View style={styles.inputWrapper}>
              <FontAwesome5 name="percentage" size={11} color="#8D6E63" style={{ marginRight: 10, marginLeft: 2 }} />
              <TextInput 
                style={styles.textInput}
                value={potonganDriver}
                onChangeText={(txt) => setPotonganDriver(txt.replace(/[^0-9.]/g, ''))}
                keyboardType="numeric"
              />
              <Text style={styles.unitSuffix}>% Potongan</Text>
            </View>

            {/* SUB-GRUP 3: BIAYA JASA FINTECH FLAT APLIKASI */}
            <Text style={styles.formGroupTitle}>REGULASI BIAYA JASA FINTECH APLIKASI</Text>

            <Text style={styles.labelInput}>Batas Minimum Tarik Saldo Driver/Seller (Rp)</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.currencyPrefix}>Rp</Text>
              <TextInput 
                style={styles.textInput}
                value={adminTopup}
                onChangeText={(txt) => setAdminTopup(txt.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
              />
              <FontAwesome5 name="plus-circle" size={12} color="#8D6E63" style={styles.inputIcon} />
            </View>

            <Text style={styles.labelInput}>Biaya Layanan Belanja User Pembeli (Non-COD)</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.currencyPrefix}>Rp</Text>
              <TextInput 
                style={styles.textInput}
                value={adminBelanja}
                onChangeText={(txt) => setAdminBelanja(txt.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
              />
              <FontAwesome5 name="shopping-bag" size={11} color="#8D6E63" style={styles.inputIcon} />
            </View>

            <Text style={styles.labelInput}>Biaya Jasa Kliring WD (Driver, Seller, & User)</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.currencyPrefix}>Rp</Text>
              <TextInput 
                style={styles.textInput}
                value={adminWd}
                onChangeText={(txt) => setAdminWd(txt.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
              />
              <FontAwesome5 name="university" size={11} color="#8D6E63" style={styles.inputIcon} />
            </View>
            
            <Text style={styles.infoHelperText}>
              *Rumus keuangan dikendalikan otomatis dan aman dari manipulasi data pihak ketiga di sisi client HP. Nilai Biaya Layanan akan ditembakkan ke tabel pembeli dan memotong saldo mitra sesuai algoritma Tuan.
            </Text>

            <TouchableOpacity 
              style={[styles.btnSave, loadingSave && { backgroundColor: '#BCAAA4' }]} 
              onPress={handleSimpanTarifAdmin}
              disabled={loadingSave}
            >
              {loadingSave ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark-outline" size={16} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.btnSaveText}>Kunci & Terapkan Sasis Ekonomi</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDFCFB' },
  scrollContent: { padding: 16 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDFCFB' },
  loadingText: { marginTop: 12, color: '#8D6E63', fontSize: 13, fontWeight: '500' },
  bannerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4A3525', padding: 18, borderRadius: 16, marginBottom: 16, elevation: 2 },
  bannerTitleText: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
  bannerSubTitleText: { fontSize: 10, color: '#D7CCC8', marginTop: 4, lineHeight: 14 },
  formCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#EFEBE9', padding: 16 },
  formGroupTitle: { fontSize: 10, fontWeight: 'bold', color: '#A1887F', letterSpacing: 1, marginBottom: 14, marginTop: 14, textTransform: 'uppercase' },
  labelInput: { fontSize: 11, fontWeight: 'bold', color: '#4A3525', marginBottom: 6 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDFCFB', borderWidth: 1, borderColor: '#EFEBE9', borderRadius: 12, paddingHorizontal: 12, height: 42, marginBottom: 14 },
  currencyPrefix: { fontSize: 12, fontWeight: 'bold', color: '#4A3525', marginRight: 6 },
  unitSuffix: { fontSize: 11, fontWeight: 'bold', color: '#8D6E63', marginLeft: 6 },
  inputIcon: { marginLeft: 6 },
  textInput: { flex: 1, color: '#4A3525', fontSize: 13, paddingVertical: 0, fontWeight: '600' },
  infoHelperText: { fontSize: 9, color: '#A1887F', fontStyle: 'italic', marginTop: -4, marginBottom: 14, lineHeight: 13 },
  btnSave: { backgroundColor: '#D35400', flexDirection: 'row', height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginTop: 14, elevation: 1 },
  btnSaveText: { color: '#fff', fontSize: 13, fontWeight: 'bold' }
});