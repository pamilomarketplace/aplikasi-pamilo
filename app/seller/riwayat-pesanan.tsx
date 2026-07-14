import React, { useState, useCallback } from 'react';
import { 
  StyleSheet, Text, View, FlatList, 
  StatusBar, ActivityIndicator, RefreshControl 
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../supabaseConfig';

export default function RiwayatPesananSellerScreen() {
  const insets = useSafeAreaInsets();
  const [riwayatOrders, setRiwayatOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRiwayatPesanan = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: merchantRow } = await supabase
        .from('toko')
        .select('id_toko')
        .eq('user_id_toko', session.user.id)
        .maybeSingle();

      if (!merchantRow) return;

      const { data, error } = await supabase
        .from('order_items')
        .select(`
          id, kuantitas, harga_satuan, status_item, 
          produk!fk_order_items_produk ( nama_produk, kategori_produk, kategori_label_produk ),
          orders!inner ( 
            id, pembeli_id, status_order, alamat_pengiriman, created_at, 
            total_pembayaran, metode_pembayaran, layanan,
            biaya_ongkir, biaya_penanganan, potongan_diskon,
            users!pembeli_id ( user_name, user_phone ) 
          )
        `)
        .eq('penjual_id', merchantRow.id_toko)
        .in('orders.status_order', ['SELESAI', 'DIBATALKAN']) 
        .order('id', { ascending: false });

      if (error) throw error;

      if (data) {
        const formatHistory = data.map((item: any) => {
          const kategoriDariDb = String(item.produk?.kategori_label_produk || item.produk?.kategori_produk || 'UMUM').toUpperCase();
          const layananInduk = String(item.orders?.layanan || '').toUpperCase();
          
          let pilar = 'MART';
          if (layananInduk === 'SERVIS' || layananInduk === 'JASA' || kategoriDariDb.includes('SERVIS') || kategoriDariDb.includes('JASA')) pilar = 'SERVIS';
          else if (kategoriDariDb.includes('FOOD') || kategoriDariDb.includes('MAKANAN')) pilar = 'FOOD';

          return {
            id_item: item.id,
            id_nota: item.orders?.id ? item.orders.id.substring(0, 8).toUpperCase() : 'N/A',
            nama_pembeli: item.orders?.users?.user_name || 'Warga PAMILO',
            nama_produk: item.produk?.nama_produk || 'Produk/Jasa',
            pilar_kategori: pilar,
            kuantitas: Number(item.kuantitas || 1),
            total_harga_item: Number(item.harga_satuan || 0) * Number(item.kuantitas || 0),
            
            // Info Billing Induk
            total_pembayaran_induk: item.orders?.total_pembayaran || 0,
            biaya_ongkir_induk: item.orders?.biaya_ongkir || 0,
            biaya_penanganan_induk: item.orders?.biaya_penanganan || 0,
            potongan_diskon_induk: item.orders?.potongan_diskon || 0,
            metode_pembayaran_induk: item.orders?.metode_pembayaran || 'TUNAI',
            
            status_item: item.orders?.status_order || item.status_item, 
            tanggal: item.orders?.created_at ? new Date(item.orders.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'
          };
        });
        setRiwayatOrders(formatHistory);
      }
    } catch (err) { console.log("Gagal tarik arsip:", err); } 
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchRiwayatPesanan(); }, []));

  const renderBadge = (status: string) => {
    const isSelesai = status === 'SELESAI';
    return (
      <View style={[styles.badge, isSelesai ? { backgroundColor: '#E8F5E9' } : { backgroundColor: '#FFEBEE' }]}>
        <Text style={[styles.badgeTxt, isSelesai ? { color: '#2E7D32' } : { color: '#C62828' }]}>
          {isSelesai ? 'BERHASIL SELESAI' : 'DIBATALKAN'}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerTitle: 'Arsip Riwayat Penjualan', headerStyle: { backgroundColor: '#4A3525' }, headerTintColor: '#fff' }} />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />

      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#4A3525" /></View>
      ) : (
        <FlatList
          data={riwayatOrders}
          keyExtractor={(item) => item.id_item.toString()}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRiwayatPesanan(); }} colors={["#4A3525"]} />}
          ListEmptyComponent={() => (
            <View style={styles.emptyBox}>
              <MaterialCommunityIcons name="history" size={44} color="#D7CCC8" />
              <Text style={styles.emptyTxt}>Belum ada riwayat pesanan yang selesai atau dibatalkan.</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const isBatal = item.status_item === 'DIBATALKAN';
            const isJasa = item.pilar_kategori === 'SERVIS';
            const isFood = item.pilar_kategori === 'FOOD';
            const isSaldo = String(item.metode_pembayaran_induk).toUpperCase().includes('SALDO');

            return (
              <View style={[styles.card, isBatal && { opacity: 0.7 }]}>
                <View style={styles.cardHead}>
                  <Text style={[styles.notaTxt, isBatal && { textDecorationLine: 'line-through', color: '#9E9E9E' }]}>NOTA: #{item.id_nota}</Text>
                  {renderBadge(item.status_item)}
                </View>
                
                <View style={styles.cardBody}>
                  <Text style={styles.dateTxt}>{item.tanggal} WIB</Text>
                  <Text style={styles.buyerTxt}>👤 {item.nama_pembeli}</Text>
                  
                  <View style={styles.productRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.productTxt, isBatal && { textDecorationLine: 'line-through', color: '#9E9E9E' }]}>{item.nama_produk}</Text>
                      <Text style={styles.qtyTxt}>{isJasa ? 'Sesi/Jam' : 'Kuantitas'}: {item.kuantitas}x</Text>
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: isJasa ? '#6A1B9A' : (isFood ? '#E65100' : '#0277BD'), marginTop: 4 }}>
                        🏷️ {isJasa ? 'PAMILO SERVIS' : (isFood ? 'PAMILO FOOD' : 'PAMILO MART')}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.incomeLbl}>{isJasa ? 'Tarif Layanan' : 'Harga Barang'}</Text>
                      <Text style={[styles.incomeVal, isBatal && { textDecorationLine: 'line-through', color: '#9E9E9E' }]}>
                        Rp {item.total_harga_item.toLocaleString('id-ID')}
                      </Text>
                    </View>
                  </View>

                  {/* 🔥 INFO BILLING LENGKAP ARSIP */}
                  <View style={[styles.billingContainer, isBatal && { borderColor: '#E0E0E0', backgroundColor: '#F5F5F5' }]}>
                    <View style={styles.billingRow}>
                      <Text style={styles.billingLabel}>Metode Pembayaran</Text>
                      <Text style={[styles.billingValue, { color: isBatal ? '#9E9E9E' : (isSaldo ? '#2E7D32' : '#D35400') }]}>
                        {isSaldo ? '💳 SALDO (Pamilo-Pay)' : '💵 TUNAI / COD'}
                      </Text>
                    </View>
                    
                    <View style={styles.billingRow}>
                      <Text style={styles.billingLabel}>{isJasa ? 'Transport Teknisi' : 'Ongkos Kirim'}</Text>
                      <Text style={[styles.billingValue, isBatal && { color: '#9E9E9E' }]}>Rp {item.biaya_ongkir_induk.toLocaleString('id-ID')}</Text>
                    </View>

                    {item.biaya_penanganan_induk > 0 && (
                      <View style={styles.billingRow}>
                        <Text style={styles.billingLabel}>Biaya Layanan Aplikasi</Text>
                        <Text style={[styles.billingValue, isBatal && { color: '#9E9E9E' }]}>Rp {item.biaya_penanganan_induk.toLocaleString('id-ID')}</Text>
                      </View>
                    )}

                    {item.potongan_diskon_induk > 0 && (
                      <View style={styles.billingRow}>
                        <Text style={[styles.billingLabel, { color: isBatal ? '#9E9E9E' : '#00796B' }]}>Potongan Promo</Text>
                        <Text style={[styles.billingValue, { color: isBatal ? '#9E9E9E' : '#00796B' }]}>- Rp {item.potongan_diskon_induk.toLocaleString('id-ID')}</Text>
                      </View>
                    )}

                    <View style={styles.totalBillDivider} />
                    <View style={styles.billingRow}>
                      <Text style={styles.totalBillLabel}>TOTAL TAGIHAN WARGA</Text>
                      <Text style={[styles.totalBillValue, isBatal && { textDecorationLine: 'line-through', color: '#9E9E9E' }]}>
                        Rp {item.total_pembayaran_induk.toLocaleString('id-ID')}
                      </Text>
                    </View>
                  </View>

                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#EFEBE9', marginBottom: 16, elevation: 0.5 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#FDFCFB', borderBottomWidth: 1, borderBottomColor: '#EFEBE9', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  notaTxt: { fontSize: 12, fontWeight: '900', color: '#4A3525' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 0.3 },
  cardBody: { padding: 16 },
  dateTxt: { fontSize: 10, color: '#A1887F', marginBottom: 6 },
  buyerTxt: { fontSize: 13, fontWeight: 'bold', color: '#1A0F05', marginBottom: 12 },
  productRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  productTxt: { fontSize: 14, fontWeight: 'bold', color: '#4A3525' },
  qtyTxt: { fontSize: 11, color: '#8D6E63', marginTop: 4 },
  incomeLbl: { fontSize: 9, color: '#8D6E63', marginBottom: 2, textAlign: 'right', textTransform: 'uppercase', letterSpacing: 0.3 },
  incomeVal: { fontSize: 14, fontWeight: '900', color: '#4A3525' },

  billingContainer: { backgroundColor: '#FFF8F4', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FFCCBC' },
  billingRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' },
  billingLabel: { fontSize: 11, color: '#7D665E', fontWeight: '500' },
  billingValue: { fontSize: 11, fontWeight: 'bold', color: '#4A3525' },
  totalBillDivider: { height: 1, backgroundColor: '#FFCCBC', marginVertical: 6 },
  totalBillLabel: { fontSize: 11, fontWeight: '900', color: '#4A3525' },
  totalBillValue: { fontSize: 15, fontWeight: '900', color: '#D35400' },

  emptyBox: { alignItems: 'center', paddingTop: 80 },
  emptyTxt: { marginTop: 12, fontSize: 12, color: '#A1887F', fontStyle: 'italic', textAlign: 'center' }
});