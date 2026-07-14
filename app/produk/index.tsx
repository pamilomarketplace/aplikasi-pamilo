// app/produk/index.tsx
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, TextInput, Image, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useDaftarProduk } from '@/features/produk/useDaftarProduk';
import { Produk } from '@/features/produk/produkRepository';

// 🚀 KALKULASI DINAMIS 4 KOLOM
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_GAP = 6;
// 32 = Padding kiri kanan container (16*2). 3 = jumlah celah di antara 4 kolom.
const CARD_WIDTH = (SCREEN_WIDTH - 32 - (3 * COLUMN_GAP)) / 4; 

export default function ProductCatalogScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const initialType = (params.initialType as string) || 'FOOD';

  const { 
    produk, 
    loadingProduk, 
    errorProduk, 
    kataKunciCari, 
    setKataKunciCari 
  } = useDaftarProduk(initialType);

  const formatRupiah = (angka: number) => `Rp ${Number(angka).toLocaleString('id-ID')}`;

  // Logika Penentuan Judul
  let screenTitle = 'Etalase Produk';
  let screenIcon = '🍲';
  
  if (initialType === 'FOOD') { 
    screenTitle = 'Pamilo Food 🍔'; 
    screenIcon = '🍲'; 
  } else if (initialType === 'MART') { 
    screenTitle = 'Pamilo Mart 🛒'; 
    screenIcon = '📦'; 
  } else if (initialType === 'SERVICE') { 
    screenTitle = 'Pamilo Service 🛠️'; 
    screenIcon = '🔧'; 
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF6F0" />
      
      {/* HEADER */}
      <View style={[styles.headerRow, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#4A3420" />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>{screenTitle}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* PENCARIAN */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#7A6450" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Cari di ${screenTitle}...`}
          placeholderTextColor="#A1887F"
          value={kataKunciCari}
          onChangeText={setKataKunciCari} 
        />
        {kataKunciCari.length > 0 && (
          <TouchableOpacity onPress={() => setKataKunciCari('')}>
            <Ionicons name="close-circle" size={20} color="#E74C3C" />
          </TouchableOpacity>
        )}
      </View>

      {/* ERROR */}
      {errorProduk && (
        <View style={styles.errorWrapper}>
          <Text style={styles.errorText}>{`⚠️ ${errorProduk}`}</Text>
        </View>
      )}

      {/* LIST PRODUK 4 KOLOM */}
      {loadingProduk ? (
        <ActivityIndicator size="large" color="#4A3420" style={styles.loader} />
      ) : (
        <FlatList
          data={produk}
          keyExtractor={(item: Produk) => item.id_produk}
          numColumns={4} // 🚀 DIUBAH MENJADI 4 KOLOM
          columnWrapperStyle={styles.rowWrapper}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {kataKunciCari !== '' 
                ? `Pencarian "${kataKunciCari}" tidak ditemukan.` 
                : 'Belum ada produk jualan di kategori ini.'}
            </Text>
          }
          renderItem={({ item }: { item: Produk }) => (
            <TouchableOpacity 
              style={styles.productCard}
              activeOpacity={0.8}
              onPress={() => router.push(`/produk/${item.id_produk}` as any)} 
            >
              {/* BAGIAN GAMBAR */}
              <View style={styles.imagePlaceholder}>
                {item.foto_produk ? (
                  <Image source={{ uri: item.foto_produk }} style={styles.productImage} resizeMode="cover" />
                ) : (
                  <Text style={styles.boxIcon}>{screenIcon}</Text>
                )}
                
                {/* 🚀 IKON FAVORIT MELAYANG DI ATAS GAMBAR */}
                <TouchableOpacity style={styles.favIconWrapper}>
                  <Ionicons name="heart-outline" size={12} color="#FFF" />
                </TouchableOpacity>

                {/* LABEL KATEGORI KECIL */}
                <View style={styles.categoryLabelBadge}>
                  <Text style={styles.categoryLabelText}>{item.kategori_label_produk || 'Umum'}</Text>
                </View>
              </View>
              
              {/* BAGIAN TEKS & RATING */}
              <View style={styles.productInfoSection}>
                <Text style={styles.productName} numberOfLines={2}>{item.nama_produk}</Text>
                <Text style={styles.productPrice} numberOfLines={1}>{formatRupiah(item.harga_produk)}</Text>
                
                {/* 🚀 BARIS FOOTER KARTU (RATING + TOMBOL TAMBAH) */}
                <View style={styles.productCardFooterRow}>
                  <Text style={styles.ratingText}>⭐ 5.0</Text>
                  <TouchableOpacity style={styles.addCartCircleBtn}>
                    <Ionicons name="add" size={10} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF6F0' },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 15 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  screenTitle: { flex: 1, fontSize: 18, fontWeight: 'bold', color: '#4A3420', textAlign: 'center' },
  
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 12, height: 46, marginBottom: 15, marginHorizontal: 16, borderWidth: 1, borderColor: '#E0D0C0', elevation: 1 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, color: '#4A3420', height: '100%' },
  
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // 🚀 STYLE KHUSUS 4 KOLOM
  listContent: { paddingBottom: 40, paddingHorizontal: 16 },
  rowWrapper: { justifyContent: 'flex-start', gap: COLUMN_GAP, marginBottom: COLUMN_GAP },
  
  productCard: { backgroundColor: '#FFF', width: CARD_WIDTH, borderRadius: 10, borderWidth: 1, borderColor: '#E0D0C0', elevation: 1, overflow: 'hidden' },
  imagePlaceholder: { height: 72, backgroundColor: '#EADBC8', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  productImage: { width: '100%', height: '100%' },
  boxIcon: { fontSize: 24 }, // Ikon diperkecil untuk 4 kolom
  
  favIconWrapper: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.3)', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  categoryLabelBadge: { position: 'absolute', bottom: 3, left: 3, backgroundColor: 'rgba(74, 52, 32, 0.85)', paddingVertical: 1, paddingHorizontal: 4, borderRadius: 3 },
  categoryLabelText: { color: '#FFF', fontSize: 6, fontWeight: 'bold' },
  
  productInfoSection: { padding: 4 },
  productName: { fontSize: 9, fontWeight: 'bold', color: '#4A3420', height: 24, lineHeight: 12 }, 
  productPrice: { fontSize: 9, fontWeight: 'bold', color: '#E28743', marginTop: 2 },
  
  productCardFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  ratingText: { fontSize: 8, fontWeight: '600', color: '#7A6450' },
  addCartCircleBtn: { backgroundColor: '#4A3420', width: 14, height: 14, borderRadius: 4, justifyContent: 'center', alignItems: 'center' },

  emptyText: { textAlign: 'center', color: '#7A6450', marginTop: 40, fontStyle: 'italic', fontSize: 13, width: SCREEN_WIDTH - 32 },
  errorWrapper: { backgroundColor: '#FDEDEC', padding: 8, borderRadius: 8, marginBottom: 10, marginHorizontal: 16 },
  errorText: { color: '#E74C3C', fontSize: 11, fontWeight: '600', textAlign: 'center' }
});