// app/migo/tracking.tsx
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Image, Modal, Alert, Linking } from 'react-native'; 
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps';
import { supabase } from '@/utils/supabaseClient';
import { useMigoTracking } from '@/features/migo/useMigoTracking'; 

const { width, height } = Dimensions.get('window');

export default function MigoTrackingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setCurrentUserId(data.user.id);
    });
  }, []);

  const {
    loadingTracking,
    btnLoading, 
    order,
    amIDriver,
    driverLiveLocation,
    handleCancelOrder,
    handleProgressDriver,
    alertState,
    alertLoading,
    handleAlertConfirm,
    closeAlert,
    hitungPendapatanBersihMigo,
    hasUnreadChat, setHasUnreadChat 
  } = useMigoTracking(orderId as string, currentUserId);

  useEffect(() => {
    if (!mapRef.current) return;
    if (driverLiveLocation) {
      mapRef.current.animateToRegion({
        latitude: driverLiveLocation.lat,
        longitude: driverLiveLocation.lng,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      }, 1000);
    } else if (order) {
      mapRef.current.animateToRegion({
        latitude: Number(order.latitude_jemput),
        longitude: Number(order.longitude_jemput),
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      }, 600);
    }
  }, [order, driverLiveLocation]);

  if (loadingTracking) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4A3420" />
        <Text style={styles.loadingText}>Menghubungkan ke satelit Migo...</Text>
      </View>
    );
  }

  if (!order) return null;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={{
          latitude: Number(order.latitude_jemput),
          longitude: Number(order.longitude_jemput),
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }}
      >
        <UrlTile urlTemplate="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" maximumZ={19} />
        <Marker coordinate={{ latitude: Number(order.latitude_jemput), longitude: Number(order.longitude_jemput) }} title="Lokasi Jemput" pinColor="#4CAF50" />
        {order.status_order === 'DIANTAR' && (
          <Marker coordinate={{ latitude: Number(order.latitude_tujuan), longitude: Number(order.longitude_tujuan) }} title="Tujuan Antar" pinColor="#E74C3C" />
        )}

        {driverLiveLocation && (
          <Marker 
            coordinate={{ latitude: driverLiveLocation.lat, longitude: driverLiveLocation.lng }} 
            title={amIDriver ? "Lokasi Anda" : "Lokasi Driver"} 
            rotation={driverLiveLocation.heading}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.liveVehicleMarker}>
              <Text style={{fontSize: 20}}>{order.tipe_layanan === 'MIGO_CAR' ? '🚗' : '🛵'}</Text>
            </View>
          </Marker>
        )}
      </MapView>

      <TouchableOpacity 
        style={[styles.floatingBackBtn, { top: insets.top + 12 }]}
        onPress={() => router.replace(amIDriver ? '/driver' : '/(tabs)')}
      >
        <Ionicons name={order.status_order === 'SELESAI' || order.status_order === 'BATAL' ? "arrow-back" : "apps"} size={18} color="#E28743" />
      </TouchableOpacity>

      <View style={[styles.statusSheet, { paddingBottom: insets.bottom + 16 }]}>
        
        {order.status_order === 'MENCARI_DRIVER' && (
          <View style={styles.sheetContentCenter}>
            <ActivityIndicator size="large" color="#E28743" style={{ marginVertical: 10 }} />
            <Text style={styles.statusMainTitle}>Mencari Driver Terdekat...</Text>
            <Text style={styles.statusSubtitle}>Satelit PAMILO sedang menyebarkan orderan Anda ke armada Migo di Ciamis.</Text>
            
            <View style={styles.miniInvoiceBox}>
              <Text style={styles.invoiceRouteText} numberOfLines={1}>📍 Dari: {order.alamat_jemput}</Text>
              <Text style={styles.invoiceRouteText} numberOfLines={1}>🏁 Ke: {order.alamat_antar}</Text>
              <View style={styles.dividerBox} />
              <Text style={styles.invoiceFareText}>Biaya Layanan: Rp {Number(order.biaya_layanan || 0).toLocaleString('id-ID')}</Text>
              <Text style={styles.invoiceFareText}>Total Tagihan: <Text style={{color: '#E28743', fontWeight: 'bold'}}>Rp {Number(order.total_pembayaran).toLocaleString('id-ID')}</Text></Text>
            </View>
            
            {!amIDriver && (
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancelOrder} disabled={btnLoading}>
                <Text style={styles.cancelButtonText}>Batalkan Pesanan</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {(order.status_order === 'MENUJU_LOKASI' || order.status_order === 'DIANTAR') && (
          <View>
            <View style={styles.driverHeaderRow}>
              <View style={styles.statusBadgeLive}>
                <Text style={styles.statusBadgeLiveText}>
                  {order.status_order === 'MENUJU_LOKASI' ? '🏍️ MITRA MENUJU LOKASI JEMPUT' : '🚀 PERJALANAN MENUJU TUJUAN'}
                </Text>
              </View>
              <Text style={styles.distanceEtaText}>{order.jarak_km} Km</Text>
            </View>

            <View style={styles.driverProfileCard}>
              <View style={styles.driverAvatarCircle}>
                {amIDriver ? (
                  order.penumpang_avatar ? (
                    <Image source={{ uri: order.penumpang_avatar }} style={styles.fullImageAvatar} />
                  ) : <Text style={styles.driverAvatarEmoji}>🧑‍💼</Text>
                ) : (
                  order.driver_avatar ? (
                    <Image source={{ uri: order.driver_avatar }} style={styles.fullImageAvatar} />
                  ) : <Text style={styles.driverAvatarEmoji}>👨‍✈️</Text>
                )}
              </View>
              
              <View style={styles.driverInfoDetails}>
                {amIDriver ? (
                  <>
                    <Text style={styles.driverNameText}>{order.nama_penumpang || 'Warga PAMILO'}</Text>
                    <Text style={styles.driverPlateText}>Penumpang Migo</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.driverNameText}>{order.driver_nama || 'Mitra Migo'}</Text>
                    <Text style={styles.driverPlateText}>{order.driver_plat || 'Z ---- XX'} • {order.driver_merek || 'Armada Migo'}</Text>
                  </>
                )}
              </View>
              
              <TouchableOpacity 
                style={styles.phoneCallBtn}
                onPress={() => {
                  setHasUnreadChat(false); 
                  const targetReceiverId = amIDriver ? order.pembeli_id : order.driver_id;
                  const targetNameTitle = amIDriver ? (order.nama_penumpang || 'Warga Pamilo') : (order.driver_nama || 'Mitra PAMILO');
                  if (targetReceiverId) {
                    router.push({
                      pathname: '/chat',
                      params: { orderId: order.id, receiverId: targetReceiverId, nameTitle: targetNameTitle }
                    });
                  } else {
                    Alert.alert('Gagal', 'Identitas partner belum terkunci.');
                  }
                }}
              >
                <Ionicons name="chatbubbles" size={20} color="#FFF" />
                {hasUnreadChat && <View style={styles.chatBadgeIndicator} />}
              </TouchableOpacity>
            </View>

            <View style={styles.routeStaticInfoBox}>
              <Text style={styles.staticRouteText} numberOfLines={1}>🟢 Dari: {order.alamat_jemput}</Text>
              <Text style={styles.staticRouteText} numberOfLines={1}>🏁 Ke: {order.alamat_antar}</Text>
              <View style={styles.dividerBox} />
              <Text style={styles.staticPaymentText}>Tarif Dasar Perjalanan: Rp {Number(order.total_pembayaran - (order.biaya_layanan || 0)).toLocaleString('id-ID')}</Text>
              <Text style={styles.staticPaymentText}>Biaya Transaksi Sistem: Rp {Number(order.biaya_layanan || 0).toLocaleString('id-ID')}</Text>
              <Text style={styles.staticPaymentText}>
                {amIDriver ? 'Estimasi Saldo Bersih Masuk' : 'Total Pembayaran Warga'}: <Text style={{fontWeight: 'bold', color: '#2ECC71'}}>
                  Rp {amIDriver ? hitungPendapatanBersihMigo(order.total_pembayaran).toLocaleString('id-ID') : Number(order.total_pembayaran).toLocaleString('id-ID')}
                </Text> ({order.metode_pembayaran})
              </Text>
            </View>

            <View style={{ marginTop: 16, gap: 10 }}>
              {amIDriver ? (
                <View style={{ gap: 10 }}>
                  <TouchableOpacity 
                    style={styles.navMapsBtn} 
                    onPress={() => {
                      const targetLat = order.status_order === 'MENUJU_LOKASI' ? order.latitude_jemput : order.latitude_tujuan;
                      const targetLng = order.status_order === 'MENUJU_LOKASI' ? order.longitude_jemput : order.longitude_tujuan;
                      const url = `https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}&travelmode=driving`;
                      Linking.openURL(url).catch(() => Alert.alert('Gagal', 'Tidak dapat membuka aplikasi Google Maps.'));
                    }}
                  >
                    <Ionicons name="navigate-circle" size={22} color="#FFF" />
                    <Text style={styles.navMapsBtnText}>
                      {order.status_order === 'MENUJU_LOKASI' ? 'Buka Peta ke Titik Jemput Penumpang' : 'Buka Peta ke Alamat Tujuan'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.primaryBtnDriver} onPress={handleProgressDriver} disabled={btnLoading}>
                    {btnLoading ? <ActivityIndicator color="#FFF" /> : (
                      <>
                        <Text style={styles.textBtnMain}>
                          {order.status_order === 'MENUJU_LOKASI' ? 'Saya Sudah Sampai di Lokasi Jemput' : 'Turunkan Penumpang (Selesai)'}
                        </Text>
                        <Ionicons name="arrow-forward-circle" size={18} color="#FFF" />
                      </>
                    )}
                  </TouchableOpacity>

                  {order.status_order === 'MENUJU_LOKASI' && (
                    <TouchableOpacity style={styles.cancelButton} onPress={handleCancelOrder} disabled={btnLoading}>
                      <Text style={styles.cancelButtonText}>Batalkan Perjalanan (Mitra)</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  <View style={styles.passengerStatusBanner}>
                    <Ionicons name="information-circle" size={16} color="#E65100" />
                    <Text style={styles.textStatusPassenger}>
                      {order.status_order === 'MENUJU_LOKASI' ? 'Driver Migo sedang meluncur menuju titik penjemputan Anda.' : 'Perjalanan sedang aktif. Selamat menikmati rute aman ekosistem PAMILO.'}
                    </Text>
                  </View>

                  <TouchableOpacity 
                    style={styles.lacakDriverBtn} 
                    onPress={() => {
                      if (driverLiveLocation) {
                        mapRef.current?.animateToRegion({
                          latitude: driverLiveLocation.lat,
                          longitude: driverLiveLocation.lng,
                          latitudeDelta: 0.005,
                          longitudeDelta: 0.005,
                        }, 1000);
                      } else {
                        Alert.alert('Radar GPS 📡', 'Sedang menunggu pancaran sinyal satelit GPS dari motor/mobil mitra terdekat...');
                      }
                    }}
                  >
                    <Ionicons name="locate-outline" size={18} color="#4A3420" />
                    <Text style={styles.lacakDriverBtnText}>Lacak Posisi Kendaraan Driver</Text>
                  </TouchableOpacity>

                  {order.status_order === 'MENUJU_LOKASI' && (
                    <TouchableOpacity style={styles.cancelButton} onPress={handleCancelOrder} disabled={btnLoading}>
                      <Text style={styles.cancelButtonText}>Batalkan Pesanan</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>
        )}
      </View>

      {/* POPUP ALERT */}
      <View style={styles.alertOverlay && !alertState.visible ? { display: 'none' } : null}>
        <Modal transparent visible={alertState.visible} animationType="fade" onRequestClose={closeAlert}>
          <View style={styles.alertOverlay}>
            <View style={styles.alertBox}>
              <Text style={styles.alertTitle}>{alertState.title}</Text>
              <Text style={styles.alertMessage}>{alertState.message}</Text>
              
              {/* 🚀 FIX: TEKS NOMINAL JUMBO DITAMPILKAN DI SINI */}
              {alertState.nominal && (
                <Text style={styles.alertNominalJumbo}>{alertState.nominal}</Text>
              )}

              <View style={styles.alertActionRow}>
                {alertState.isConfirm && (
                  <TouchableOpacity style={styles.alertCancelBtn} onPress={closeAlert} disabled={alertLoading}>
                    <Text style={styles.alertCancelBtnText}>Tidak</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.alertConfirmBtn} onPress={handleAlertConfirm} disabled={alertLoading}>
                  {alertLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.alertConfirmBtnText}>{alertState.isConfirm ? 'Ya, Yakin' : 'Oke'}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF6F0' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF6F0' },
  loadingText: { marginTop: 12, fontSize: 13, color: '#7A6450', fontWeight: '500' },
  map: { width: width, height: height },
  liveVehicleMarker: { width: 40, height: 40, backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#E28743', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },
  floatingBackBtn: { position: 'absolute', left: 16, backgroundColor: '#FFF', width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', elevation: 5, zIndex: 99 },
  statusSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 22, paddingHorizontal: 24, elevation: 15 },
  sheetContentCenter: { alignItems: 'center' },
  statusMainTitle: { fontSize: 16, fontWeight: 'bold', color: '#4A3420', marginTop: 8, textAlign: 'center' },
  statusSubtitle: { fontSize: 12, color: '#7A6450', textAlign: 'center', marginTop: 6, lineHeight: 16, paddingHorizontal: 10 },
  miniInvoiceBox: { width: '100%', backgroundColor: '#FAF3F0', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E0D0C0', marginVertical: 16, gap: 3 },
  invoiceRouteText: { fontSize: 12, color: '#4A3420', fontWeight: '500' },
  invoiceFareText: { fontSize: 11, color: '#7A6450', marginTop: 2, fontWeight: '600' },
  dividerBox: { height: 1, backgroundColor: '#E0D0C0', marginVertical: 6 },
  cancelButton: { width: '100%', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E74C3C', paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  cancelButtonText: { color: '#E74C3C', fontSize: 13, fontWeight: 'bold' },
  driverHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  statusBadgeLive: { backgroundColor: '#E28743', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  statusBadgeLiveText: { color: '#FFF', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.3 },
  distanceEtaText: { fontSize: 14, fontWeight: 'bold', color: '#4A3420' },
  driverProfileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAF3F0', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#E0D0C0' },
  driverAvatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4A3420', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  fullImageAvatar: { width: 44, height: 44, borderRadius: 22 },
  driverAvatarEmoji: { fontSize: 20 },
  driverInfoDetails: { flex: 1, marginLeft: 12 },
  driverNameText: { fontSize: 14, fontWeight: 'bold', color: '#4A3420' },
  driverPlateText: { fontSize: 12, color: '#7A6450', fontWeight: '600', marginTop: 2 },
  phoneCallBtn: { backgroundColor: '#4CAF50', width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', position: 'relative' }, 
  chatBadgeIndicator: { position: 'absolute', top: -3, right: -3, width: 12, height: 12, borderRadius: 6, backgroundColor: '#E74C3C', borderWidth: 2, borderColor: '#FAF3F0' },
  routeStaticInfoBox: { marginTop: 12, paddingLeft: 4, gap: 2 },
  staticRouteText: { fontSize: 12, color: '#4A3420', fontWeight: '600' },
  staticPaymentText: { fontSize: 11, color: '#7A6450', marginTop: 1, fontWeight: '500' },
  navMapsBtn: { backgroundColor: '#4285F4', width: '100%', height: 46, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  navMapsBtnText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  primaryBtnDriver: { backgroundColor: '#4A3420', width: '100%', height: 50, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  textBtnMain: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  passengerStatusBanner: { backgroundColor: '#FFF3E0', borderRadius: 12, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center', borderWidth: 0.5, borderColor: '#FFE0B2' },
  textStatusPassenger: { color: '#E65100', fontSize: 12, fontWeight: '500', flex: 1, lineHeight: 16 },
  lacakDriverBtn: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#4A3420', width: '100%', height: 46, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  lacakDriverBtnText: { color: '#4A3420', fontSize: 13, fontWeight: 'bold' },
  alertOverlay: { flex: 1, backgroundColor: 'rgba(74, 52, 32, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  alertBox: { width: '100%', backgroundColor: '#FFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E0D0C0', elevation: 10 },
  alertTitle: { fontSize: 16, fontWeight: 'bold', color: '#4A3420', textAlign: 'center' },
  alertMessage: { fontSize: 13, color: '#7A6450', textAlign: 'center', marginTop: 8, lineHeight: 18, fontWeight: '500' },
  
  // 🚀 FIX: STYLE UNTUK UANG JUMBO
  alertNominalJumbo: { fontSize: 28, fontWeight: '900', color: '#2ECC71', textAlign: 'center', marginTop: 6, marginBottom: 4 },
  
  alertActionRow: { flexDirection: 'row', gap: 12, marginTop: 20, width: '100%' },
  alertCancelBtn: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, borderColor: '#C0A995', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF6F0' },
  alertCancelBtnText: { color: '#7A6450', fontWeight: 'bold', fontSize: 13 },
  alertConfirmBtn: { flex: 1, height: 44, borderRadius: 10, backgroundColor: '#4A3420', justifyContent: 'center', alignItems: 'center' },
  alertConfirmBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 }
});