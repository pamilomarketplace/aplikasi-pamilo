// app/favorit/index.tsx
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 🚀 HUBUNGAN RIIL: Mengonsumsi data favorit langsung dari database
import { useFavorit, ItemFavorit } from '@/features/favorit/useFavorit';

export default function FavoritScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // Menggunakan data asli dari brankas Supabase
  const { loading, favoritItems, hapusFavorit } = useFavorit();

  const formatRupiah = (angka: number) => `Rp ${Number(angka).toLocaleString('id-ID')}`;

  const renderFavoritItem = ({ item }: { item: ItemFavorit }) => {
    const produkDetail = item.produk;
    
    return (
      <TouchableOpacity 
        style={styles.favoritCard} 
        onPress={() => router.push(`/produk/${item.id_produk}` as any)}
      >
        <View style={styles.imageBox}>
          <Ionicons name="heart" size={24} color="#E74C3C" />
        </View>
        <View style={styles.infoCol}>
          <Text style={styles.badge}>{produkDetail?.kategori_label_produk || 'PRODUK'}</Text>
          <Text style={styles.titleText} numberOfLines={1}>
            {produkDetail?.nama_produk || 'Komoditas Pasar'}
          </Text>
          <Text style={styles.priceText}>
            {formatRupiah(produkDetail?.harga_produk || 0)}
          </Text>
        </View>
        
        {/* Tombol aksi hapus dari wishlist secara riil */}
        <TouchableOpacity style={styles.btnHapus} onPress={() => hapusFavorit(item.id)}>
          <Ionicons name="trash-outline" size={18} color="#A1887F" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#4A3420" />
      
      <View style={[styles.customNavBar, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.navBarTitle}>Wishlist Saya ❤️</Text>
        <View style={{ width: 35 }} />
      </View>

      {loading ? (
        <View style={styles.centerLoad}>
          <ActivityIndicator size="large" color="#4A3420" />
          <Text style={styles.loadText}>Mengambil daftar produk favorit Anda...</Text>
        </View>
      ) : (
        <FlatList
          data={favoritItems}
          keyExtractor={(item) => item.id}
          renderItem={renderFavoritItem}
          contentContainerStyle={styles.listPadding}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="heart-dislike-outline" size={60} color="#C0A995" />
              <Text style={styles.emptyTitle}>Belum Ada Favorit</Text>
              <Text style={styles.emptySub}>Simpan produk jualan warga yang Anda sukai di sini agar mudah dicari nanti.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FAF6F0' },
  customNavBar: { backgroundColor: '#4A3420', height: 95, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, elevation: 4 },
  backBtn: { width: 35, height: 40, justifyContent: 'center' },
  navBarTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  centerLoad: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadText: { fontSize: 12, color: '#7A6450', fontWeight: 'bold' },
  listPadding: { padding: 16 },
  favoritCard: { backgroundColor: '#FFF', flexDirection: 'row', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#E0D0C0', marginBottom: 12, alignItems: 'center', elevation: 1 },
  imageBox: { width: 50, height: 50, backgroundColor: '#FAF6F0', borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E0D0C0' },
  infoCol: { flex: 1, marginLeft: 12 },
  badge: { fontSize: 8, color: '#E28743', backgroundColor: '#FFF8E1', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontWeight: 'bold', marginBottom: 4 },
  titleText: { fontSize: 14, fontWeight: 'bold', color: '#4A3420' },
  priceText: { fontSize: 12, color: '#A1887F', marginTop: 2 },
  btnHapus: { padding: 6 },
  emptyContainer: { alignItems: 'center', marginTop: 150, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#7A6450', marginTop: 16 },
  emptySub: { fontSize: 12, color: '#A1887F', textAlign: 'center', marginTop: 6, lineHeight: 18 }
});