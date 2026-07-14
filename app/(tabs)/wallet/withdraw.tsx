// app/(tabs)/wallet/withdraw.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWithdraw } from '@/features/wallet/useWithdraw';

export default function WithdrawScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // 🚀 FAKTA SOLUSI: Mengambil variabel hasPendingWithdrawal dari hook
  const { saldo, bankAccount, hasPendingWithdrawal, loading, submitting, error, executeWithdraw } = useWithdraw();

  const [jumlahInput, setJumlahInput] = useState('');
  
  const [manualBank, setManualBank] = useState('');
  const [manualRekening, setManualRekening] = useState('');
  const [manualPemilik, setManualPemilik] = useState('');

  const formatRupiah = (angka: number) => `Rp ${Number(angka).toLocaleString('id-ID')}`;

  const handleSubmit = async () => {
    const nominal = Number(jumlahInput);
    if (!jumlahInput || nominal <= 0) {
      Alert.alert('Perhatian', 'Masukkan nominal penarikan yang valid (harus lebih dari Rp 0).');
      return;
    }

    if (!bankAccount) {
      if (!manualBank.trim() || !manualRekening.trim() || !manualPemilik.trim()) {
        Alert.alert('Perhatian', 'Silakan lengkapi seluruh data rekening bank Anda.');
        return;
      }
    }

    const manualDetails = bankAccount ? undefined : {
      nama_bank: manualBank,
      nomor_rekening: manualRekening,
      nama_pemilik: manualPemilik
    };

    const result = await executeWithdraw(nominal, manualDetails);
    if (result.success) {
      Alert.alert('Sukses', 'Permintaan penarikan saldo berhasil dikirim. Menunggu verifikasi admin.', [
        { text: 'OK', onPress: () => router.replace('/wallet') }
      ]);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerPemuat}>
        <ActivityIndicator size="large" color="#4A3420" />
        <Text style={{ marginTop: 10, color: '#7A6450', fontSize: 12 }}>Menyelaraskan data rekening...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.mainContainer}>
      <View style={[styles.customNavBar, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.push('/wallet')}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.navBarTitle}>Tarik Saldo</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.infoSaldoCard}>
          <Text style={styles.infoSaldoLabel}>Maksimal Batas Penarikan:</Text>
          <Text style={styles.infoSaldoValue}>{formatRupiah(saldo)}</Text>
        </View>

        {error && (
          <View style={styles.errorWrapper}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* 🚀 FAKTA SOLUSI: Blokir UI jika ada transaksi nyangkut */}
        {hasPendingWithdrawal ? (
          <View style={styles.pendingWarningCard}>
            <Ionicons name="time-outline" size={48} color="#E67E22" />
            <Text style={styles.pendingWarningTitle}>Penarikan Sedang Diproses</Text>
            <Text style={styles.pendingWarningText}>
              Anda tidak dapat membuat permintaan penarikan baru karena masih ada transaksi sebelumnya yang menunggu persetujuan (PENDING) oleh Admin PAMILO.
            </Text>
            <TouchableOpacity 
              style={styles.backToWalletBtn} 
              onPress={() => router.push('/wallet')}
            >
              <Text style={styles.backToWalletBtnText}>Kembali ke Dompet</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Render Formulir Normal jika TIDAK ADA yang pending */
          <>
            <Text style={styles.fieldSectionLabel}>Rekening Bank Tujuan</Text>
            
            {bankAccount ? (
              <View style={styles.savedBankCard}>
                <View style={styles.bankHeaderRow}>
                  <Ionicons name="checkmark-circle" size={18} color="#2ECC71" />
                  <Text style={styles.savedBankName}>{bankAccount.nama_bank.toUpperCase()}</Text>
                </View>
                <Text style={styles.savedAccNumber}>{bankAccount.nomor_rekening}</Text>
                <Text style={styles.savedAccOwner}>a.n. {bankAccount.nama_pemilik}</Text>
                <Text style={styles.badgeLockedInfo}>🔒 Rekening Terkunci Otomatis</Text>
              </View>
            ) : (
              <View style={styles.manualFormContainer}>
                <Text style={styles.inputLabel}>Nama Bank</Text>
                <TextInput 
                  style={styles.inputField} 
                  placeholder="Contoh: BCA, BNI, Mandiri" 
                  placeholderTextColor="#A1887F"
                  value={manualBank}
                  onChangeText={setManualBank}
                />

                <Text style={styles.inputLabel}>Nomor Rekening</Text>
                <TextInput 
                  style={styles.inputField} 
                  placeholder="Masukkan nomor rekening" 
                  placeholderTextColor="#A1887F"
                  keyboardType="numeric"
                  value={manualRekening}
                  onChangeText={setManualRekening}
                />

                <Text style={styles.inputLabel}>Nama Pemilik Rekening</Text>
                <TextInput 
                  style={styles.inputField} 
                  placeholder="Nama sesuai buku tabungan" 
                  placeholderTextColor="#A1887F"
                  value={manualPemilik}
                  onChangeText={setManualPemilik}
                />
              </View>
            )}

            <Text style={styles.fieldSectionLabel}>Nominal Penarikan</Text>
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

            <TouchableOpacity 
              style={[styles.submitButton, submitting && { backgroundColor: '#C0A995' }]} 
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitButtonText}>Konfirmasi Penarikan</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FAF6F0' },
  centerPemuat: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF6F0' },
  customNavBar: { backgroundColor: '#4A3420', height: 90, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, elevation: 4 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  navBarTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  infoSaldoCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#E0D0C0', marginBottom: 20 },
  infoSaldoLabel: { fontSize: 12, color: '#7A6450', fontWeight: '500' },
  infoSaldoValue: { fontSize: 22, fontWeight: 'bold', color: '#E28743', marginTop: 4 },
  fieldSectionLabel: { fontSize: 12, fontWeight: 'bold', color: '#7A6450', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 10 },
  savedBankCard: { backgroundColor: '#4A3420', padding: 16, borderRadius: 16, marginBottom: 20, elevation: 2 },
  bankHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  savedBankName: { color: '#FFF', fontWeight: 'bold', fontSize: 14, letterSpacing: 0.5 },
  savedAccNumber: { color: '#FFF', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  savedAccOwner: { color: '#C0A995', fontSize: 13, marginTop: 4, fontWeight: '500' },
  badgeLockedInfo: { color: '#E28743', fontSize: 10, fontWeight: '700', marginTop: 12, textTransform: 'uppercase' },
  manualFormContainer: { backgroundColor: '#FFF', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E0D0C0', marginBottom: 20 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#4A3420', marginBottom: 6 },
  inputField: { backgroundColor: '#FAF6F0', borderWidth: 1, borderColor: '#E0D0C0', borderRadius: 10, height: 44, paddingHorizontal: 12, fontSize: 13, color: '#4A3420', marginBottom: 14 },
  amountInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E0D0C0', borderRadius: 16, paddingHorizontal: 16, height: 60, marginBottom: 30 },
  currencySymbol: { fontSize: 20, fontWeight: 'bold', color: '#4A3420', marginRight: 8 },
  amountInput: { flex: 1, fontSize: 22, fontWeight: 'bold', color: '#4A3420', padding: 0 },
  submitButton: { backgroundColor: '#E28743', height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  submitButtonText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  errorWrapper: { backgroundColor: '#FDEDEC', padding: 12, borderRadius: 10, marginBottom: 15 },
  errorText: { color: '#E74C3C', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  // Tambahan style untuk kotak peringatan transaksi nyangkut
  pendingWarningCard: { backgroundColor: '#FFF9E6', padding: 24, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#FAD7A1', marginTop: 10 },
  pendingWarningTitle: { fontSize: 16, fontWeight: 'bold', color: '#D35400', marginTop: 12, marginBottom: 8, textAlign: 'center' },
  pendingWarningText: { fontSize: 13, color: '#A04000', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  backToWalletBtn: { backgroundColor: '#D35400', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  backToWalletBtnText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' }
});