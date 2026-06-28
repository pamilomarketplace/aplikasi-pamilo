// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, StatusBar, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/supabaseConfig';

// 🟢 FIX: DAFTAR BANK NASIONAL & EWALLET DITAMBAHKAN
const DAFTAR_PLATFORM = [
  { id: 'bca', nama: 'BCA' },
  { id: 'mandiri', nama: 'MANDIRI' },
  { id: 'bri', nama: 'BRI' },
  { id: 'bni', nama: 'BNI' },
  { id: 'bsi', nama: 'BSI' },
  { id: 'cimb', nama: 'CIMB NIAGA' },
  { id: 'qris', nama: 'QRIS' },
  { id: 'dana', nama: 'DANA' },
  { id: 'gopay', nama: 'GOPAY' },
  { id: 'ovo', nama: 'OVO' },
  { id: 'shopeepay', nama: 'SHOPEE PAY' }
];

interface RekeningEksis {
  nama_bank: string;
  nomor_rekening: string;
  nama_pemilik: string;
}

export default function PengaturanBankScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [platformTerpilih, setPlatformTerpilih] = useState<string | null>(null);
  const [nomorEwallet, setNomorEwallet] = useState('');
  const [namaPemilik, setNamaPemilik] = useState('');
  
  const [uriGambarQris, setUriGambarQris] = useState<string | null>(null);
  const [isUploadingQris, setIsUploadingQris] = useState(false);

  const [loadingProses, setLoadingProses] = useState(false);
  const [loadingDataAwal, setLoadingDataAwal] = useState(true);
  const [rekeningTerdaftar, setRekeningTerdaftar] = useState<RekeningEksis | null>(null);

  const muatDataRekeningUser = async () => {
    try {
      setLoadingDataAwal(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data, error } = await supabase
        .from('user_bank_accounts')
        .select('nama_bank, nomor_rekening, nama_pemilik')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setRekeningTerdaftar(data);
      }
    } catch (e: any) {
      console.log("🚨 Gagal memuat data brankas bank:", e.message);
    } finally {
      setLoadingDataAwal(false);
    }
  };

  useEffect(() => {
    muatDataRekeningUser();
  }, []);

  const handleAmbilMediaQris = async () => {
    Alert.alert("Metode Unggah QRIS", "Silakan tentukan cara pengambilan gambar QRIS:", [
      {
        text: "Buka Kamera", onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') return Alert.alert("Akses Ditolak", "Aplikasi memerlukan izin kamera.");
          let hasil = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.6 });
          if (!hasil.canceled && hasil.assets?.[0]) setUriGambarQris(hasil.assets[0].uri);
        }
      },
      {
        text: "Ambil Dari Galeri", onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') return Alert.alert("Akses Ditolak", "Aplikasi memerlukan izin galeri.");
          let hasil = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.6 });
          if (!hasil.canceled && hasil.assets?.[0]) setUriGambarQris(hasil.assets[0].uri);
        }
      },
      { text: "Batal", style: "cancel" }
    ]);
  };

  const prosesUploadQrisKeCloud = async (uriLokal: string, userId: string): Promise<string> => {
    if (uriLokal.startsWith('http')) return uriLokal; 
    try {
      const formatFile = uriLokal.split('.').pop() || 'jpg';
      const namaFileUnik = `bank/qr_${userId}_${Date.now()}.${formatFile}`;
      const paketData = new FormData();
      
      paketData.append('file', {
        uri: Platform.OS === 'android' ? uriLokal : uriLokal.replace('file://', ''),
        name: namaFileUnik,
        type: `image/${formatFile === 'png' ? 'png' : 'jpeg'}`
      } as any);

      const { error: uploadError } = await supabase.storage.from('pamilo-assets').upload(namaFileUnik, paketData, { contentType: 'multipart/form-data', upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlPublik } = supabase.storage.from('pamilo-assets').getPublicUrl(namaFileUnik);
      return urlPublik.publicUrl;
    } catch (error: any) {
      throw new Error(`Sasis Storage Gagal: ${error.message || "Koneksi terputus"}`);
    }
  };

  const cetakUuidManualSteril = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const handleSimpanRekeningKunci = async () => {
    // 🟢 PENGAMAN GANDA: Tolak ekseskusi jika data sudah ada
    if (rekeningTerdaftar) return Alert.alert("Akun Terkunci", "Anda sudah memiliki akun pencairan. Hubungi admin untuk merubahnya.");

    try {
      setLoadingProses(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const uid = session.user.id;
      let dataPenampungUtama = "";

      if (platformTerpilih === 'qris') {
        if (!uriGambarQris) {
          setLoadingProses(false);
          return Alert.alert("Gambar Kosong ❌", "Silakan foto atau ambil gambar QRIS Anda terlebih dahulu.");
        }
        setIsUploadingQris(true);
        dataPenampungUtama = await prosesUploadQrisKeCloud(uriGambarQris, uid);
        setIsUploadingQris(false);
      } else {
        dataPenampungUtama = nomorEwallet.trim();
      }

      // 💥 SUNTIK STRING UUID MANDIRI YANG DIJAMIN STERIL (1x INSERT ONLY)
      const uuidBaruMurni = cetakUuidManualSteril(); 

      const { error: errorInsert } = await supabase
        .from('user_bank_accounts')
        .insert([
          {
            id: uuidBaruMurni, 
            user_id: uid, 
            nama_bank: platformTerpilih!.toLowerCase(), 
            nomor_rekening: dataPenampungUtama,
            nama_pemilik: namaPemilik.trim().toUpperCase(),
          }
        ]);

      if (errorInsert) throw errorInsert;

      Alert.alert("Berhasil Disimpan 🎉", "Data akun tujuan pencairan dana Anda telah resmi dikunci ke dalam sistem keamanan PAMILO.", [
        { text: "Selesai", onPress: () => muatDataRekeningUser() }
      ]);

    } catch (err: any) {
      Alert.alert("Gagal Menyimpan ❌", err.message || "Terjadi kendala teknis.");
    } finally {
      setLoadingProses(false);
      setIsUploadingQris(false);
    }
  };

  const validasiFormulirLengkap = () => {
    if (!platformTerpilih) return false; 
    if (!namaPemilik.trim() || namaPemilik.trim().length < 3) return false; 
    if (platformTerpilih === 'qris') return uriGambarQris !== null; 
    return nomorEwallet.trim().length >= 10; 
  };

  const isFormValid = validasiFormulirLengkap();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <Stack.Screen options={{ title: 'Akun Pencairan Dana', headerStyle: { backgroundColor: '#4A3525' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: 'bold', fontSize: 14 } }} />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />

      {loadingDataAwal ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#4A3525" />
          <Text style={styles.loadingText}>Menghubungkan ke brankas finansial...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          
          {/* 🟢 LOGIKA GEMBOK PERMANEN (HANYA MENAMPILKAN STATUS JIKA SUDAH DIISI) */}
          {rekeningTerdaftar ? (
            <View style={styles.lockedContainerInfo}>
              <View style={styles.lockedHeader}>
                <Ionicons name="shield-checkmark" size={42} color="#2E7D32" />
                <Text style={styles.lockedTitleText}>REKENING ANDA TELAH DIKUNCI</Text>
              </View>
              <Text style={styles.lockedSubText}>
                Demi standar keamanan Level-1, data bank yang telah terdaftar tidak dapat diubah secara bebas untuk mencegah pembajakan akun (pencurian dana).
              </Text>
              
              <View style={styles.rekeningTerkunciBox}>
                <View style={styles.rekeningHeaderRow}>
                  <Text style={styles.rekeningKunciLabel}>🔒 DATA AKUN AKTIF ANDA DI DATABASE</Text>
                  <View style={styles.badgeAktif}><Text style={styles.badgeAktifText}>SIAP WD</Text></View>
                </View>
                <Text style={styles.txtDetailKunci}>Metode Pencairan: <Text style={{ fontWeight: 'bold', color: '#1B5E20' }}>{rekeningTerdaftar.nama_bank.toUpperCase()}</Text></Text>
                
                {rekeningTerdaftar.nama_bank.toLowerCase() === 'qris' ? (
                  <View style={{ marginTop: 6, marginBottom: 4 }}>
                    <Text style={[styles.txtDetailKunci, { marginBottom: 4 }]}>Dokumen QRIS Terkunci:</Text>
                    <Image source={{ uri: rekeningTerdaftar.nomor_rekening }} style={styles.miniQrisCloudPreview} />
                  </View>
                ) : (
                  <Text style={styles.txtDetailKunci}>No. Akun / HP: <Text style={{ fontWeight: 'bold', letterSpacing: 0.8, color: '#1B5E20' }}>{rekeningTerdaftar.nomor_rekening}</Text></Text>
                )}
                
                <Text style={styles.txtDetailKunci} numberOfLines={1}>Nama Terdaftar: <Text style={{ fontWeight: 'bold', color: '#1B5E20' }}>{(rekeningTerdaftar.nama_pemilik || '').toUpperCase()}</Text></Text>
              </View>

              <TouchableOpacity style={styles.btnBantuanAdmin} onPress={() => Alert.alert("Bantuan Hubungi Admin", "Jika Anda kehilangan akses ke rekening Anda, silakan hubungi Customer Service PAMILO di WhatsApp Center kami.")}>
                <Ionicons name="help-buoy-outline" size={16} color="#D35400" style={{ marginRight: 6 }}/>
                <Text style={styles.btnBantuanAdminText}>Butuh Ganti Rekening? Hubungi Admin</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // 🟢 FORMULIR INPUT (HANYA MUNCUL JIKA BELUM ADA DATA SAMA SEKALI)
            <View style={styles.sectionCard}>
              <View style={styles.warningBoxOneTime}>
                <Ionicons name="warning" size={16} color="#E65100" />
                <Text style={styles.warningBoxText}>PERHATIAN: Pastikan data Anda benar. Rekening hanya dapat dimasukkan 1 (satu) kali demi keamanan permanen.</Text>
              </View>

              <Text style={styles.sectionTitle}>Pilih Platform Tujuan Pencairan</Text>
              <View style={styles.gridWallet}>
                {DAFTAR_PLATFORM.map((item) => (
                  <TouchableOpacity 
                    key={item.id} 
                    style={[styles.walletOption, platformTerpilih === item.id && styles.walletActive]}
                    onPress={() => {
                      setPlatformTerpilih(item.id);
                      if(item.id !== 'qris') setUriGambarQris(null);
                    }}
                    disabled={loadingProses}
                  >
                    <View style={styles.radioCircle}>
                      {platformTerpilih === item.id && <View style={styles.radioInnerCircle} />}
                    </View>
                    <Text style={[styles.walletText, platformTerpilih === item.id && styles.walletTextActive]}>{item.nama}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {platformTerpilih === 'qris' ? (
                <View style={{ marginTop: 14 }}>
                  <Text style={styles.inputLabel}>Dokumen QRIS Penarikan Saldo</Text>
                  <TouchableOpacity style={styles.btnMediaPicker} onPress={handleAmbilMediaQris} disabled={loadingProses}>
                    <Ionicons name="camera" size={18} color="#D35400" />
                    <Text style={styles.btnMediaPickerText}>
                      {uriGambarQris ? "Ganti Gambar/Foto QRIS" : "Unggah QRIS dari Galeri / Kamera"}
                    </Text>
                  </TouchableOpacity>

                  {uriGambarQris && (
                    <View style={styles.previewContainer}>
                      <Image source={{ uri: uriGambarQris }} style={styles.previewImageReal} />
                      <Text style={styles.previewHint}>*Preview gambar QRIS yang akan dikirim ke pusat</Text>
                    </View>
                  )}
                </View>
              ) : platformTerpilih ? (
                <View>
                  <Text style={styles.inputLabel}>Nomor Rekening / No. HP {platformTerpilih.toUpperCase()}</Text>
                  <View style={styles.inputWrapper}>
                    <FontAwesome5 name="phone" size={12} color="#90A4AE" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Contoh: 081234xxx / 541098xxx"
                      placeholderTextColor="#B0BEC5"
                      keyboardType="numeric"
                      value={nomorEwallet}
                      onChangeText={(text) => setNomorEwallet(text.replace(/[^0-9]/g, ''))}
                      editable={!loadingProses}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.hintWajibPilih}>
                  <Text style={styles.hintWajibPilihText}>*Silakan tentukan jenis bank atau e-wallet di atas terlebih dahulu.</Text>
                </View>
              )}

              <Text style={styles.inputLabel}>Nama Lengkap Pemilik Sesuai Buku Rekening</Text>
              <View style={styles.inputWrapper}>
                <FontAwesome5 name="user" size={12} color="#90A4AE" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Masukkan nama resmi terdaftar..."
                  placeholderTextColor="#B0BEC5"
                  autoCapitalize="characters"
                  value={namaPemilik}
                  onChangeText={setNamaPemilik}
                  editable={!loadingProses}
                />
              </View>

              <TouchableOpacity style={[styles.btnSimpan, (!isFormValid || loadingProses) && styles.btnSimpanDisabled]} onPress={handleSimpanRekeningKunci} disabled={!isFormValid || loadingProses}>
                {loadingProses ? <ActivityIndicator size="small" color="#fff" /> : (
                  <><Ionicons name={isFormValid ? "lock-closed" : "ellipse-outline"} size={14} color="#fff" style={{ marginRight: 6 }} /><Text style={styles.btnSimpanText}>{isUploadingQris ? "Mengunggah File..." : "KUNCI REKENING PERMANEN"}</Text></>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDFCFB' }, scrollContent: { padding: 16 }, centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 }, loadingText: { marginTop: 10, fontSize: 12, color: '#8D6E63', fontWeight: '500' },
  sectionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#EFEBE9', elevation: 0.5, marginBottom: 16 },
  warningBoxOneTime: { flexDirection: 'row', backgroundColor: '#FFF3E0', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#FFCCBC', marginBottom: 16, alignItems: 'flex-start', gap: 8 }, warningBoxText: { flex: 1, color: '#E65100', fontSize: 10, fontWeight: 'bold', lineHeight: 15 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', color: '#7D665E', marginBottom: 14, letterSpacing: 0.5, textTransform: 'uppercase' }, gridWallet: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginBottom: 4 }, walletOption: { width: '48%', flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#EFEBE9', borderRadius: 10, padding: 12, height: 46, marginTop: 6 }, walletActive: { borderColor: '#D35400', backgroundColor: '#FFFAF1' }, radioCircle: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: '#BCAAA4', justifyContent: 'center', alignItems: 'center', marginRight: 10 }, radioInnerCircle: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D35400' }, walletText: { fontSize: 11, fontWeight: 'bold', color: '#4A3525' }, walletTextActive: { color: '#D35400' },
  inputLabel: { fontSize: 11, fontWeight: 'bold', color: '#4A3525', marginBottom: 6, marginTop: 14 }, inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFAFA', borderRadius: 10, borderWidth: 1, borderColor: '#EFEBE9', paddingHorizontal: 12, height: 42 }, inputIcon: { marginRight: 8 }, textInput: { flex: 1, fontSize: 12, color: '#212121', fontWeight: 'bold', paddingVertical: 0 },
  btnSimpan: { backgroundColor: '#4A3525', flexDirection: 'row', height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginTop: 26, elevation: 1 }, btnSimpanDisabled: { backgroundColor: '#CFD8DC', elevation: 0 }, btnSimpanText: { color: '#fff', fontSize: 12, fontWeight: 'bold', letterSpacing: 0.3 }, btnMediaPicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF8F4', borderWidth: 1, borderColor: '#FFCCBC', borderStyle: 'dashed', height: 46, borderRadius: 10, gap: 8 }, btnMediaPickerText: { color: '#D35400', fontSize: 12, fontWeight: 'bold' }, previewContainer: { marginTop: 12, alignItems: 'center', backgroundColor: '#FAFAFA', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#ECEFF1' }, previewImageReal: { width: 140, height: 140, borderRadius: 8, backgroundColor: '#eee' }, previewHint: { fontSize: 10, color: '#90A4AE', marginTop: 6, fontStyle: 'italic' }, miniQrisCloudPreview: { width: 100, height: 100, borderRadius: 8, borderWidth: 1, borderColor: '#C8E6C9', backgroundColor: '#f9f9f9', marginBottom: 4 }, hintWajibPilih: { backgroundColor: '#ECEFF1', padding: 12, borderRadius: 10, marginTop: 12 }, hintWajibPilihText: { color: '#607D8B', fontSize: 10.5, lineHeight: 15, fontWeight: '500' },
  lockedContainerInfo: { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#C8E6C9', alignItems: 'center', elevation: 1 }, lockedHeader: { alignItems: 'center', marginBottom: 12 }, lockedTitleText: { fontSize: 14, fontWeight: '900', color: '#1B5E20', marginTop: 8 }, lockedSubText: { fontSize: 11, color: '#607D8B', textAlign: 'center', lineHeight: 16, marginBottom: 20 },
  rekeningTerkunciBox: { width: '100%', backgroundColor: '#E8F5E9', borderColor: '#A5D6A7', borderWidth: 1, borderRadius: 14, padding: 14, elevation: 0.5 }, rekeningHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, rekeningKunciLabel: { fontSize: 9, fontWeight: 'bold', color: '#1B5E20', letterSpacing: 0.5 }, badgeAktif: { backgroundColor: '#2E7D32', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }, badgeAktifText: { color: '#fff', fontSize: 7, fontWeight: 'bold' }, txtDetailKunci: { fontSize: 12, color: '#2E7D32', marginTop: 3 },
  btnBantuanAdmin: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#FFF3E0', borderRadius: 20, borderWidth: 1, borderColor: '#FFCCBC' }, btnBantuanAdminText: { color: '#D35400', fontSize: 11, fontWeight: 'bold' }
});