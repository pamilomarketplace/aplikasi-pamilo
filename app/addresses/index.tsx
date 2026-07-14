// app/addresses/index.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Alert, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
// Mengonsumsi pipa data terisolasi sesuai aturan baku arsitektur bersih
import { useAddresses, AddressData } from '../../features/addresses/useAddresses';

export default function AddressesManagementScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { addresses, loading, error, refresh, setAddressAsUtama } = useAddresses();
  const [actionId, setActionId] = useState<string | null>(null);

  // 🚀 KUNCI PENCEGAT 1: MENAHAN TOMBOL BACK FISIK/GESTURE SMARTPHONE (ANDROID/IOS)
  useEffect(() => {
    const handleHardwareBack = () => {
      // Potong jalur bebas, paksa lempar balik ke halaman profil
      router.replace('/(tabs)/profile');
      return true; // Nilai true mengabaikan aksi bawaan OS yang biasanya melempar ke beranda
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      handleHardwareBack
    );

    // Bersihkan listener saat halaman ditinggalkan agar tidak mengganggu layar lain
    return () => backHandler.remove();
  }, []);

  const handlePilihUtama = async (id: string) => {
    setActionId(id);
    const hasil = await setAddressAsUtama(id);
    setActionId(null);

    if (hasil.success) {
      Alert.alert('Alamat Diperbarui', 'Alamat utama berhasil diganti. Keranjang belanja Anda otomatis menyesuaikan rute kirim ini.');
    } else {
      Alert.alert('Gagal', hasil.message || 'Gagal mengubah alamat utama.');
    }
  };

  if (loading && addresses.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#4A3420" />
        <ActivityIndicator size="large" color="#E28743" />
        <Text style={styles.loadingText}>Menyelaraskan Titik Koordinat Alamat...</Text>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#4A3420" />

      {/* NAVIGASI HEADER ATAS */}
      <View style={[styles.customNavBar, { paddingTop: insets.top }]}>
        {/* 🚀 KUNCI PENCEGAT 2: PANAH NAVIGASI APLIKASI DIUBAH MENJADI REPLACE KREATIF */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)/profile')}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.navBarTitle}>Alamat Pengiriman Warga</Text>
        <TouchableOpacity style={styles.backBtn} onPress={refresh}>
          <Ionicons name="refresh" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorWrapper}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* DAFTAR KARTU ALAMAT JALAN */}
      <FlatList
        data={addresses}
        keyExtractor={(item: AddressData) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="map-outline" size={60} color="#C0A995" />
            <Text style={styles.emptyTitle}>Belum Ada Alamat</Text>
            <Text style={styles.emptySub}>Anda belum mendaftarkan lokasi rumah atau titik koordinat pengantaran kurir.</Text>
          </View>
        }
        renderItem={({ item }: { item: AddressData }) => (
          <View style={[styles.addressCard, item.is_utama && styles.addressCardUtama]}>
            {/* Bagian Atas Kartu: Label & Status Badge */}
            <View style={styles.cardHeader}>
              <View style={styles.labelRow}>
                <Ionicons name={item.label.toLowerCase() === 'rumah' ? 'home' : 'business'} size={15} color="#4A3420" />
                <Text style={styles.addressLabelText}>{item.label.toUpperCase()}</Text>
              </View>
              {item.is_utama && (
                <View style={styles.utamaBadge}>
                  <Text style={styles.utamaBadgeText}>UTAMA</Text>
                </View>
              )}
            </View>

            {/* Bagian Tengah Kartu: Identitas & Detail Kontak */}
            <Text style={styles.receiverText}>{item.nama_penerima} • {item.nomor_telepon}</Text>
            <Text style={styles.detailText}>{item.detail_lengkap}</Text>

            {/* Bagian Bawah Kartu: Tombol Aksi Pilihan Utama */}
            {!item.is_utama && (
              <TouchableOpacity 
                style={styles.btnSetUtama}
                onPress={() => handlePilihUtama(item.id)}
                disabled={actionId !== null}
              >
                {actionId === item.id ? (
                  <ActivityIndicator size="small" color="#E28743" />
                ) : (
                  <Text style={styles.btnSetUtamaText}>Jadikan Alamat Utama</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      {/* TOMBOL FIX FLOATING: TAMBAH ALAMAT BARU */}
      <View style={[styles.bottomActionContainer, { paddingBottom: insets.bottom + 14 }]}>
        <TouchableOpacity 
          style={styles.btnAddAddress}
          onPress={() => router.push('/addresses/add' as any)}
        >
          <Ionicons name="add-circle" size={20} color="#FFF" />
          <Text style={styles.btnAddAddressText}>Tambah Alamat Baru</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FAF6F0' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF6F0' },
  loadingText: { marginTop: 12, color: '#7A6450', fontWeight: 'bold', fontSize: 12 },
  customNavBar: { backgroundColor: '#4A3420', height: 90, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, elevation: 4 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  navBarTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  listContent: { padding: 16 },
  
  addressCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E0D0C0', elevation: 1 },
  addressCardUtama: { borderColor: '#E28743', backgroundColor: '#FFFDFB', borderWidth: 1.5 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addressLabelText: { fontSize: 12, fontWeight: 'bold', color: '#4A3420', letterSpacing: 0.3 },
  utamaBadge: { backgroundColor: '#E28743', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  utamaBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  receiverText: { fontSize: 13, fontWeight: 'bold', color: '#4A3420', marginBottom: 4 },
  detailText: { fontSize: 12, color: '#7A6450', lineHeight: 18, marginBottom: 12 },
  btnSetUtama: { borderTopWidth: 1, borderTopColor: '#FAF6F0', paddingTop: 12, alignItems: 'center' },
  btnSetUtamaText: { color: '#E28743', fontSize: 12, fontWeight: 'bold' },

  bottomActionContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E0D0C0', elevation: 8 },
  btnAddAddress: { backgroundColor: '#4A3420', height: 48, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, elevation: 2 },
  btnAddAddressText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#7A6450', marginTop: 14 },
  emptySub: { fontSize: 12, color: '#A1887F', textAlign: 'center', marginTop: 6, lineHeight: 18, fontStyle: 'italic' },
  errorWrapper: { backgroundColor: '#FDEDEC', padding: 10, margin: 16, borderRadius: 10 },
  errorText: { color: '#E74C3C', fontSize: 12, fontWeight: '600', textAlign: 'center' }
});