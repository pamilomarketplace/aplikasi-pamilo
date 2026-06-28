// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  StatusBar, 
  ActivityIndicator, 
  Alert,
  Dimensions,
  FlatList,
  Modal
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Picker } from '@react-native-picker/picker';

// BACKEND: KONEKTOR UTAMA SUPABASE SAKTI TUAN OWNER
import { supabase } from '../../supabaseConfig';

const { width, height } = Dimensions.get('window');

const INITIAL_REGION_CIAMIS = {
  latitude: -7.3262,
  longitude: 108.3532,
  latitudeDelta: 0.035,
  longitudeDelta: 0.035,
};

export default function GodModeCommandCenter() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const [loading, setLoading] = useState(true);
  const [lastRadarUpdate, setLastRadarUpdate] = useState<string>('');
  
  // STATE DRIVER & MARKER MAPS
  const [activeDrivers, setActiveDrivers] = useState<any[]>([]); 
  const [mapMarkers, setMapMarkers] = useState<any[]>([]); 

  // STATE ORDERAN MACET
  const [pendingOrders, setPendingOrders] = useState<any[]>([]); 

  // STATE MODAL FORCE DISPATCH VVIP
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedAsalTabel, setSelectedAsalTabel] = useState<string>(''); 
  const [dispatchTargetUserId, setDispatchTargetUserId] = useState<string>(''); 

  // 🚀 ENGINE 1: FUNGSI RINGAN HANYA UNTUK POSISI DRIVER DARI DATABASE
  const refreshPosisiDriverSaja = async () => {
    try {
      const { data: resDrivers, error } = await supabase.from('drivers')
        .select(`
          user_id_driver, status_driver, latitude_driver, longitude_driver,
          users (user_name, saldo)
        `)
        .eq('status_driver', 'ONLINE');

      if (error) throw error;

      const onlineDriversWithLoc = resDrivers?.map(d => ({
        id: d.user_id_driver, 
        name: d.users?.user_name || 'MIGO Driver',
        saldo: Number(d.users?.saldo || 0),
        lat: Number(d.latitude_driver) || -7.3262,
        lng: Number(d.longitude_driver) || 108.3532
      })) || [];
      
      setActiveDrivers(onlineDriversWithLoc);
      setMapMarkers(onlineDriversWithLoc.map(d => ({
        key: d.id,
        coordinate: { latitude: d.lat, longitude: d.lng },
        title: d.name,
        description: `Saldo Dompet: Rp ${d.saldo.toLocaleString('id-ID')}`
      })));
    } catch (err) {
      console.log("Gagal menyegarkan koordinat ringan:", err);
    }
  };

  // 🚀 ENGINE 2: FUNGSI GOD-MODE UTAMA (Tarik Semua - Telah Dioptimasi)
  const fetchSirkuitRadarGodMode = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const [resDrivers, resPendingOrders, resPendingMigo] = await Promise.all([
        supabase.from('drivers').select('user_id_driver, status_driver, latitude_driver, longitude_driver, users(user_name, saldo)').eq('status_driver', 'ONLINE'),
        supabase.from('orders').select('id, pembeli_id, status_order, jarak_km, biaya_ongkir, total_pembayaran, alamat_pengiriman, created_at, users(user_name)').eq('status_order', 'MENCARI_KURIR').is('kurir_id', null).order('created_at', { ascending: false }),
        supabase.from('migo_orders').select('id, pembeli_id, alamat_jemput, alamat_antar, jarak_km, total_pembayaran, status_order, created_at, tipe_layanan, users(user_name)').eq('status_order', 'MENCARI_DRIVER').is('driver_id', null).order('created_at', { ascending: false })
      ]);

      // --- 1. MAPPING DRIVER ---
      const onlineDriversWithLoc = resDrivers.data?.map(d => ({
        id: d.user_id_driver, 
        name: d.users?.user_name || 'MIGO Driver',
        saldo: Number(d.users?.saldo || 0),
        lat: Number(d.latitude_driver) || -7.3262,
        lng: Number(d.longitude_driver) || 108.3532
      })) || [];
      
      setActiveDrivers(onlineDriversWithLoc);
      setMapMarkers(onlineDriversWithLoc.map(d => ({
        key: d.id,
        coordinate: { latitude: d.lat, longitude: d.lng },
        title: d.name,
        description: `Saldo Dompet: Rp ${d.saldo.toLocaleString('id-ID')}`
      })));

      // --- 2. MAPPING ORDERAN MACET ---
      const formattedOrders = resPendingOrders.data?.map(o => ({
        id: o.id,
        asalTabel: 'orders',
        warga: o.users?.user_name || 'Warga Pamilo',
        infoUtama: '📦 MUATAN BELANJA PASAR',
        alamatAwal: 'Pasar Tradisional / Mitra Toko',
        alamatTujuan: o.alamat_pengiriman, 
        jarak: Number(o.jarak_km || 0).toFixed(1),
        ongkir: Number(o.biaya_ongkir || 0),
        createdAt: o.created_at
      })) || [];

      const formattedMigo = resPendingMigo.data?.map(m => ({
        id: m.id,
        asalTabel: 'migo_orders',
        warga: m.users?.user_name || 'Penumpang Migo',
        infoUtama: `🛵 OJOL (${m.tipe_layanan})`, 
        alamatAwal: m.alamat_jemput || 'Titik Jemput Driver', 
        alamatTujuan: m.alamat_antar || 'Titik Antar', 
        jarak: Number(m.jarak_km || 0).toFixed(1),
        ongkir: Number(m.total_pembayaran || 0), 
        createdAt: m.created_at
      })) || [];

      setPendingOrders([...formattedOrders, ...formattedMigo]);

      const sekarang = new Date();
      setLastRadarUpdate(sekarang.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

    } catch (error) {
      console.log("Kesalahan fatal sasis God Mode:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSirkuitRadarGodMode();

    // 🚀 ENGINE 3: SENSOR SATELIT BROADCAST (FIX UNTUK LIVE TRACKING ADMIN YANG MEMBEKU)
    // Sensor ini menyadap langsung pancaran HP Driver tanpa harus menunggu data masuk ke tabel Database!
    const channelLiveTrackingAdmin = supabase.channel('global-radar-system-admin')
      .on('broadcast', { event: 'POSISI_DRIVER_UPDATE' }, (payload) => {
        // payload dari driver biasanya berisi: { lat: -7.xxx, lng: 108.xxx, driverId: 'uuid' }
        if (payload.payload && payload.payload.lat && payload.payload.lng) {
          setMapMarkers((prevMarkers) => {
            // Karena broadcast orderan driver bisa jadi tidak mengirim ID Driver secara gamblang (tergantung setup awal),
            // maka sistem akan memperbarui marker pertama yang berdekatan atau menarik id jika ada.
            const updatedMarkers = [...prevMarkers];
            const targetDriverId = payload.payload.driverId; // Jika di HP Driver di-set

            if (targetDriverId) {
              const markerIndex = updatedMarkers.findIndex(m => m.key === targetDriverId);
              if (markerIndex !== -1) {
                updatedMarkers[markerIndex].coordinate = { latitude: payload.payload.lat, longitude: payload.payload.lng };
              }
            } else {
              // Fallback: Jika ID tidak terdeteksi di payload, sinkronkan via refresh ringan database.
              // (Mencegah marker melompat jika ada banyak driver)
              refreshPosisiDriverSaja();
            }
            return updatedMarkers;
          });
        }
      })
      .subscribe();

    // 🚀 ENGINE 4: BYPASS RADAR POSTGRESQL UNTUK ORDERAN DAN STATUS LOGIN DRIVER
    const channelOrderanPamilo = supabase
      .channel('executive-god-mode-realtime-secure-v8')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { fetchSirkuitRadarGodMode(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'migo_orders' }, () => { fetchSirkuitRadarGodMode(); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'drivers' }, () => { refreshPosisiDriverSaja(); })
      .subscribe();

    return () => {
      supabase.removeChannel(channelOrderanPamilo);
      supabase.removeChannel(channelLiveTrackingAdmin);
    };
  }, []);

  const handleOpenDispatchModal = (id: string, tabel: string) => {
    if (activeDrivers.length === 0) {
      Alert.alert("Tembakan Melos 🛑", "Tidak ada driver MIGO yang online saat ini di radar Ciamis.");
      return;
    }
    setSelectedOrderId(id);
    setSelectedAsalTabel(tabel);
    setDispatchTargetUserId(activeDrivers[0].id); 
    setShowDispatchModal(true);
  };

  const handleForceDispatch = async () => {
    if (!selectedOrderId || !dispatchTargetUserId || !selectedAsalTabel) return;

    try {
      setLoading(true);
      const isOjol = selectedAsalTabel === 'migo_orders';
      
      const targetTable = selectedAsalTabel;
      const payloadUpdate = isOjol 
        ? { driver_id: dispatchTargetUserId, status_order: 'MENUJU_JEMPUT' } 
        : { kurir_id: dispatchTargetUserId, status_order: 'DIPROSES' };    

      const { data, error } = await supabase
        .from(targetTable)
        .update(payloadUpdate)
        .eq('id', selectedOrderId)
        .in('status_order', ['MENCARI_DRIVER', 'MENCARI_KURIR']) 
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Orderan sudah disamber ojol lain terlebih dahulu.");
      }

      await supabase.from('notifications').insert({
        user_id_notif: dispatchTargetUserId,
        judul_notif: "🚨 TUGAS VVIP PUSAT!",
        isi_notif: "Tuan Owner mengunci tugas khusus untuk Anda. Segera buka aplikasi dan selesaikan!",
        is_read_notif: false,
        tipe_notif: 'INFO_SISTEM'
      });

      setShowDispatchModal(false);
      fetchSirkuitRadarGodMode();
      Alert.alert("Tembakan Tepat Sasaran! 🎯", "Orderan resmi dikunci paksa ke driver yang ditunjuk dan HP mereka sedang dibunyikan dari pusat.");

    } catch (e: any) {
      Alert.alert("Gagal Menembak Orderan 🚨", e.message || "Terjadi kesalahan internal sasis server.");
      setShowDispatchModal(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.mainWrapper}>
      <Stack.Screen options={{ headerShown: true, headerTitle: 'Pusat Komando God Mode MIGO', headerTintColor: '#fff', headerStyle: { backgroundColor: '#1A0F05' }, headerTitleStyle: { fontWeight: 'bold', fontSize: 13 } }} />
      <StatusBar barStyle="light-content" backgroundColor="#1A0F05" />

      {/* OVERLAY PANEL MODAL FORCE DISPATCH PREMIUM */}
      <Modal visible={showDispatchModal} transparent={true} animationType="slide" onRequestClose={() => setShowDispatchModal(false)}>
        <View style={styles.fullscreenOverlay}>
          <View style={styles.dispatchModalCard}>
            <View style={styles.radarPulseWrapper}>
              <FontAwesome5 name="satellite-dish" size={20} color="#fff" />
            </View>
            <Text style={styles.modalHeading}>EKSEKUSI FORCE DISPATCH VVIP</Text>
            <Text style={styles.modalSubHeading}>Kunci paksa orderan macet ini ke target user driver pilihan Anda.</Text>
            
            <Text style={styles.labelPicker}>SIAPKAN TARGET DRIVER MIGO ONLINE:</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={dispatchTargetUserId}
                onValueChange={(itemValue) => setDispatchTargetUserId(itemValue)}
                style={styles.pickerStyle}
                dropdownIconColor="#5D3A1A"
              >
                {activeDrivers.map((driver) => (
                  <Picker.Item key={driver.id} label={`🛵 ${driver.name} (Saldo: Rp ${driver.saldo.toLocaleString('id-ID')})`} value={driver.id} />
                ))}
              </Picker>
            </View>

            <View style={styles.modalActionButtonsRow}>
              <TouchableOpacity style={styles.btnModalBatal} onPress={() => setShowDispatchModal(false)}>
                <Text style={styles.btnModalBatalText}>LEWATKAN</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnModalTembak} onPress={handleForceDispatch}>
                <Text style={styles.btnModalTembakText}>TEMBAK PAKSA</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* JEROAN UTAMA 1: MAPVIEW RADAR DRIVER (REALTIME GPS) */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.mapStyle}
          initialRegion={INITIAL_REGION_CIAMIS}
          provider={PROVIDER_GOOGLE}
          showsUserLocation={false}
          showsMyLocationButton={true}
        >
          {mapMarkers.map((marker) => (
            <Marker key={marker.key} coordinate={marker.coordinate} title={marker.title} description={marker.description}>
              <View style={styles.customMarkerBg}><FontAwesome5 name="motorcycle" size={10} color="#fff" /></View>
            </Marker>
          ))}
        </MapView>
        <View style={styles.mapHeaderStats}>
          <View style={styles.mapBadge}><View style={styles.liveDot} /><Text style={styles.mapBadgeText}>RADAR LIVE {lastRadarUpdate}</Text></View>
          <View style={styles.statBadge}>
            <Text style={styles.statBadgeText}>MIGO Aktif: <Text style={{ fontWeight: '900' }}>{activeDrivers.length}</Text></Text>
          </View>
        </View>
      </View>

      {/* JEROAN UTAMA 2: PANEL LIST ORDERAN MACET CIAMIS */}
      <View style={styles.pendingContainer}>
        <View style={styles.pendingHeader}>
          <Ionicons name="radio-sharp" size={16} color="#D35400" />
          <Text style={styles.pendingTitle}>DAFTAR ANTREAN ORDERAN MACET DI DAERAH</Text>
          <View style={styles.badgeCountPending}><Text style={styles.badgeCountText}>{pendingOrders.length} MACET</Text></View>
        </View>

        <FlatList
          data={pendingOrders}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FontAwesome5 name="satellite" size={26} color="#BCAAA4" opacity={0.4} />
              <Text style={styles.emptyText}>Seluruh sasis operasional lancar. Nol orderan macet harian warga Ciamis.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.orderCard, item.asalTabel === 'migo_orders' ? styles.cardOjolBorder : styles.cardBarangBorder]}>
              <View style={styles.orderHeaderRow}>
                <View style={[styles.badgeTable, item.asalTabel === 'migo_orders' ? styles.bgOjolBadge : styles.bgBarangBadge]}>
                  <Text style={item.asalTabel === 'migo_orders' ? styles.textOjolBadge : styles.textBarangBadge}>{item.infoUtama}</Text>
                </View>
                <Text style={styles.orderTime}>{new Date(item.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>

              <View style={styles.wargaRow}>
                <FontAwesome5 name="user-alt" size={10} color="#A1887F" />
                <Text style={styles.wargaNameText} numberOfLines={1}>Pemesan: <Text style={{ fontWeight: '900' }}>{item.warga}</Text></Text>
              </View>

              <Text style={styles.alamatLabel}>📍 TITIK ASAL / JEMPUT:</Text>
              <Text style={styles.alamatValue} numberOfLines={1}>{item.alamatAwal}</Text>

              <Text style={styles.alamatLabel}>🏁 TITIK TUJUAN / ANTAR:</Text>
              <Text style={styles.alamatValue} numberOfLines={2}>{item.alamatTujuan}</Text>

              <View style={styles.priceRow}>
                <Text style={styles.jarakText}>🗺️ JARAK RETAIL: {item.jarak} KM</Text>
                <Text style={styles.priceText}>Rp {item.ongkir.toLocaleString('id-ID')}</Text>
              </View>

              <TouchableOpacity style={styles.btnTembakAction} onPress={() => handleOpenDispatchModal(item.id, item.asalTabel)}>
                <Ionicons name="flash" size={12} color="#FFF" />
                <Text style={styles.btnTembakText}>TEMBAK FORCE DISPATCH</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: '#FAF8F5' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A0F05' },
  loadingText: { marginTop: 14, color: '#FFB74D', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  fullscreenOverlay: { flex: 1, backgroundColor: 'rgba(26,15,5,0.94)', justifyContent: 'center', alignItems: 'center' },
  dispatchModalCard: { width: width - 32, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, alignItems: 'center', borderWidth: 1.5, borderColor: '#5D3A1A', elevation: 10 },
  radarPulseWrapper: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#D35400', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  modalHeading: { fontSize: 14, fontWeight: '900', color: '#1A0F05', letterSpacing: 0.5 },
  modalSubHeading: { fontSize: 10, color: '#8D6E63', fontWeight: '500', marginTop: 4, marginBottom: 20, textAlign: 'center' },
  labelPicker: { fontSize: 9, fontWeight: 'bold', color: '#A1887F', letterSpacing: 1, marginBottom: 8, alignSelf: 'flex-start' },
  pickerWrapper: { width: '100%', backgroundColor: '#FAF8F5', borderRadius: 12, borderWidth: 1, borderColor: '#EFEBE9', overflow: 'hidden', marginBottom: 25 },
  pickerStyle: { height: 50, width: '100%', color: '#4A3525' },
  modalActionButtonsRow: { flexDirection: 'row', gap: 12, width: '100%' },
  btnModalBatal: { flex: 0.35, backgroundColor: '#F5F5F5', paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0' },
  btnModalBatalText: { color: '#616161', fontWeight: 'bold', fontSize: 12, letterSpacing: 0.3 },
  btnModalTembak: { flex: 0.65, backgroundColor: '#5D3A1A', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  btnModalTembakText: { color: '#fff', fontWeight: 'bold', fontSize: 12, letterSpacing: 0.3 },
  mapContainer: { height: height * 0.40, width: '100%', position: 'relative' },
  mapStyle: { ...StyleSheet.absoluteFillObject },
  customMarkerBg: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#5D3A1A', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#F1E3CB' },
  mapHeaderStats: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mapBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(26,15,5,0.75)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2ECC71' },
  mapBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  statBadge: { backgroundColor: '#F1E3CB', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#D7CCC8' },
  statBadgeText: { fontSize: 10, color: '#5D3A1A', fontWeight: 'bold' },
  pendingContainer: { flex: 1, backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, elevation: 5, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  pendingHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F5EFEA' },
  pendingTitle: { fontSize: 10, fontWeight: 'bold', color: '#A1887F', letterSpacing: 1, flex: 1, marginLeft: 10 },
  badgeCountPending: { backgroundColor: '#FFEBEE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeCountText: { fontSize: 9, color: '#C62828', fontWeight: 'bold' },
  listContent: { paddingHorizontal: 20, paddingTop: 10 },
  orderCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardOjolBorder: { borderColor: '#FFCDD2' },
  cardBarangBorder: { borderColor: '#F1E3CB' },
  orderHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  badgeTable: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, borderWidth: 0.5 },
  bgOjolBadge: { backgroundColor: '#FFEBEE', borderColor: '#FFCDD2' },
  bgBarangBadge: { backgroundColor: '#FFF8E1', borderColor: '#FFE082' },
  textOjolBadge: { fontSize: 8, color: '#C62828', fontWeight: '900' },
  textBarangBadge: { fontSize: 8, color: '#F57F17', fontWeight: '900' },
  orderTime: { fontSize: 10, color: '#BCAAA4', fontWeight: '600' },
  wargaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 },
  wargaNameText: { fontSize: 12, color: '#4A3525' },
  alamatLabel: { fontSize: 8, fontWeight: 'bold', color: '#BCAAA4', letterSpacing: 0.5, marginTop: 4 },
  alamatValue: { fontSize: 11, color: '#4A3525', fontWeight: '600', marginTop: 2, marginBottom: 4 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  jarakText: { fontSize: 11, color: '#8D6E63', fontWeight: 'bold' },
  priceText: { fontSize: 18, fontWeight: '900', color: '#2E7D32' },
  btnTembakAction: { backgroundColor: '#5D3A1A', flexDirection: 'row', height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginTop: 4, elevation: 1 },
  btnTembakText: { color: '#FFF', fontSize: 11, fontWeight: 'bold', marginLeft: 6, letterSpacing: 0.3 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 80, gap: 14 },
  emptyText: { color: '#BCAAA4', fontSize: 11, fontWeight: '500', textAlign: 'center', paddingHorizontal: 40, lineHeight: 18 }
});