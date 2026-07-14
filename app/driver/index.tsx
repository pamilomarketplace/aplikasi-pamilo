// app/driver/index.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Alert, StatusBar, RefreshControl, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGlobalDriver } from '@/context/DriverContext';
import { ActiveOrderFloatingBanner } from '@/components/ActiveOrderFloatingBanner'; 

export default function DriverDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const { 
    isDriver, isOnline, todayTrips, todayEarnings, availableOrders, currentActiveOrder, 
    loading, error, toggleOnlineStatus, acceptOrder, updateOrderProgress, hitungPendapatanBersihMigo, refreshPool 
  } = useGlobalDriver();

  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const handleHardwareBack = () => {
      router.replace('/(tabs)'); 
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
    return () => subscription.remove();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshPool();
    setRefreshing(false);
  };

  // ✅ FIX: Menerima dan melempar dbTable ke Context
  const handleTerimaOrder = async (orderId: string, dbTable: 'migo_orders' | 'pesanan') => {
    setProcessingId(orderId);
    const result = await acceptOrder(orderId, dbTable);
    setProcessingId(null);
    if (result.success) {
      router.replace({ pathname: '/orders/[id]', params: { id: orderId } } as any); 
    } else { 
      Alert.alert('Gagal ❌', result.message); 
    }
  };

  // ✅ FIX: Menerima status dinamis dan dbTable
  const handleUpdateStatus = async (orderId: string, nextStatus: 'MENUJU_LOKASI' | 'DIANTAR' | 'SELESAI', dbTable: 'migo_orders' | 'pesanan') => {
    setProcessingId(orderId);
    const result = await updateOrderProgress(orderId, nextStatus, dbTable);
    setProcessingId(null);
    if (result.success && nextStatus === 'SELESAI') {
      Alert.alert('Tugas Selesai ✨', 'Barang/Penumpang berhasil diantar! Pendapatan bersih telah dicatat ke saldo Anda.');
    } else if (!result.success) {
      Alert.alert('Gagal', result.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#4A3420" />
        <ActivityIndicator size="large" color="#E28743" />
        <Text style={styles.loadingText}>Memuat Radar Migo...</Text>
      </View>
    );
  }

  if (isDriver === false) {
    return (
      <View style={styles.centerContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#4A3420" />
        <Ionicons name="id-card-outline" size={80} color="#C0A995" />
        <Text style={styles.notDriverTitle}>Anda Belum Terdaftar Sebagai Mitra</Text>
        <Text style={styles.notDriverSub}>Dapatkan penghasilan tambahan tanpa batas dengan bergabung menjadi armada Migo Motor atau Migo Mobil.</Text>
        <TouchableOpacity style={styles.btnDaftar} onPress={() => Alert.alert('Info 💡', 'Silakan hubungi Admin PAMILO untuk aktivasi akun Mitra Anda.')}>
          <Text style={styles.btnDaftarText}>Daftar Menjadi Mitra Migo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnKembali} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.btnKembaliText}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Logika Cerdas Tombol Berdasarkan Tipe Order
  const isLogistik = currentActiveOrder?.tipe_order === 'PAMILO';
  
  // Penentuan Status Lanjutan
  let nextStatusToUpdate: 'MENUJU_LOKASI' | 'DIANTAR' | 'SELESAI' = 'SELESAI';
  if (currentActiveOrder) {
    if (isLogistik) {
       nextStatusToUpdate = currentActiveOrder.status_order === 'MENUJU_TOKO' ? 'MENUJU_LOKASI' : 'SELESAI';
    } else {
       nextStatusToUpdate = currentActiveOrder.status_order === 'MENUJU_LOKASI' ? 'DIANTAR' : 'SELESAI';
    }
  }

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#4A3420" />
      <View style={[styles.navBar, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)')}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.navBarTitle}>Dashboard Armada Migo</Text>
        <TouchableOpacity style={[styles.switchToggleBody, isOnline ? styles.switchOnBg : styles.switchOffBg]} onPress={toggleOnlineStatus} activeOpacity={0.8}>
          <Text style={styles.textSwitchLabel}>{isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
          <View style={[styles.switchCircleDot, isOnline ? styles.switchDotRight : styles.switchDotLeft]} />
        </TouchableOpacity>
      </View>

      <View style={styles.statsPanelContainerRow}>
        <View style={styles.statsCardSplitItem}>
          <Text style={styles.labelStatsMini}>TRIP HARI INI</Text>
          <Text style={styles.valueStatsNumber}>{todayTrips} Ritase</Text>
        </View>
        <View style={[styles.statsCardSplitItem, { borderLeftWidth: 1, borderLeftColor: '#E0D0C0' }]}>
          <Text style={styles.labelStatsMini}>AKUMULASI BERSIH</Text>
          <Text style={[styles.valueStatsNumber, { color: '#2ECC71' }]}>Rp {todayEarnings.toLocaleString('id-ID')}</Text>
        </View>
      </View>

      {error && <View style={styles.errorBanner}><Text style={styles.errorText}>⚠️ {error}</Text></View>}

      {currentActiveOrder ? (
        <View style={styles.activeJobContainer}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10}}>
            <Text style={[styles.sectionHeadlineTitle, {marginHorizontal: 0, marginTop: 0, marginBottom: 0}]}>TUGAS BERJALAN SAAT INI</Text>
            <TouchableOpacity style={styles.floatingMapLinkBtn} onPress={() => router.push({ pathname: '/orders/[id]', params: { id: currentActiveOrder.id } })}>
              <Text style={styles.floatingMapLinkText}>Buka Peta Pelacakan ➔</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.jobCard}>
            <View style={styles.jobHeader}>
              {/* ✅ FIX: Gunakan variabel status_order ter-standarisasi */}
              <Text style={styles.jobServiceType}>
                {isLogistik ? '📦 LOGISTIK PAMILO' : '🚗 MIGO RIDE'}
              </Text>
              <View style={styles.paymentBadge}><Text style={styles.paymentBadgeText}>{currentActiveOrder.metode_pembayaran.replace('_', ' ')}</Text></View>
            </View>
            
            <View style={styles.routeBox}>
              <Text style={styles.routeLabel}>📍 {isLogistik ? 'AMBIL BARANG DI TOKO:' : 'JEMPUT PENUMPANG:'}</Text>
              <Text style={styles.routeValue}>{currentActiveOrder.alamat_jemput}</Text> 
              <View style={styles.routeDivider} />
              <Text style={styles.routeLabel}>🏁 ANTAR KE TUJUAN:</Text>
              {/* ✅ FIX: Gunakan variabel alamat_antar ter-standarisasi */}
              <Text style={styles.routeValue}>{currentActiveOrder.alamat_antar}</Text>
            </View>
            
            <View style={styles.jobFooter}>
              <View>
                <Text style={styles.labelGrossInvoice}>TOTAL TAGIHAN WARGA</Text>
                <Text style={styles.jobPriceGross}>Rp {Number(currentActiveOrder.total_pembayaran).toLocaleString('id-ID')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                 <Text style={styles.labelGrossInvoice}>ONGKOS KIRIM DRIVER</Text>
                 {/* ✅ FIX: Gunakan ongkos_kirim murni */}
                 <Text style={[styles.jobPriceGross, {color: '#2ECC71'}]}>Rp {Number(currentActiveOrder.ongkos_kirim).toLocaleString('id-ID')}</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.actionBtn, nextStatusToUpdate === 'SELESAI' && { backgroundColor: '#E74C3C' }]} 
              // ✅ FIX: Lempar argumen db_table ke fungsi
              onPress={() => handleUpdateStatus(currentActiveOrder.id, nextStatusToUpdate, currentActiveOrder.db_table)}
              disabled={processingId === currentActiveOrder.id}
            >
              {processingId === currentActiveOrder.id ? (
                <ActivityIndicator color="#FFF" /> 
              ) : (
                <Text style={styles.actionBtnText}>
                  {nextStatusToUpdate === 'SELESAI' ? 'Selesaikan Perjalanan (Tiba)' : (isLogistik ? 'Barang Diambil (Antar)' : 'Penumpang Naik (Antar)')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent} data={availableOrders} keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#E28743']} />}
          ListHeaderComponent={<Text style={styles.sectionHeadlineTitle}>{isOnline ? 'ANTREAN RADAR TERSEDIA' : 'RADAR MATI (OFFLINE)'}</Text>}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name={isOnline ? "radio-outline" : "moon-outline"} size={60} color="#C0A995" />
              <Text style={styles.emptyTitle}>{isOnline ? 'Menunggu Panggilan...' : 'Anda Sedang Istirahat'}</Text>
              <Text style={styles.emptySub}>{isOnline ? 'Satelit sedang memantau pesanan yang masuk dari Warga maupun dari Toko UMKM.' : 'Nyalakan sakelar ONLINE di atas untuk mulai memantau antrean orderan.'}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.orderCard}>
              <View style={styles.jobHeader}>
                <Text style={styles.jobServiceType}>{item.tipe_order === 'PAMILO' ? '📦 LOGISTIK' : '🚕 RIDE'}</Text>
                <Text style={styles.jobDistanceText}>Ongkir: Rp {Number(item.ongkos_kirim).toLocaleString('id-ID')}</Text> 
              </View>
              
              <View style={{ marginVertical: 12, gap: 4 }}>
                <Text style={styles.routeText} numberOfLines={1}>🟢 Dari: {item.alamat_jemput}</Text>
                {/* ✅ FIX: Gunakan variabel alamat_antar ter-standarisasi */}
                <Text style={styles.routeText} numberOfLines={1}>🔴 Ke: {item.alamat_antar}</Text>
              </View>
              
              <View style={styles.orderFooter}>
                <View style={{ gap: 1 }}>
                  <Text style={styles.priceHighlight}>Rp {hitungPendapatanBersihMigo(item.ongkos_kirim).toLocaleString('id-ID')}</Text>
                  <Text style={styles.labelGrossUnderText}>Potensi Bersih</Text>
                </View>
                {/* ✅ FIX: Lempar argumen db_table ke fungsi */}
                <TouchableOpacity style={styles.btnTerima} onPress={() => handleTerimaOrder(item.id, item.db_table)} disabled={processingId === item.id}>
                  {processingId === item.id ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.btnTerimaText}>Ambil Order</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
      <ActiveOrderFloatingBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FAF6F0' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF6F0', padding: 30 },
  loadingText: { marginTop: 12, color: '#7A6450', fontWeight: 'bold', fontSize: 13 },
  notDriverTitle: { fontSize: 16, fontWeight: 'bold', color: '#4A3420', marginTop: 16, textAlign: 'center' },
  notDriverSub: { fontSize: 12, color: '#7A6450', textAlign: 'center', marginTop: 8, lineHeight: 18, marginBottom: 30 },
  btnDaftar: { backgroundColor: '#E28743', width: '100%', height: 46, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  btnDaftarText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  btnKembali: { backgroundColor: 'transparent', width: '100%', height: 46, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#C0A995' },
  btnKembaliText: { color: '#7A6450', fontWeight: 'bold', fontSize: 13 },
  navBar: { backgroundColor: '#4A3420', height: 95, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, elevation: 4 },
  backBtn: { width: 36, height: 40, justifyContent: 'center' },
  navBarTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  switchToggleBody: { width: 84, height: 28, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, position: 'relative' },
  switchOnBg: { backgroundColor: '#2ECC71' },
  switchOffBg: { backgroundColor: '#E74C3C' },
  textSwitchLabel: { color: '#FFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.5, marginLeft: 2 },
  switchCircleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF', position: 'absolute' },
  switchDotLeft: { left: 4 }, switchDotRight: { right: 4 },
  statsPanelContainerRow: { flexDirection: 'row', backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 16, borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: '#E0D0C0', elevation: 2 },
  statsCardSplitItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  labelStatsMini: { fontSize: 9, fontWeight: 'bold', color: '#A1887F', letterSpacing: 0.5 },
  valueStatsNumber: { fontSize: 14, fontWeight: 'bold', color: '#4A3420' },
  sectionHeadlineTitle: { fontSize: 10, fontWeight: 'bold', color: '#A1887F', letterSpacing: 1, marginHorizontal: 16, marginTop: 20, marginBottom: 10 },
  listContent: { paddingHorizontal: 16, paddingBottom: 150, flexGrow: 1 }, 
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 14, fontWeight: 'bold', color: '#7A6450', marginTop: 12 },
  emptySub: { fontSize: 11, color: '#A1887F', textAlign: 'center', marginTop: 6, lineHeight: 16 },
  errorBanner: { backgroundColor: '#FDEDEC', padding: 10, margin: 16, borderRadius: 8 },
  errorText: { color: '#E74C3C', fontSize: 12, textAlign: 'center', fontWeight: 'bold' },
  orderCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E0D0C0', elevation: 2 },
  jobServiceType: { fontSize: 11, fontWeight: 'bold', color: '#4A3420', backgroundColor: '#F0E6DD', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  jobDistanceText: { fontSize: 13, fontWeight: 'bold', color: '#2ECC71' },
  routeText: { fontSize: 13, color: '#4A3420', fontWeight: '500' },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: '#FAF6F0', paddingTop: 12 },
  priceHighlight: { fontSize: 18, fontWeight: 'bold', color: '#E28743' },
  labelGrossUnderText: { fontSize: 9, color: '#A1887F', fontWeight: '500', marginTop: 2 },
  btnTerima: { backgroundColor: '#4A3420', paddingHorizontal: 24, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  btnTerimaText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  activeJobContainer: { flex: 1, paddingHorizontal: 16, paddingBottom: 150 },
  jobCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 18, elevation: 4, borderWidth: 1, borderColor: '#E0D0C0' },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentBadge: { backgroundColor: '#FFF3E0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#FFB74D' },
  paymentBadgeText: { color: '#F57C00', fontSize: 10, fontWeight: 'bold' },
  routeBox: { backgroundColor: '#FAF6F0', borderRadius: 12, padding: 12, marginVertical: 14, borderWidth: 0.5, borderColor: '#E0D0C0' },
  routeLabel: { fontSize: 10, color: '#7A6450', fontWeight: 'bold', marginBottom: 2 },
  routeValue: { fontSize: 13, color: '#4A3420', fontWeight: '600', marginBottom: 2 },
  routeDivider: { height: 1, backgroundColor: '#E0D0C0', marginVertical: 8 },
  jobFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  labelGrossInvoice: { fontSize: 9, color: '#A1887F', fontWeight: 'bold' },
  jobPriceGross: { fontSize: 16, fontWeight: 'bold', color: '#4A3420' },
  actionBtn: { backgroundColor: '#2ECC71', height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  actionBtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  floatingMapLinkBtn: { backgroundColor: '#4A3420', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  floatingMapLinkText: { color: '#FFF', fontSize: 9, fontWeight: 'bold' }
});