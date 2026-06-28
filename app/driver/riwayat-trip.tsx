// @ts-nocheck
import React, { useEffect, useState, useCallback } from 'react';
import { 
  StyleSheet, Text, View, FlatList, TouchableOpacity, 
  ActivityIndicator, RefreshControl, StatusBar 
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../supabaseConfig';

const formatRupiah = (angka: number) => 'Rp ' + (angka || 0).toLocaleString('id-ID');

export default function RiwayatTripMigoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [riwayatList, setRiwayatList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalPendapatanTrip, setTotalPendapatanTrip] = useState(0);

  // 🚀 ENGINE AKUNTANSI TRANSPARAN (MANUAL FETCH)
  const fetchJejakTripMigo = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const driverId = session.user.id;

      // 1. TARIK MIGO MURNI
      const { data: resMigo } = await supabase.from('migo_orders')
        .select('*')
        .eq('driver_id', driverId)
        .in('status_order', ['SELESAI', 'DIBATALKAN'])
        .order('created_at', { ascending: false })
        .limit(30);
        
      // 2. TARIK ORDERS MURNI
      const { data: resOrders } = await supabase.from('orders')
        .select('*')
        .eq('kurir_id', driverId)
        .in('status_order', ['SELESAI', 'DIBATALKAN'])
        .order('created_at', { ascending: false })
        .limit(30);

      let hitungTotalUangSaku = 0;

      // 🔥 BEDAH FINANSIAL MIGO
      const arrMigo = (resMigo || []).map(m => {
        // Asumsi: total_pembayaran MIGO = Ongkos Kotor + Biaya Layanan Warga
        // Fallback sementara 1000 jika kolom biaya_layanan belum eksis
        const titipanBiayaLayanan = Number(m.biaya_layanan || 1000); 
        const totalUangWarga = Number(m.total_pembayaran || 0);
        
        // Ongkos murni hasil setir driver
        const ongkosKotor = (totalUangWarga - titipanBiayaLayanan > 0) ? (totalUangWarga - titipanBiayaLayanan) : totalUangWarga;
        
        // Komisi mutlak aplikasi (10% dari ongkos)
        const komisiAplikasi = (ongkosKotor * 10) / 100;
        
        // Saldo driver yang akan ditarik sistem
        const totalPemotonganSaldo = titipanBiayaLayanan + komisiAplikasi;
        
        // Uang bawa pulang driver
        const pendapatanBersih = ongkosKotor - komisiAplikasi;

        if (m.status_order === 'SELESAI') hitungTotalUangSaku += pendapatanBersih;

        return {
          id: m.id,
          id_nota: m.id.substring(0, 8).toUpperCase(),
          tipe: `MIGO ${m.tipe_layanan || 'RIDE'}`,
          status: m.status_order,
          waktu: m.created_at,
          jemput: m.alamat_jemput || '-',
          antar: m.alamat_antar || '-',
          ongkosKotor: ongkosKotor,
          titipanBiayaLayanan: titipanBiayaLayanan,
          komisiAplikasi: komisiAplikasi,
          totalPemotonganSaldo: totalPemotonganSaldo,
          pendapatanBersih: pendapatanBersih,
          metode: String(m.metode_pembayaran || 'TUNAI').toUpperCase()
        };
      });

      // 🔥 BEDAH FINANSIAL FOOD & MART
      const arrOrders = (resOrders || []).map(o => {
        const ongkosKotor = Number(o.biaya_ongkir || 0);
        const titipanBiayaLayanan = Number(o.biaya_penanganan || 0) + Number(o.biaya_admin || 0);
        
        // Komisi mutlak aplikasi (10% dari ongkir)
        const komisiAplikasi = (ongkosKotor * 10) / 100;
        
        // Saldo driver yang akan ditarik sistem
        const totalPemotonganSaldo = titipanBiayaLayanan + komisiAplikasi;
        
        // Uang bawa pulang driver
        const pendapatanBersih = ongkosKotor - komisiAplikasi;

        if (o.status_order === 'SELESAI') hitungTotalUangSaku += pendapatanBersih;

        return {
          id: o.id,
          id_nota: o.id.substring(0, 8).toUpperCase(),
          tipe: 'PENGIRIMAN BARANG',
          status: o.status_order,
          waktu: o.created_at,
          jemput: o.alamat_penjemputan || 'Toko Mitra',
          antar: o.alamat_pengiriman || '-',
          ongkosKotor: ongkosKotor,
          titipanBiayaLayanan: titipanBiayaLayanan,
          komisiAplikasi: komisiAplikasi,
          totalPemotonganSaldo: totalPemotonganSaldo,
          pendapatanBersih: pendapatanBersih,
          metode: String(o.metode_pembayaran || 'TUNAI').toUpperCase()
        };
      });

      const gabungan = [...arrMigo, ...arrOrders].sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime());
      
      setRiwayatList(gabungan);
      setTotalPendapatanTrip(hitungTotalUangSaku);

    } catch (error) {
      console.log("Distorsi riwayat:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchJejakTripMigo();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchJejakTripMigo();
  }, []);

  const renderItem = ({ item }: { item: any }) => {
    const isSelesai = item.status === 'SELESAI';
    const tgl = new Date(item.waktu).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

    const getBadgeStyle = (status: string) => {
      const s = String(status || '').toUpperCase().trim();
      if (s === 'DIBATALKAN') return { bg: '#FFEBEE', color: '#C62828', icon: 'close-circle', text: 'DIBATALKAN' };
      if (s === 'SELESAI') return { bg: '#E8F5E9', color: '#117A65', icon: 'checkmark-circle', text: 'SELESAI' };
      return { bg: '#E3F2FD', color: '#1565C0', icon: 'time', text: s };
    };

    const uiStatus = getBadgeStyle(item.status);

    return (
      <View style={styles.cardInfo}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.labelNota}>NO. INVOICE</Text>
            <Text style={styles.valueNota}>#{item.id_nota}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: uiStatus.bg }]}>
            <Ionicons name={uiStatus.icon as any} size={12} color={uiStatus.color} style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: uiStatus.color }]}>{uiStatus.text}</Text>
          </View>
        </View>
        <Text style={styles.dateText}>Dikerjakan pada: {tgl} WIB</Text>

        <View style={[styles.sectionCard, { marginTop: 14, marginBottom: 0 }]}>
          <Text style={styles.sectionTitle}> {item.tipe === 'MIGO RIDE' || item.tipe === 'MIGO DELIVERY' ? 'Rincian Titik Perjalanan' : 'Alamat Pengiriman'}</Text>
          
          <View style={styles.migoRouteBox}>
            <View style={styles.routeRow}>
              <Ionicons name="radio-button-on" size={14} color="#4A3525" />
              <Text style={styles.routeText} numberOfLines={1}>{item.jemput}</Text>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routeRow}>
              <Ionicons name="location" size={14} color="#D35400" />
              <Text style={styles.routeText} numberOfLines={2}>{item.antar}</Text>
            </View>
          </View>
        </View>

        {/* 🚀 AKUNTANSI TRANSPARAN DRIVER */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Buku Akuntansi Trip</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Metode Transaksi</Text>
            <Text style={styles.summaryValueBlack}>{item.metode}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tarif / Ongkos Kotor Driver</Text>
            <Text style={styles.summaryValueBlack}>{formatRupiah(item.ongkosKotor)}</Text>
          </View>

          <View style={styles.summaryBoxMerah}>
             <View style={styles.summaryRow}>
               <Text style={styles.summaryLabelPotongan}>Titipan Biaya Layanan (Dari Warga)</Text>
               <Text style={styles.summaryValueRed}>- {formatRupiah(item.titipanBiayaLayanan)}</Text>
             </View>
             <View style={[styles.summaryRow, {marginBottom: 0}]}>
               <Text style={styles.summaryLabelPotongan}>Potongan Komisi Aplikasi (10%)</Text>
               <Text style={styles.summaryValueRed}>- {formatRupiah(item.komisiAplikasi)}</Text>
             </View>
             <View style={styles.dividerLine} />
             <View style={[styles.summaryRow, {marginBottom: 0}]}>
               <Text style={[styles.summaryLabelPotongan, {fontWeight: 'bold', color: '#C62828'}]}>Total Saldo Ditarik Sistem</Text>
               <Text style={[styles.summaryValueRed, {fontWeight: '900'}]}>- {formatRupiah(item.totalPemotonganSaldo)}</Text>
             </View>
          </View>
          
          <View style={[styles.summaryRow, {marginTop: 10}]}>
            <Text style={styles.totalLabel}>Uang Bersih Driver</Text>
            <Text style={[styles.totalValueBig, { color: isSelesai ? '#2E7D32' : '#757575' }]}>
              {formatRupiah(item.pendapatanBersih > 0 ? item.pendapatanBersih : 0)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.mainWrapper}>
      <Stack.Screen 
        options={{
          headerShown: true,
          headerTitle: 'Buku Catatan Trip Driver',
          headerTintColor: '#fff',
          headerStyle: { backgroundColor: '#111' },
          headerTitleStyle: { fontWeight: 'bold', fontSize: 14 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 5, marginRight: 15 }}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          ),
        }} 
      />
      <StatusBar barStyle="light-content" backgroundColor="#111" />

      <View style={styles.container}>
        <View style={styles.summaryHeaderBox}>
          <View style={styles.summaryLeft}>
            <Text style={styles.summaryLabelWhite}>Total Trip Sukses:</Text>
            <Text style={styles.summaryValueNum}>{riwayatList.filter(t => t.status === 'SELESAI').length} Rute</Text>
          </View>
          <View style={styles.summaryRight}>
            <Text style={styles.summaryLabelWhite}>Akumulasi Bersih:</Text>
            <Text style={styles.summaryValueCash}>{formatRupiah(totalPendapatanTrip)}</Text>
          </View>
        </View>

        <Text style={styles.listGroupTitle}>DAFTAR LOG RITASE HARI INI</Text>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#D35400" />
            <Text style={styles.loadingText}>Membuka buku besar log pengantaran...</Text>
          </View>
        ) : riwayatList.length > 0 ? (
          <FlatList
            data={riwayatList}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.listContent, { paddingBottom: 20 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#D35400"]} />}
            renderItem={renderItem}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="route" size={54} color="#D7CCC8" />
            <Text style={styles.emptyTitle}>Buku Log Masih Bersih</Text>
            <Text style={styles.emptySubtitle}>Mitra Kurir belum memiliki catatan penyelesaian trip antar paket hari ini. Nyalakan sakelar radar harian dan sikat muatan yang mengantre pasar!</Text>
          </View>
        )}
      </View>
      <View style={{ height: insets.bottom, backgroundColor: '#4A3525' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: '#4A3525' },
  container: { flex: 1, backgroundColor: '#FDFCFB' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDFCFB', paddingTop: 40 },
  loadingText: { marginTop: 12, color: '#D35400', fontSize: 12, fontWeight: '500' },
  summaryHeaderBox: { flexDirection: 'row', backgroundColor: '#111', margin: 16, borderRadius: 14, padding: 16, elevation: 2 },
  summaryLeft: { flex: 1, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.12)' },
  summaryRight: { flex: 1, paddingLeft: 16, justifyContent: 'center' },
  summaryLabelWhite: { fontSize: 10, color: '#BCAAA4', fontWeight: '500' },
  summaryValueNum: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginTop: 4 },
  summaryValueCash: { fontSize: 18, fontWeight: '900', color: '#10B981', marginTop: 4 },
  listGroupTitle: { fontSize: 10, fontWeight: 'bold', color: '#A1887F', letterSpacing: 1, marginHorizontal: 20, marginBottom: 10, marginTop: 4 },
  listContent: { paddingHorizontal: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingTop: 40 },
  emptyTitle: { fontSize: 15, fontWeight: 'bold', color: '#111', marginTop: 16 },
  emptySubtitle: { fontSize: 12, color: '#8D6E63', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  cardInfo: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 14, elevation: 1, borderWidth: 1, borderColor: '#EBE7DF' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, 
  labelNota: { fontSize: 10, color: '#8D6E63', fontWeight: 'bold', letterSpacing: 0.5 }, 
  valueNota: { fontSize: 14, fontWeight: '900', color: '#4A3525', marginTop: 2, fontFamily: 'monospace' }, 
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }, 
  statusText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.3 }, 
  dateText: { fontSize: 10, color: '#A1887F', marginTop: 10, fontWeight: '500' }, 
  sectionCard: { backgroundColor: '#fff', marginTop: 10, paddingTop: 16, borderTopWidth: 1, borderColor: '#EFEBE9' }, 
  sectionTitle: { fontSize: 11, fontWeight: 'bold', color: '#4A3525', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }, 
  migoRouteBox: { backgroundColor: '#FDFCFB', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#EFEBE9' }, 
  routeRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 20 }, 
  routeLine: { width: 1, height: 12, backgroundColor: '#E0E0E0', marginLeft: 6, marginVertical: 2 }, 
  routeText: { fontSize: 12, color: '#4A3525', marginLeft: 10, fontWeight: '500', lineHeight: 16 }, 
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }, 
  summaryLabel: { fontSize: 11, color: '#757575', fontWeight: '500' }, 
  summaryValueBlack: { fontSize: 12, fontWeight: 'bold', color: '#111' }, 
  summaryBoxMerah: { backgroundColor: '#FFF5F5', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FEE2E2', marginTop: 4 },
  summaryLabelPotongan: { fontSize: 10, color: '#C62828', fontWeight: '500' },
  summaryValueRed: { fontSize: 11, fontWeight: 'bold', color: '#C62828' }, 
  dividerLine: { height: 1, backgroundColor: '#FFCDD2', borderStyle: 'dashed', marginVertical: 8 }, 
  totalLabel: { fontSize: 13, fontWeight: '900', color: '#4A3525' }, 
  totalValueBig: { fontSize: 16, fontWeight: '900', color: '#10B981' }
});