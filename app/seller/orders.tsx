// app/seller/orders.tsx
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSellerOrders } from '@/features/seller/useSellerOrders';

export default function SellerOrdersScreen() {
  const insets = useSafeAreaInsets();
  const { 
    loading, orders, router, handleTerimaOrderan, handleTolakOrderan, handlePanggilKurir, refreshData,
    alertState, alertLoading, handleAlertConfirm, closeAlert 
  } = useSellerOrders();

  const formatRupiah = (angka: number) => `Rp ${Number(angka).toLocaleString('id-ID')}`;

  const renderOrderCard = ({ item }: { item: any }) => {
    const isBaru = item.status_pesanan === 'DIPROSES';
    const isDikemas = item.status_pesanan === 'DIKEMAS';
    const isMenungguKurir = item.status_pesanan === 'SIAP_PICKUP' || item.status_pesanan === 'MENUJU_LOKASI';

    return (
      <View style={[styles.card, isBaru && styles.cardHighlight]}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderId}>ID: {item.id.substring(0,8).toUpperCase()}</Text>
          <View style={[styles.badge, isBaru ? styles.badgeNew : isDikemas ? styles.badgeProcess : styles.badgeWait]}>
            <Text style={styles.badgeText}>
              {isBaru ? '🔴 BARU MASUK' : isDikemas ? '🍳 SEDANG DIKEMAS' : '🛵 MENUNGGU KURIR'}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Item Belanjaan:</Text>
        {item.item_pesanan?.map((produk: any, idx: number) => (
          <View key={idx} style={styles.itemRow}>
            <Text style={styles.itemName}>• {produk.produk?.nama_produk} <Text style={styles.itemQty}>x{produk.kuantitas}</Text></Text>
          </View>
        ))}

        <View style={styles.summaryRow}>
          <Text style={styles.metodeText}>Pembayaran: <Text style={{fontWeight: 'bold'}}>{item.metode_pembayaran.replace('_', ' ')}</Text></Text>
          <Text style={styles.hargaText}>Total: {formatRupiah(item.subtotal_produk)}</Text>
        </View>

        <View style={styles.actionContainer}>
          {isBaru && (
            <View style={styles.splitBtnRow}>
              <TouchableOpacity style={styles.btnTolak} onPress={() => handleTolakOrderan(item.id)}>
                <Ionicons name="close-circle" size={18} color="#E74C3C" />
                <Text style={styles.btnTolakText}>Tolak</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.btnTerimaSplit} onPress={() => handleTerimaOrderan(item.id)}>
                <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                <Text style={styles.btnText}>Terima</Text>
              </TouchableOpacity>
            </View>
          )}

          {isDikemas && (
            <TouchableOpacity style={styles.btnPanggil} onPress={() => handlePanggilKurir(item.id)}>
              <Ionicons name="megaphone" size={20} color="#FFF" />
              <Text style={styles.btnText}>Pesanan Siap (Panggil Kurir)</Text>
            </TouchableOpacity>
          )}

          {isMenungguKurir && (
            <View style={styles.btnDisabledState}>
              <ActivityIndicator size="small" color="#E65100" style={{marginRight: 8}} />
              <Text style={styles.btnDisabledText}>Menunggu Kurir Datang Mengambil...</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#4A3420" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Dapur / Radar Toko 🏪</Text>
        <TouchableOpacity style={styles.backBtn} onPress={refreshData}><Ionicons name="refresh" size={24} color="#FFF" /></TouchableOpacity>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrderCard}
        contentContainerStyle={styles.listPadding}
        refreshing={loading}
        onRefresh={refreshData}
        ListEmptyComponent={
          <View style={styles.centerEmpty}>
            <Ionicons name="cafe-outline" size={60} color="#C0A995" />
            <Text style={styles.emptyTitle}>Belum Ada Pesanan Masuk</Text>
            <Text style={styles.emptySub}>Pesanan yang di-checkout pembeli akan otomatis muncul di sini.</Text>
          </View>
        }
      />

      <View style={styles.alertOverlay && !alertState.visible ? { display: 'none' } : null}>
        <Modal transparent visible={alertState.visible} animationType="fade" onRequestClose={closeAlert}>
          <View style={styles.alertOverlay}>
            <View style={styles.alertBox}>
              <Text style={styles.alertTitle}>{alertState.title}</Text>
              <Text style={styles.alertMessage}>{alertState.message}</Text>
              <View style={styles.alertActionRow}>
                {alertState.isConfirm && (
                  <TouchableOpacity style={styles.alertCancelBtn} onPress={closeAlert} disabled={alertLoading}>
                    <Text style={styles.alertCancelBtnText}>Tidak</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.alertConfirmBtn} onPress={handleAlertConfirm} disabled={alertLoading}>
                  {alertLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.alertConfirmBtnText}>{alertState.isConfirm ? 'Ya, Yakin' : 'Oke Mengerti'}</Text>}
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
  header: { backgroundColor: '#4A3420', height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, justifyContent: 'space-between', elevation: 4 },
  backBtn: { padding: 5 },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  listPadding: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 16, elevation: 2, borderWidth: 1, borderColor: '#E0D0C0' },
  cardHighlight: { borderColor: '#E74C3C', borderWidth: 2, backgroundColor: '#FFFDFD' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontSize: 12, color: '#7A6450', fontWeight: 'bold' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeNew: { backgroundColor: '#E74C3C' },
  badgeProcess: { backgroundColor: '#F1C40F' },
  badgeWait: { backgroundColor: '#3498DB' },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#E0D0C0', marginVertical: 12 },
  sectionTitle: { fontSize: 12, color: '#A1887F', fontWeight: 'bold', marginBottom: 6 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  itemName: { fontSize: 14, color: '#4A3420', fontWeight: '500', flex: 1 },
  itemQty: { color: '#E28743', fontWeight: 'bold' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E0D0C0' },
  metodeText: { fontSize: 12, color: '#7A6450' },
  hargaText: { fontSize: 14, fontWeight: 'bold', color: '#4A3420' },
  actionContainer: { marginTop: 16 },
  
  splitBtnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  // 🚀 FIX: Menghapus 'borderSide: 1' yang membuat error TypeScript
  btnTolak: { flex: 0.4, backgroundColor: '#FDEDEC', borderWidth: 1, borderColor: '#E74C3C', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 48, borderRadius: 12, gap: 6 },
  btnTolakText: { color: '#E74C3C', fontSize: 14, fontWeight: 'bold' },
  btnTerimaSplit: { flex: 0.6, backgroundColor: '#E74C3C', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 48, borderRadius: 12, gap: 8 },
  
  btnPanggil: { backgroundColor: '#2ECC71', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 48, borderRadius: 12, gap: 8 },
  btnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  btnDisabledState: { backgroundColor: '#FFF3E0', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#FFB74D' },
  btnDisabledText: { color: '#E65100', fontSize: 12, fontWeight: 'bold' },
  centerEmpty: { alignItems: 'center', marginTop: 100 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#7A6450', marginTop: 12 },
  emptySub: { fontSize: 12, color: '#A1887F', textAlign: 'center', marginTop: 6, paddingHorizontal: 40 },
  
  alertOverlay: { flex: 1, backgroundColor: 'rgba(74, 52, 32, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  alertBox: { width: '100%', backgroundColor: '#FFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E0D0C0', elevation: 10 },
  alertTitle: { fontSize: 16, fontWeight: 'bold', color: '#4A3420', textAlign: 'center' },
  alertMessage: { fontSize: 13, color: '#7A6450', textAlign: 'center', marginTop: 8, lineHeight: 18, fontWeight: '500' },
  alertActionRow: { flexDirection: 'row', gap: 12, marginTop: 20, width: '100%' },
  alertCancelBtn: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, borderColor: '#C0A995', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF6F0' },
  alertCancelBtnText: { color: '#7A6450', fontWeight: 'bold', fontSize: 13 },
  alertConfirmBtn: { flex: 1, height: 44, borderRadius: 10, backgroundColor: '#2ECC71', justifyContent: 'center', alignItems: 'center' },
  alertConfirmBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 }
});