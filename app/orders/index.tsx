// @ts-nocheck
import React, { useEffect, useState, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  StatusBar,
  Dimensions,
  Alert,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../supabaseConfig';

const { width } = Dimensions.get('window');

interface Order {
  id_asli: string; 
  id_pesanan: string;
  navigator_status?: string;
  tanggal: string;
  total_bayar: number;
  status: 'PENDING' | 'DIPROSES' | 'DIKIRIM' | 'DIANTAR' | 'MENUJU_JEMPUT' | 'SELESAI' | 'DIBATALKAN';
  jumlah_item: number;
  produk_sampel: string;
  driver_id?: string;
  id_toko_order?: string; 
  ongkos_kirim?: number;
  asal_tabel: 'orders' | 'migo_orders'; 
  is_jasa: boolean; 
}

export default function OrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const fetchRiwayatBelanjaWarga = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const uid = session.user.id;

      const [resOrders, resMigoOrders] = await Promise.all([
        supabase.from('orders').select('id, created_at, total_pembayaran, status_order, kurir_id, toko_id, biaya_ongkir').or(`pembeli_id.eq.${uid},user_id_pembeli.eq.${uid}`),
        supabase.from('migo_orders').select('id, created_at, total_pembayaran, status_order, driver_id, tipe_layanan, jarak_km').or(`pembeli_id.eq.${uid}`)
      ]);

      let gabunganNotaRaw: any[] = [];

      if (!resOrders.error && resOrders.data) {
        gabunganNotaRaw = [...gabunganNotaRaw, ...resOrders.data.map(o => ({ ...o, asal_tabel: 'orders' }))];
      }
      if (!resMigoOrders.error && resMigoOrders.data) {
        gabunganNotaRaw = [...gabunganNotaRaw, ...resMigoOrders.data.map(m => ({ ...m, asal_tabel: 'migo_orders', kurir_id: m.driver_id }))];
      }

      if (gabunganNotaRaw.length === 0) {
        setOrders([]);
        return;
      }

      const listIdOrderPasar = gabunganNotaRaw.filter(o => o.asal_tabel === 'orders').map(o => o.id);

      let dataItems = [];
      let dataProduk = [];
      if (listIdOrderPasar.length > 0) {
        const { data: items } = await supabase
          .from('order_items')
          .select('id, order_id, id_produk_order, kuantitas')
          .in('order_id', listIdOrderPasar);
        if (items) dataItems = items;

        const { data: prod } = await supabase.from('produk').select('id_produk, nama_produk, kategori_produk');
        if (prod) dataProduk = prod;
      }

      const produkMap = new Map(dataProduk?.map(p => [String(p.id_produk), p.nama_produk]) || []);
      const kategoriMap = new Map(dataProduk?.map(p => [String(p.id_produk), String(p.kategori_produk || '').toUpperCase().trim()]) || []);

      const itemsByOrderMap = new Map<string, any[]>();
      dataItems?.forEach(item => {
        const oId = item.order_id;
        if (!itemsByOrderMap.has(oId)) itemsByOrderMap.set(oId, []);
        itemsByOrderMap.get(oId)?.push(item);
      });

      const formatOrders: Order[] = gabunganNotaRaw.map((nota: any) => {
        const isMigo = nota.asal_tabel === 'migo_orders';
        
        let namaProdukPertama = isMigo ? (nota.tipe_layanan === 'PAMILO_DELIVERY' ? 'Pengiriman Pesanan' : 'Layanan Ojek MIGO') : 'Produk Belanjaan';
        let totalKuantitasJenisItem = isMigo ? 1 : 0;
        let orderanIniJasa = false;

        if (!isMigo) {
          const subItems = itemsByOrderMap.get(nota.id) || [];
          totalKuantitasJenisItem = subItems.length;
          const itemPertama = subItems[0];
          const targetIdProduk = itemPertama ? itemPertama.id_produk_order : null;
          
          if (targetIdProduk) {
            const searchNama = produkMap.get(String(targetIdProduk));
            if (searchNama) namaProdukPertama = searchNama;
          }

          // 🎯 SENSOR 3 PILAR: Tandai true jika kolom kategori_produk berisi murni SERVIS
          subItems.forEach(item => {
            const pKat = kategoriMap.get(String(item.id_produk_order)) || '';
            if (pKat === 'SERVIS') {
              orderanIniJasa = true;
            }
          });
        }

        const tanggalLokal = nota.created_at
          ? new Date(nota.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
          : 'Hari Ini';

        return {
          id_asli: nota.id, 
          id_pesanan: nota.id.substring(0, 8).toUpperCase(), 
          tanggal: tanggalLokal,
          total_bayar: Number(nota.total_pembayaran || 0),
          status: String(nota.status_order || 'PENDING').toUpperCase() as any,
          text_status_raw: String(nota.status_order || 'PENDING').toUpperCase(),
          jumlah_item: totalKuantitasJenisItem,
          produk_sampel: namaProdukPertama,
          driver_id: nota.kurir_id || null,      
          id_toko_order: nota.toko_id || null,  
          ongkos_kirim: Number(nota.biaya_ongkir || 0),
          asal_tabel: nota.asal_tabel,
          is_jasa: orderanIniJasa
        };
      });

      formatOrders.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      setOrders(formatOrders);

    } catch (error: any) {
      console.error("Sirkuit riwayat transaksi putus:", error);
      Alert.alert("Gagal Memuat", `Sistem gagal menarik nota belanja.`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchRiwayatBelanjaWarga(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRiwayatBelanjaWarga();
  }, []);

  const handleKonfirmasiSelesai = async (order: Order) => {
    Alert.alert(
      "Konfirmasi Selesai Transaksi",
      `Apakah layanan/pesanan #${order.id_pesanan} sudah tuntas terpenuhi?`,
      [
        { text: "Belum", style: "cancel" },
        {
          text: "Ya, Selesai 🏁",
          onPress: async () => {
            try {
              setLoadingAction(order.id_asli);
              
              const { error: updateError } = await supabase
                .from(order.asal_tabel)
                .update({ status_order: 'SELESAI' })
                .eq('id', order.id_asli);

              if (updateError) throw updateError;

              Alert.alert("Sukses Selesai 🎉", `Terima kasih! Saldo pembayaran aman diteruskan murni ke pihak penyedia mitra.`);
              fetchRiwayatBelanjaWarga();
            } catch (err: any) {
              Alert.alert("Gagal Menyelesaikan", err.message || err);
            } finally {
              setLoadingAction(null);
            }
          }
        }
      ]
    );
  };

  // 🎯 RE-KALIBRASI STATUS: Khusus untuk Pamilo Servis (is_jasa = true) status di-render murni bypass kurir
  const dapatkanWarnaStatus = (status: string, isJasa: boolean) => {
    switch (status) {
      case 'PENDING': case 'MENCARI_DRIVER': case 'MENCARI_KURIR': 
        return { bg: '#FEF9E7', teks: '#E67E22', ikon: 'time-outline', label: isJasa ? 'MENUNGGU KONFIRMASI MITRA' : 'MENCARI DRIVER MIGO' };
      case 'DIPROSES': case 'MENUJU_JEMPUT':
        return { bg: '#E8F8F5', teks: '#2E7D32', ikon: 'cube-outline', label: isJasa ? 'SEDANG DIKERJAKAN MITRA' : 'DIPROSES MITRA' };
      case 'DIKIRIM': case 'DIANTAR':
        return { bg: '#EBF5FB', teks: '#2980B9', ikon: 'bicycle-outline', label: isJasa ? 'MITRA SERVIS MENUJU LOKASI' : 'SEDANG DIANTAR KURIR' };
      case 'SELESAI': 
        return { bg: '#E8F8F5', teks: '#117A65', ikon: 'checkmark-circle-outline', label: 'SELESAI' };
      default: 
        return { bg: '#FFEBEE', teks: '#C62828', ikon: 'close-circle-outline', label: 'DIBATALKAN' };
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: true,
          headerTitle: 'Riwayat Transaksi',
          headerTintColor: '#fff',
          headerStyle: { backgroundColor: '#4A3525' },
          headerTitleStyle: { fontWeight: 'bold', fontSize: 15 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 5, marginRight: 10 }}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          ),
        }} 
      />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />

      {loading ? (
        <View style={styles.centerEmpty}>
          <ActivityIndicator size="large" color="#4A3525" />
          <Text style={styles.loadingText}>Membuka brankas riwayat transaksi...</Text>
        </View>
      ) : orders.length > 0 ? (
        <FlatList
          data={orders}
          keyExtractor={(item, index) => `${item.id_pesanan}-${index}`}
          contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#4A3525"]} />
          }
          renderItem={({ item }) => {
            const temaStatus = dapatkanWarnaStatus(item.text_status_raw, item.is_jasa);
            const isBisaDiselesaikan = ['DIPROSES', 'DIKIRIM', 'DIANTAR', 'MENUJU_JEMPUT'].includes(item.text_status_raw);
            
            return (
              <View style={styles.orderCard}>
                
                <View style={styles.cardHeader}>
                  <View style={styles.invoiceGroup}>
                    <Ionicons name="receipt-outline" size={14} color="#8D6E63" />
                    <Text style={styles.invoiceText}>NOTA: #{item.id_pesanan}</Text>
                  </View>
                  
                  <View style={[styles.statusBadge, { backgroundColor: temaStatus.bg }]}>
                    <Ionicons name={temaStatus.ikon as any} size={11} color={temaStatus.teks} style={{ marginRight: 4 }} />
                    <Text style={[styles.statusText, { color: temaStatus.teks }]}>{temaStatus.label}</Text>
                  </View>
                </View>

                <View style={styles.cardBodyInfo}>
                  <Text style={styles.dateText}>{item.tanggal}</Text>
                  <Text style={styles.productSample} numberOfLines={1}>{item.produk_sampel}</Text>
                  {item.jumlah_item > 1 && (
                    <Text style={styles.extraItems}>+{item.jumlah_item - 1} varian layanan/produk lainnya</Text>
                  )}
                </View>

                <View style={styles.divider} />

                <View style={styles.cardFooter}>
                  <View style={styles.priceContainer}>
                    <Text style={styles.totalLabel}>{item.is_jasa ? 'Total Biaya Jasa:' : 'Total Ditagihkan:'}</Text>
                    <Text style={styles.totalPrice}>Rp {item.total_bayar.toLocaleString('id-ID')}</Text>
                    <Text style={styles.subLabel}>{item.is_jasa ? '(Sudah Termasuk Layanan)' : '(Termasuk Ongkir & Layanan)'}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    
                    {/* TOMBOL CHAT KILAT */}
                    {item.status !== 'SELESAI' && item.status !== 'DIBATALKAN' && (
                      <TouchableOpacity 
                        style={styles.btnChatKilat}
                        onPress={() => {
                          // 🎯 LOCK ABSOLUT: Jika orderan Pamilo Servis (is_jasa = true), jalur obrolan langsung dikunci mati ke id_toko_order (Bypass Kurir!)
                          const targetReceiver = item.is_jasa ? item.id_toko_order : ((item.text_status_raw === 'PENDING' || item.text_status_raw === 'MENCARI_DRIVER' || item.text_status_raw === 'MENCARI_KURIR') ? item.id_toko_order : item.driver_id);
                          
                          if (!targetReceiver) {
                            return Alert.alert("Mitra Belum Siap 🛠️", "Pesanan Jasa belum dikonfirmasi oleh Penyedia Servis.");
                          }

                          router.push({
                            pathname: `/chat/${item.id_asli}`,
                            params: { receiver_id: targetReceiver }
                          });
                        }}
                      >
                        <Ionicons name="chatbubble-ellipses-outline" size={13} color="#4A3525" style={{ marginRight: 4 }} />
                        <Text style={styles.btnChatText}>Chat</Text>
                      </TouchableOpacity>
                    )}

                    {/* TOMBOL AKSI */}
                    {isBisaDiselesaikan ? (
                      loadingAction === item.id_asli ? (
                        <ActivityIndicator size="small" color="#117A65" style={{ paddingHorizontal: 15 }} />
                      ) : (
                        <TouchableOpacity 
                          style={[styles.btnDetail, { backgroundColor: '#117A65', borderColor: '#117A65' }]} 
                          onPress={() => handleKonfirmasiSelesai(item)}
                        >
                          <Text style={[styles.btnDetailText, { color: '#fff' }]}>Selesaikan</Text>
                        </TouchableOpacity>
                      )
                    ) : (
                      <TouchableOpacity 
                        style={styles.btnDetail} 
                        onPress={() => {
                          if (item.asal_tabel === 'migo_orders') {
                            router.push(`/orders/detail-migo?id=${item.id_asli}`);
                          } else {
                            router.push(`/orders/detail?id=${item.id_asli}`); 
                          }
                        }}
                      >
                        <Text style={styles.btnDetailText}>Lihat Detail</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

              </View>
            );
          }}
        />
      ) : (
        <View style={styles.centerEmpty}>
          <FontAwesome5 name="file-invoice-dollar" size={54} color="#D7CCC8" />
          <Text style={styles.emptyTitle}>Belum Ada Transaksi</Text>
          <Text style={styles.emptySubtitle}>Kamu belum pernah melakukan transaksi check-out produk ataupun ojek di pasar PAMILO Ciamis.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDFCFB' },
  listContainer: { padding: 16 },
  loadingText: { marginTop: 12, fontSize: 12, color: '#8D6E63', fontWeight: '500' },
  orderCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#EFEBE9', elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10 },
  invoiceGroup: { flexDirection: 'row', alignItems: 'center' },
  invoiceText: { fontSize: 11, fontWeight: 'bold', color: '#4A3525', marginLeft: 6, fontFamily: 'monospace' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  cardBodyInfo: { paddingVertical: 2 }, 
  dateText: { fontSize: 11, color: '#A1887F' },
  productSample: { fontSize: 13, fontWeight: '600', color: '#4A3525', marginTop: 4 },
  extraItems: { fontSize: 11, color: '#8D6E63', marginTop: 2, fontStyle: 'italic' },
  divider: { height: 1, backgroundColor: '#F5F5F5', marginVertical: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceContainer: { flex: 1 },
  totalLabel: { fontSize: 11, color: '#A1887F' },
  totalPrice: { fontSize: 14, fontWeight: '900', color: '#D35400', marginTop: 1 },
  subLabel: { fontSize: 9, color: '#BCAAA4', marginTop: 2, fontStyle: 'italic' },
  btnDetail: { borderWidth: 1, borderColor: '#4A3525', paddingHorizontal: 14, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  btnDetailText: { color: '#4A3525', fontSize: 11, fontWeight: 'bold' },
  centerEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 15, fontWeight: 'bold', color: '#4A3525', marginTop: 16 },
  emptySubtitle: { fontSize: 12, color: '#8D6E63', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  btnChatKilat: { flexDirection: 'row', borderWidth: 1, borderColor: '#4A3525', backgroundColor: '#FFF8F4', paddingHorizontal: 12, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  btnChatText: { color: '#4A3525', fontSize: 11, fontWeight: 'bold' }
});