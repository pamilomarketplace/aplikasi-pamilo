// @ts-nocheck
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  ActivityIndicator, 
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
  StatusBar
} from 'react-native';
import { supabase } from '../../supabaseConfig';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

function OrderCardComponent({ item, myUid, onRefreshAction, handleBatalFunc }) {
  const router = useRouter();
  const [showTimeoutOptions, setShowTimeoutOptions] = useState(false);

  const isOjekMigoSaja = !item.punya_belanjaan;
  const currentOrderId = item.id;
  const currentDriverId = item.kurir_id;
  
  const isEndStatus = ['SELESAI', 'DIBATALKAN'].includes(item.status_order);
  const apakahBisaDibatalkan = ['MENCARI_DRIVER', 'PENDING', 'MENCARI_KURIR'].includes(item.status_order);

  useEffect(() => {
    if (['MENCARI_DRIVER', 'PENDING', 'MENCARI_KURIR'].includes(item.status_order) && !currentDriverId) {
      const hitungWaktuMundur = () => {
        const waktuDibuat = new Date(item.created_at).getTime();
        const waktuSekarang = new Date().getTime();
        const selisihMenit = (waktuSekarang - waktuDibuat) / 1000 / 60;

        if (selisihMenit >= 5) {
          setShowTimeoutOptions(true);
        }
      };

      hitungWaktuMundur(); 
      const intervalTimer = setInterval(hitungWaktuMundur, 10000); 
      return () => clearInterval(intervalTimer);
    } else {
      setShowTimeoutOptions(false);
    }
  }, [item.status_order, item.created_at, currentDriverId]);

  const handleCariLagi = async () => {
    try {
      const targetTable = item.jenis_tabel === 'MIGO' ? 'migo_orders' : 'orders';
      await supabase.from(targetTable).update({ created_at: new Date().toISOString() }).eq('id', currentOrderId);
      setShowTimeoutOptions(false);
      Alert.alert("Radar Diperluas 📡", "Sistem PAMILO kembali menyebarkan orderan ke driver terdekat.");
      onRefreshAction();
    } catch (e) {
      console.log(e);
    }
  };

  // 🟢 LOGIKA PEMISAHAN WARNA BACKGROUND (POIN 4a)
  const dynamicCardStyle = item.status_order === 'SELESAI'
    ? { backgroundColor: '#E8F5E9', borderColor: '#C8E6C9' } // SELESAI: Background Hijau
    : item.status_order === 'DIBATALKAN'
    ? { backgroundColor: '#FFEBEE', borderColor: '#FFCDD2' } // DIBATALKAN: Background Merah
    : { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }; // AKTIF BERJALAN: Background Netral/Biru Pudar cerah

  // 🟢 LOGIKA UI DINAMIS 4 PILAR
  let textPilar = 'PAMILO MART';
  let colorPilar = '#0277BD'; 
  let iconPilar = 'cube';

  if (item.jenis_tabel === 'MIGO') { textPilar = 'MIGO RIDE'; colorPilar = '#2E7D32'; iconPilar = 'motorcycle'; }
  else if (item.jenis_tabel === 'FOOD') { textPilar = 'PAMILO FOOD'; colorPilar = '#E65100'; iconPilar = 'hamburger'; }
  else if (item.jenis_tabel === 'SERVIS') { textPilar = 'PAMILO SERVIS'; colorPilar = '#6A1B9A'; iconPilar = 'tools'; }

  if (isEndStatus) colorPilar = '#757575'; // Jika sudah selesai/batal, warna label pilar dinetralkan jadi abu

  return (
    <View style={[styles.orderCard, dynamicCardStyle]}>
      <View style={styles.cardHeader}>
        <View style={[styles.badgeMetode, { borderColor: isEndStatus ? '#E0E0E0' : colorPilar + '50', backgroundColor: isEndStatus ? '#F5F5F5' : colorPilar + '15' }]}>
          <FontAwesome5 name={iconPilar as any} size={9} color={colorPilar} style={{marginRight: 4}} />
          <Text style={[styles.badgeText, { color: colorPilar }]}>
            {textPilar}
          </Text>
        </View>
        <Text style={[styles.statusText, item.status_order === 'DIBATALKAN' ? {color: '#C62828'} : item.status_order === 'SELESAI' ? {color: '#117A65'} : {color: '#E65100'}]}>
          {item.status_order === 'MENCARI_DRIVER' || item.status_order === 'MENCARI_KURIR' ? 'Mencari Kurir...' : item.status_order.replace('_', ' ')}
        </Text>
      </View>

      <View style={styles.divider} />

      <TouchableOpacity 
        style={styles.cardBody}
        onPress={() => {
          router.push({
            pathname: '/orders/detail',
            params: { id: currentOrderId, asal_tabel: item.jenis_tabel === 'MIGO' ? 'migo_orders' : 'orders' }
          });
        }}
      >
        {isEndStatus && item.created_at && (
          <View style={styles.waktuRiwayatRow}>
            <Ionicons name="calendar-outline" size={12} color="#8D6E63" style={{ marginRight: 5 }} />
            <Text style={styles.waktuRiwayatText}>
              {new Date(item.created_at).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB
            </Text>
          </View>
        )}

        {item.alamat_penjemputan && <Text style={styles.alamatText} numberOfLines={1}>🛫 Jemput: {item.alamat_penjemputan}</Text>}
        <Text style={styles.alamatText} numberOfLines={1}>🏁 {item.jenis_tabel === 'SERVIS' ? 'Lokasi Pengerjaan' : 'Antar ke'}: {item.alamat_pengiriman}</Text>
        <Text style={styles.jarakText}>🛞 Jarak Rute: {item.jarak_km || 0} KM</Text>
        <Text style={styles.metodeBayarText}>Metode: <Text style={{fontWeight: 'bold', color: '#4A3525'}}>{item.metode_pembayaran}</Text></Text>
        
        {Number(item.potongan_diskon || 0) > 0 && (
          <View style={styles.promoBadgeRow}>
            <Ionicons name="gift" size={12} color="#004D40" />
            <Text style={styles.promoBadgeText}>Berhasil hemat Rp {Number(item.potongan_diskon).toLocaleString('id-ID')} pakai promo lapak!</Text>
          </View>
        )}
      </TouchableOpacity>

      {showTimeoutOptions && (
        <View style={styles.timeoutAlertBox}>
          <Text style={styles.timeoutAlertText}>⚠️ Waduh maaf, tampaknya semua kurir MIGO kami sedang dalam orderan saat ini.</Text>
          <View style={styles.timeoutBtnRow}>
            <TouchableOpacity style={styles.btnTimeoutBatal} onPress={() => handleBatalFunc(currentOrderId, item.metode_pembayaran, item.total_pembayaran, item.jenis_tabel)}>
              <Text style={styles.btnTimeoutBatalText}>Batalkan Pesanan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnTimeoutCariLagi} onPress={handleCariLagi}>
              <Text style={styles.btnTimeoutCariText}>Cari Kurir Lagi</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.cardFooter}>
        <View style={styles.priceContainer}>
          <Text style={styles.totalLabel}>Total Ditagihkan:</Text>
          <Text style={styles.totalValue}>Rp {(item.total_pembayaran || 0).toLocaleString('id-ID')}</Text>
        </View>

        <View style={styles.actionChatGroupRow}>
          {!isOjekMigoSaja && !isEndStatus && (
            <TouchableOpacity style={styles.btnChatToko} onPress={() => router.push({ pathname: `/chat/${currentOrderId}`, params: { receiver_id: item.penjual_id } })}>
              <FontAwesome5 name="store" size={11} color="#D35400" /><Text style={styles.btnChatTextToko}>{item.jenis_tabel === 'SERVIS' ? 'Ahli Jasa' : 'Toko'}</Text>
            </TouchableOpacity>
          )}
          {currentDriverId && !isEndStatus && (
            <TouchableOpacity style={styles.btnChatDriver} onPress={() => router.push({ pathname: `/chat/${currentOrderId}`, params: { receiver_id: currentDriverId } })}>
              <FontAwesome5 name="motorcycle" size={11} color="#fff" /><Text style={styles.btnChatTextDriver}>Driver</Text>
            </TouchableOpacity>
          )}
          {!showTimeoutOptions && apakahBisaDibatalkan && (
            <TouchableOpacity style={styles.btnBatalBox} onPress={() => handleBatalFunc(currentOrderId, item.metode_pembayaran, item.total_pembayaran, item.jenis_tabel)}>
              <Ionicons name="close-circle" size={13} color="#C62828" /><Text style={styles.btnBatalText}>Batal</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

export default function PesananSayaTabScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [daftarOrders, setDaftarOrders] = useState<any[]>([]);
  const [myUid, setMyUid] = useState<string | null>(null);

  const isFirstMount = useRef(true); 

  const muatRiwayatOrdersWarga = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) setLoading(true); 

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      
      const uid = session.user.id;
      setMyUid(uid);

      const [resOrders, resMigo] = await Promise.all([
        supabase.from('orders').select('*').eq('pembeli_id', uid),
        supabase.from('migo_orders').select('*').eq('pembeli_id', uid)
      ]);

      const listIdOrder = (resOrders.data || []).map(o => o.id);
      let itemOrderIdsSet = new Set();
      if (listIdOrder.length > 0) {
        const { data: rawItems } = await supabase.from('order_items').select('order_id').in('order_id', listIdOrder);
        itemOrderIdsSet = new Set(rawItems?.map(i => i.order_id) || []);
      }

      // 🟢 LOGIKA FORMAT DATA DENGAN 3 PILAR
      const formatPasar = (resOrders.data || []).map(o => {
        let pilar = 'MART';
        const layanan = String(o.layanan || '').toUpperCase();
        if (layanan.includes('SERVIS') || layanan.includes('JASA')) pilar = 'SERVIS';
        else if (layanan.includes('FOOD') || layanan.includes('MAKANAN')) pilar = 'FOOD';

        return {
          ...o, status_order: String(o.status_order || 'PENDING').toUpperCase().trim(),
          punya_belanjaan: itemOrderIdsSet.has(o.id), jenis_tabel: pilar
        }
      });

      const formatMigo = (resMigo.data || []).map(o => ({
        ...o, kurir_id: o.driver_id, alamat_pengiriman: o.alamat_antar, alamat_penjemputan: o.alamat_jemput,
        status_order: String(o.status_order || 'MENCARI_DRIVER').toUpperCase().trim(), punya_belanjaan: false, potongan_diskon: 0, jenis_tabel: 'MIGO'
      }));

      const gabunganNota = [...formatPasar, ...formatMigo].sort((a, b) => {
        const aSelesai = ['SELESAI', 'DIBATALKAN'].includes(a.status_order);
        const bSelesai = ['SELESAI', 'DIBATALKAN'].includes(b.status_order);
        if (aSelesai && !bSelesai) return 1;  
        if (!aSelesai && bSelesai) return -1; 
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      
      setDaftarOrders(gabunganNota);

    } catch (err) {
      console.log("Sirkuit riwayat order terputus:", err);
    } finally {
      if (isInitialLoad) setLoading(false); 
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (isFirstMount.current) {
        muatRiwayatOrdersWarga(true);
        isFirstMount.current = false;
      } else {
        muatRiwayatOrdersWarga(false); 
      }
    }, [])
  );

  useEffect(() => {
    const namaChannelUnik = `radar-tab-pesanan-${Date.now()}`;
    const channelRiwayat = supabase.channel(namaChannelUnik);

    channelRiwayat.on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { muatRiwayatOrdersWarga(false); });
    channelRiwayat.on('postgres_changes', { event: '*', schema: 'public', table: 'migo_orders' }, () => { muatRiwayatOrdersWarga(false); });
    channelRiwayat.subscribe();

    return () => { supabase.removeChannel(channelRiwayat); };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    muatRiwayatOrdersWarga(false);
  };

  const handleBatalkanPesananWarga = async (orderId: string, metodeBayar: string, totalHarga: number, tabelTarget: string) => {
    if (!myUid) return;
    const targetSupabaseTable = tabelTarget === 'MIGO' ? 'migo_orders' : 'orders';

    Alert.alert(
      "Konfirmasi Batal ❌",
      "Apakah Kamu yakin ingin membatalkan pesanan ini?",
      [
        { text: "Kembali", style: "cancel" },
        {
          text: "Ya, Batalkan",
          style: "destructive",
          onPress: async () => {
            try {
              // Trigger SQL kita akan mengurus saldonya dengan aman. Cukup ubah status.
              const { error } = await supabase.from(targetSupabaseTable).update({ status_order: 'DIBATALKAN' }).eq('id', orderId).eq('pembeli_id', myUid).in('status_order', ['PENDING', 'MENCARI_KURIR', 'MENCARI_DRIVER']); 
              if (error) throw error;
              Alert.alert("Sukses Batal 🎉", "Pesanan Kamu resmi dibatalkan dan sistem radar dihentikan.");
              muatRiwayatOrdersWarga(false); 
            } catch (err: any) {
              Alert.alert("Gagal Membatalkan 🚨", "Maaf, pesanan gagal dibatalkan. Kemungkinan besar orderan sudah terlanjur disambar oleh armada di lapangan.");
              muatRiwayatOrdersWarga(false);
            }
          }
        }
      ]
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#4A3525" /></View>;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: true, headerTitle: 'Aktivitas Pesanan Anda', headerTintColor: '#fff', headerStyle: { backgroundColor: '#4A3525' }, headerTitleStyle: { fontWeight: 'bold', fontSize: 14 } }} />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />

      <FlatList
        data={daftarOrders}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20, paddingTop: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#4A3525"]} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <FontAwesome5 name="route" size={38} color="#BCAAA4" />
            <Text style={styles.emptyText}>Belum ada rekam aktivitas riwayat belanja, pengerjaan servis, atau pemesanan ojek MIGO saat ini.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <OrderCardComponent item={item} myUid={myUid} onRefreshAction={() => muatRiwayatOrdersWarga(false)} handleBatalFunc={handleBatalkanPesananWarga} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5', paddingHorizontal: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF8F5' },
  emptyBox: { alignItems: 'center', marginTop: 100, gap: 12, paddingHorizontal: 20 },
  emptyText: { color: '#8D6E63', fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 18, fontStyle: 'italic' },
  orderCard: { borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgeMetode: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.3 },
  statusText: { fontSize: 11, fontWeight: 'bold', letterSpacing: 0.3 },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginVertical: 10 },
  cardBody: { gap: 4, paddingVertical: 2 },
  alamatText: { fontSize: 12, color: '#1A0F05', fontWeight: 'bold', lineHeight: 16 },
  jarakText: { fontSize: 11, color: '#5D4037', fontWeight: '600', marginTop: 2 },
  metodeBayarText: { fontSize: 11, color: '#5D4037', fontWeight: '600' },
  waktuRiwayatRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, backgroundColor: 'rgba(0,0,0,0.03)', padding: 6, borderRadius: 8, alignSelf: 'flex-start' },
  waktuRiwayatText: { fontSize: 11, fontWeight: '700', color: '#5D4037' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  priceContainer: { justifyContent: 'center' },
  totalLabel: { fontSize: 10, color: '#757575', fontWeight: 'bold' },
  totalValue: { fontSize: 14, fontWeight: '900', color: '#D35400' },
  actionChatGroupRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnChatToko: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#FFF8F4', borderWidth: 1, borderColor: '#FFCCBC' },
  btnChatTextToko: { fontSize: 11, fontWeight: 'bold', color: '#D35400' },
  btnChatDriver: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#2E7D32' },
  btnChatTextDriver: { fontSize: 11, fontWeight: 'bold', color: '#fff' },
  btnBatalBox: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#FFEBEE', borderWidth: 1, borderColor: '#FFCDD2' },
  btnBatalText: { fontSize: 11, fontWeight: 'bold', color: '#C62828' },
  timeoutAlertBox: { backgroundColor: '#FFF3E0', borderRadius: 10, borderWidth: 1, borderColor: '#FFE0B2', padding: 10, marginTop: 10, gap: 8 },
  timeoutAlertText: { fontSize: 11, color: '#E65100', fontWeight: '600', lineHeight: 15 },
  timeoutBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 2 },
  btnTimeoutBatal: { backgroundColor: '#FFEBEE', borderWidth: 1, borderColor: '#FFCDD2', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  btnTimeoutBatalText: { fontSize: 11, fontWeight: 'bold', color: '#C62828' },
  btnTimeoutCariLagi: { backgroundColor: '#D35400', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  btnTimeoutCariText: { fontSize: 11, fontWeight: 'bold', color: '#fff' },
  promoBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0, 121, 107, 0.1)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, marginTop: 4, borderWidth: 0.5, borderColor: '#B2DFDB' },
  promoBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#004D40', flex: 1 }
});