// app/referral/index.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Share, Clipboard, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ReferralScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Kode dummy lokal sementara sebelum ditarik dari useProfile/useAuth Tuan Master
  const KODE_REFERRAL_WARGA = "PAMILO-GALUH-2026"; 

  const handleSalinKode = () => {
    Clipboard.setString(KODE_REFERRAL_WARGA);
    Alert.alert("Tersalin 📋", "Kode referral berhasil disalin ke papan klip ponsel.");
  };

  const handleBagikanAplikasi = async () => {
    try {
      await Share.share({
        message: `Mari bela tetangga dan beli di tetangga menggunakan aplikasi Pasar PAMILO! Masukkan kode referral saya: ${KODE_REFERRAL_WARGA} saat mendaftar akun warga baru.`,
      });
    } catch (error: any) {
      console.error(error.message);
    }
  };

  return (
    <View style={[styles.mainContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor="#4A3420" />

      {/* NAVIGASI HEADER REFERRAL */}
      <View style={styles.customNavBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.navBarTitle}>Program Kemitraan Warga 🤝</Text>
        <View style={{ width: 35 }} />
      </View>

      <View style={styles.bodyContent}>
        {/* KARTU UTAMA AJAKAN */}
        <View style={styles.referralCard}>
          <Ionicons name="gift-outline" size={48} color="#E28743" style={{ alignSelf: 'center', marginBottom: 10 }} />
          <Text style={styles.cardHeading}>Bela Tetangga, Raih Berkah</Text>
          <Text style={styles.cardSubText}>
            Bagikan kode unik Anda kepada kerabat atau tetangga di Tatar Galuh Ciamis untuk ikut bertransaksi komoditas pasar segar di aplikasi PAMILO.
          </Text>

          {/* BOX NOTA KODE REFERRAL */}
          <View style={styles.codeDisplayBox}>
            <Text style={styles.labelCode}>KODE REFERRAL ANDA</Text>
            <Text style={styles.codeTextValue}>{KODE_REFERRAL_WARGA}</Text>
            
            <TouchableOpacity style={styles.btnCopyAction} onPress={handleSalinKode}>
              <Ionicons name="copy-outline" size={14} color="#4A3420" />
              <Text style={styles.textBtnCopy}>Salin Kode Kemitraan</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* TOMBOL BAGIKAN JUMBO */}
        <TouchableOpacity style={styles.btnShareExecute} onPress={handleBagikanAplikasi}>
          <Ionicons name="share-social-outline" size={18} color="#FFF" />
          <Text style={styles.textBtnShare}>Bagikan Link Aplikasi</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FAF6F0' },
  customNavBar: { backgroundColor: '#4A3420', height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, elevation: 4 },
  backBtn: { width: 35, height: 40, justifyContent: 'center' },
  navBarTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  
  bodyContent: { flex: 1, padding: 20, justifyContent: 'center' },
  referralCard: { backgroundColor: '#FFF', padding: 24, borderRadius: 16, borderWidth: 1, borderColor: '#E0D0C0', elevation: 2, marginBottom: 20 },
  cardHeading: { fontSize: 16, fontWeight: 'bold', color: '#4A3420', textAlign: 'center', marginBottom: 6 },
  cardSubText: { fontSize: 12, color: '#7A6450', textAlign: 'center', lineHeight: 18, paddingHorizontal: 10 },
  
  codeDisplayBox: { backgroundColor: '#FAF6F0', borderWidth: 1, borderColor: '#E0D0C0', borderRadius: 12, padding: 16, marginTop: 20, alignItems: 'center', gap: 4 },
  labelCode: { fontSize: 9, fontWeight: 'bold', color: '#A1887F', letterSpacing: 1 },
  codeTextValue: { fontSize: 20, fontWeight: 'bold', color: '#4A3420', letterSpacing: 2, marginVertical: 4 },
  btnCopyAction: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingVertical: 4, paddingHorizontal: 12, borderWidth: 0.5, borderColor: '#E0D0C0', borderRadius: 20, backgroundColor: '#FFF' },
  textBtnCopy: { fontSize: 11, fontWeight: 'bold', color: '#4A3420' },

  btnShareExecute: { backgroundColor: '#E28743', height: 46, borderRadius: 23, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, elevation: 2 },
  textBtnShare: { color: '#FFF', fontSize: 13, fontWeight: 'bold' }
});