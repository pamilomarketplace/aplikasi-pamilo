// @ts-nocheck
import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, Switch, StatusBar, 
  ActivityIndicator, RefreshControl, Dimensions, Modal, 
  Platform, FlatList, DeviceEventEmitter
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router'; 
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import { Audio } from 'expo-av'; 
import MapView, { Marker } from 'react-native-maps'; 
import { supabase } from '../../supabaseConfig';

const { width } = Dimensions.get('window');
const TASK_GPS_MIGO_BACKGROUND = 'TUGAS_PELACAK_BACKGROUND_MIGO_V1'; 
const SALDO_MINIMUM_RADAR = 10000;

// ========================================================
// 🚀 REAKTOR GPS LATAR BELAKANG (WAJIB DI LUAR KOMPONEN)
// ========================================================
TaskManager.defineTask(TASK_GPS_MIGO_BACKGROUND, async ({ data, error }) => {
  if (error) {
    console.error("GPS Background Error:", error.message);
    return;
  }
  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      const loc = locations[0];
      try {
        const userId = await AsyncStorage.getItem('DRIVER_USER_ID');
        const isOnline = await AsyncStorage.getItem('DRIVER_ONLINE_STATUS');
        
        if (userId && isOnline === 'true') {
          await supabase.from('drivers').update({
            latitude_driver: loc.coords.latitude, 
            longitude_driver: loc.coords.longitude
          }).eq('user_id_driver', userId);
          console.log(`[BACKGROUND] Tembakan Satelit: ${loc.coords.latitude}, ${loc.coords.longitude}`);
        }
      } catch (err) {
        console.error("Gagal menembak GPS background:", err);
      }
    }
  }
});

interface OrderMuatan {
  id_asli_uuid: string;
  id_nota: string;
  tipe_layanan: string;
  nama_pemesan: string;
  alamat_jemput: string;
  alamat_kirim: string;
  ongkir_kurir: number;
  created_at_raw: number;
  created_at: string;
  latitude_jemput: number;
  longitude_jemput: number;
  latitude_kirim: number;
  longitude_kirim: number;
  asal_tabel: 'orders' | 'migo_orders'; 
}

