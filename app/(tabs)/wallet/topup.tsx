// app/(tabs)/wallet/topup.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker'; 
import { useTopUp } from '@/features/wallet/useTopup'; 

type PaymentMethod = 'BCA' | 'DANA' | 'QRIS';

export default function TopUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const { submitting, error, executeTopUp } = useTopUp();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('BCA');

  // State input formulir konfirmasi warga
  const [jumlahInput, setJumlahInput] = useState('');
  const [namaBank, setNamaBank] = useState('');
  const [nomorRekening, setNomorRekening] = useState('');
  const [namaPemilik, setNamaPemilik] = useState('');
  const [buktiStruk, setBuktiStruk] = useState<string | null>(null);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Izin Ditolak', 'PAMILO memerlukan izin akses galeri untuk mengunggah bukti struk.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.6, 
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setBuktiStruk(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    const nominal = Number(jumlahInput);

    if (!jumlahInput || nominal <= 0) {
      Alert.alert('Perhatian', 'Masukkan nominal top up yang valid (harus lebih dari Rp 0).');
      return;
    }
    if (!namaBank.trim() || !nomorRekening.trim() || !namaPemilik.trim()) {
      Alert.alert('Perhatian', 'Silakan lengkapi seluruh informasi konfirmasi pengirim Anda.');
      return;
    }
    if (!buktiStruk) {
      Alert.alert('Perhatian', 'Wajib melampirkan foto bukti struk / transfer sebagai validasi fisik.');
      return;
    }

    const finalMethodName = selectedMethod === 'BCA' ? namaBank : `${selectedMethod} - ${namaBank}`;

    const result = await executeTopUp(nominal, {
      nama_bank: finalMethodName,
      nomor_rekening: nomorRekening,
      nama_pemilik_rekening: namaPemilik,
      bukti_struk: buktiStruk 
    });

    if (result.success) {
      Alert.alert(
        'Permintaan Terkirim', 
        'Konfirmasi top up berhasil dibuat. Saldo akan otomatis bertambah setelah admin memverifikasi transfer Anda.',
        [{ text: 'OK', onPress: () => router.replace('/wallet') }]
      );
    }
  };

  const handleMethodChange = (method: PaymentMethod) => {
    setSelectedMethod(method);
    if (method === 'DANA') {
      setNamaBank('DANA');
    } else if (method === 'QRIS') {
      setNamaBank('E-Wallet/M-Banking');
    } else {
      setNamaBank('');
    }
    setNomorRekening('');
    setNamaPemilik('');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.mainContainer}>
      {/* HEADER NAVIGASI (DIPERBAIKI: Mengarah Mutlak ke /wallet) */}
      <View style={[styles.customNavBar, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.push('/wallet')}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.navBarTitle}>Top Up Saldo</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* CHIPS SELECTOR METODE TOP UP */}
        <Text style={styles.fieldSectionLabel}>Pilih Metode Top Up</Text>
        <View style={styles.methodSelectorRow}>
          {(['BCA', 'DANA', 'QRIS'] as PaymentMethod[]).map((method) => (
            <TouchableOpacity
              key={method}
              style={[
                styles.methodChip,
                selectedMethod === method && styles.methodChipActive
              ]}
              onPress={() => handleMethodChange(method)}
            >
              <Ionicons 
                name={method === 'QRIS' ? 'qr-code' : method === 'DANA' ? 'wallet' : 'business'} 
                size={16} 
                color={selectedMethod === method ? '#FFF' : '#7A6450'} 
              />
              <Text style={[styles.methodChipText, selectedMethod === method && styles.methodChipTextActive]}>
                {method}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* KARTU INSTRUKSI DINAMIS */}
        <Text style={styles.fieldSectionLabel}>Tujuan Transfer PAMILO</Text>
        
        {selectedMethod === 'BCA' && (
          <View style={styles.pamiloBankCard}>
            <Text style={styles.pamiloBankName}>BANK BCA (PAMILO MARKETPLACE)</Text>
            <Text style={styles.pamiloAccNumber}>515-0298-042</Text>
            <Text style={styles.pamiloAccOwner}>a.n. Septian Gilang Permana</Text>
            <Text style={styles.pamiloInstructionNote}>
              💡 Silakan lakukan transfer antar-bank atau sesama BCA ke rekening di atas sebelum mengisi formulir di bawah.
            </Text>
          </View>
        )}

        {selectedMethod === 'DANA' && (
          <View style={[styles.pamiloBankCard, { borderColor: '#118EEA' }]}>
            <Text style={[styles.pamiloBankName, { color: '#118EEA' }]}>DANA E-WALLET (PAMILO)</Text>
            <Text style={styles.pamiloAccNumber}>0831-9558-5892</Text>
            <Text style={styles.pamiloAccOwner}>a.n. Septian Gilang Permana</Text>
            <Text style={styles.pamiloInstructionNote}>
              💡 Silakan lakukan kirim saldo DANA ke nomor e-wallet di atas terlebih dahulu.
            </Text>
          </View>
        )}

        {selectedMethod === 'QRIS' && (
          <View style={[styles.pamiloBankCard, { borderColor: '#2ECC71', alignItems: 'center' }]}>
            <Text style={[styles.pamiloBankName, { color: '#2ECC71', textAlign: 'center' }]}>QRIS INTERNASIONAL PAMILO</Text>
            
            <View style={styles.qrisVisualBox}>
              <Ionicons name="qr-code-sharp" size={100} color="#4A3420" />
              <Text style={styles.qrisScanBadge}>SCAN ME</Text>
            </View>

            <Text style={[styles.pamiloAccOwner, { marginTop: 8 }]}>a.n. PAMILO MARKETPLACE</Text>
            <Text style={[styles.pamiloInstructionNote, { textAlign: 'center' }]}>
              💡 Simpan tangkapan layar / scan langsung kode QRIS diatas menggunakan aplikasi E-Wallet atau M-Banking Anda.
            </Text>
          </View>
        )}

        {error && (
          <View style={styles.errorWrapper}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* FORMULIR KONFIRMASI */}
        <Text style={styles.fieldSectionLabel}>Formulir Konfirmasi Pengirim</Text>
        <View style={styles.formContainer}>
          
          <Text style={styles.inputLabel}>
            {selectedMethod === 'BCA' ? 'Nama Bank Anda' : 'Aplikasi / Sumber Dana'}
          </Text>
          <TextInput 
            style={styles.inputField} 
            placeholder={selectedMethod === 'BCA' ? "Contoh: Mandiri, BRI, BCA" : "Contoh: OVO, GoPay, DANA Bisnis"} 
            placeholderTextColor="#A1887F"
            value={namaBank}
            onChangeText={setNamaBank}
          />

          <Text style={styles.inputLabel}>
            {selectedMethod === 'BCA' ? 'Nomor Rekening Anda' : selectedMethod === 'DANA' ? 'Nomor HP DANA Pengirim' : 'No. HP / ID Transaksi'}
          </Text>
          <TextInput 
            style={styles.inputField} 
            placeholder={selectedMethod === 'BCA' ? "Masukkan nomor rekening Anda" : "Masukkan nomor kontak pengirim"} 
            placeholderTextColor="#A1887F"
            keyboardType="numeric"
            value={nomorRekening}
            onChangeText={setNomorRekening}
          />

          <Text style={styles.inputLabel}>Nama Pemilik Akun / Pengirim</Text>
          <TextInput 
            style={styles.inputField} 
            placeholder="Nama sesuai di aplikasi / rekening" 
            placeholderTextColor="#A1887F"
            value={namaPemilik}
            onChangeText={setNamaPemilik}
          />
        </View>

        {/* INPUT BUKTI STRUK */}
        <Text style={styles.fieldSectionLabel}>Lampiran Bukti Transfer</Text>
        <View style={styles.uploadStrukCard}>
          {buktiStruk ? (
            <View style={styles.previewImageWrapper}>
              <Image source={{ uri: buktiStruk }} style={styles.previewStrukImg} />
              <TouchableOpacity style={styles.btnHapusStruk} onPress={() => setBuktiStruk(null)}>
                <Ionicons name="trash" size={14} color="#FFF" />
                <Text style={styles.btnHapusStrukText}>Ganti Foto</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.btnPilihStrukCard} activeOpacity={0.7} onPress={handlePickImage}>
              <Ionicons name="camera" size={26} color="#7A6450" />
              <Text style={styles.textUploadPrompt}>Klik untuk Unggah / Foto Struk</Text>
              <Text style={styles.textUploadSubPrompt}>Format gambar (JPG, JPEG, PNG)</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* INPUT NOMINAL UANG */}
        <Text style={styles.fieldSectionLabel}>Jumlah Top Up</Text>
        <View style={styles.amountInputWrapper}>
          <Text style={styles.currencySymbol}>Rp</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0"
            placeholderTextColor="#C0A995"
            keyboardType="numeric"
            value={jumlahInput}
            onChangeText={setJumlahInput}
          />
        </View>

        {/* TOMBOL AKSI KIRIM */}
        <TouchableOpacity 
          style={[styles.submitButton, submitting && { backgroundColor: '#C0A995' }]} 
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitButtonText}>Konfirmasi Sudah Bayar</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FAF6F0' },
  customNavBar: { backgroundColor: '#4A3420', height: 90, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, elevation: 4 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  navBarTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  methodSelectorRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 16 },
  methodChip: { flex: 1, height: 40, borderRadius: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E0D0C0', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  methodChipActive: { backgroundColor: '#4A3420', borderColor: '#4A3420' },
  methodChipText: { fontSize: 12, fontWeight: '700', color: '#7A6450' },
  methodChipTextActive: { color: '#FFF' },
  pamiloBankCard: { backgroundColor: '#2B1D12', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#5D4037', elevation: 2 },
  pamiloBankName: { color: '#E28743', fontWeight: 'bold', fontSize: 12, letterSpacing: 0.5 },
  pamiloAccNumber: { color: '#FFF', fontSize: 22, fontWeight: 'bold', letterSpacing: 1, marginTop: 6 },
  pamiloAccOwner: { color: '#FFF', fontSize: 14, marginTop: 2, fontWeight: '600' },
  pamiloInstructionNote: { color: '#C0A995', fontSize: 11, marginTop: 12, fontStyle: 'italic', lineHeight: 16 },
  qrisVisualBox: { width: 140, height: 140, backgroundColor: '#FFF', borderRadius: 12, marginTop: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#E0D0C0', padding: 8 },
  qrisScanBadge: { fontSize: 10, fontWeight: 'bold', color: '#FFF', backgroundColor: '#E74C3C', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 2, letterSpacing: 0.5 },
  fieldSectionLabel: { fontSize: 11, fontWeight: 'bold', color: '#7A6450', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 10 },
  formContainer: { backgroundColor: '#FFF', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E0D0C0', marginBottom: 20 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#4A3420', marginBottom: 6 },
  inputField: { backgroundColor: '#FAF6F0', borderWidth: 1, borderColor: '#E0D0C0', borderRadius: 10, height: 44, paddingHorizontal: 12, fontSize: 13, color: '#4A3420', marginBottom: 14 },
  amountInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E0D0C0', borderRadius: 16, paddingHorizontal: 16, height: 60, marginBottom: 30 },
  currencySymbol: { fontSize: 20, fontWeight: 'bold', color: '#4A3420', marginRight: 8 },
  amountInput: { flex: 1, fontSize: 22, fontWeight: 'bold', color: '#4A3420', padding: 0 },
  submitButton: { backgroundColor: '#E28743', height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  submitButtonText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  errorWrapper: { backgroundColor: '#FDEDEC', padding: 12, borderRadius: 10, marginBottom: 15 },
  errorText: { color: '#E74C3C', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  uploadStrukCard: { backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E0D0C0', padding: 12, marginBottom: 20, overflow: 'hidden' },
  btnPilihStrukCard: { width: '100%', height: 120, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#C0A995', borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF9F6' },
  textUploadPrompt: { fontSize: 13, fontWeight: 'bold', color: '#4A3420', marginTop: 8 },
  textUploadSubPrompt: { fontSize: 10, color: '#A1887F', marginTop: 2, fontWeight: '500' },
  previewImageWrapper: { alignItems: 'center', width: '100%' },
  previewStrukImg: { width: '100%', height: 200, borderRadius: 12, resizeMode: 'contain', backgroundColor: '#FAF6F0' },
  btnHapusStruk: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E74C3C', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginTop: 10, elevation: 1 },
  btnHapusStrukText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' }
});