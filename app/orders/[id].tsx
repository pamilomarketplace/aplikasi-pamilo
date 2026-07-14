// app/orders/[id].tsx
import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions, Alert, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrderDetail } from '@/features/orders/useOrderDetail';
import { supabase } from '@/utils/supabaseClient';

const { width } = Dimensions.get('window');

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mapRef = useRef<MapView | null>(null);
  
  const insets = useSafeAreaInsets();
  
  // 🚀 Menerima jarakPengiriman (Km) dari otak
  const { loading, orderData, tokoData, items, currentUserId, jarakPengiriman } = useOrderDetail(id);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (mapRef.current && tokoData && orderData) {
      mapRef.current.animateToRegion({
        latitude: Number(tokoData.latitude_toko), longitude: Number(tokoData.longitude_toko),
        latitudeDelta: 0.02, longitudeDelta: 0.02,
      }, 1000);
    }
  }, [tokoData, orderData]);

  const formatRupiah = (angka: number | null | undefined) => `Rp ${Number(angka || 0).toLocaleString('id-ID')}`;

  const handleSmartBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)'); 
  };

  // 🚀 FUNGSI BARU: Buka Aplikasi Google Maps
  const bukaNavigasiMaps = (lat: number | string, lng: number | string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url).catch(() => Alert.alert('Gagal', 'Tidak dapat membuka Google Maps di perangkat ini.'));
  };

  const handleDriverUpdateStatus = async (nextStatus: string, confirmationMessage: string) => {
    Alert.alert('Konfirmasi Rute', confirmationMessage, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Ya, Lanjut', onPress: async () => {
          setIsProcessing(true);
          try {
            const { error } = await supabase.from('pesanan').update({ status_pesanan: nextStatus }).eq('id', id);
            if (error) throw error;
          } catch (err: any) {
            Alert.alert('Gagal', err.message);
          } finally {
            setIsProcessing(false);
          }
        }
      }
    ]);
  };

  const handleSelesaikanPesanan = async () => {
    Alert.alert('Konfirmasi Pesanan', 'Apakah Anda yakin barang sudah diterima dengan baik? Dana akan diteruskan ke Toko dan Kurir.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Ya, Selesai', onPress: async () => {
          setIsProcessing(true);
          try {
            const { data, error } = await supabase.rpc('selesaikan_pesanan_logistik', { p_order_id: id });
            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);
            Alert.alert('Sukses ✨', 'Pesanan selesai! Terima kasih telah berbelanja di PAMILO.');
            handleSmartBack();
          } catch (err: any) {
            Alert.alert('Gagal', err.message);
          } finally {
            setIsProcessing(false);
          }
        }
      }
    ]);
  };

  const handleBatalkanPesanan = async () => {
    Alert.alert('Batalkan Pesanan?', 'Apakah Anda yakin ingin membatalkan pesanan ini?', [
      { text: 'Tidak', style: 'cancel' },
      { text: 'Ya, Batalkan', style: 'destructive', onPress: async () => {
          setIsProcessing(true);
          try {
            const { data, error } = await supabase.rpc('batalkan_pesanan_logistik', {
              p_order_id: id, p_user_id: currentUserId, p_alasan: 'Dibatalkan oleh pembeli dari aplikasi'
            });
            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);
            Alert.alert('Dibatalkan ❌', data.message);
            handleSmartBack();
          } catch (err: any) {
            Alert.alert('Gagal Membatalkan', err.message);
          } finally {
            setIsProcessing(false);
          }
        }
      }
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#4A3420" /></View>;
  if (!orderData) return <View style={styles.center}><Text>Pesanan tidak ditemukan.</Text></View>;

  const isDriverView = currentUserId === orderData.driver_id;
  const isBuyerView = currentUserId === orderData.pembeli_id;

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        {tokoData && orderData.latitude_pengiriman ? (
          <MapView ref={mapRef} provider={PROVIDER_DEFAULT} style={styles.map}>
             <UrlTile urlTemplate="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" maximumZ={19} />
             <Marker coordinate={{ latitude: Number(tokoData.latitude_toko), longitude: Number(tokoData.longitude_toko) }} title={tokoData.nama_toko} pinColor="#2ECC71" />
             <Marker coordinate={{ latitude: Number(orderData.latitude_pengiriman), longitude: Number(orderData.longitude_pengiriman) }} title="Lokasi Pengantaran" pinColor="#E74C3C" />
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}><Text style={{color: '#A1887F'}}>Memuat Peta...</Text></View>
        )}
        <TouchableOpacity style={styles.backBtnAbsolute} onPress={handleSmartBack}>
          <Ionicons name="arrow-back" size={24} color="#4A3420" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.detailSheet} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 40, 80) }}
      >
        <View style={[styles.statusBox, orderData.status_pesanan === 'BATAL' && { backgroundColor: '#E74C3C' }]}>
          <Text style={styles.statusLabel}>Status Saat Ini:</Text>
          <Text style={styles.statusValue}>{orderData.status_pesanan.replace(/_/g, ' ')}</Text>
        </View>

        {isDriverView && orderData.pembeli && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>👤 Kontak Pembeli (Warga)</Text>
            <View style={styles.itemRow}><Text style={styles.feeLabel}>Nama</Text><Text style={styles.feeValue}>{orderData.pembeli.user_name}</Text></View>
            <View style={styles.itemRow}><Text style={styles.feeLabel}>Nomor Telepon</Text><Text style={styles.feeValue}>{orderData.pembeli.user_phone}</Text></View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>📦 Rincian Belanjaan</Text>
          {items.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.produk?.nama_produk} <Text style={{color:'#E28743'}}>x{item.kuantitas}</Text></Text>
              <Text style={styles.itemPrice}>{formatRupiah(item.harga_satuan * item.kuantitas)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          
          {/* 🚀 MENAMPILKAN JARAK (KM) BERSAMAAN DENGAN ONGKIR */}
          <View style={styles.itemRow}>
            <Text style={styles.feeLabel}>Ongkos Kirim <Text style={styles.jarakText}>(Jarak: {jarakPengiriman} Km)</Text></Text>
            <Text style={styles.feeValue}>{formatRupiah(orderData.ongkos_kirim)}</Text>
          </View>
          
          <View style={styles.itemRow}><Text style={styles.feeLabel}>Biaya Layanan</Text><Text style={styles.feeValue}>{formatRupiah(orderData.biaya_layanan)}</Text></View>
          <View style={styles.divider} />
          <View style={styles.itemRow}>
            <Text style={styles.totalLabel}>Total Pembayaran</Text>
            <Text style={styles.totalValue}>{formatRupiah(orderData.total_pembayaran)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>📍 Tujuan Pengantaran</Text>
          <Text style={styles.addressText}>{orderData.alamat_pengiriman}</Text>
          
          {/* 🚀 TOMBOL NAVIGASI GOOGLE MAPS UNTUK DRIVER */}
          {isDriverView && (
            <View style={styles.navigasiGroupRow}>
              {orderData.status_pesanan === 'MENUJU_TOKO' && tokoData && (
                <TouchableOpacity style={styles.btnRouteMap} onPress={() => bukaNavigasiMaps(tokoData.latitude_toko, tokoData.longitude_toko)}>
                  <Ionicons name="map-outline" size={18} color="#E28743" />
                  <Text style={styles.btnRouteMapText}>Lihat Rute Ke Toko</Text>
                </TouchableOpacity>
              )}
              
              {(orderData.status_pesanan === 'MENUJU_LOKASI' || orderData.status_pesanan === 'TIBA_DI_TUJUAN') && (
                <TouchableOpacity style={styles.btnRouteMap} onPress={() => bukaNavigasiMaps(orderData.latitude_pengiriman, orderData.longitude_pengiriman)}>
                  <Ionicons name="navigate-outline" size={18} color="#2ECC71" />
                  <Text style={[styles.btnRouteMapText, { color: '#2ECC71' }]}>Lihat Rute Ke Pembeli</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {isDriverView && (
          <>
            {orderData.status_pesanan === 'MENUJU_TOKO' && (
              <TouchableOpacity style={styles.btnDriverAction} disabled={isProcessing} onPress={() => handleDriverUpdateStatus('MENUJU_LOKASI', 'Apakah Anda sudah mengambil barang di Toko?')}>
                {isProcessing ? <ActivityIndicator color="#FFF" /> : <><Ionicons name="cube" size={20} color="#FFF" /><Text style={styles.btnDriverText}>Barang Sudah Diambil</Text></>}
              </TouchableOpacity>
            )}
            
            {orderData.status_pesanan === 'MENUJU_LOKASI' && (
              <TouchableOpacity style={styles.btnDriverAction} disabled={isProcessing} onPress={() => handleDriverUpdateStatus('TIBA_DI_TUJUAN', 'Apakah Anda sudah sampai di alamat tujuan dan menyerahkan barang?')}>
                {isProcessing ? <ActivityIndicator color="#FFF" /> : <><Ionicons name="location" size={20} color="#FFF" /><Text style={styles.btnDriverText}>Pesanan Diantar / Sampai</Text></>}
              </TouchableOpacity>
            )}

            {orderData.status_pesanan === 'TIBA_DI_TUJUAN' && (
              <View style={styles.waitingBadge}><Text style={styles.waitingBadgeText}>Menunggu Pembeli konfirmasi pesanan di HP mereka...</Text></View>
            )}
          </>
        )}

        {isBuyerView && (
          <>
            {orderData.status_pesanan === 'DIPROSES' && (
              <TouchableOpacity style={styles.btnBatal} disabled={isProcessing} onPress={handleBatalkanPesanan}>
                {isProcessing ? <ActivityIndicator color="#E74C3C" /> : <><Ionicons name="close-circle" size={20} color="#E74C3C" /><Text style={styles.btnBatalText}>Batalkan Pesanan</Text></>}
              </TouchableOpacity>
            )}

            {orderData.status_pesanan === 'TIBA_DI_TUJUAN' && (
              <TouchableOpacity style={styles.btnSelesai} disabled={isProcessing} onPress={handleSelesaikanPesanan}>
                {isProcessing ? <ActivityIndicator color="#FFF" /> : <><Ionicons name="checkmark-done-circle" size={20} color="#FFF" /><Text style={styles.btnSelesaiText}>Barang Diterima & Selesai</Text></>}
              </TouchableOpacity>
            )}
            
            {(orderData.status_pesanan === 'MENUJU_TOKO' || orderData.status_pesanan === 'MENUJU_LOKASI') && (
              <View style={styles.waitingBadge}><Text style={styles.waitingBadgeText}>Kurir sedang dalam perjalanan menuju lokasi Anda 🛵</Text></View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF6F0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF6F0' },
  mapContainer: { height: '40%', width: '100%', position: 'relative' },
  map: { ...StyleSheet.absoluteFillObject },
  mapPlaceholder: { flex: 1, backgroundColor: '#E0D0C0', justifyContent: 'center', alignItems: 'center' },
  backBtnAbsolute: { position: 'absolute', top: 40, left: 20, backgroundColor: '#FFF', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  
  detailSheet: { flex: 1, backgroundColor: '#FAF6F0', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, paddingHorizontal: 20, paddingTop: 20, elevation: 5 },
  
  statusBox: { backgroundColor: '#4A3420', padding: 16, borderRadius: 12, marginBottom: 16, alignItems: 'center' },
  statusLabel: { color: '#C0A995', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  statusValue: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  
  card: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E0D0C0', elevation: 1 },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#4A3420', marginBottom: 12 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  itemName: { fontSize: 13, color: '#4A3420', flex: 1 },
  itemPrice: { fontSize: 13, fontWeight: 'bold', color: '#4A3420' },
  feeLabel: { fontSize: 12, color: '#7A6450' },
  jarakText: { fontSize: 11, color: '#E28743', fontStyle: 'italic' },
  feeValue: { fontSize: 12, color: '#7A6450', fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#E0D0C0', marginVertical: 10 },
  totalLabel: { fontSize: 14, fontWeight: 'bold', color: '#4A3420' },
  totalValue: { fontSize: 16, fontWeight: 'bold', color: '#E28743' },
  addressText: { fontSize: 13, color: '#7A6450', lineHeight: 20 },
  
  navigasiGroupRow: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#E0D0C0', paddingTop: 12 },
  btnRouteMap: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FAF6F0', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#EADBC8', justifyContent: 'center' },
  btnRouteMapText: { fontSize: 13, fontWeight: 'bold', color: '#E28743' },
  
  btnDriverAction: { backgroundColor: '#3498DB', height: 50, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 2, marginTop: 8 },
  btnDriverText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  
  btnSelesai: { backgroundColor: '#2ECC71', height: 50, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 2, marginTop: 8 },
  btnSelesaiText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },

  btnBatal: { backgroundColor: '#FDEDEC', borderWidth: 1, borderColor: '#E74C3C', height: 50, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 4 },
  btnBatalText: { color: '#E74C3C', fontSize: 14, fontWeight: 'bold' },
  
  btnDisabled: { backgroundColor: '#95A5A6', elevation: 0 },
  waitingBadge: { backgroundColor: '#E0D0C0', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  waitingBadgeText: { color: '#4A3420', fontSize: 12, fontWeight: '600', textAlign: 'center' }
});