export default function DashboardDriverScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [driverData, setDriverData] = useState({ name: 'Mitra MIGO', saldo: 0, foto: null });
  const [orderModal, setOrderModal] = useState({ visible: false, data: null });
  const [stats, setStats] = useState({ ritase: 0, pendapatan: 0 });
  const [daftarTrip, setDaftarTrip] = useState([]);
  const [loadingAmbil, setLoadingAmbil] = useState<string | boolean>(false);
  const [muatanList, setMuatanList] = useState<OrderMuatan[]>([]);
  const [petaRegion, setPetaRegion] = useState({ latitude: -7.3262, longitude: 108.3532, latitudeDelta: 0.04, longitudeDelta: 0.04 });
  const [infoModal, setInfoModal] = useState({ visible: false, title: '', message: '', type: 'warning' }); 

  const isOnlineRef = useRef(false);
  const activeOrderIdRef = useRef(null);
  const soundRef = useRef(null); 

  const showCustomAlert = (title: string, message: string, type: 'warning' | 'error' | 'success' = 'warning') => {
    setInfoModal({ visible: true, title, message, type });
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Kemudi Driver', 
      headerStyle: { backgroundColor: '#4A3525' }, 
      headerTintColor: '#fff', 
      headerTitleStyle: { fontWeight: 'bold', fontSize: 14 },
      headerRight: () => (
        <TouchableOpacity onPress={() => router.push('/saldo')} style={styles.headerWalletBtn}>
          <FontAwesome5 name="wallet" size={12} color="#4A3525" style={{ marginRight: 6 }} />
          <Text style={styles.headerWalletTxt}>
            Rp {(driverData.saldo || 0).toLocaleString('id-ID')}
          </Text>
        </TouchableOpacity>
      )
    });
  }, [navigation, driverData.saldo]);

  const playNotificationSound = async () => {
    try {
      if (soundRef.current) await soundRef.current.unloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false, staysActiveInBackground: true, playsInSilentModeIOS: true,
        shouldRouteThroughEarpieceAndroid: false, playThroughEarpieceAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/migo.mp3'),
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );
      soundRef.current = sound;
    } catch (error) {
      console.log("❌ Gagal memutar file audio:", error);
    }
  };

  const stopNotificationSound = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch (error) {}
  };

  const syncDashboardData = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.replace('/login');
      const uid = session.user.id;
      await AsyncStorage.setItem('DRIVER_USER_ID', uid);

      const [{ data: user }, { data: drv }, { data: config }] = await Promise.all([
        supabase.from('users').select('saldo, foto_user').eq('user_id', uid).maybeSingle(),
        supabase.from('drivers').select('status_driver, foto_wajah, nama_driver').eq('user_id_driver', uid).maybeSingle(),
        supabase.from('pengaturan_aplikasi').select('nilai_konfigurasi').eq('kunci_konfigurasi', 'POTONGAN_DRIVER_PERSEN').maybeSingle()
      ]);

      const rasioPotonganDinamis = (config?.nilai_konfigurasi ? Number(config.nilai_konfigurasi) : 10) / 100;
      let cleanSaldo = typeof user?.saldo === 'number' ? user.saldo : Number(String(user?.saldo || '0').replace(/[^0-9.-]+/g, "")) || 0;

      setDriverData({ name: drv?.nama_driver || 'Mitra PAMILO', saldo: cleanSaldo, foto: drv?.foto_wajah || user?.foto_user || null });

      if (drv) {
        const online = drv.status_driver === 'ONLINE';
        setIsOnline(online);
        isOnlineRef.current = online;
        await AsyncStorage.setItem('DRIVER_ONLINE_STATUS', online ? 'true' : 'false');
      }

      const today = new Date(); today.setHours(0,0,0,0);
      const [resOrders, resMigo] = await Promise.all([
        supabase.from('orders').select('*').eq('kurir_id', uid).order('created_at', { ascending: false }),
        supabase.from('migo_orders').select('*').eq('driver_id', uid).order('created_at', { ascending: false })
      ]);

      let dailyRitase = 0, dailyIncome = 0, currentActiveId = null;
      const combinedTrips = [];

      const mapper = (item, table) => {
        const isPasar = table === 'orders';
        const isActive = isPasar ? ['PENDING', 'DIPROSES', 'DIKIRIM'].includes(item.status_order) : ['DIPROSES', 'MENUJU_JEMPUT', 'DIANTAR'].includes(item.status_order);
        const baseIncome = isPasar ? (item.biaya_ongkir || 0) : (item.total_pembayaran || 0);
        const income = baseIncome - (baseIncome * rasioPotonganDinamis);

        if (isActive) currentActiveId = item.id;
        if (item.status_order === 'SELESAI' && new Date(item.created_at) >= today) { dailyRitase++; dailyIncome += income; }

        let pilar = 'MART';
        if (isPasar && item.layanan) {
           const layanan = String(item.layanan).toUpperCase();
           if (layanan.includes('SERVIS') || layanan.includes('JASA')) pilar = 'SERVIS';
           else if (layanan.includes('FOOD') || layanan.includes('MAKANAN')) pilar = 'FOOD';
        }

        combinedTrips.push({
          id: item.id, 
          type: isPasar ? `PAMILO ${pilar}` : item.tipe_layanan?.replace('_', ' ') || 'MIGO RIDE',
          asal: table, status: item.status_order, income,
          rute: isPasar ? item.alamat_pengiriman : `${item.alamat_jemput} ➔ ${item.alamat_antar || item.alamat_tujuan}`,
          date: item.created_at, isActive
        });
      };

      resOrders.data?.forEach(i => mapper(i, 'orders'));
      resMigo.data?.forEach(i => mapper(i, 'migo_orders'));

      setDaftarTrip(combinedTrips.sort((a,b) => b.isActive - a.isActive || new Date(b.date) - new Date(a.date)));
      setStats({ ritase: dailyRitase, pendapatan: dailyIncome });
      activeOrderIdRef.current = currentActiveId;

    } catch (e) { console.log("Sync Error", e); } 
    finally { setLoading(false); setRefreshing(false); }
  };

  const fetchAntreanMuatanPasar = async () => {
    if (!isOnlineRef.current) return;
    try {
      const [resOjek, resBarang] = await Promise.all([
        supabase.from('migo_orders').select('id, tipe_layanan, alamat_jemput, latitude_jemput, longitude_jemput, alamat_antar, latitude_tujuan, longitude_tujuan, total_pembayaran, created_at, nama_penumpang').eq('status_order', 'MENCARI_DRIVER').is('driver_id', null),
        supabase.from('orders').select('id, alamat_pengiriman, alamat_penjemputan, latitude_jemput, longitude_jemput, latitude_tujuan, longitude_tujuan, biaya_ongkir, created_at, nama_pembeli, layanan').eq('status_order', 'MENCARI_KURIR').is('kurir_id', null) 
      ]);

      let gabunganMuatan: OrderMuatan[] = [];

      if (resOjek.data) {
        const formatOjek = resOjek.data.map((nota: any) => ({
          id_asli_uuid: nota.id, id_nota: nota.id.substring(0, 8).toUpperCase(), tipe_layanan: nota.tipe_layanan || 'MIGO_RIDE',
          nama_pemesan: nota.nama_penumpang || 'Pelanggan MIGO', alamat_jemput: nota.alamat_jemput || 'Titik Jemput Belum Tertera',
          alamat_kirim: nota.alamat_antar || 'Tujuan Belum Tertera', ongkir_kurir: Number(nota.total_pembayaran) || 0,
          created_at_raw: new Date(nota.created_at).getTime(),
          created_at: new Date(nota.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
          latitude_jemput: parseFloat(nota.latitude_jemput) || -7.3275, longitude_jemput: parseFloat(nota.longitude_driver) || 108.3540,
          latitude_kirim: parseFloat(nota.latitude_tujuan) || -7.3220, longitude_kirim: parseFloat(nota.longitude_tujuan) || 108.3510,
          asal_tabel: 'migo_orders' as const
        }));
        gabunganMuatan = [...gabunganMuatan, ...formatOjek];
      }

      if (resBarang.data) {
        const formatBarang = resBarang.data.map((nota: any) => {
          let pilar = 'MART';
          const layanan = String(nota.layanan || '').toUpperCase();
          if (layanan.includes('SERVIS') || layanan.includes('JASA')) pilar = 'SERVIS';
          else if (layanan.includes('FOOD') || layanan.includes('MAKANAN')) pilar = 'FOOD';

          return {
            id_asli_uuid: nota.id, id_nota: nota.id.substring(0, 8).toUpperCase(), tipe_layanan: `PAMILO_${pilar}`,
            nama_pemesan: nota.nama_pembeli || 'Warga PAMILO', alamat_jemput: nota.alamat_penjemputan || `Mitra ${pilar}`,
            alamat_kirim: nota.alamat_pengiriman || 'Tujuan Belum Tertera', ongkir_kurir: Number(nota.biaya_ongkir) || 0,
            created_at_raw: new Date(nota.created_at).getTime(),
            created_at: new Date(nota.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
            latitude_jemput: parseFloat(nota.latitude_jemput) || -7.3274, longitude_jemput: parseFloat(nota.longitude_jemput) || 108.3543,
            latitude_kirim: parseFloat(nota.latitude_tujuan) || -7.3220, longitude_kirim: parseFloat(nota.longitude_tujuan) || 108.3510,
            asal_tabel: 'orders' as const
          };
        });
        gabunganMuatan = [...gabunganMuatan, ...formatBarang];
      }

      gabunganMuatan.sort((a, b) => b.created_at_raw - a.created_at_raw);
      setMuatanList(gabunganMuatan);

      if (gabunganMuatan.length > 0) {
        setPetaRegion(prev => ({ ...prev, latitude: gabunganMuatan[0].latitude_jemput, longitude: gabunganMuatan[0].longitude_jemput }));
      }
    } catch (err) { console.error("Radar Fetch Error:", err); }
  };

  useEffect(() => {
    const prepareDashboard = async () => {
      const savedStatus = await AsyncStorage.getItem('DRIVER_ONLINE_STATUS');
      if (savedStatus !== null) {
        const online = savedStatus === 'true';
        setIsOnline(online);
        isOnlineRef.current = online;
        if (online) fetchAntreanMuatanPasar();
      }
      await syncDashboardData(false);
    };
    prepareDashboard();

    // 🟢 TETAP PERTAHANKAN CHANNEL HANYA UNTUK MEMPERBARUI DAFTAR RADAR MAP (Bukan Pemicu Suara/Modal)
    const channelLiveMapMigo = supabase.channel(`live-map-dashboard-${Date.now()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'migo_orders' }, () => { fetchAntreanMuatanPasar(); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => { fetchAntreanMuatanPasar(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => { fetchAntreanMuatanPasar(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'migo_orders' }, () => { fetchAntreanMuatanPasar(); })
      .subscribe();

    return () => {
      stopNotificationSound();
      supabase.removeChannel(channelLiveMapMigo);
    };
  }, []);

  useFocusEffect(useCallback(() => {
    syncDashboardData(true); 
    fetchAntreanMuatanPasar();
  }, []));

  // ========================================================
  // 🚀 ENGINE UPDATE LOKASI MANUAL (AGRESIF & AKURAT)
  // ========================================================
  const suntikSatelitLatarDepan = async (uid) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;
      
      if (latitude && longitude && !isNaN(latitude)) {
         await supabase.from('drivers').update({
            latitude_driver: latitude,
            longitude_driver: longitude
         }).eq('user_id_driver', uid);
         console.log(`[FOREGROUND] Tembakan Manual: ${latitude}, ${longitude}`);
      }
    } catch(err) {
      console.log("Gagal Tembak Manual GPS", err);
    }
  };

  const handleToggleOnline = async (val) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    if (val && session.user.email !== 'agieldoank85@gmail.com') {
      const { data: u } = await supabase.from('users').select('saldo').eq('user_id', session.user.id).single();
      if ((u?.saldo || 0) < SALDO_MINIMUM_RADAR) {
        setIsOnline(false);
        return showCustomAlert("Saldo Minim ⚠️", `Minimal Rp ${SALDO_MINIMUM_RADAR.toLocaleString()} untuk mulai on-bid.`, 'warning');
      }
    }

    setIsOnline(val);
    isOnlineRef.current = val;
    await AsyncStorage.setItem('DRIVER_ONLINE_STATUS', val ? 'true' : 'false');
    await supabase.from('drivers').update({ status_driver: val ? 'ONLINE' : 'OFFLINE' }).eq('user_id_driver', session.user.id);
    
    toggleBackgroundService(val);
    if (val) {
      suntikSatelitLatarDepan(session.user.id); 
      fetchAntreanMuatanPasar();
    } else {
      setMuatanList([]);
    }
  };

  const toggleBackgroundService = async (status) => {
    try {
      if (status) {
        activateKeepAwake();
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') return showCustomAlert("Izin Ditolak 🛑", "PAMILO butuh akses lokasi agar bisa beroperasi.", 'error');
        
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus === 'granted') {
          await Location.startLocationUpdatesAsync(TASK_GPS_MIGO_BACKGROUND, {
            accuracy: Location.Accuracy.High, 
            timeInterval: 10000,          
            distanceInterval: 10,         
            showsBackgroundLocationIndicator: true,
            foregroundService: { 
              notificationTitle: "Radar PAMILO Driver Aktif 🛵", 
              notificationBody: "Satelit sedang mengunci titik pergerakan Anda.", 
              notificationColor: "#D35400" 
            }
          });
        } else {
          showCustomAlert("Akses Terbatas ⚠️", "Anda menolak izin lokasi 'Selalu/All the Time'. Titik GPS Anda mungkin mati saat layar HP dikunci.", 'warning');
        }
      } else {
        deactivateKeepAwake();
        const isRunning = await TaskManager.isTaskRegisteredAsync(TASK_GPS_MIGO_BACKGROUND);
        if (isRunning) await Location.stopLocationUpdatesAsync(TASK_GPS_MIGO_BACKGROUND);
      }
    } catch (e) {
      console.log("Gagal menyalakan/mematikan background task:", e);
    }
  };

  const ambilOrderan = async () => {
    setLoadingAmbil(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setLoadingAmbil(false);
      return;
    }

    const isMigo = orderModal.data.table === 'migo_orders';
    const namaKolomKunci = isMigo ? 'driver_id' : 'kurir_id';
    const targetStatus = isMigo ? 'MENUJU_JEMPUT' : 'DIPROSES';
    
    try {
      const { data, error } = await supabase.from(orderModal.data.table)
        .update({ 
          [namaKolomKunci]: session.user.id, 
          status_order: targetStatus 
        })
        .eq('id', orderModal.data.id)
        .in('status_order', ['MENCARI_DRIVER', 'MENCARI_KURIR'])
        .is(namaKolomKunci, null)
        .select();

      await stopNotificationSound();
      setOrderModal({ visible: false, data: null });

      if (error) throw error;

      if (data && data.length > 0) { 
        router.push({ pathname: '/driver/tugas-aktif', params: { id: data[0].id, asal_tabel: orderModal.data.table } });
      } else {
        showCustomAlert("Terlambat 😥", "Orderan ini baru saja disambar kilat oleh armada lain!", 'warning');
        fetchAntreanMuatanPasar();
      }
    } catch (err) {
      console.log(err);
      showCustomAlert("Error Koneksi 📡", "Gagal menghubungi satelit PAMILO.", 'error');
    } finally {
      setLoadingAmbil(false);
    }
  };

  const handleSikatMuatan = async (order: OrderMuatan) => {
    const isBarang = order.asal_tabel === 'orders';
    
    try {
      setLoadingAmbil(order.id_asli_uuid);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const payloadUpdate = isBarang 
        ? { kurir_id: session.user.id, status_order: 'DIPROSES' } 
        : { driver_id: session.user.id, status_order: 'MENUJU_JEMPUT' }; 

      const { data: realisasiData } = await supabase.from(order.asal_tabel)
        .update(payloadUpdate)
        .eq('id', order.id_asli_uuid)
        .in('status_order', ['MENCARI_DRIVER', 'MENCARI_KURIR'])
        .is(isBarang ? 'kurir_id' : 'driver_id', null) 
        .select();

      if (!realisasiData || realisasiData.length === 0) {
        showCustomAlert("Gagal Mengunci 😥", "Muatan ini barusan sudah disambar kilat oleh armada lain.", 'warning');
        fetchAntreanMuatanPasar(); 
        return;
      }

      router.push({ 
        pathname: '/driver/tugas-aktif', 
        params: { id: order.id_asli_uuid, asal_tabel: order.asal_tabel } 
      });

    } catch (err) { 
      showCustomAlert("Error 🛑", "Gagal mengunci nota orderan.", 'error');
    } finally { 
      setLoadingAmbil(false); 
    }
  };

  const renderHeader = () => (
    // ... Bagian UI RenderHeader tetap utuh sesuai kode Anda
    <View style={styles.header}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>{driverData.foto ? <Image source={{ uri: driverData.foto }} style={styles.img} contentFit="cover" cachePolicy="disk" /> : <FontAwesome5 name="user-ninja" size={16} color="#4A3525" />}</View>
        <View style={{ flex: 1, marginLeft: 12 }}><Text style={styles.welcomeTxt}>Selamat Bekerja, Mitra!</Text><Text style={styles.name}>{driverData.name}</Text></View>
      </View>

      <View style={[styles.statusBox, isOnline ? styles.cardOpen : styles.cardClosed]}>
        <View style={styles.statusInfo}><FontAwesome5 name="satellite-dish" size={15} color={isOnline ? "#2E7D32" : "#C62828"} /><Text style={styles.statusTitle}>Radar Siap Antar: {isOnline ? 'ONLINE' : 'OFFLINE'}</Text></View>
        <Switch value={isOnline} onValueChange={handleToggleOnline} trackColor={{ false: '#D7CCC8', true: '#A5D6A7' }} thumbColor={isOnline ? '#2E7D32' : '#757575'} />
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.incomeCol}><Text style={styles.statLabel}>Pendapatan Hari Ini</Text><View style={styles.valueRow}><FontAwesome5 name="money-bill-wave" size={13} color="#A5D6A7" style={{ marginRight: 8 }} /><Text style={styles.incomeVal}>Rp {stats.pendapatan.toLocaleString('id-ID')}</Text></View></View>
        <View style={styles.divider} />
        <View style={styles.ritaseCol}><Text style={styles.statLabel}>Ritase Hari Ini</Text><View style={styles.valueRow}><FontAwesome5 name="route" size={12} color="#FFE082" style={{ marginRight: 6 }} /><Text style={styles.ritaseVal}>{stats.ritase} Trip</Text></View></View>
      </View>

      {isOnline && (
        <View style={styles.radarSection}>
          <View style={styles.radarHeaderBox}>
            <Text style={styles.radarHeaderTitle}>📡 SATELIT RADAR TERDEKAT</Text>
            <ActivityIndicator size="small" color="#D35400" animating={refreshing} />
          </View>
          
          <View style={styles.mapWrapper}>
            <MapView style={styles.liveMapStyle} region={petaRegion} showsUserLocation showsMyLocationButton showsCompass>
              {muatanList.map((muatan) => {
                const isMigo = muatan.asal_tabel === 'migo_orders';
                const isFood = muatan.tipe_layanan === 'PAMILO_FOOD';
                const isServis = muatan.tipe_layanan === 'PAMILO_SERVIS';
                
                let iconName = 'cube';
                let bgWarna = '#0277BD'; 
                let labelJemput = 'Toko/Mart';

                if (isMigo) { iconName = 'body'; bgWarna = '#2E7D32'; labelJemput = 'Penumpang MIGO'; }
                else if (isFood) { iconName = 'fast-food'; bgWarna = '#E65100'; labelJemput = 'Resto/Warung FOOD'; }
                else if (isServis) { iconName = 'build'; bgWarna = '#6A1B9A'; labelJemput = 'Ahli SERVIS'; }

                return (
                  <React.Fragment key={`geo-${muatan.id_asli_uuid}`}>
                    <Marker coordinate={{ latitude: muatan.latitude_jemput, longitude: muatan.longitude_jemput }} title={`Jemput: ${labelJemput}`} description={`Nota #${muatan.id_nota}`}>
                      <View style={[styles.customMarkerCircle, { backgroundColor: bgWarna }]}><Ionicons name={iconName as any} size={12} color="#fff" /></View>
                    </Marker>
                    <Marker coordinate={{ latitude: muatan.latitude_kirim, longitude: muatan.longitude_kirim }} title="Tujuan Akhir" description={`Tarif Bersih: Rp ${muatan.ongkir_kurir.toLocaleString('id-ID')}`}>
                      <View style={[styles.customMarkerCircle, { backgroundColor: '#C62828' }]}><Ionicons name="location" size={12} color="#fff" /></View>
                    </Marker>
                  </React.Fragment>
                );
              })}
            </MapView>
            {muatanList.length === 0 && (
              <View style={styles.mapEmptyOverlay}>
                <FontAwesome5 name="check-circle" size={24} color="#FFF" style={{marginBottom: 8}}/>
                <Text style={styles.mapEmptyText}>Area Satelit Terpantau Bersih</Text>
              </View>
            )}
          </View>

          {muatanList.map((muatan) => {
            const isMigo = muatan.asal_tabel === 'migo_orders';
            const isFood = muatan.tipe_layanan === 'PAMILO_FOOD';
            const isServis = muatan.tipe_layanan === 'PAMILO_SERVIS';
            
            let iconCard = 'box';
            let textPelanggan = '🛍️ Pelanggan: ';
            let textBtnSikat = 'Sikat Belanjaan & Antar';
            let iconBtnSikat = 'truck';

            if (isMigo) { iconCard = 'user-alt'; textPelanggan = '👤 Penumpang: '; iconBtnSikat = 'motorcycle'; textBtnSikat = 'Sikat Penumpang & Jalan'; }
            else if (isFood) { iconCard = 'hamburger'; textPelanggan = '🍔 Pelanggan: '; iconBtnSikat = 'motorcycle'; textBtnSikat = 'Sikat Makanan & Antar'; }
            else if (isServis) { iconCard = 'wrench'; textPelanggan = '🛠️ Pelanggan: '; iconBtnSikat = 'tools'; textBtnSikat = 'Ambil Tugas Servis'; }

            return (
              <TouchableOpacity key={muatan.id_asli_uuid} style={styles.muatanCard} activeOpacity={0.9} onPress={() => setPetaRegion({ latitude: muatan.latitude_jemput, longitude: muatan.longitude_jemput, latitudeDelta: 0.02, longitudeDelta: 0.02 })}>
                <View style={styles.cardHeader}>
                  <View style={styles.roseBrandColumn}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <FontAwesome5 name={iconCard} size={10} color="#111" />
                      <Text style={styles.notaText}>NOTA: #{muatan.id_nota}</Text>
                    </View>
                    <Text style={styles.timeText}>Masuk: {muatan.created_at}</Text>
                  </View>
                  <View style={styles.ongkirBox}>
                    <Text style={styles.ongkirValue}>Rp {muatan.ongkir_kurir.toLocaleString('id-ID')}</Text>
                  </View>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.pointName}>{textPelanggan}{muatan.nama_pemesan}</Text>
                  <Text style={styles.pointSubText} numberOfLines={1}>{isServis ? '🏁 Titik Pengerjaan' : '🏁 Antar ke'}: Sembunyikan Detail</Text>
                </View>
                <View style={styles.cardFooter}>
                  {loadingAmbil === muatan.id_asli_uuid ? <ActivityIndicator size="small" color="#D35400" style={{ marginRight: 16 }} /> : (
                    <TouchableOpacity style={[styles.btnSikat, isServis && {backgroundColor: '#6A1B9A'}, isFood && {backgroundColor: '#E65100'}, isMigo && {backgroundColor: '#2E7D32'}]} onPress={() => handleSikatMuatan(muatan)}>
                      <FontAwesome5 name={iconBtnSikat} size={12} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.btnSikatText}>{textBtnSikat}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Arus Riwayat & Tugas Berjalan</Text>
    </View>
  );

  if (loading) return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color="#4A3525" /></View>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />
      <FlatList
        data={daftarTrip}
        keyExtractor={item => item.id}
        ListHeaderComponent={renderHeader}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); syncDashboardData(false); fetchAntreanMuatanPasar(); }} colors={['#4A3525']} />}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.tripCard, item.isActive ? styles.tripActive : styles.tripDone]} 
            onPress={() => {
              if (item.isActive) {
                router.push({ pathname: '/driver/tugas-aktif', params: { id: item.id, asal_tabel: item.asal } });
              } else {
                router.push({ pathname: '/orders/detail', params: { id: item.id } });
              }
            }}
          >
            <View style={styles.tripHeader}>
              <View style={[styles.badge, { backgroundColor: item.isActive ? '#E74C3C' : '#E8F5E9' }]}><Text style={{ color: item.isActive ? '#fff' : '#2E7D32', fontSize: 9, fontWeight: '900' }}>{item.isActive ? '🔥 AKTIF' : item.status}</Text></View>
              <Text style={styles.tripType}>{item.type}</Text>
            </View>
            <Text style={styles.tripRute} numberOfLines={2}>{item.rute}</Text>
            <View style={styles.tripFooter}>
              <Text style={styles.tripTime}>{new Date(item.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</Text>
              <Text style={[styles.tripPrice, { color: item.isActive ? '#E74C3C' : '#2E7D32' }]}>Rp {item.income.toLocaleString()}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<View style={styles.centerEmpty}><Text style={styles.emptyText}>Belum ada riwayat trip hari ini.</Text></View>}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      />

      {/* 🔴 MODAL ORDERAN TETAP DIJAGA AGAR TIDAK BREAK KETIKA TOMBOL "TERIMA" DARI APP/_LAYOUT DIKLIK ATAU DIKIRIM PARAMETER */}
      <Modal visible={orderModal.visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.alertCard}>
            <View style={styles.alertIconBg}><FontAwesome5 name="bell" size={22} color="#fff" /></View>
            <Text style={styles.alertHeading}>ORDERAN MASUK!</Text>
            <View style={styles.alertData}>
              <Text style={styles.alertLabel}>👤 NAMA PELANGGAN:</Text>
              <Text style={styles.alertVal}>{orderModal.data?.nama || 'Warga PAMILO'}</Text>
              <View style={styles.alertPriceBox}>
                <Text style={styles.alertPriceLabel}>PENDAPATAN BERSIH DRIVER:</Text>
                <Text style={styles.alertPriceVal}>Rp {Number(orderModal.data?.ongkir || 0).toLocaleString('id-ID')}</Text>
              </View>
            </View>
            <View style={styles.alertBtnRow}>
              <TouchableOpacity style={styles.btnReject} onPress={async () => { await stopNotificationSound(); setOrderModal({ visible: false, data: null }); }}><Text style={{ color: '#616161', fontWeight: 'bold' }}>LEWATI</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnAccept} onPress={ambilOrderan} disabled={loadingAmbil === true}>{loadingAmbil === true ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>TERIMA</Text>}</TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={infoModal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.infoModalCard}>
            <View style={[styles.infoIconCircle, { 
              backgroundColor: infoModal.type === 'error' ? '#C62828' : (infoModal.type === 'warning' ? '#D35400' : '#2E7D32') 
            }]}>
              <Ionicons 
                name={infoModal.type === 'error' ? 'close-outline' : (infoModal.type === 'warning' ? 'warning-outline' : 'checkmark-outline')} 
                size={36} color="#fff" 
              />
            </View>
            <Text style={styles.infoModalTitle}>{infoModal.title}</Text>
            <Text style={styles.infoModalMessage}>{infoModal.message}</Text>
            <TouchableOpacity 
              style={[styles.btnInfoClose, { 
                backgroundColor: infoModal.type === 'error' ? '#C62828' : (infoModal.type === 'warning' ? '#D35400' : '#2E7D32') 
              }]} 
              onPress={() => setInfoModal({ ...infoModal, visible: false })}
            >
              <Text style={styles.btnInfoCloseText}>MENGERTI</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}



