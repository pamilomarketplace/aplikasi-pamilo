// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, ActivityIndicator,
  StatusBar, Image, TouchableOpacity, Dimensions, Modal, Vibration 
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '../../supabaseConfig';

const { width } = Dimensions.get('window');

export default function SmartDetailOrderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams(); 

  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [orderNotFound, setOrderNotFound] = useState(false);
  
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [driverData, setDriverData] = useState<any>(null);
  const [tokoData, setTokoData] = useState<any>(null);
  
  const [driverLivePos, setDriverLivePos] = useState<{ latitude: number; longitude: number } | null>(null);
  const [petaRegion, setPetaRegion] = useState<any>(null);

  const [tipeLayanan, setTipeLayanan] = useState<'FOOD' | 'MART' | 'SERVIS' | 'MIGO'>('MART');
  
  const [showSelesaiModal, setShowSelesaiModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [pesanChatMasuk, setPesanChatMasuk] = useState('');
  const [unreadsChatCount, setUnreadsChatCount] = useState(0);
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const prevStatusRef = useRef<string | null>(null);

  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', isConfirm: false, onConfirm: () => {}, confirmText: 'OK', cancelText: 'Batal' });
  const showAlert = (title: string, message: string, isConfirm = false, onConfirm = () => setAlertConfig(p => ({...p, visible: false})), confirmText = 'OK', cancelText = 'Batal') => {
    setAlertConfig({ visible: true, title, message, isConfirm, onConfirm, confirmText, cancelText });
  };
  const closeAlert = () => setAlertConfig(p => ({...p, visible: false}));

  const fetchSmartOrderDetail = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) setLoading(true);
      
      const safeId = Array.isArray(id) ? id[0] : id;
      if (!safeId) {
        setOrderNotFound(true); setLoading(false); return;
      }

      let dataSasis = null;
      let targetTabel = '';
      let pilarLayanan = 'MART';

      const { data: orderMigo } = await supabase.from('migo_orders').select('*').eq('id', safeId).maybeSingle();
        
      if (orderMigo) {
        dataSasis = orderMigo;
        targetTabel = 'migo_orders';
        pilarLayanan = 'MIGO';
      } else {
        const { data: orderPasar } = await supabase.from('orders').select('*').eq('id', safeId).maybeSingle();
        if (orderPasar) {
          dataSasis = orderPasar;
          targetTabel = 'orders';
          const layanan = String(orderPasar.layanan || '').toUpperCase();
          if (layanan.includes('SERVIS') || layanan.includes('JASA')) pilarLayanan = 'SERVIS';
          else if (layanan.includes('FOOD') || layanan.includes('MAKANAN')) pilarLayanan = 'FOOD';
        }
      }

      if (!dataSasis) {
        setOrderNotFound(true); setLoading(false); return;
      }

      if (dataSasis.pembeli_id) {
        const { data: uD } = await supabase.from('users').select('*').eq('user_id', dataSasis.pembeli_id).maybeSingle();
        dataSasis.users = uD || { user_name: 'Warga PAMILO' };
      }

      if (targetTabel === 'orders' && dataSasis.penjual_id) {
        const { data: tD } = await supabase.from('toko').select('*').eq('id_toko', dataSasis.penjual_id).maybeSingle();
        if (tD) setTokoData(tD);
        
        const { data: items } = await supabase.from('order_items').select('*, produk(*)').eq('order_id', safeId);
        if (items && items.length > 0) setOrderItems(items);
      }

      setTipeLayanan(pilarLayanan as any);
      setOrderData({ ...dataSasis, asal_tabel: targetTabel });

      if (dataSasis.latitude_jemput && dataSasis.longitude_jemput) {
        setPetaRegion((prev: any) => prev || {
          latitude: Number(dataSasis.latitude_jemput), longitude: Number(dataSasis.longitude_jemput),
          latitudeDelta: 0.015, longitudeDelta: 0.015
        });
      }

      if (pilarLayanan !== 'SERVIS') {
        const targetDriverId = dataSasis.driver_id || dataSasis.kurir_id;
        if (targetDriverId) {
          const { data: dData } = await supabase.from('drivers').select('*').eq('user_id_driver', targetDriverId).maybeSingle();
          if (dData) {
            setDriverData(dData);
            if (dData.latitude_driver && dData.longitude_driver && !driverLivePos) {
              setDriverLivePos({ latitude: parseFloat(dData.latitude_driver), longitude: parseFloat(dData.longitude_driver) });
            }
          }
        }
      }

    } catch (err: any) { console.error(err.message); } 
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (orderData?.status_order) {
      const s = String(orderData.status_order).toUpperCase().trim();
      if (prevStatusRef.current && prevStatusRef.current !== 'SELESAI' && s === 'SELESAI') {
        setShowSelesaiModal(true);
      }
      prevStatusRef.current = s;
    }
  }, [orderData?.status_order]);

  useEffect(() => {
    const safeId = Array.isArray(id) ? id[0] : id;
    if (!safeId) return;

    supabase.auth.getSession().then(({ data }) => { setCurrentUserId(data.session?.user?.id || null); });
    fetchSmartOrderDetail(true);

    const channelLiveTracking = supabase.channel(`live-tracking-${safeId}`)
      .on('broadcast', { event: 'POSISI_DRIVER_UPDATE' }, (payload) => {
        setDriverLivePos({ latitude: payload.payload.lat, longitude: payload.payload.lng });
      }).subscribe();

    const channelOrderUpdate = supabase.channel(`live-order-update-${safeId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        if (String(payload.new?.id) === String(safeId)) {
          setOrderData((prev: any) => prev ? { ...prev, status_order: payload.new.status_order } : prev);
          fetchSmartOrderDetail(false);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'migo_orders' }, (payload) => {
        if (String(payload.new?.id) === String(safeId)) {
          setOrderData((prev: any) => prev ? { ...prev, status_order: payload.new.status_order } : prev);
          fetchSmartOrderDetail(false);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `order_id=eq.${safeId}` }, async (payload) => {
        const pesanBaru = payload.new;
        const { data: sessionData } = await supabase.auth.getSession();
        if (pesanBaru.sender_id !== sessionData?.session?.user?.id) {
            Vibration.vibrate([0, 200, 100, 200]);
            try {
              const { sound } = await Audio.Sound.createAsync(require('../../assets/sounds/migo.mp3'), { shouldPlay: true });
              sound.setOnPlaybackStatusUpdate((status) => { if (status.didJustFinish) sound.unloadAsync(); });
            } catch (err) {}
            setPesanChatMasuk(pesanBaru.text_message || pesanBaru.message || 'Pesan baru dari Driver');
            setUnreadsChatCount(prev => prev + 1);
            setShowChatModal(true);
        }
      }).subscribe();

    const pollingInterval = setInterval(() => { fetchSmartOrderDetail(false); }, 7000); 
    return () => { supabase.removeChannel(channelOrderUpdate); supabase.removeChannel(channelLiveTracking); clearInterval(pollingInterval); };
  }, [id]);

  const handleBatalkanPesananDariDetail = async () => {
    showAlert("Batalkan Pesanan? ❌", "Apakah Anda yakin ingin membatalkan pesanan ini?", true, async () => {
        closeAlert();
        try {
          setLoadingAction(true);
          await supabase.from(orderData.asal_tabel).update({ status_order: 'DIBATALKAN' }).eq('id', orderData.id)
            .in('status_order', ['PENDING', 'MENCARI_KURIR', 'MENCARI_DRIVER', 'MENUJU_JEMPUT', 'DIPROSES', 'MENUNGGU_KONFIRMASI_MITRA']);
          showAlert("Dibatalkan 🎉", "Pesanan Anda resmi ditutup.", false, () => { closeAlert(); router.replace('/(tabs)/pesanan'); });
        } catch (err: any) { 
          showAlert("Gagal Batal 🚨", err.message); fetchSmartOrderDetail(false); 
        } finally { setLoadingAction(false); }
    }, "Ya, Batalkan", "Kembali");
  };

  const handleKonfirmasiSelesai = async () => {
    const sAktif = String(orderData.status_order).toUpperCase();
    if (tipeLayanan === 'MIGO' && sAktif !== 'DIANTAR') return showAlert("Belum Sampai 🚨", "Driver masih dalam perjalanan.");
    if (tipeLayanan !== 'MIGO' && tipeLayanan !== 'SERVIS' && sAktif !== 'DIKIRIM') return showAlert("Belum Sampai 🚨", "Pesanan masih diproses toko/kurir.");

    const waktuDibuat = new Date(orderData.created_at).getTime();
    if ((Date.now() - waktuDibuat) / 60000 < 5) return showAlert("SELESAIKAN ORDERAN ⏳", "MOHON SELESAIKAN ORDERAN ANDA.");

    const dialogTitle = orderData.asal_tabel === 'migo_orders' 
        ? "Apakah Perjalanan MIGO sudah selesai dengan aman?" 
        : (tipeLayanan === 'SERVIS' ? "Apakah pengerjaan servis sudah selesai?" : "Apakah pesanan sudah Kamu terima dengan baik?");

    showAlert("Konfirmasi Selesai 🏁", dialogTitle, true, async () => {
        closeAlert();
        try {
          setLoadingAction(true);
          await supabase.from(orderData.asal_tabel).update({ status_order: 'SELESAI' }).eq('id', orderData.id);
          setShowSelesaiModal(true);
        } catch (err: any) { showAlert("Gagal Menyelesaikan", err.message); } 
        finally { setLoadingAction(false); }
    }, "Ya, Selesai!", "Belum");
  };

  if (loading) return <View style={styles.centerLoading}><ActivityIndicator size="large" color="#4A3525" /><Text style={styles.loadingText}>Membongkar arsip transaksi...</Text></View>;
  if (orderNotFound || !orderData) return (
    <View style={styles.centerLoading}>
      <FontAwesome5 name="box-open" size={40} color="#D7CCC8" style={{ marginBottom: 15 }} />
      <Text style={[styles.loadingText, { color: '#4A3525', fontSize: 14 }]}>Arsip Orderan Tidak Ditemukan</Text>
      <Text style={{ fontSize: 11, color: '#8D6E63', marginTop: 5, textAlign: 'center', paddingHorizontal: 40 }}>Orderan ini mungkin telah kedaluwarsa atau ditarik oleh sistem.</Text>
      <TouchableOpacity style={styles.btnKembaliNotFound} onPress={() => router.back()}><Text style={styles.btnKembaliNotFoundText}>Kembali</Text></TouchableOpacity>
    </View>
  );

  const statusBagianAtas = String(orderData.status_order || '').toUpperCase().trim();
  const isMencari = ['PENDING', 'MENCARI_KURIR', 'MENCARI_DRIVER', 'MENUNGGU_KONFIRMASI_MITRA'].includes(statusBagianAtas);
  const isBatalSelesai = ['DIBATALKAN', 'SELESAI'].includes(statusBagianAtas);
  const isBisaSelesai = !isMencari && !isBatalSelesai;
  const tanggalLokal = new Date(orderData.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute:'2-digit' });

  const getBadgeStyle = (status: string) => {
    const s = String(status || '').toUpperCase().trim();
    if (['PENDING', 'MENCARI_KURIR', 'MENCARI_DRIVER', 'MENUNGGU_KONFIRMASI_MITRA'].includes(s)) return { bg: '#FFF3E0', color: '#E65100', icon: 'time', text: tipeLayanan === 'SERVIS' ? 'MENUNGGU KONFIRMASI' : 'MENCARI ARMADA' };
    if (['DIBATALKAN'].includes(s)) return { bg: '#FFEBEE', color: '#C62828', icon: 'close-circle', text: 'DIBATALKAN' };
    if (['SELESAI'].includes(s)) return { bg: '#E8F5E9', color: '#117A65', icon: 'checkmark-circle', text: 'SELESAI' };
    return { bg: '#E3F2FD', color: '#1565C0', icon: 'bicycle', text: 'DI PERJALANAN' };
  };

  const uiStatus = getBadgeStyle(orderData.status_order);
  const dynamicHeaderTitle = tipeLayanan === 'MIGO' ? "Perjalanan Aktif" : (tipeLayanan === 'SERVIS' ? 'PAMILO Servis' : 'PAMILO Belanja');

  const labelAlamatJemput = tipeLayanan === 'MIGO' ? (orderData.alamat_jemput || '-') : (tokoData?.alamat_toko || orderData.alamat_penjemputan || '-');
  const labelAlamatAntar = tipeLayanan === 'MIGO' ? (orderData.alamat_antar || '-') : (orderData.alamat_pengiriman || '-');
  
  // 🚀 ENGINE AKUNTANSI PENUMPANG (Mewajibkan Warga membayar Biaya Layanan)
  const ongkirTrip = tipeLayanan === 'MIGO' ? Number(orderData.total_pembayaran || 0) : Number(orderData.biaya_ongkir || 0);
  const biayaLayananApp = tipeLayanan === 'MIGO' ? Number(orderData.biaya_layanan || orderData.biaya_aplikasi || 1000) : (Number(orderData.biaya_penanganan || 0) + Number(orderData.biaya_admin || 0));
  const totalHargaBarang = tipeLayanan === 'MIGO' ? 0 : Number(orderData.total_harga_barang || 0);
  
  // Total keseluruhan Mutlak (Ongkos + Layanan + Barang)
  const grandTotalTagihan = totalHargaBarang + ongkirTrip + biayaLayananApp;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: true, headerTitle: dynamicHeaderTitle, headerTintColor: '#fff', headerStyle: { backgroundColor: '#4A3525' } }} />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />

      {!isBatalSelesai && petaRegion && (tipeLayanan === 'MIGO' || driverData) && (
        <View style={styles.mapContainer}>
          <MapView style={styles.map} region={petaRegion}>
            <Marker coordinate={{ latitude: parseFloat(orderData.latitude_jemput), longitude: parseFloat(orderData.longitude_jemput) }} title="Lokasi Jemput">
              <View style={styles.markerJemput}><FontAwesome5 name={tipeLayanan === 'MIGO' ? "user" : "store"} size={11} color="#fff" /></View>
            </Marker>
            <Marker coordinate={{ latitude: parseFloat(orderData.latitude_tujuan), longitude: parseFloat(orderData.longitude_tujuan) }} title="Lokasi Tujuan">
              <View style={styles.markerAntar}><FontAwesome5 name="flag-checkered" size={11} color="#fff" /></View>
            </Marker>
            {driverLivePos && (
              <Marker coordinate={driverLivePos} title="Posisi Kurir" zIndex={999}>
                <View style={styles.markerDriverMigoTrack}><FontAwesome5 name="motorcycle" size={12} color="#fff" /></View>
              </Marker>
            )}
          </MapView>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 180 }}>
        <View style={[styles.headerCard, (!isBatalSelesai && petaRegion && (tipeLayanan === 'MIGO' || driverData)) && { borderTopLeftRadius: 20, borderTopRightRadius: 20, marginTop: -15 }]}>
          <View style={styles.headerRow}>
            <View><Text style={styles.labelNota}>NO. INVOICE</Text><Text style={styles.valueNota}>#{orderData.id.substring(0, 8).toUpperCase()}</Text></View>
            <View style={[styles.statusBadge, { backgroundColor: uiStatus.bg }]}><Ionicons name={uiStatus.icon as any} size={12} color={uiStatus.color} style={{ marginRight: 4 }} /><Text style={[styles.statusText, { color: uiStatus.color }]}>{uiStatus.text}</Text></View>
          </View>
          <Text style={styles.dateText}>Dipesan: {tanggalLokal} WIB</Text>
        </View>

        {isMencari && (
          <View style={styles.mencariContainer}>
            <ActivityIndicator size="large" color="#D35400" />
            <Text style={styles.mencariTitle}>Menghubungkan Ke {tipeLayanan === 'SERVIS' ? 'Mitra Jasa' : 'Armada / Toko'}...</Text>
          </View>
        )}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>🗺️ Rute / Alamat</Text>
          <View style={styles.routeContainer}>
            <View style={styles.routeItem}>
              <Ionicons name="radio-button-on" size={16} color="#4A3525" />
              <View style={styles.routeTextWrapper}>
                <Text style={styles.routeLabel}>{tipeLayanan === 'MIGO' ? 'TITIK JEMPUT' : 'MITRA / TOKO'}</Text>
                {tipeLayanan !== 'MIGO' && <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#4A3525', marginBottom: 2 }}>{tokoData?.nama_toko || 'Mitra Pamilo'}</Text>}
                <Text style={styles.routeValue}>{labelAlamatJemput}</Text>
              </View>
            </View>
            {tipeLayanan !== 'SERVIS' && (
              <>
                <View style={styles.routeLine} />
                <View style={styles.routeItem}>
                  <Ionicons name="location" size={16} color="#D35400" />
                  <View style={styles.routeTextWrapper}>
                    <Text style={styles.routeLabel}>TITIK TUJUAN / ANTAR</Text>
                    <Text style={styles.routeValue}>{labelAlamatAntar}</Text>
                    {orderData.catatan && <Text style={{ fontSize: 11, color: '#8D6E63', marginTop: 4, fontStyle: 'italic' }}>Catatan: {orderData.catatan}</Text>}
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {tipeLayanan !== 'MIGO' && orderItems.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{tipeLayanan === 'SERVIS' ? '🛠️ Rincian Jasa' : '📦 Rincian Belanjaan'}</Text>
            {orderItems.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <View style={styles.itemImageContainer}>
                  {item.produk?.foto_produk ? <Image source={{ uri: item.produk.foto_produk }} style={styles.itemImage} /> : <Ionicons name="cube-outline" size={18} color="#BCAAA4" />}
                </View>
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName} numberOfLines={2}>{item.produk?.nama_produk || 'Produk/Jasa'}</Text>
                  {item.varian_terpilih && <Text style={styles.itemVariantText}>Varian: {item.varian_terpilih}</Text>}
                  <Text style={styles.itemQty}>{item.kuantitas} x Rp {Number(item.harga_satuan).toLocaleString('id-ID')}</Text>
                </View>
                <Text style={styles.itemSubtotal}>Rp {(item.kuantitas * Number(item.harga_satuan)).toLocaleString('id-ID')}</Text>
              </View>
            ))}
            {!isBatalSelesai && (
              <TouchableOpacity style={styles.btnChatToko} onPress={() => { setUnreadsChatCount(0); router.push({ pathname: '/chat/[id]', params: { id: orderData.id, receiver_id: orderData.penjual_id } }); }}>
                <Ionicons name="chatbubbles" size={14} color="#D35400" style={{ marginRight: 6 }} />
                <Text style={styles.btnChatTokoText}>Hubungi Mitra Jasa/Toko</Text>
                {unreadsChatCount > 0 && <View style={styles.redDotCountMini}><Text style={styles.redDotTextMini}>{unreadsChatCount}</Text></View>}
              </TouchableOpacity>
            )}
          </View>
        )}

        {driverData && tipeLayanan !== 'SERVIS' && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>👤 Informasi {tipeLayanan === 'MIGO' ? 'Driver MIGO' : 'Kurir Pengantar'}</Text>
            <View style={styles.driverBox}>
              <View style={styles.driverAvatar}>
                {driverData.foto_wajah ? <Image source={{ uri: driverData.foto_wajah }} style={styles.itemImage} /> : <FontAwesome5 name="user-ninja" size={16} color="#2E7D32" />}
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.driverName}>{driverData.nama_driver}</Text>
                <Text style={styles.driverPlat}>{driverData.plat_nomor}</Text>
              </View>
              {!isBatalSelesai && (
                <TouchableOpacity style={styles.btnChatKurir} onPress={() => { setUnreadsChatCount(0); router.push({ pathname: '/chat/[id]', params: { id: orderData.id, receiver_id: orderData.driver_id || orderData.kurir_id } }); }}>
                  <Ionicons name="chatbubbles" size={16} color="#fff" />
                  {unreadsChatCount > 0 && <View style={styles.redBadgeGelembung}><Text style={styles.redBadgeText}>{unreadsChatCount}</Text></View>}
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>💳 Ringkasan Tagihan</Text>
          <View style={{ backgroundColor: '#F8FAFB', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 }}>
            <View style={styles.finRow}><Text style={styles.finLabel}>Metode Pembayaran</Text><Text style={styles.finValueBlack}>{String(orderData.metode_pembayaran || 'TUNAI').toUpperCase()}</Text></View>
            
            {tipeLayanan !== 'MIGO' && (
              <View style={styles.finRow}><Text style={styles.finLabel}>{tipeLayanan === 'SERVIS' ? 'Biaya Jasa Servis' : 'Total Harga Barang'}</Text><Text style={styles.finValueBlack}>Rp {totalHargaBarang.toLocaleString('id-ID')}</Text></View>
            )}
            
            <View style={styles.finRow}><Text style={styles.finLabel}>{tipeLayanan === 'MIGO' ? 'Tarif Perjalanan' : 'Ongkos Kirim'}</Text><Text style={styles.finValueBlack}>Rp {ongkirTrip.toLocaleString('id-ID')}</Text></View>
            <View style={styles.finRow}><Text style={styles.finLabel}>Biaya Layanan Aplikasi</Text><Text style={styles.finValueBlack}>Rp {biayaLayananApp.toLocaleString('id-ID')}</Text></View>
            
            <View style={styles.dividerDashed} />
            <View style={styles.finRow}><Text style={styles.totalLabel}>Total Tagihan</Text><Text style={styles.totalValueGreen}>Rp {grandTotalTagihan.toLocaleString('id-ID')}</Text></View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomStickyBar, { paddingBottom: insets.bottom || 16 }]}>
        {loadingAction ? <ActivityIndicator color="#4A3525" /> : (
          <View style={{ width: '100%', gap: 8 }}>
            {isMencari ? (
              <TouchableOpacity style={styles.btnBatalSasisUtama} onPress={handleBatalkanPesananDariDetail}><Ionicons name="close-circle" size={18} color="#fff" style={{ marginRight: 6 }} /><Text style={styles.btnBatalSasisUtamaText}>Batalkan Pesanan Ini</Text></TouchableOpacity>
            ) : isBisaSelesai ? (
              <>
                <TouchableOpacity style={styles.btnSelesaikanAction} onPress={handleKonfirmasiSelesai}>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.btnSelesaikanActionText}>{orderData.asal_tabel === 'migo_orders' ? 'Perjalanan Selesai' : (tipeLayanan === 'SERVIS' ? 'Pekerjaan Servis Selesai' : 'Pesanan Sudah Saya Terima')}</Text>
                </TouchableOpacity>
                {tipeLayanan === 'MIGO' && (
                  <TouchableOpacity style={[styles.btnBatalSasisUtama, orderData.status_order === 'DIANTAR' && { backgroundColor: '#E0E0E0', borderColor: '#E0E0E0' }]} onPress={handleBatalkanPesananDariDetail} disabled={orderData.status_order === 'DIANTAR'}><Text style={[styles.btnBatalSasisUtamaText, orderData.status_order === 'DIANTAR' && { color: '#9E9E9E' }]}>{orderData.status_order === 'DIANTAR' ? 'Perjalanan Dimulai' : 'Batalkan Perjalanan'}</Text></TouchableOpacity>
                )}
              </>
            ) : (
              <TouchableOpacity style={styles.btnKembaliStatis} onPress={() => router.replace('/(tabs)/pesanan')}><Text style={styles.btnKembaliStatisText}>Kembali ke Riwayat</Text></TouchableOpacity>
            )}
          </View>
        )}
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
            <View style={[styles.completionIconBgCircle, { backgroundColor: '#4A3525' }]}><FontAwesome5 name="smile-wink" size={24} color="#fff" /></View>
            <Text style={styles.completionHeading}>ALHAMDULILLAH, SELESAI! 🎉</Text>
            <Text style={styles.completionSubHeading}>Terima kasih telah mempercayakan perjalanan & pesanan Anda bersama PAMILO.</Text>
            
            <View style={{ width: '100%', gap: 10, marginTop: 24 }}>
              <TouchableOpacity style={[styles.btnCompletionClose, { backgroundColor: '#4A3525' }]} onPress={() => { setShowSelesaiModal(false); router.replace('/(tabs)'); }}>
                <Text style={styles.btnCompletionText}>OK, KEMBALI KE BERANDA</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnCompletionClose, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#D7CCC8' }]} onPress={() => { setShowSelesaiModal(false); router.replace('/(tabs)/pesanan'); }}>
                <Text style={[styles.btnCompletionText, { color: '#4A3525' }]}>LIHAT ARSIP NOTA</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showChatModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlayChat}>
          <View style={[styles.modalCardChat, { borderColor: '#4A3525' }]}><View style={[styles.alertIconBgChat, { backgroundColor: '#4A3525' }]}><Ionicons name="chatbubbles" size={24} color="#fff" /></View><Text style={styles.modalTitleHeaderChat}>PESAN DARI DRIVER / TOKO</Text><View style={styles.alertDataChat}><Text style={[styles.alertValChat, { textAlign: 'center', fontStyle: 'italic' }]}>"{pesanChatMasuk}"</Text></View>
            <View style={styles.buttonActionRowChat}>
              <TouchableOpacity style={styles.btnActionLewatiChat} onPress={() => setShowChatModal(false)}><Text style={styles.btnTextLewatiLabelChat}>TUTUP</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btnActionTerimaChat, { backgroundColor: '#D35400' }]} onPress={() => { setShowChatModal(false); setUnreadsChatCount(0); router.push({ pathname: '/chat/[id]', params: { id: orderData.id, receiver_id: currentUserId === orderData.pembeli_id ? (orderData.driver_id || orderData.kurir_id || orderData.penjual_id) : orderData.pembeli_id } }); }}><Text style={styles.btnTextTerimaLabelChat}>BALAS PESAN</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5' }, centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF8F5' }, loadingText: { marginTop: 12, fontSize: 11, color: '#8D6E63', fontWeight: '700' },
  mapContainer: { height: 200 }, map: { ...StyleSheet.absoluteFillObject }, markerJemput: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#4A3525', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' }, markerAntar: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#D35400', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' }, markerDriverMigoTrack: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#2E7D32', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff', elevation: 5 },
  headerCard: { backgroundColor: '#fff', padding: 20, borderBottomWidth: 1, borderColor: '#EFEBE9', zIndex: 10 }, headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, labelNota: { fontSize: 10, color: '#8D6E63', fontWeight: 'bold', letterSpacing: 0.5 }, valueNota: { fontSize: 14, fontWeight: '900', color: '#4A3525', marginTop: 2, fontFamily: 'monospace' }, statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }, statusText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.3 }, dateText: { fontSize: 10, color: '#A1887F', marginTop: 10, fontWeight: '500' }, mencariContainer: { backgroundColor: '#fff', padding: 16, alignItems: 'center', borderBottomWidth: 1, borderColor: '#EFEBE9', flexDirection: 'row', justifyContent: 'center', gap: 10 }, mencariTitle: { fontSize: 12, fontWeight: 'bold', color: '#E65100' }, 
  sectionCard: { backgroundColor: '#fff', marginTop: 10, padding: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#EFEBE9' }, sectionTitle: { fontSize: 12, fontWeight: '900', color: '#4A3525', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }, 
  routeContainer: { backgroundColor: '#FDFCFB', borderWidth: 1, borderColor: '#EFEBE9', borderRadius: 12, padding: 14 }, routeItem: { flexDirection: 'row', alignItems: 'flex-start' }, routeLine: { width: 2, height: 20, backgroundColor: '#E0E0E0', marginLeft: 7, marginVertical: 4 }, routeTextWrapper: { flex: 1, marginLeft: 12 }, routeLabel: { fontSize: 9, fontWeight: 'bold', color: '#A1887F', textTransform: 'uppercase' }, routeValue: { fontSize: 12, fontWeight: '600', color: '#4A3525', marginTop: 2, lineHeight: 18 }, jarakBox: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFF8F4', padding: 12, borderRadius: 8, marginTop: 12 }, jarakLabel: { fontSize: 11, color: '#D35400', fontWeight: 'bold' }, jarakValue: { fontSize: 12, color: '#D35400', fontWeight: '900' },
  finRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, finLabel: { fontSize: 11, color: '#757575', fontWeight: '500' }, finValueBlack: { fontSize: 12, fontWeight: 'bold', color: '#4A3525' }, finValueRed: { fontSize: 12, fontWeight: 'bold', color: '#C62828' }, dividerDashed: { height: 1, backgroundColor: '#E0E0E0', borderStyle: 'dashed', marginVertical: 10 }, totalLabel: { fontSize: 13, fontWeight: '900', color: '#4A3525' }, totalValueGreen: { fontSize: 16, fontWeight: '900', color: '#2E7D32' },
  tokoHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#FAF8F5' }, tokoNameText: { fontSize: 13, fontWeight: 'bold', color: '#4A3525', marginLeft: 8 }, btnChatToko: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#FFCCBC', justifyContent: 'center', marginTop: 10, position: 'relative' }, btnChatTokoText: { fontSize: 11, fontWeight: 'bold', color: '#D35400' }, itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 }, itemImageContainer: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#FAF8F5', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#EFEBE9' }, itemImage: { width: '100%', height: '100%', resizeMode: 'cover' }, itemDetails: { flex: 1, marginLeft: 12, paddingRight: 10 }, itemName: { fontSize: 12, fontWeight: 'bold', color: '#1A0F05', lineHeight: 16 }, itemVariantText: { fontSize: 10, color: '#8D6E63', fontStyle: 'italic', fontWeight: '500', marginTop: 1 }, itemQty: { fontSize: 11, color: '#8D6E63', marginTop: 4, fontWeight: '500' }, itemSubtotal: { fontSize: 13, fontWeight: '900', color: '#4A3525' }, driverBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#C8E6C9' }, driverAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#C8E6C9', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#A5D6A7' }, driverName: { fontSize: 13, fontWeight: '900', color: '#1B5E20' }, driverPlat: { fontSize: 12, color: '#111', marginTop: 2, fontWeight: 'bold', letterSpacing: 0.3 }, driverSpecs: { fontSize: 10, color: '#2E7D32', marginTop: 2, fontWeight: '500' }, btnChatKurir: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2E7D32', justifyContent: 'center', alignItems: 'center', elevation: 1, marginLeft: 10, position: 'relative' }, 
  bottomStickyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderColor: '#EFEBE9', elevation: 10 }, btnBatalSasisUtama: { backgroundColor: '#C62828', width: '100%', height: 46, borderRadius: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', elevation: 2 }, btnBatalSasisUtamaText: { color: '#fff', fontWeight: 'bold', fontSize: 13, letterSpacing: 0.5 }, btnSelesaikanAction: { backgroundColor: '#117A65', width: '100%', height: 46, borderRadius: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', elevation: 2 }, btnSelesaikanActionText: { color: '#fff', fontSize: 13, fontWeight: 'bold', letterSpacing: 0.3 }, btnKembaliStatis: { backgroundColor: '#FAF8F5', borderWidth: 1, borderColor: '#E0D4CE', width: '100%', height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, btnKembaliStatisText: { color: '#4A3525', fontWeight: 'bold', fontSize: 12 }, btnKembaliNotFound: { backgroundColor: '#4A3525', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 20, marginTop: 20 }, btnKembaliNotFoundText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  completionOverlay: { flex: 1, backgroundColor: 'rgba(17,17,17,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 }, completionCardPremium: { width: '100%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', elevation: 12 }, completionIconBgCircle: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }, completionHeading: { fontSize: 16, fontWeight: '900', color: '#111', letterSpacing: 0.5, textAlign: 'center' }, completionSubHeading: { fontSize: 12, color: '#757575', fontWeight: '600', marginTop: 8, textAlign: 'center', lineHeight: 18 }, btnCompletionClose: { width: '100%', paddingVertical: 14, borderRadius: 14, alignItems: 'center', elevation: 1 }, btnCompletionText: { color: '#FFF', fontWeight: 'bold', fontSize: 12, letterSpacing: 0.5 },
  modalOverlayChat: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 }, modalCardChat: { backgroundColor: '#FFFFFF', width: '100%', borderRadius: 24, padding: 22, borderWidth: 2, alignItems: 'center', elevation: 10 }, alertIconBgChat: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 10, marginTop: -5 }, modalTitleHeaderChat: { fontSize: 16, fontWeight: '900', color: '#111', textAlign: 'center', marginBottom: 15 }, alertDataChat: { width: '100%', backgroundColor: '#FFF8F4', borderRadius: 16, padding: 15, marginBottom: 20, borderWidth: 1, borderColor: '#FFCCBC' }, alertLabelChat: { fontSize: 11, fontWeight: 'bold', color: '#A1887F', marginBottom: 4 }, alertValChat: { fontSize: 13, fontWeight: '800', color: '#4A3525', lineHeight: 18 }, buttonActionRowChat: { flexDirection: 'row', width: '100%', gap: 10 }, btnActionLewatiChat: { flex: 1, backgroundColor: '#F1F5F9', height: 48, borderRadius: 15, justifyContent: 'center', alignItems: 'center' }, btnTextLewatiLabelChat: { color: '#475569', fontWeight: 'bold', fontSize: 14 }, btnActionTerimaChat: { flex: 2, height: 48, borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 2 }, btnTextTerimaLabelChat: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  redBadgeGelembung: { position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 1, borderColor: '#fff' }, redBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' }, redDotCountMini: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 }, redDotTextMini: { color: '#fff', fontSize: 8, fontWeight: '900' },
  customAlertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 }, customAlertCard: { width: '100%', backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center', elevation: 15 }, customAlertIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }, customAlertTitle: { fontSize: 16, fontWeight: '900', color: '#1A0F05', textAlign: 'center', marginBottom: 8 }, customAlertMessage: { fontSize: 13, color: '#475569', textAlign: 'center', marginBottom: 24, lineHeight: 20 }, customAlertRow: { flexDirection: 'row', gap: 12, width: '100%' }, btnCustomAlertCancel: { flex: 1, backgroundColor: '#F1F5F9', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }, btnCustomAlertCancelText: { color: '#475569', fontWeight: 'bold', fontSize: 13 }, btnCustomAlertConfirm: { flex: 1, backgroundColor: '#D35400', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }, btnCustomAlertConfirmText: { color: '#fff', fontWeight: 'bold', fontSize: 13 }
});