// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  ActivityIndicator, StatusBar, Linking, Platform, Vibration, Dimensions, Modal, Image 
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av'; 
import * as Location from 'expo-location'; 
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../supabaseConfig';

const { width, height } = Dimensions.get('window');

const formatRupiah = (angka: number) => 'Rp ' + (angka || 0).toLocaleString('id-ID');

export default function TugasAktifKurirScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  
  const [orderAktif, setOrderAktif] = useState<any>(null);
  const [tugasItems, setTugasItems] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  
  const [showSelesaiModal, setShowSelesaiModal] = useState(false);
  const [showUnder5MinModal, setShowUnder5MinModal] = useState(false); 
  const [ringkasanFinansial, setRingkasanFinansial] = useState<any | null>(null);

  const [showChatModal, setShowChatModal] = useState(false);
  const [pesanChatMasuk, setPesanChatMasuk] = useState('');
  const [pengirimChatId, setPengirimChatId] = useState('');
  const [unreadsChatCount, setUnreadsChatCount] = useState(0);

  const [pilarTugas, setPilarTugas] = useState<'FOOD' | 'MART' | 'MIGO'>('MART');

  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', isConfirm: false, onConfirm: () => {}, confirmText: 'OK', cancelText: 'Batal' });
  const showAlert = (title: string, message: string, isConfirm = false, onConfirm = () => setAlertConfig(p => ({...p, visible: false})), confirmText = 'OK', cancelText = 'Batal') => {
    setAlertConfig({ visible: true, title, message, isConfirm, onConfirm, confirmText, cancelText });
  };
  const closeAlert = () => setAlertConfig(p => ({...p, visible: false}));

  useEffect(() => { fetchTugasSekarang(); }, [params.id]);

  useEffect(() => {
    if (!orderAktif?.id) return;
    let pemantauGps: Location.LocationSubscription | null = null;
    let channelPelacak: any = null;
    let waktuKirimTerakhir = 0; 

    const mulaiPancarkanRadar = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      await AsyncStorage.setItem('ACTIVE_ORDER_ID', orderAktif.id);

      channelPelacak = supabase.channel(`live-tracking-${orderAktif.id}`, {
        config: { broadcast: { self: false, ack: false } }
      });
      
      channelPelacak.subscribe(async (statusSubscribe: string) => {
        if (statusSubscribe === 'SUBSCRIBED') {
          console.log("📡 Satelit Pemancar GPS Driver Aktif Meluncur!");
          pemantauGps = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
            (lokasi) => {
              const waktuSekarang = Date.now();
              if (waktuSekarang - waktuKirimTerakhir > 4000) {
                waktuKirimTerakhir = waktuSekarang;
                channelPelacak.send({
                  type: 'broadcast', event: 'POSISI_DRIVER_UPDATE',
                  payload: { lat: lokasi.coords.latitude, lng: lokasi.coords.longitude }
                }).catch(() => {}); 
              }
            }
          );
        }
      });
    };

    mulaiPancarkanRadar();

    return () => {
      AsyncStorage.removeItem('ACTIVE_ORDER_ID');
      if (pemantauGps) pemantauGps.remove();
      if (channelPelacak) supabase.removeChannel(channelPelacak);
    };
  }, [orderAktif?.id]);

  useEffect(() => {
    if (!orderAktif?.id) return;
    const safeId = orderAktif.id;

    const channelNotifChatDriver = supabase
      .channel(`live-driver-channel-stream-${safeId}`)
      
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `order_id=eq.${safeId}` }, async (payload) => {
        const pesanBaru = payload.new;
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (sessionData?.session?.user && pesanBaru.sender_id !== sessionData.session.user.id) {
          Vibration.vibrate([0, 300, 150, 300]);
          try {
            const { sound } = await Audio.Sound.createAsync(
              require('../../assets/sounds/migo.mp3'), 
              { shouldPlay: true, isLooping: false, volume: 1.0 }
            );
            sound.setOnPlaybackStatusUpdate((status) => { if (status.didJustFinish) sound.unloadAsync(); });
          } catch (err) {}

          setPesanChatMasuk(pesanBaru.text_message || pesanBaru.message || 'Mengirim pesan...');
          setPengirimChatId(pesanBaru.sender_id);
          setUnreadsChatCount(prev => prev + 1);
          setShowChatModal(true);
        }
      })
      
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'migo_orders', filter: `id=eq.${safeId}` }, (payload) => {
        const orderTerupdate = payload.new;
        setOrderAktif((prev: any) => prev ? { ...prev, status_order: orderTerupdate.status_order } : prev);

        if (orderTerupdate.status_order === 'SELESAI') {
          // 🚀 ENGINE AKUNTANSI DRIVER REALTIME SINKRON
          const ongkosTrip = Number(orderTerupdate.total_pembayaran || 0);
          const biayaLayananApp = Number(orderTerupdate.biaya_layanan || orderTerupdate.biaya_aplikasi || 1000);
          const totalKeseluruhan = ongkosTrip + biayaLayananApp;

          Vibration.vibrate([0, 200, 100, 500]);
          setRingkasanFinansial({
            ...orderTerupdate, tarif_total: totalKeseluruhan,
            metode_bayar: String(orderTerupdate.metode_pembayaran || 'TUNAI').toUpperCase()
          });
          setShowSelesaiModal(true);
        } else if (orderTerupdate.status_order === 'DIBATALKAN') {
          Vibration.vibrate([0, 500, 200, 500]);
          showAlert("Dibatalkan 🚨", "Penumpang membatalkan pesanan.", false, () => { closeAlert(); router.replace('/driver'); });
        }
      })
      
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${safeId}` }, (payload) => {
        const orderTerupdate = payload.new;
        setOrderAktif((prev: any) => prev ? { ...prev, status_order: orderTerupdate.status_order } : prev);

        if (orderTerupdate.status_order === 'SELESAI') {
          const ongkosTrip = Number(orderTerupdate.biaya_ongkir || 0);
          const biayaLayananApp = Number(orderTerupdate.biaya_penanganan || 0) + Number(orderTerupdate.biaya_admin || 0);
          const totalHargaBarang = Number(orderTerupdate.total_harga_barang || 0);
          const totalKeseluruhan = totalHargaBarang + ongkosTrip + biayaLayananApp;

          Vibration.vibrate([0, 200, 100, 500]);
          setRingkasanFinansial({
            ...orderTerupdate, tarif_total: totalKeseluruhan,
            metode_bayar: String(orderTerupdate.metode_pembayaran || 'TUNAI').toUpperCase()
          });
          setShowSelesaiModal(true);
        } else if (orderTerupdate.status_order === 'DIBATALKAN') {
          Vibration.vibrate([0, 500, 200, 500]);
          showAlert("Dibatalkan 🚨", "Pesanan dibatalkan oleh sistem/pembeli.", false, () => { closeAlert(); router.replace('/driver'); });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channelNotifChatDriver); };
  }, [orderAktif?.id]);

  const fetchTugasSekarang = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const uid = session.user.id;

      let tugasDitemukan = null;
      let targetPilar = 'MART';
      const safeId = params.id ? (Array.isArray(params.id) ? params.id[0] : params.id) : null;

      let resMigo, resOrders;

      if (safeId) {
        resMigo = await supabase.from('migo_orders').select('*').eq('id', safeId).maybeSingle();
        resOrders = await supabase.from('orders').select('*').eq('id', safeId).maybeSingle();
      } else {
        resMigo = await supabase.from('migo_orders').select('*').eq('driver_id', uid).in('status_order', ['MENUJU_JEMPUT', 'DIANTAR', 'DIPROSES']).order('created_at', { ascending: false }).limit(1).maybeSingle();
        resOrders = await supabase.from('orders').select('*').eq('kurir_id', uid).in('status_order', ['DIKIRIM', 'DIPROSES', 'MENUJU_JEMPUT']).order('created_at', { ascending: false }).limit(1).maybeSingle();
      }

      if (resMigo.data) {
          tugasDitemukan = { ...resMigo.data, asal_tabel: 'migo_orders' }; 
          targetPilar = 'MIGO';
      } else if (resOrders.data) {
          tugasDitemukan = { ...resOrders.data, asal_tabel: 'orders' };
          const layanan = String(resOrders.data.layanan || '').toUpperCase();
          if (layanan.includes('FOOD') || layanan.includes('MAKANAN')) targetPilar = 'FOOD';
          else targetPilar = 'MART'; 
      }

      if (tugasDitemukan) {
        if (tugasDitemukan.pembeli_id) {
          const { data: userD } = await supabase.from('users').select('*').eq('user_id', tugasDitemukan.pembeli_id).maybeSingle();
          tugasDitemukan.users = userD || {};
        }
        
        if (targetPilar !== 'MIGO' && tugasDitemukan.penjual_id) {
          const { data: tokoD } = await supabase.from('toko').select('*').eq('id_toko', tugasDitemukan.penjual_id).maybeSingle();
          tugasDitemukan.toko = tokoD || null;
        }

        if (targetPilar !== 'MIGO') {
          const { data: items } = await supabase.from('order_items').select('*, produk(*)').eq('order_id', tugasDitemukan.id);
          if (items) setTugasItems(items);
        }

        setPilarTugas(targetPilar as any);
        setOrderAktif(tugasDitemukan);
      } else {
        setOrderAktif(null);
      }

    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  const navigasiKeTitik = (lat: number, lon: number, label: string) => {
    if (!lat || !lon) return showAlert("GPS Absen", "Titik koordinat belum terkunci di sistem.");
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${lat},${lon}`;
    const url = Platform.select({ ios: `${scheme}${label}@${latLng}`, android: `${scheme}${latLng}(${label})` });
    if (url) Linking.openURL(url);
  };

  const handleSudahSampaiToko = async () => {
    try {
      setLoadingAction(true);
      const statusBaru = orderAktif.asal_tabel === 'migo_orders' ? 'DIANTAR' : 'DIKIRIM';
      await supabase.from(orderAktif.asal_tabel).update({ status_order: statusBaru }).eq('id', orderAktif.id);
      Vibration.vibrate([0, 100, 100, 100]);
      setOrderAktif(prev => ({ ...prev, status_order: statusBaru }));
    } catch (err: any) { showAlert("Gagal", err.message); } 
    finally { setLoadingAction(false); }
  };

  const handleSelesaikanTugasFinis = async () => {
    const waktuDibuat = new Date(orderAktif.created_at).getTime();
    if ((Date.now() - waktuDibuat) / 60000 < 5) {
      setShowUnder5MinModal(true); return;
    }

    showAlert("Konfirmasi Selesai 🏁", "Apakah Mitra sudah menuntaskan pengantaran ini?", true, async () => {
        closeAlert();
        try {
          setLoadingAction(true);
          const { data, error } = await supabase.from(orderAktif.asal_tabel).update({ status_order: 'SELESAI' }).eq('id', orderAktif.id).select().single();
          if (error) throw error;

          // 🚀 ENGINE AKUNTANSI DRIVER MANUAL KLIK
          let totalKeseluruhan = 0;
          if (orderAktif.asal_tabel === 'migo_orders') {
            const ongkosTrip = Number(orderAktif.total_pembayaran || 0);
            const biayaLayananApp = Number(orderAktif.biaya_layanan || orderAktif.biaya_aplikasi || 1000);
            totalKeseluruhan = ongkosTrip + biayaLayananApp;
          } else {
            const ongkosTrip = Number(orderAktif.biaya_ongkir || 0);
            const biayaLayananApp = Number(orderAktif.biaya_penanganan || 0) + Number(orderAktif.biaya_admin || 0);
            const totalHargaBarang = Number(orderAktif.total_harga_barang || 0);
            totalKeseluruhan = totalHargaBarang + ongkosTrip + biayaLayananApp;
          }

          Vibration.vibrate(800); 
          setRingkasanFinansial({
            ...data, tarif_total: totalKeseluruhan,
            metode_bayar: String(orderAktif.metode_pembayaran || 'TUNAI').toUpperCase()
          });
          setShowSelesaiModal(true); 

        } catch (err: any) { showAlert("Gagal", err.message); } 
        finally { setLoadingAction(false); }
    }, "Sudah Selesai! 🚀", "Belum");
  };

  const handleBatalDaruratKurir = async () => {
    showAlert("Peringatan Pembatalan", "Melepas orderan dapat menurunkan performa akun driver Anda. Lanjutkan?", true, async () => {
        closeAlert();
        try {
          setLoadingAction(true);
          await supabase.from(orderAktif.asal_tabel).update({ 
              status_order: orderAktif.asal_tabel === 'migo_orders' ? 'MENCARI_DRIVER' : 'MENCARI_KURIR',
              driver_id: null, kurir_id: null   
            }).eq('id', orderAktif.id);
          router.replace('/driver');
        } catch (err: any) {} finally { setLoadingAction(false); }
    }, "Ya, Lepas Orderan", "Jangan");
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#4A3525" /></View>;

  if (!orderAktif) return (
    <View style={styles.mainWrapper}>
      <Stack.Screen options={{ headerTitle: 'Panduan Rute', headerStyle: { backgroundColor: '#1A0F05' }, headerTintColor: '#fff' }} />
      <View style={styles.center}>
        <FontAwesome5 name="route" size={44} color="#D7CCC8" style={{ marginBottom: 16 }} />
        <Text style={styles.emptyText}>Rekan Driver tidak memiliki tugas aktif yang sedang berjalan saat ini.</Text>
        <TouchableOpacity style={styles.btnBack} onPress={() => router.replace('/driver')}>
          <Text style={{color:'#fff', fontWeight:'bold', fontSize: 12}}>Kembali ke Beranda</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const isFaseJemput = orderAktif.status_order === 'MENUJU_JEMPUT' || orderAktif.status_order === 'DIPROSES';
  const isFaseSelesai = orderAktif.status_order === 'SELESAI'; 
  
  const targetMapLat = isFaseJemput ? parseFloat(orderAktif.latitude_jemput) : parseFloat(orderAktif.latitude_tujuan);
  const targetMapLon = isFaseJemput ? parseFloat(orderAktif.longitude_jemput) : parseFloat(orderAktif.longitude_tujuan);
  const mapRegion = { latitude: targetMapLat || -7.3262, longitude: targetMapLon || 108.3532, latitudeDelta: 0.005, longitudeDelta: 0.005 };

  let mapLabelStr = 'Titik Tujuan';
  let bottomBtnText = 'TUGAS SELESAI 🏁';
  let pillText = 'FASE ANTAR TUJUAN';
  let pilarColor = '#2E7D32'; 

  if (isFaseSelesai) {
      pilarColor = '#64748B';
      pillText = 'ORDER SELESAI 🎉';
      bottomBtnText = 'KEMBALI KE BERANDA 🏁';
      mapLabelStr = 'Selesai';
  } else if (pilarTugas === 'MIGO') {
      pilarColor = isFaseJemput ? '#2E7D32' : '#1B5E20';
      mapLabelStr = isFaseJemput ? 'Titik Jemput Penumpang' : 'Lokasi Tujuan Penumpang';
      pillText = isFaseJemput ? 'MENUJU PENUMPANG' : 'MENGANTAR PENUMPANG';
      bottomBtnText = isFaseJemput ? 'SUDAH BERSAMA PENUMPANG' : 'PENUMPANG SAMPAI 🏁';
  } else {
      pilarColor = isFaseJemput ? '#D35400' : '#A04000';
      mapLabelStr = isFaseJemput ? 'Lokasi Resto/Toko' : 'Lokasi Warga';
      pillText = isFaseJemput ? 'MENUJU TOKO/RESTO' : 'MENGANTAR PESANAN';
      bottomBtnText = isFaseJemput ? 'PESANAN SUDAH DIAMBIL' : 'PESANAN SAMPAI 🏁';
  }

  const chatReceiverId = orderAktif.pembeli_id;
  const dataWarga = orderAktif.users || {};
  const namaWarga = dataWarga.user_name || dataWarga.nama || dataWarga.name || dataWarga.nama_lengkap || 'Warga PAMILO';
  
  let rawFotoUser = dataWarga.user_avatar || dataWarga.avatar_url || dataWarga.foto_profil || dataWarga.foto || dataWarga.photo || dataWarga.foto_wajah || dataWarga.profile_picture || dataWarga.url_foto || null;
  if (String(rawFotoUser).includes('null') || String(rawFotoUser).includes('undefined')) { rawFotoUser = null; }
  const fotoWajahUser = (rawFotoUser && String(rawFotoUser).trim() !== '') ? String(rawFotoUser).trim() : null;

  // 🚀 ENGINE AKUNTANSI DRIVER (Memaparkan Jumlah Tagihan Mutlak)
  const ongkosTrip = pilarTugas === 'MIGO' ? Number(orderAktif.total_pembayaran || 0) : Number(orderAktif.biaya_ongkir || 0);
  const biayaLayananApp = pilarTugas === 'MIGO' ? Number(orderAktif.biaya_layanan || orderAktif.biaya_aplikasi || 1000) : (Number(orderAktif.biaya_penanganan || 0) + Number(orderAktif.biaya_admin || 0));
  const totalBelanjaanKotor = pilarTugas === 'MIGO' ? 0 : tugasItems.reduce((sum, item) => sum + (item.kuantitas * Number(item.harga_satuan)), 0);
  
  // Total Mutlak yang Harus Diambil dari Penumpang
  const grandTotalTagihan = totalBelanjaanKotor + ongkosTrip + biayaLayananApp;

  const labelAlamatJemput = orderAktif.toko?.alamat_toko || orderAktif.alamat_jemput || orderAktif.alamat_penjemputan || 'Menunggu Konfirmasi Toko';
  const labelAlamatAntar = orderAktif.alamat_kirim || orderAktif.alamat_antar || orderAktif.alamat_pengiriman || orderAktif.alamat_tujuan || '-';

  return (
    <View style={styles.containerUat}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <MapView style={StyleSheet.absoluteFillObject} provider={PROVIDER_GOOGLE} region={mapRegion} showsUserLocation>
        {targetMapLat && targetMapLon && (
          <Marker coordinate={{ latitude: targetMapLat, longitude: targetMapLon }}>
            <View style={[styles.markerCircle, {backgroundColor: pilarColor}]}><FontAwesome5 name="map-marker-alt" size={14} color="#fff" /></View>
          </Marker>
        )}
      </MapView>

      <View style={[styles.floatingTopHeader, { top: insets.top + 10 }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.replace('/driver')} style={styles.btnBackTop}><Ionicons name="arrow-back" size={20} color="#fff"/></TouchableOpacity>
          <View style={[styles.fasePill, { backgroundColor: pilarColor }]}><Text style={styles.fasePillText}>{pillText}</Text></View>
          <TouchableOpacity onPress={handleBatalDaruratKurir} style={styles.btnBackTop}><Ionicons name="warning" size={20} color="#FCA5A5"/></TouchableOpacity>
        </View>
      </View>

      <View style={[styles.floatingBottomDetails, { paddingBottom: insets.bottom + 5, maxHeight: height * 0.72 }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
          <Text style={styles.titleInfo}>📋 #{orderAktif.id.substring(0, 8).toUpperCase()} • PAMILO {pilarTugas}</Text>
          
          <View style={styles.rowMitraInfo}>
            {fotoWajahUser ? (
              <Image source={{ uri: fotoWajahUser }} style={styles.avatarWajahAsliUser} resizeMode="cover" />
            ) : (
              <View style={styles.avatarPlaceholder}><FontAwesome5 name="user" size={16} color="#94A3B8" /></View>
            )}
            
            <View style={{ flex: 1 }}>
              <Text style={styles.namaBesar}>{namaWarga}</Text>
              <Text style={{ fontSize: 11, color: '#64748B', fontWeight: 'bold', marginTop: 2 }}>
                {pilarTugas === 'MIGO' ? '🛵 Penumpang MIGO' : '🛍️ Pelanggan PAMILO'}
              </Text>
            </View>

            <View style={styles.actionCircleRow}>
              <TouchableOpacity style={[styles.btnCircleMap, {backgroundColor: pilarColor}]} onPress={() => navigasiKeTitik(targetMapLat, targetMapLon, mapLabelStr)}><Ionicons name="navigate" size={18} color="#fff" /></TouchableOpacity>
              
              <TouchableOpacity style={styles.btnCircleWa} onPress={() => { setUnreadsChatCount(0); router.push({ pathname: `/chat/${orderAktif.id}`, params: { receiver_id: chatReceiverId } }); }}>
                <Ionicons name="chatbubbles" size={18} color="#fff" />
                {unreadsChatCount > 0 && (
                  <View style={styles.badgeAbsoluteDriver}><Text style={styles.badgeTextMiniDriver}>{unreadsChatCount}</Text></View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.pembatasGaris} />

          <Text style={styles.sectionTitle}>🗺️ Rute Perjalanan</Text>
          <View style={styles.migoRouteContainer}>
            <View style={styles.routeRowLine}>
              <FontAwesome5 name="store" size={12} color={pilarTugas === 'MIGO' ? '#2E7D32' : '#D35400'} style={{ marginRight: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.routeLabelMini}>NAMA & ALAMAT {pilarTugas === 'MIGO' ? 'PENJEMPUTAN' : 'TOKO / RESTO'}:</Text>
                {pilarTugas !== 'MIGO' && <Text style={[styles.routeTextValue, { fontWeight: 'bold', color: '#4A3525' }]}>{orderAktif.toko?.nama_toko || 'Mitra Pamilo'}</Text>}
                <Text style={styles.routeTextValue}>{labelAlamatJemput}</Text>
              </View>
            </View>
            <View style={styles.routeGarisHubungVertical} />
            <View style={styles.routeRowLine}>
              <Ionicons name="location" size={16} color="#C0392B" />
              <View style={{ flex: 1 }}>
                <Text style={styles.routeLabelMini}>ALAMAT TUJUAN PENGIRIMAN WARGA:</Text>
                <Text style={styles.routeTextValue}>{labelAlamatAntar}</Text>
              </View>
            </View>
          </View>

          {pilarTugas !== 'MIGO' && tugasItems.length > 0 && (
            <View style={{ marginTop: 12, backgroundColor: '#FAFBFD', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 10, fontWeight: '900', color: '#475569', marginBottom: 6, textTransform: 'uppercase' }}>🛒 ITEM BELANJAAN WARGA:</Text>
              {tugasItems.map((item, idx) => (
                <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: idx !== tugasItems.length - 1 ? 0.5 : 0, borderBottomColor: '#E2E8F0' }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E293B' }}>{item.produk?.nama_produk || 'Item Belanja'}</Text>
                    {item.varian_terpilih && <Text style={{ fontSize: 9, color: '#64748B', fontStyle: 'italic' }}>Varian: {item.varian_terpilih}</Text>}
                    <Text style={{ fontSize: 11, color: '#64748B' }}>{item.kuantitas} Pcs x {formatRupiah(item.harga_satuan)}</Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E293B' }}>{formatRupiah(item.kuantitas * Number(item.harga_satuan))}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 🚀 RINCIAN TAGIHAN TOTAL (Memaparkan Komponen Biaya Layanan Warga) */}
          <View style={{ marginTop: 10, backgroundColor: '#F8FAFB', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
            <Text style={{ fontSize: 10, fontWeight: '900', color: '#64748B', marginBottom: 6, textTransform: 'uppercase' }}>🧾 TOTAL PEMBAYARAN PENUMPANG:</Text>
            
            {pilarTugas !== 'MIGO' && (
              <View style={styles.strukRow}><Text style={styles.strukLabel}>Total Belanja Produk</Text><Text style={styles.strukValue}>{formatRupiah(totalBelanjaanKotor)}</Text></View>
            )}
            <View style={styles.strukRow}><Text style={styles.strukLabel}>{pilarTugas === 'MIGO' ? 'Tarif Perjalanan' : 'Ongkos Kirim'}</Text><Text style={styles.strukValue}>{formatRupiah(ongkosTrip)}</Text></View>
            <View style={styles.strukRow}><Text style={styles.strukLabel}>Biaya Layanan Aplikasi</Text><Text style={styles.strukValue}>{formatRupiah(biayaLayananApp)}</Text></View>
            
            <View style={[styles.strukRow, { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 6, marginTop: 4 }]}>
              <Text style={[styles.strukLabel, { fontWeight: 'bold', color: '#0F172A' }]}>TOTAL TAGIHAN ({String(orderAktif.metode_pembayaran || 'TUNAI').toUpperCase()})</Text>
              <Text style={{ fontSize: 13, fontWeight: '900', color: '#D35400' }}>{formatRupiah(grandTotalTagihan)}</Text>
            </View>
          </View>

          <View style={styles.pembatasGaris} />

          <Text style={{ fontSize: 10, fontWeight: '900', color: '#64748B', marginBottom: 4, textTransform: 'uppercase' }}>💰 TOTAL TAGIHAN ({String(orderAktif.metode_pembayaran || 'TUNAI').toUpperCase()}):</Text>
          <View style={styles.rowTarifActions}>
            <View style={{ flex: 1 }}>
              <Text style={styles.hargaBesar}>{formatRupiah(grandTotalTagihan)}</Text>
              <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>*Sudah termasuk Tarif Utama + Biaya Layanan Aplikasi</Text>
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <TouchableOpacity 
              style={[styles.btnBottomPrimary, { backgroundColor: pilarColor }]} 
              onPress={isFaseSelesai ? () => router.replace('/driver') : (isFaseJemput ? handleSudahSampaiToko : handleSelesaikanTugasFinis)} 
              disabled={loadingAction}
            >
              {loadingAction ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnBottomText}>{bottomBtnText}</Text>}
            </TouchableOpacity>

            {!isFaseSelesai && (
              <TouchableOpacity style={styles.btnBatalDaruratBawahAction} onPress={handleBatalDaruratKurir}>
                <Ionicons name="close-circle" size={16} color="#C0392B" />
                <Text style={styles.textBatalDaruratBawahAction}>Batalkan & Kembalikan Orderan ke Radar</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>

      <Modal visible={alertConfig.visible} transparent={true} animationType="fade" statusBarTranslucent>
        <View style={styles.customAlertOverlay}>
          <View style={styles.customAlertCard}>
            <View style={styles.customAlertIcon}>
               <Ionicons name={alertConfig.title.includes('Batal') || alertConfig.title.includes('Gagal') ? "warning" : "information-circle"} size={32} color={alertConfig.title.includes('Batal') || alertConfig.title.includes('Gagal') ? "#C62828" : "#D35400"} />
            </View>
            <Text style={styles.customAlertTitle}>{alertConfig.title}</Text>
            <Text style={styles.customAlertMessage}>{alertConfig.message}</Text>
            <View style={styles.customAlertRow}>
              {alertConfig.isConfirm && (
                <TouchableOpacity style={styles.btnCustomAlertCancel} onPress={closeAlert}>
                  <Text style={styles.btnCustomAlertCancelText}>{alertConfig.cancelText}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.btnCustomAlertConfirm} onPress={alertConfig.onConfirm}>
                <Text style={styles.btnCustomAlertConfirmText}>{alertConfig.confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showSelesaiModal} transparent={true} animationType="fade" statusBarTranslucent>
        <View style={styles.completionOverlay}>
          <View style={styles.completionCardPremium}>
            <View style={styles.completionIconBg}><FontAwesome5 name="check-double" size={24} color="#fff" /></View>
            <Text style={styles.completionHeading}>ALHAMDULILLAH, SELESAI!</Text>
            {ringkasanFinansial?.metode_bayar === 'TUNAI' ? (
                <>
                    <Text style={{fontSize:11, color:'#757575', marginTop: 10}}>Uang Tunai Yang Diterima:</Text>
                    <Text style={[styles.finValueGreenModal, { color: '#D35400' }]}>{formatRupiah(ringkasanFinansial?.tarif_total || 0)}</Text>
                    <Text style={{fontSize:11, color:'#2E7D32', marginBottom: 20, marginTop: 4, fontWeight: 'bold'}}>Silakan cek rincian potongan di Riwayat Trip</Text>
                </>
            ) : (
                <>
                    <Text style={{fontSize:11, color:'#757575', marginTop: 10}}>Pendapatan Saldo Digital (Total Tagihan):</Text>
                    <Text style={styles.finValueGreenModal}>+ {formatRupiah(ringkasanFinansial?.tarif_total || 0)}</Text>
                    <Text style={{fontSize:11, color:'#2E7D32', marginBottom: 20, marginTop: 4, fontWeight: 'bold'}}>Pembayaran Non-Tunai Berhasil</Text>
                </>
            )}
            <View style={{ width: '100%', gap: 10 }}>
              <TouchableOpacity style={styles.btnCompletionClose} onPress={() => { setShowSelesaiModal(false); router.replace('/driver'); }}>
                <Text style={styles.btnCompletionText}>OK, KEMBALI KE BERANDA</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showUnder5MinModal} transparent={true} animationType="fade" statusBarTranslucent>
        <View style={styles.under5OverlayMain}>
          <View style={styles.under5CardBody}>
            <Ionicons name="time-outline" size={44} color="#E67E22" style={{ marginBottom: 12 }} />
            <Text style={styles.under5TextSacred}>Sistem mendeteksi Orderan Belum Selesai. Jika sudah selesai abaikan peringatan ini, dan tekan selesaikan tugas.</Text>
            <TouchableOpacity style={styles.under5BtnClose} onPress={() => setShowUnder5MinModal(false)}>
              <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 12 }}>Paham, Lanjutkan Kerja 🤝</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showChatModal} transparent={true} animationType="slide" statusBarTranslucent>
        <View style={styles.modalOverlayChat}>
          <View style={[styles.modalCardChat, { borderColor: pilarColor }]}><View style={[styles.alertIconBgChat, { backgroundColor: pilarColor }]}><Ionicons name="chatbubbles" size={24} color="#fff" /></View><Text style={styles.modalTitleHeaderChat}>PESAN MASUK REALTIME</Text><View style={styles.alertDataChat}><Text style={[styles.alertLabelChat, { textAlign: 'center' }]}>Isi Pesan Warga:</Text><Text style={[styles.alertValChat, { textAlign: 'center', fontSize: 14, fontStyle: 'italic' }]}>"{pesanChatMasuk}"</Text></View><View style={styles.buttonActionRowChat}><TouchableOpacity style={styles.btnActionLewatiChat} onPress={() => setShowChatModal(false)}><Text style={styles.btnTextLewatiLabelChat}>TUTUP</Text></TouchableOpacity><TouchableOpacity style={[styles.btnActionTerimaChat, { backgroundColor: pilarColor }]} onPress={() => { setShowChatModal(false); setUnreadsChatCount(0); router.push({ pathname: `/chat/${orderAktif.id}`, params: { receiver_id: pengirimChatId } }); }}><Text style={styles.btnTextTerimaLabelChat}>BALAS PESAN</Text></TouchableOpacity></View></View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  containerUat: { flex: 1, backgroundColor: '#000' }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: '#FAF8F5' }, mainWrapper: { flex: 1, backgroundColor: '#4A3525' }, emptyText: { fontSize: 13, color: '#8D6E63', textAlign: 'center', fontWeight: '500', marginBottom: 16 }, btnBack: { backgroundColor: '#4A3525', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }, markerCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#4A3525', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' }, floatingTopHeader: { position: 'absolute', left: 16, right: 16, zIndex: 10 }, headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, btnBackTop: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', alignItems: 'center' }, fasePill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 }, fasePillText: { color: '#fff', fontWeight: '900', fontSize: 11 }, floatingBottomDetails: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', padding: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 15 }, titleInfo: { fontSize: 11, fontWeight: '800', color: '#94A3B8', marginBottom: 10 }, rowMitraInfo: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 }, avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' }, avatarWajahAsliUser: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#F1F5F9' }, namaBesar: { fontSize: 16, fontWeight: '900', color: '#1E293B' }, pembatasGaris: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 }, rowTarifActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }, labelTarif: { fontSize: 10, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase' }, hargaBesar: { fontSize: 24, fontWeight: '900', color: '#2E7D32', marginTop: 2 }, actionCircleRow: { flexDirection: 'row', gap: 10 }, btnCircleMap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#D35400', justifyContent: 'center', alignItems: 'center' }, btnCircleWa: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', position: 'relative' }, btnBottomPrimary: { width: '100%', height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }, btnBottomText: { color: '#fff', fontWeight: '900', fontSize: 14 }, btnBatalDaruratBawahAction: { flexDirection: 'row', gap: 6, width: '100%', height: 44, borderRadius: 12, backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginTop: 4 }, textBatalDaruratBawahAction: { fontSize: 11, fontWeight: 'bold', color: '#C0392B' }, sectionTitle: { fontSize: 11, fontWeight: '900', color: '#4A3525', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }, migoRouteContainer: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 6 }, routeRowLine: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, routeGarisHubungVertical: { width: 2, height: 12, backgroundColor: '#CBD5E1', marginLeft: 7, marginVertical: 2 }, routeLabelMini: { fontSize: 8, fontWeight: '900', color: '#64748B', letterSpacing: 0.3 }, routeTextValue: { fontSize: 11, color: '#334155', marginTop: 1, lineHeight: 14 }, strukRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }, strukLabel: { fontSize: 11, color: '#64748B' }, strukValue: { fontSize: 11, fontWeight: 'bold', color: '#1E293B' }, completionOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }, completionCardPremium: { width: '85%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center' }, completionIconBg: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#2E7D32', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }, completionHeading: { fontSize: 16, fontWeight: '900', color: '#111', marginBottom: 10 }, finValueGreenModal: { fontSize: 26, fontWeight: '900', color: '#2E7D32', marginBottom: 0 }, btnCompletionClose: { width: '100%', backgroundColor: '#1E293B', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }, btnCompletionText: { color: '#FFF', fontWeight: '900', fontSize: 12 }, under5OverlayMain: { flex: 1, backgroundColor: 'rgba(15,23,42,0.9)', justifyContent: 'center', alignItems: 'center' }, under5CardBody: { width: '80%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', elevation: 10 }, under5TextSacred: { fontSize: 12, fontWeight: '600', color: '#0F172A', textAlign: 'center', marginVertical: 10, lineHeight: 18 }, under5BtnClose: { backgroundColor: '#1E293B', width: '100%', height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 14 }, modalOverlayChat: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 }, modalCardChat: { backgroundColor: '#FFFFFF', width: '100%', borderRadius: 24, padding: 22, borderWidth: 2, alignItems: 'center', elevation: 10 }, alertIconBgChat: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 10, marginTop: -5 }, modalTitleHeaderChat: { fontSize: 16, fontWeight: '900', color: '#111', textAlign: 'center', marginBottom: 15 }, alertDataChat: { width: '100%', backgroundColor: '#FFF8F4', borderRadius: 16, padding: 15, marginBottom: 20, borderWidth: 1, borderColor: '#FFCCBC' }, alertLabelChat: { fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 4 }, alertValChat: { fontSize: 13, fontWeight: '800', color: '#0F172A', lineHeight: 18 }, buttonActionRowChat: { flexDirection: 'row', width: '100%', gap: 10 }, btnActionLewatiChat: { flex: 1, backgroundColor: '#F1F5F9', height: 48, borderRadius: 15, justifyContent: 'center', alignItems: 'center' }, btnTextLewatiLabelChat: { color: '#475569', fontWeight: 'bold', fontSize: 14 }, btnActionTerimaChat: { flex: 2, height: 48, borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 2 }, btnTextTerimaLabelChat: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  badgeAbsoluteDriver: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 1, borderColor: '#fff' }, badgeTextMiniDriver: { color: '#fff', fontSize: 9, fontWeight: '900' },
  customAlertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 }, customAlertCard: { width: '100%', backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center', elevation: 15 }, customAlertIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }, customAlertTitle: { fontSize: 16, fontWeight: '900', color: '#1A0F05', textAlign: 'center', marginBottom: 8 }, customAlertMessage: { fontSize: 13, color: '#475569', textAlign: 'center', marginBottom: 24, lineHeight: 20 }, customAlertRow: { flexDirection: 'row', gap: 12, width: '100%' }, btnCustomAlertCancel: { flex: 1, backgroundColor: '#F1F5F9', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }, btnCustomAlertCancelText: { color: '#475569', fontWeight: 'bold', fontSize: 13 }, btnCustomAlertConfirm: { flex: 1, backgroundColor: '#D35400', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }, btnCustomAlertConfirmText: { color: '#fff', fontWeight: 'bold', fontSize: 13 }
});