// app/checkout/index.tsx
import React, { useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Image, TextInput, Modal, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { PROVIDER_DEFAULT } from 'react-native-maps';

import { useCheckout, CheckoutItem } from '@/features/orders/useCheckout';

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // 🚀 RADAR PENGENDALI PETA
  const mapRef = useRef<MapView | null>(null);
  
  const params = useLocalSearchParams();
  const mode = params.mode as string | null;
  const produk_id = params.id_produk as string | null;
  const qty = params.kuantitas ? Number(params.kuantitas) : 1;

  const {
    loading, submitting, userSaldo, checkoutItems, subtotalHarga, 
    jarakKm, ongkosKirim, biayaLayanan, totalPembayaran, 
    alamatInput, setAlamatInput, patokanInput, setPatokanInput,
    metodePembayaran, setMetodePembayaran,
    isMapVisible, setIsMapVisible, bukaPeta, tempLat, tempLng, setTempLat, setTempLng,
    konfirmasiLokasiPeta, isTranslatingGps, latitude,
    searchQuery, setSearchQuery, searchResults, setSearchResults, isSearching, cariAlamatPeta, pilihHasilPencarian,
    executeOrderCheckout
  } = useCheckout(mode, produk_id, qty);

  const formatRupiah = (angka: number) => `Rp ${Number(angka).toLocaleString('id-ID')}`;

  const renderItemBelanjaan = ({ item }: { item: CheckoutItem }) => (
    <View style={styles.productCardRow}>
      <View style={styles.imagePlaceholderBox}>
        {item.foto_produk ? <Image source={{ uri: item.foto_produk }} style={styles.actualImg} resizeMode="cover" /> : <Ionicons name="basket" size={24} color="#A1887F" />}
      </View>
      <View style={styles.productInfoCol}>
        <Text style={styles.productNameText} numberOfLines={2}>{item.nama_produk}</Text>
        <Text style={styles.qtyPriceText}>{item.kuantitas} x {formatRupiah(item.harga)}</Text>
      </View>
      <Text style={styles.subtotalItemText}>{formatRupiah(item.harga * item.kuantitas)}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerLoad}>
        <ActivityIndicator size="large" color="#4A3420" />
        <Text style={styles.loadText}>Menarik data dari server PAMILO...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.mainContainer, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor="#4A3420" />

      <View style={[styles.customNavBar, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.navBarTitle}>Konfirmasi Pembayaran</Text>
        <View style={{ width: 35 }} />
      </View>

      <FlatList
        data={checkoutItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItemBelanjaan}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={styles.sectionWrapperBlock}>
              <View style={styles.sectionHeaderTitleRow}>
                <Ionicons name="location-sharp" size={18} color="#E28743" />
                <Text style={styles.sectionHeadingText}>Lokasi Tujuan Pengantaran</Text>
              </View>
              
              <TouchableOpacity style={styles.mapTriggerBtn} onPress={bukaPeta}>
                <Ionicons name="map-outline" size={20} color="#7A6450" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.mapTriggerLabel}>{latitude !== null ? "Koordinat GPS Terkunci" : "Ketuk untuk Atur Titik di Peta"}</Text>
                  <Text style={[styles.mapTriggerValue, latitude === null && { color: '#E74C3C', fontStyle: 'italic' }]} numberOfLines={2}>
                    {alamatInput || '⚠️ Alamat belum diatur, ketuk di sini.'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#A1887F" />
              </TouchableOpacity>

              {latitude !== null && (
                <>
                  <TextInput style={[styles.textInputSingle, { marginTop: 10 }]} placeholder="Detail Alamat (Cth: Blok B No. 12)" placeholderTextColor="#A1887F" value={alamatInput} onChangeText={setAlamatInput} />
                  <TextInput style={[styles.textInputSingle, { marginTop: 10 }]} placeholder="Patokan lokasi (Cth: Pagar Hitam)" placeholderTextColor="#A1887F" value={patokanInput} onChangeText={setPatokanInput} />
                </>
              )}
            </View>

            <View style={[styles.sectionWrapperBlock, { marginTop: 14 }]}>
              <View style={styles.sectionHeaderTitleRow}>
                <Ionicons name="card" size={18} color="#E28743" />
                <Text style={styles.sectionHeadingText}>Metode Pembayaran</Text>
              </View>
              <View style={styles.paymentMethodContainer}>
                <TouchableOpacity style={[styles.paymentOptionBtn, metodePembayaran === 'TUNAI' && styles.paymentOptionActive]} onPress={() => setMetodePembayaran('TUNAI')}>
                  <Ionicons name="cash-outline" size={24} color={metodePembayaran === 'TUNAI' ? '#4A3420' : '#A1887F'} />
                  <Text style={[styles.paymentOptionText, metodePembayaran === 'TUNAI' && styles.paymentOptionTextActive]}>Tunai / COD</Text>
                  {metodePembayaran === 'TUNAI' && <View style={styles.activeDot} />}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.paymentOptionBtn, metodePembayaran === 'SALDO' && styles.paymentOptionActive]} onPress={() => setMetodePembayaran('SALDO')}>
                  <Ionicons name="wallet-outline" size={24} color={metodePembayaran === 'SALDO' ? '#4A3420' : '#A1887F'} />
                  <View style={styles.saldoTextWrapper}>
                    <Text style={[styles.paymentOptionText, metodePembayaran === 'SALDO' && styles.paymentOptionTextActive]}>Saldo Dompet</Text>
                    <Text style={styles.saldoAvailableText}>Sisa: {formatRupiah(userSaldo)}</Text>
                  </View>
                  {metodePembayaran === 'SALDO' && <View style={styles.activeDot} />}
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.sectionTitleMiddle}>Daftar Komoditas Belanjaan</Text>
          </>
        }
        ListFooterComponent={
          <View style={[styles.sectionWrapperBlock, { marginTop: 16 }]}>
            <Text style={styles.notaHeadingText}>Rincian Nota Finansial</Text>
            <View style={styles.notaRowLine}><Text style={styles.notaLabelText}>Subtotal Belanja</Text><Text style={styles.notaValueText}>{formatRupiah(subtotalHarga)}</Text></View>
            <View style={styles.notaRowLine}><Text style={styles.notaLabelText}>Ongkos Kirim ({jarakKm} Km)</Text><Text style={styles.notaValueText}>{formatRupiah(ongkosKirim)}</Text></View>
            <View style={styles.notaRowLine}><Text style={styles.notaLabelText}>Biaya Layanan</Text><Text style={styles.notaValueText}>{formatRupiah(biayaLayanan)}</Text></View>
            <View style={styles.dividerLine} />
            <View style={styles.notaRowLine}><Text style={styles.totalLabelText}>Total Bayar</Text><Text style={styles.totalValueText}>{formatRupiah(totalPembayaran)}</Text></View>
          </View>
        }
      />

      <View style={styles.stickyFooterBar}>
        <View style={styles.footerPriceCol}>
          <Text style={styles.footerLabelTotal}>Total Bayar</Text>
          <Text style={styles.footerValueTotal}>{formatRupiah(totalPembayaran)}</Text>
        </View>
        <TouchableOpacity style={[styles.btnExecutePayment, submitting && styles.btnExecuteDisabled]} onPress={executeOrderCheckout} disabled={submitting}>
          {submitting ? <ActivityIndicator size="small" color="#FFF" /> : <><Text style={styles.textBtnPayment}>Bayar Sekarang</Text><Ionicons name="checkmark-circle" size={18} color="#FFF" /></>}
        </TouchableOpacity>
      </View>

      <Modal visible={isMapVisible} animationType="slide" transparent={false}>
        <View style={styles.mapContainer}>
          <MapView 
            ref={mapRef} // 🚀 PENGENDALI PETA DIPASANG DI SINI
            style={styles.mapView}
            provider={PROVIDER_DEFAULT}
            initialRegion={{ latitude: tempLat, longitude: tempLng, latitudeDelta: 0.005, longitudeDelta: 0.005 }} // Gunakan initialRegion agar tidak konflik dengan animasi
            onRegionChangeComplete={(region) => {
              setTempLat(region.latitude);
              setTempLng(region.longitude);
            }}
          />
          <View style={styles.centerPinMarker}>
            <Ionicons name="location" size={46} color="#E74C3C" />
          </View>

          <View style={[styles.mapHeaderSearchContainer, { paddingTop: insets.top + 10 }]}>
            <View style={styles.mapHeaderTopRow}>
              <TouchableOpacity style={styles.mapCloseBtn} onPress={() => setIsMapVisible(false)}>
                <Ionicons name="arrow-back" size={24} color="#4A3420" />
              </TouchableOpacity>
              <View style={styles.searchInputWrapper}>
                <TextInput
                  style={styles.mapSearchInput}
                  placeholder="Ketik alamat, lalu klik Cari/Enter 🔍"
                  placeholderTextColor="#A1887F"
                  value={searchQuery}
                  onChangeText={setSearchQuery} // 🚀 Hanya menyimpan teks ke state
                  onSubmitEditing={() => cariAlamatPeta(searchQuery)} // 🚀 Menembak API hanya saat tombol Enter di keyboard ditekan
                  returnKeyType="search" // Mengubah tombol enter keyboard menjadi ikon kaca pembesar/Cari
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity style={styles.clearSearchBtn} onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                    <Ionicons name="close-circle" size={18} color="#A1887F" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {isSearching && <ActivityIndicator style={{ marginTop: 12 }} color="#E28743" />}
            {searchResults.length > 0 && (
              <View style={styles.searchResultContainer}>
                {searchResults.map((res, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.searchResultItem} 
                    onPress={() => {
                      pilihHasilPencarian(res.lat, res.lon);
                      // 🚀 TERBANGKAN PETA KE TITIK HASIL PENCARIAN
                      mapRef.current?.animateToRegion({
                        latitude: Number(res.lat),
                        longitude: Number(res.lon),
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005
                      }, 1000); // Durasi terbang 1 detik
                    }}
                  >
                    <Ionicons name="location-outline" size={18} color="#7A6450" />
                    <Text style={styles.searchResultText} numberOfLines={2}>{res.display_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={[styles.mapFooter, { paddingBottom: insets.bottom + 20 }]}>
            <TouchableOpacity style={styles.btnConfirmMap} onPress={konfirmasiLokasiPeta} disabled={isTranslatingGps}>
              {isTranslatingGps ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnConfirmMapText}>Pilih Koordinat Ini</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FAF6F0' },
  customNavBar: { backgroundColor: '#4A3420', height: 95, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, elevation: 4 },
  backBtn: { width: 35, height: 40, justifyContent: 'center' },
  navBarTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  centerLoad: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadText: { fontSize: 12, color: '#7A6450', fontWeight: 'bold' },
  scrollContainer: { padding: 16 },
  
  sectionWrapperBlock: { backgroundColor: '#FFF', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E0D0C0', elevation: 1 },
  sectionHeaderTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  sectionHeadingText: { fontSize: 14, fontWeight: 'bold', color: '#4A3420' },
  
  mapTriggerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAF6F0', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E0D0C0' },
  mapTriggerLabel: { fontSize: 11, color: '#7A6450', fontWeight: 'bold', marginBottom: 2 },
  mapTriggerValue: { fontSize: 13, color: '#4A3420', fontWeight: '500', lineHeight: 18 },
  textInputSingle: { backgroundColor: '#FAF6F0', borderRadius: 8, borderWidth: 1, borderColor: '#E0D0C0', paddingHorizontal: 12, height: 45, fontSize: 13, color: '#4A3420' },
  
  mapContainer: { flex: 1, backgroundColor: '#FAF6F0' },
  mapView: { ...StyleSheet.absoluteFillObject },
  centerPinMarker: { position: 'absolute', top: '50%', left: '50%', marginTop: -40, marginLeft: -23, zIndex: 10, alignItems: 'center' },
  
  mapHeaderSearchContainer: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 16, backgroundColor: 'rgba(255,255,255,0.95)', elevation: 5, zIndex: 20 },
  mapHeaderTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mapCloseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FAF3F0', justifyContent: 'center', alignItems: 'center' },
  searchInputWrapper: { flex: 1, position: 'relative' },
  mapSearchInput: { height: 42, backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1, borderColor: '#E0D0C0', paddingLeft: 12, paddingRight: 36, fontSize: 13, color: '#4A3420', elevation: 1 },
  clearSearchBtn: { position: 'absolute', right: 10, top: 12 },
  
  searchResultContainer: { backgroundColor: '#FFF', borderRadius: 10, marginTop: 10, elevation: 3, borderWidth: 1, borderColor: '#E0D0C0', maxHeight: 200, overflow: 'hidden' },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 0.5, borderBottomColor: '#E0D0C0', gap: 10 },
  searchResultText: { flex: 1, fontSize: 12, color: '#4A3420' },

  mapFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, elevation: 15 },
  btnConfirmMap: { backgroundColor: '#E28743', height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  btnConfirmMapText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },

  paymentMethodContainer: { flexDirection: 'column', gap: 10 },
  paymentOptionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAF6F0', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E0D0C0', position: 'relative' },
  paymentOptionActive: { backgroundColor: '#FFF8E1', borderColor: '#E28743' },
  paymentOptionText: { fontSize: 14, fontWeight: '600', color: '#7A6450', marginLeft: 12, flex: 1 },
  paymentOptionTextActive: { color: '#4A3420', fontWeight: 'bold' },
  saldoTextWrapper: { marginLeft: 12, flex: 1 },
  saldoAvailableText: { fontSize: 11, color: '#27AE60', fontWeight: 'bold', marginTop: 2 },
  activeDot: { position: 'absolute', right: 14, width: 12, height: 12, borderRadius: 6, backgroundColor: '#E28743' },

  sectionTitleMiddle: { fontSize: 14, fontWeight: 'bold', color: '#7A6450', marginTop: 20, marginBottom: 10 },
  productCardRow: { flexDirection: 'row', backgroundColor: '#FFF', padding: 10, borderRadius: 10, alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: '#E0D0C0' },
  imagePlaceholderBox: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#FAF6F0', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E0D0C0', overflow: 'hidden' },
  actualImg: { width: '100%', height: '100%' },
  productInfoCol: { flex: 1, marginLeft: 12, gap: 2 },
  productNameText: { fontSize: 13, fontWeight: 'bold', color: '#4A3420', lineHeight: 18 },
  qtyPriceText: { fontSize: 12, color: '#A1887F' },
  subtotalItemText: { fontSize: 13, fontWeight: 'bold', color: '#4A3420' },
  
  notaHeadingText: { fontSize: 14, fontWeight: 'bold', color: '#4A3420', marginBottom: 14 },
  notaRowLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  notaLabelText: { fontSize: 13, color: '#7A6450' },
  notaValueText: { fontSize: 13, color: '#4A3420', fontWeight: 'bold' },
  dividerLine: { height: 1, backgroundColor: '#E0D0C0', marginVertical: 10 },
  totalLabelText: { fontSize: 15, fontWeight: 'bold', color: '#4A3420' },
  totalValueText: { fontSize: 18, fontWeight: 'bold', color: '#E28743' },
  
  stickyFooterBar: { flexDirection: 'row', backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#E0D0C0', alignItems: 'center', gap: 16, elevation: 10 },
  footerPriceCol: { flex: 1 },
  footerLabelTotal: { fontSize: 12, color: '#A1887F', fontWeight: 'bold' },
  footerValueTotal: { fontSize: 18, fontWeight: 'bold', color: '#E28743' },
  btnExecutePayment: { backgroundColor: '#E28743', flexDirection: 'row', paddingHorizontal: 20, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', gap: 8, elevation: 2 },
  btnExecuteDisabled: { backgroundColor: '#C0A995', elevation: 0 },
  textBtnPayment: { color: '#FFF', fontSize: 14, fontWeight: 'bold' }
});