const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5' }, 
  headerWalletBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8F4', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginRight: 10, borderWidth: 1, borderColor: '#FFCCBC' },
  headerWalletTxt: { color: '#4A3525', fontWeight: '900', fontSize: 12 },
  header: { padding: 16 },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 12, borderWidth: 1, borderColor: '#EFEBE9', marginBottom: 12, elevation: 0.5 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F5EBE6', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#E0D4CE' },
  img: { width: '100%', height: '100%' },
  welcomeTxt: { fontSize: 10, fontWeight: 'bold', color: '#BCAAA4' },
  name: { fontWeight: '900', color: '#4A3525', fontSize: 14, textTransform: 'capitalize' },
  statusBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1, marginBottom: 12 },
  cardOpen: { backgroundColor: '#E8F5E9', borderColor: '#C8E6C9' },
  cardClosed: { backgroundColor: '#FFEBEE', borderColor: '#FFCDD2' },
  statusInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusTitle: { fontWeight: 'bold', color: '#111', fontSize: 12 },
  statsContainer: { flexDirection: 'row', backgroundColor: '#4A3525', borderRadius: 20, padding: 16, alignItems: 'center', justifyContent: 'space-between', elevation: 3, marginBottom: 16 },
  incomeCol: { flex: 1.8 },
  ritaseCol: { flex: 1, alignItems: 'center' },
  divider: { width: 1, height: 35, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 8 },
  statLabel: { fontSize: 10, color: '#FFF3E0', fontWeight: '700', textTransform: 'uppercase' },
  valueRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  incomeVal: { fontSize: 20, fontWeight: '900', color: '#fff' },
  ritaseVal: { fontSize: 20, fontWeight: '900', color: '#FFE082' },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', color: '#A1887F', letterSpacing: 1.2, marginBottom: 12, textTransform: 'uppercase' },
  
  radarSection: { backgroundColor: '#FFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#FFCCBC', marginBottom: 16, elevation: 1 },
  radarHeaderBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  radarHeaderTitle: { fontSize: 12, fontWeight: '900', color: '#D35400' },
  mapWrapper: { height: 200, width: '100%', borderRadius: 14, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: '#EFEBE9', position: 'relative' },
  liveMapStyle: { ...StyleSheet.absoluteFillObject },
  customMarkerCircle: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff', elevation: 3 },
  mapEmptyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  mapEmptyText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  muatanCard: { backgroundColor: '#FDFCFB', borderRadius: 12, borderWidth: 1, borderColor: '#EFEBE9', marginBottom: 10, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FAFAFA', padding: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  roseBrandColumn: { flex: 1 }, 
  notaText: { fontSize: 11, fontWeight: 'bold', color: '#111', fontFamily: 'monospace' },
  timeText: { fontSize: 9, color: '#A1887F', marginTop: 3 }, 
  ongkirBox: { alignItems: 'flex-end' },
  ongkirValue: { fontSize: 13, fontWeight: '900', color: '#2E7D32' },
  cardBody: { padding: 10 }, 
  pointName: { fontSize: 11, fontWeight: 'bold', color: '#111' },
  pointSubText: { fontSize: 10, color: '#5D4037', marginTop: 4 },
  cardFooter: { paddingHorizontal: 10, paddingBottom: 10, flexDirection: 'row', justifyContent: 'flex-end' },
  btnSikat: { backgroundColor: '#111', flexDirection: 'row', height: 30, paddingHorizontal: 14, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  btnSikatText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  tripCard: { borderRadius: 16, padding: 14, marginBottom: 12, marginHorizontal: 16, borderWidth: 1 },
  tripActive: { backgroundColor: '#FFF5F5', borderColor: '#FADBD8', borderWidth: 1.5 },
  tripDone: { backgroundColor: '#fff', borderColor: '#EFEBE9' },
  tripHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tripType: { fontSize: 10, fontWeight: 'bold', color: '#4A3525' },
  tripRute: { fontSize: 12, color: '#1A0F05', fontWeight: 'bold', marginTop: 10 },
  tripFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, borderTopWidth: 1, borderTopColor: '#FAF8F5', paddingTop: 8 },
  tripTime: { fontSize: 10, color: '#9E9E9E' },
  tripPrice: { fontSize: 13, fontWeight: '900' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  alertCard: { width: width - 40, backgroundColor: '#fff', borderRadius: 24, padding: 20, alignItems: 'center' },
  alertIconBg: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#4A3525', justifyContent: 'center', alignItems: 'center' },
  alertHeading: { fontSize: 16, fontWeight: '900', color: '#111', marginTop: 15 },
  alertData: { width: '100%', backgroundColor: '#FFF8F4', borderRadius: 16, padding: 15, marginVertical: 15 },
  alertLabel: { fontSize: 9, fontWeight: 'bold', color: '#A1887F', marginBottom: 4 },
  alertVal: { fontSize: 14, fontWeight: '800', color: '#4A3525', marginBottom: 10 },
  alertPriceBox: { marginTop: 10, alignItems: 'center', borderTopWidth: 1, borderColor: '#FFCCBC', paddingTop: 10 },
  alertPriceLabel: { fontSize: 9, fontWeight: 'bold', color: '#A1887F' },
  alertPriceVal: { fontSize: 22, fontWeight: '900', color: '#2E7D32' },
  alertBtnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  btnReject: { flex: 1, backgroundColor: '#F5F5F5', padding: 15, borderRadius: 15, alignItems: 'center' },
  btnAccept: { flex: 2, backgroundColor: '#2E7D32', padding: 15, borderRadius: 15, alignItems: 'center' },
  centerEmpty: { marginTop: 50, alignItems: 'center' },
  emptyText: { color: '#8D6E63', fontStyle: 'italic', fontSize: 12 },

  infoModalCard: { width: width - 60, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, alignItems: 'center', elevation: 10 },
  infoIconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16, marginTop: -10, borderWidth: 4, borderColor: '#FFF', elevation: 2 },
  infoModalTitle: { fontSize: 16, fontWeight: '900', color: '#111', textAlign: 'center', marginBottom: 8 },
  infoModalMessage: { fontSize: 12, color: '#5D4037', textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  btnInfoClose: { width: '100%', paddingVertical: 14, borderRadius: 14, alignItems: 'center', elevation: 2 },
  btnInfoCloseText: { color: '#FFF', fontWeight: 'bold', fontSize: 12, letterSpacing: 1 }
});