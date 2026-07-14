// app/bank-accounts/index.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, StatusBar, BackHandler, KeyboardAvoidingView, ScrollView, Platform, Alert, Modal, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Mengonsumsi pipa mesin logika rekening terisolasi
import { useBankAccounts } from '@/features/bank-accounts/useBankAccounts';

export default function BankAccountsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    loading,
    submitting,
    hasAccount,
    namaBank,
    setNamaBank,
    noRekening,
    setNoRekening,
    namaPemilik,
    setNamaPemilik,
    handleSaveBank
  } = useBankAccounts();

  // State untuk mengontrol visibilitas pop-up pilihan CS
  const [showCSModal, setShowCSModal] = useState(false);

  // PROTEKSI NAVIGASI: Mencegat tombol back fisik HP agar paksa kembali ke Profil
  useEffect(() => {
    const handleHardwareBack = () => {
      router.replace('/(tabs)/profile');
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
    return () => backHandler.remove();
  }, []);

  // 🟢 EKSEKUSI OPSI 1: HUBUNGI VIA WHATSAPP EXTERNAL
  const handleWhatsAppCS = async () => {
    setShowCSModal(false);
    const nomorWA = '6281234567890'; // 🚀 Tuan Master silakan ganti dengan nomor WA CS PAMILO asli nanti
    const pesanTeks = `Halo CS Pasar PAMILO, saya ingin mengajukan permohonan perubahan data rekening bank komisi atas nama pemilik: ${namaPemilik}. Mohon bantuannya.`;
    
    const url = `whatsapp://send?phone=${nomorWA}&text=${encodeURIComponent(pesanTeks)}`;
    const webUrl = `https://wa.me/${nomorWA}?text=${encodeURIComponent(pesanTeks)}`;

    try {
      const bisaBuka = await Linking.canOpenURL(url);
      if (bisaBuka) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(webUrl); // Fallback ke browser jika aplikasi WA tidak terpasang
      }
    } catch (err) {
      Alert.alert('Gagal Membuka WhatsApp', 'Pastikan aplikasi WhatsApp terpasang di perangkat Anda.');
    }
  };

  // 🔵 EKSEKUSI OPSI 2: HUBUNGI VIA CHAT INTERNAL APLIKASI
  const handleInAppCS = () => {
    setShowCSModal(false);
    // Mengarahkan langsung ke sasis ruang obrolan aduan tiket internal
    router.push('/cs/chat' as any); 
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.mainContainer, { paddingTop: insets.top }]}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FAF6F0" />
      
      {/* NAVIGASI HEADER ATAS */}
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/profile')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#4A3420" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Manajemen Rekening Komisi</Text>
      </View>

      {loading ? (
        <View style={styles.centerLoad}>
          <ActivityIndicator size="large" color="#4A3420" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>
              {hasAccount ? 'Informasi Rekening Aktif 🔒' : 'Pendaftaran Rekening Bank Baru'}
            </Text>
            
            {/* INPUT NAMA BANK */}
            <Text style={styles.fieldLabel}>Nama Bank</Text>
            <TextInput 
              style={[styles.input, hasAccount && styles.inputLocked]} 
              placeholder="Contoh: BCA, BNI, BRI, Bank BJB" 
              placeholderTextColor="#C0A995"
              value={namaBank}
              onChangeText={setNamaBank}
              editable={!hasAccount}
            />

            {/* INPUT NOMOR REKENING */}
            <Text style={styles.fieldLabel}>Nomor Rekening</Text>
            <TextInput 
              style={[styles.input, hasAccount && styles.inputLocked]} 
              placeholder="Masukkan nomor rekening murni" 
              placeholderTextColor="#C0A995"
              keyboardType="number-pad"
              value={noRekening}
              onChangeText={setNoRekening}
              editable={!hasAccount}
            />

            {/* INPUT NAMA LENGKAP PEMILIK */}
            <Text style={styles.fieldLabel}>Nama Lengkap Pemilik Rekening</Text>
            <TextInput 
              style={[styles.input, hasAccount && styles.inputLocked]} 
              placeholder="Harus sesuai dengan nama di buku tabungan" 
              placeholderTextColor="#C0A995"
              value={namaPemilik}
              onChangeText={setNamaPemilik}
              editable={!hasAccount}
            />

            {/* TOMBOL AKSI UTAMA */}
            {hasAccount ? (
              <TouchableOpacity style={[styles.btnSave, styles.btnCS]} onPress={() => setShowCSModal(true)}>
                <Ionicons name="chatbubbles-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.btnSaveText}>Hubungi CS untuk Ubah Rekening 💬</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.btnSave} onPress={handleSaveBank} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.btnSaveText}>Kunci Informasi Rekening 💳</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}

      {/* 🌟 MODAL POP-UP DUA OPSI LAYANAN CS */}
      <Modal
        visible={showCSModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCSModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            <Text style={styles.modalTitle}>Pilih Jalur Hubungi CS 🛡️</Text>
            <Text style={styles.modalSubtitle}>Silakan pilih media komunikasi yang paling nyaman bagi Anda.</Text>

            {/* OPSI 1: CHAT DI APLIKASI */}
            <TouchableOpacity style={[styles.modalOptionBtn, styles.btnInApp]} onPress={handleInAppCS}>
              <Ionicons name="apps-outline" size={20} color="#FFF" />
              <Text style={styles.modalOptionText}>Chat CS di Aplikasi 🚀</Text>
            </TouchableOpacity>

            {/* OPSI 2: CHAT VIA WHATSAPP */}
            <TouchableOpacity style={[styles.modalOptionBtn, styles.btnWhatsApp]} onPress={handleWhatsAppCS}>
              <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
              <Text style={styles.modalOptionText}>Chat CS via WhatsApp 🟢</Text>
            </TouchableOpacity>

            {/* TOMBOL BATAL */}
            <TouchableOpacity style={styles.btnCancel} onPress={() => setShowCSModal(false)}>
              <Text style={styles.btnCancelText}>Kembali</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FAF6F0' },
  navHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56, borderBottomWidth: 1, borderBottomColor: '#E0D0C0', backgroundColor: '#FFF' },
  backBtn: { padding: 4, marginRight: 12 },
  navTitle: { fontSize: 15, fontWeight: 'bold', color: '#4A3420' },
  centerLoad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollBody: { paddingBottom: 40 },
  formCard: { backgroundColor: '#FFF', margin: 20, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E0D0C0', elevation: 1 },
  formTitle: { fontSize: 13, fontWeight: 'bold', color: '#7A6450', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldLabel: { fontSize: 11, fontWeight: 'bold', color: '#A1887F', marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: '#FAF6F0', borderWidth: 1, borderColor: '#E0D0C0', borderRadius: 10, height: 42, paddingHorizontal: 12, fontSize: 13, color: '#4A3420', marginBottom: 16 },
  inputLocked: { backgroundColor: '#EFEBE9', color: '#7A6450', borderColor: '#D7CCC8' }, 
  btnSave: { height: 46, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 8, flexDirection: 'row' },
  btnCS: { backgroundColor: '#4A3420' }, 
  btnSaveText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },

  // Desain Modul Modal Pop-Up Opsi CS
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 25 },
  modalContentCard: { backgroundColor: '#FFF', width: '100%', borderRadius: 16, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: '#E0D0C0', elevation: 10 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#4A3420', marginBottom: 6 },
  modalSubtitle: { fontSize: 12, color: '#7A6450', textAlign: 'center', marginBottom: 20, lineHeight: 16 },
  modalOptionBtn: { flexDirection: 'row', width: '100%', height: 46, borderRadius: 10, justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 12, elevation: 1 },
  btnInApp: { backgroundColor: '#4A3420' },
  btnWhatsApp: { backgroundColor: '#2E7D32' },
  modalOptionText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  btnCancel: { marginTop: 4, padding: 10 },
  btnCancelText: { color: '#A1887F', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' }
});