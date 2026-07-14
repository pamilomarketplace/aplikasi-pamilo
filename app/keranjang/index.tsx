// app/keranjang/index.tsx
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 🚀 NAMA HOOK DISESUAIKAN KE BAHASA INDONESIA (Silakan rename file hook lama Anda)
import { useKeranjang, ItemKeranjang } from '@/features/keranjang/useKeranjang';

export default function KeranjangScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const { loading, cartItems, totalBelanja, handleUpdateQuantity, handleRemoveItem, refreshCart } = useKeranjang();

  const renderCartRow = ({ item }: { item: ItemKeranjang }) => {
    const produkDetail = item.produk;
    const hargaSatuan = produkDetail?.harga_produk || 0;
    const subtotalItem = hargaSatuan * item.kuantitas;

    return (
      <View style={styles.cartCardItem}>
        {produkDetail?.foto_produk ? (
          <Image source={{ uri: produkDetail.foto_produk }} style={styles.productPhoto} />
        ) : (
          <View style={styles.photoPlaceholder}><Ionicons name="basket" size={24} color="#A1887F" /></View>
        )}

        <View style={styles.detailsColumn}>
          <Text style={styles.productNameText} numberOfLines={1}>{produkDetail?.nama_produk || 'Komoditas Pasar'}</Text>
          {item.varian_terpilih && <Text style={styles.variantBadgeText}>Varian: {item.varian_terpilih}</Text>}
          <Text style={styles.pricePerUnitText}>Rp {hargaSatuan.toLocaleString('id-ID')} / item</Text>
          <Text style={styles.itemSubtotalText}>Total: Rp {subtotalItem.toLocaleString('id-ID')}</Text>
        </View>

        <View style={styles.actionControlCol}>
          <TouchableOpacity style={styles.btnTrash} onPress={() => handleRemoveItem(item.id)}>
            <Ionicons name="trash-outline" size={18} color="#C62828" />
          </TouchableOpacity>
          <View style={styles.counterRowGroup}>
            <TouchableOpacity style={styles.btnCounter} onPress={() => handleUpdateQuantity(item.id, item.kuantitas, 'KURANG')}>
              <Ionicons name="remove" size={14} color="#4A3420" />
            </TouchableOpacity>
            <Text style={styles.qtyNumberText}>{item.kuantitas}</Text>
            <TouchableOpacity style={styles.btnCounter} onPress={() => handleUpdateQuantity(item.id, item.kuantitas, 'TAMBAH')}>
              <Ionicons name="add" size={14} color="#4A3420" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.mainContainer, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor="#4A3420" />

      <View style={[styles.customNavBar, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.navBarTitle}>Keranjang Warga 🛒</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={refreshCart}>
          <Ionicons name="refresh" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerLoad}>
          <ActivityIndicator size="large" color="#4A3420" />
          <Text style={styles.loadText}>Menghitung komoditas keranjang...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            data={cartItems}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderCartRow}
            contentContainerStyle={styles.listPaddingStyle}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyCartContainer}>
                <Ionicons name="cart-outline" size={64} color="#C0A995" />
                <Text style={styles.emptyTitle}>Keranjang Masih Kosong</Text>
                <Text style={styles.emptySub}>Ayo dukung UMKM Ciamis dengan mulai berbelanja di Pasar Galuh PAMILO.</Text>
                <TouchableOpacity style={styles.btnExploreMarket} onPress={() => router.push('/' as any)}>
                  <Text style={styles.textBtnExplore}>Mulai Belanja Sekarang</Text>
                </TouchableOpacity>
              </View>
            }
          />

          {cartItems.length > 0 && (
            <View style={styles.stickyActionFooter}>
              <View style={styles.totalSummaryPriceCol}>
                <Text style={styles.labelTotalBelanja}>Estimasi Total</Text>
                <Text style={styles.valueTotalBelanja}>Rp {totalBelanja.toLocaleString('id-ID')}</Text>
              </View>
              <TouchableOpacity style={styles.btnNextToCheckout} onPress={() => router.push('/orders/checkout' as any)}>
                <Text style={styles.textBtnCheckout}>Checkout Warga</Text>
                <Ionicons name="arrow-forward-circle" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FAF6F0' },
  customNavBar: { backgroundColor: '#4A3420', height: 95, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, elevation: 4 },
  backBtn: { width: 35, height: 40, justifyContent: 'center' },
  refreshBtn: { width: 35, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  navBarTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  centerLoad: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadText: { fontSize: 12, color: '#7A6450', fontWeight: 'bold' },
  listPaddingStyle: { padding: 14, paddingBottom: 30 },
  cartCardItem: { flexDirection: 'row', backgroundColor: '#FFF', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#E0D0C0', marginBottom: 10, alignItems: 'center', elevation: 1 },
  productPhoto: { width: 60, height: 60, borderRadius: 10, borderWidth: 0.5, borderColor: '#E0D0C0' },
  photoPlaceholder: { width: 60, height: 60, borderRadius: 10, backgroundColor: '#FAF6F0', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: '#E0D0C0' },
  detailsColumn: { flex: 1, marginLeft: 12, gap: 2, paddingRight: 6 },
  productNameText: { fontSize: 13, fontWeight: 'bold', color: '#4A3420' },
  variantBadgeText: { fontSize: 9, color: '#E28743', backgroundColor: '#FFF8E1', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontWeight: '600' },
  pricePerUnitText: { fontSize: 11, color: '#A1887F', marginTop: 2 },
  itemSubtotalText: { fontSize: 12, fontWeight: '700', color: '#4A3420', marginTop: 2 },
  actionControlCol: { alignItems: 'flex-end', justifyContent: 'space-between', height: 65, gap: 8 },
  btnTrash: { padding: 4 },
  counterRowGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAF6F0', borderWidth: 1, borderColor: '#E0D0C0', borderRadius: 14, padding: 2 },
  btnCounter: { width: 26, height: 26, justifyContent: 'center', alignItems: 'center' },
  qtyNumberText: { fontSize: 12, fontWeight: 'bold', color: '#4A3420', paddingHorizontal: 8, minWidth: 26, textAlign: 'center' },
  emptyCartContainer: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, marginTop: 120 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#7A6450', marginTop: 14 },
  emptySub: { fontSize: 12, color: '#A1887F', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  btnExploreMarket: { backgroundColor: '#4A3420', paddingHorizontal: 20, height: 42, borderRadius: 21, marginTop: 20, justifyContent: 'center', elevation: 2 },
  textBtnExplore: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  stickyActionFooter: { flexDirection: 'row', backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#E0D0C0', alignItems: 'center', gap: 16, elevation: 15 },
  totalSummaryPriceCol: { flex: 1 },
  labelTotalBelanja: { fontSize: 11, color: '#A1887F', fontWeight: '500' },
  valueTotalBelanja: { fontSize: 16, fontWeight: 'bold', color: '#E28743', marginTop: 2 },
  btnNextToCheckout: { backgroundColor: '#E28743', flexDirection: 'row', paddingHorizontal: 20, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', gap: 6, elevation: 2 },
  textBtnCheckout: { color: '#FFF', fontSize: 13, fontWeight: 'bold' }
});