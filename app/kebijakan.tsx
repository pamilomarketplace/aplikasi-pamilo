import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ModalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Kunci konfigurasi tampilan header modal layar */}
      <Stack.Screen 
        options={{ 
          headerShown: true, 
          headerTitle: 'Aturan & Keamanan Sistem',
          headerStyle: { backgroundColor: '#4A3525' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold', fontSize: 14 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 5, padding: 4 }}>
              <Ionicons name="close-circle" size={22} color="#fff" />
            </TouchableOpacity>
          )
        }} 
      />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
      >
        {/* MERCILESS SECURITY INFO BANNER */}
        <View style={styles.infoBanner}>
          <FontAwesome5 name="shield-alt" size={24} color="#D35400" />
          <Text style={styles.infoBannerTitle}>Ekosistem Belanja Aman & Jujur</Text>
          <Text style={styles.infoBannerSub}>
            Pasar Digital PAMILO Ciamis dilindungi oleh enkripsi sasis ganda Supabase Cloud untuk menjamin keamanan saldo and keadilan mutasi kas hulu ke hilir.
          </Text>
        </View>

        {/* POIN 1: BAGI PEDAGANG */}
        <View style={styles.cardRule}>
          <View style={styles.ruleHeader}>
            <View style={[styles.iconGroup, { backgroundColor: '#E8EAF6' }]}>
              <FontAwesome5 name="store" size={12} color="#3F51B5" />
            </View>
            <Text style={styles.ruleTitleText}>1. Regulasi Mitra Lapak Toko</Text>
          </View>
          <Text style={styles.ruleBodyText}>
            • Seluruh pedagang wajib mengunggah dokumen fisik KTP and foto komoditas asli tanpa manipulasi digital pencitraan.{"\n"}
            • Stok barang yang tertera pada katalog wajib diperbarui secara integer murni guna menghindari pembatalan nota sepihak.{"\n"}
            • Penarikan omset penjualan diproses instan and dikenakan biaya kliring bank flat sesuai aturan admin pusat.
          </Text>
        </View>

        {/* POIN 2: BAGI DRIVER */}
        <View style={styles.cardRule}>
          <View style={styles.ruleHeader}>
            <View style={[styles.iconGroup, { backgroundColor: '#FFF3E0' }]}>
              <FontAwesome5 name="motorcycle" size={12} color="#E65100" />
            </View>
            <Text style={styles.ruleTitleText}>2. Ketentuan Ksatria Aspal MIGO</Text>
          </View>
          <Text style={styles.ruleBodyText}>
            • Kurir MIGO wajib menjaga nomor WhatsApp and status navigasi GPS penentu ongkir agar selalu aktif saat mengantar paket harian warga.{"\n"}
            • Komisi bersih bagi hasil ongkos kirim akan dicairkan otomatis masuk ke dompet saldo sesaat setelah konsumen mengetuk tombol terima barang.
          </Text>
        </View>

        {/* POIN 3: BAGI WARGA KONSUMEN */}
        <View style={styles.cardRule}>
          <View style={styles.ruleHeader}>
            <View style={[styles.iconGroup, { backgroundColor: '#E8F5E9' }]}>
              <FontAwesome5 name="user-check" size={12} color="#1B5E20" />
            </View>
            <Text style={styles.ruleTitleText}>3. Hak Perlindungan Konsumen</Text>
          </View>
          <Text style={styles.ruleBodyText}>
            • Pembeli berhak mengajukan aduan atau *chat* kilat pararel jika paket pesanan nota tidak sesuai deskripsi katalog jualan pedagang.{"\n"}
            • Tindakan manipulasi akun, pemalsuan titik kordinat pengiriman peta, and aktivitas *fraud* keuangan akan memicu penangguhan akun utama secara mutlak oleh sakelar admin.
          </Text>
        </View>

        {/* BUTTON ACTION BACK */}
        <TouchableOpacity style={styles.btnUnderstand} onPress={() => router.back()}>
          <Text style={styles.btnUnderstandText}>SAYA MENGERTI & PATUH</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5' },
  scrollContent: { padding: 16 },
  infoBanner: { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#FFE0B2', marginBottom: 16, elevation: 0.5 },
  infoBannerTitle: { fontSize: 15, fontWeight: 'bold', color: '#4A3525', marginTop: 12 },
  infoBannerSub: { fontSize: 11, color: '#8D6E63', textAlign: 'center', marginTop: 6, lineHeight: 16, fontWeight: '500' },
  cardRule: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#EFEBE9', marginBottom: 14, elevation: 0.5 },
  ruleHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  iconGroup: { width: 26, height: 26, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  ruleTitleText: { fontSize: 13, fontWeight: 'bold', color: '#4A3525', marginLeft: 10 },
  ruleBodyText: { fontSize: 11, color: '#5D4037', lineHeight: 18, paddingLeft: 4, textAlign: 'justify' },
  btnUnderstand: { backgroundColor: '#4A3525', height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginTop: 10, elevation: 1 },
  btnUnderstandText: { color: '#fff', fontSize: 12, fontWeight: 'bold', letterSpacing: 0.8 }
});