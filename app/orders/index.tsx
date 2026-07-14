// app/orders/index.tsx
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrderHistory, OrderHistoryItem } from '@/features/orders/useOrderHistory';

export default function OrderHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loading, orders, refreshHistory } = useOrderHistory();

  const renderOrderCardRow = ({ item }: { item: OrderHistoryItem }) => {
    // Penyesuaian Status Database Asli
    const getStatusColor = (status: string) => {
      if (status === 'DIPROSES') return { bg: '#FFF3E0', text: '#E65100', label: 'Disiapkan Toko' };
      if (status === 'MENCARI_DRIVER') return { bg: '#F3E5F5', text: '#8E24AA', label: 'Mencari Kurir' };
      if (status === 'MENUJU_LOKASI') return { bg: '#E1F5FE', text: '#0288D1', label: 'Kurir Mengantar' };
      if (status === 'SELESAI') return { bg: '#E8F5E9', text: '#2E7D32', label: 'Pesanan Selesai' };
      return { bg: '#ECEFF1', text: '#37474F', label: 'Dibatalkan' };
    };
    const statusMeta = getStatusColor(item.status_pesanan);
    
    // 🚀 ASUMSI: Di dalam type OrderHistoryItem nanti Anda tambahkan properti potongan_promo
    // Karena saat ini mungkin belum ada di interface, kita bypass ke any sementara untuk UI
    const isPakaiPromo = (item as any).potongan_promo && (item as any).potongan_promo > 0;

    return (
      <TouchableOpacity 
        style={styles.historyItemCard}
        activeOpacity={0.8}
        onPress={() => router.push(`/orders/${item.id}`)}
      >
        <View style={styles.cardHeaderMeta}>
          <View style={styles.orderIdCol}>
            <Text style={styles.labelOrderTitle}>Nota Belanja PAMILO</Text>
            <Text style={styles.orderIdTextVal}>ID: {item.id.substring(0, 8).toUpperCase()}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
            <Text style={[styles.statusTextLabel, { color: statusMeta.text }]}>{statusMeta.label}</Text>
          </View>
        </View>

        <View style={styles.dividerLine} />

        <View style={styles.bodyDetailNota}>
          <Text style={styles.dateMetaText}>Waktu: {new Date(item.created_at).toLocaleDateString('id-ID')} - {new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
              <Text style={styles.priceTotalLabel}>Total Tagihan: <Text style={styles.priceOrange}>Rp {item.total_pembayaran.toLocaleString('id-ID')}</Text></Text>
              {/* 🚀 INDIKATOR PROMO DI KARTU RIWAYAT */}
              {isPakaiPromo && (
                 <View style={styles.promoBadge}>
                    <Ionicons name="pricetag" size={10} color="#27AE60"/>
                    <Text style={styles.promoText}>Promo Terpakai</Text>
                 </View>
              )}
          </View>
        </View>

        <View style={styles.btnOpenChatChannel}>
          <Ionicons name="search" size={14} color="#FFF" />
          <Text style={styles.textBtnChat}>Lacak Status & Peta</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.mainContainer, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#4A3420" />
      <View style={styles.customNavBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
        <Text style={styles.navBarTitle}>Riwayat Belanja 📋</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={refreshHistory}><Ionicons name="refresh" size={20} color="#FFF" /></TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerLoad}><ActivityIndicator size="large" color="#4A3420" /><Text style={styles.loadText}>Sinkronisasi logistik...</Text></View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrderCardRow}
          contentContainerStyle={styles.listPaddingStyle}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyHistoryContainer}>
              <Ionicons name="receipt-outline" size={54} color="#C0A995" />
              <Text style={styles.emptyTitle}>Belum Ada Riwayat Belanja</Text>
              <Text style={styles.emptySub}>Seluruh riwayat belanjaan dan status pelacakan kurir akan dimonitor secara terpusat di halaman ini.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FAF6F0' },
  customNavBar: { backgroundColor: '#4A3420', height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, elevation: 4 },
  backBtn: { width: 35, height: 40, justifyContent: 'center' },
  refreshBtn: { width: 35, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  navBarTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  centerLoad: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadText: { fontSize: 12, color: '#7A6450', fontWeight: 'bold' },
  listPaddingStyle: { padding: 14 },
  dividerLine: { height: 1, backgroundColor: '#E0D0C0', marginVertical: 10 },
  historyItemCard: { backgroundColor: '#FFF', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E0D0C0', marginBottom: 12, elevation: 1 },
  cardHeaderMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderIdCol: { gap: 2 },
  labelOrderTitle: { fontSize: 13, fontWeight: 'bold', color: '#4A3420' },
  orderIdTextVal: { fontSize: 10, color: '#A1887F', fontWeight: '500' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusTextLabel: { fontSize: 10, fontWeight: 'bold' },
  bodyDetailNota: { gap: 3, marginBottom: 12 },
  dateMetaText: { fontSize: 11, color: '#7A6450' },
  priceTotalLabel: { fontSize: 12, color: '#4A3420' },
  priceOrange: { fontWeight: 'bold', color: '#E28743', fontSize: 13 },
  promoBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F8F5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, gap: 4 },
  promoText: { fontSize: 9, color: '#27AE60', fontWeight: 'bold' },
  btnOpenChatChannel: { backgroundColor: '#E28743', flexDirection: 'row', height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 6, elevation: 1 },
  textBtnChat: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  emptyHistoryContainer: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 45, marginTop: 170 },
  emptyTitle: { fontSize: 15, fontWeight: 'bold', color: '#7A6450', marginTop: 12 },
  emptySub: { fontSize: 11, color: '#A1887F', textAlign: 'center', marginTop: 4, lineHeight: 16 }
});