// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  Dimensions, 
  ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image'; 

// BACKEND: KONEKTOR UTAMA SUPABASE
import { supabase } from '../../supabaseConfig';

const { width } = Dimensions.get('window');
const columnWidth = (width - 32 - 18) / 4; 

interface Product {
  id_produk: string;
  id?: string;
  nama_produk: string;
  harga_produk: number;
  harga?: number;
  kategori_produk: string; 
  foto_produk?: string;
  terjual: number;
  rating?: number;
  jarak_km?: number; 
}

export default function KatalogDinamisScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams(); 

  const [searchBarQuery, setSearchBarQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [productsData, setProductsData] = useState<Product[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'JARAK' | 'RATING' | 'TERLARIS'>('TERLARIS');

  const infoKategori = useMemo(() => {
    const pilarId = id?.toString().toUpperCase() || 'MART';
    if (pilarId === 'FOOD') {
      return { kode: 'FOOD', nama: 'Pamilo Food', sub: 'Eksplorasi rasa kuliner & cemilan khas', icon: 'hamburger' };
    }
    if (pilarId === 'SERVIS') {
      return { kode: 'SERVIS', nama: 'Pamilo Servis', sub: 'Jasa panggilan & solusi keahlian lokal', icon: 'tools' };
    }
    return { kode: 'MART', nama: 'Pamilo Mart', sub: 'Kebutuhan harian, sembako & UMKM', icon: 'store' };
  }, [id]);

  const fetchKatalogDatabaseData = async () => {
    try {
      setLoading(true);
      
      const { data: dataProduk, error: errorProduk } = await supabase
        .from('produk_valid_tampil') 
        .select('*')
        .eq('kategori_produk', infoKategori.kode) 
        .gt('stok_ready_produk', 0);

      if (errorProduk) throw errorProduk;

      if (dataProduk) {
        const formatted: Product[] = dataProduk.map((item: any) => ({
          ...item,
          // ⚡ FIX MUTLAK: Kunci nilai rating ke 5.0 (menggantikan generator acak Math.random)
          rating: 5.0,
          jarak_km: item.jarak_km || parseFloat((Math.random() * (4.5 - 0.5) + 0.5).toFixed(1)),
        }));

        if (selectedFilter === 'JARAK') {
          formatted.sort((a, b) => (a.jarak_km || 0) - (b.jarak_km || 0));
        } else if (selectedFilter === 'RATING') {
          formatted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        } else if (selectedFilter === 'TERLARIS') {
          formatted.sort((a, b) => (b.terjual || 0) - (a.terjual || 0));
        }

        setProductsData(formatted);
      }
    } catch (err) {
      console.error("Gagal memuat sirkuit produk:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKatalogDatabaseData();
  }, [infoKategori, selectedFilter]);

  const dataProdukTerfilter = useMemo(() => {
    return productsData.filter(p => 
      p.nama_produk.toLowerCase().includes(searchBarQuery.toLowerCase())
    );
  }, [productsData, searchBarQuery]);

  const renderItemProduk = ({ item }: { item: Product }) => {
    const currentProductId = item.id_produk || item.id;
    const currentHarga = item.harga_produk || item.harga || 0;

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => router.push({ pathname: '/detail/[id]', params: { id: currentProductId?.toString() } })}
        activeOpacity={0.85}
      >
        <View style={styles.imageContainer}>
          {item.foto_produk ? (
            <Image 
              source={{ uri: item.foto_produk }} 
              style={styles.productImage} 
              contentFit="cover" 
              transition={300}
              cachePolicy="disk"
            />
          ) : (
            <View style={styles.fallbackImage}>
              <FontAwesome5 name={infoKategori.icon} size={16} color="#D7CCC8" />
            </View>
          )}
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceBadgeText}>{item.jarak_km || 1.0}km</Text>
          </View>
        </View>
        
        <View style={styles.cardInfo}>
          <Text style={styles.productTitle} numberOfLines={2}>{item.nama_produk}</Text>
          <Text style={styles.productPrice} numberOfLines={1}>Rp {currentHarga.toLocaleString('id-ID')}</Text>
          <View style={styles.cardFooter}>
            <Ionicons name="star" size={9} color="#FFB300" />
            {/* ⚡ FIX UI: Dipaksa selalu tertulis "5.0" dengan format desimal yang konsisten */}
            <Text style={styles.ratingText}>5.0</Text>
            <Text style={styles.soldText} numberOfLines={1}>• {item.terjual || 0} trjl</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <Stack.Screen 
        options={{ 
          headerShown: true, 
          headerTitle: infoKategori.nama, 
          headerTintColor: '#fff', 
          headerStyle: { backgroundColor: '#4A3525' } 
        }} 
      />
      
      {loading ? (
        <View style={styles.centerLoadingContainer}>
          <ActivityIndicator size="large" color="#4A3525" />
          <Text style={styles.loadingTextNote}>Menyaring etalase {infoKategori.nama}...</Text>
        </View>
      ) : (
        <FlatList
          data={dataProdukTerfilter}
          keyExtractor={(item, index) => (item.id_produk || item.id || index).toString()}
          numColumns={4} 
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={[styles.gridList, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          
          ListHeaderComponent={
            <View style={styles.unifiedHeaderContainer}>
              <View style={styles.headerMetaSection}>
                <Text style={styles.mainTitleText}>{infoKategori.nama}</Text>
                <Text style={styles.subTitleText}>{infoKategori.sub}</Text>
                
                <View style={styles.pencarianBoxWrapper}>
                  <Ionicons name="search" size={16} color="#A1887F" />
                  <TextInput 
                    style={styles.pencarianInput} 
                    value={searchBarQuery} 
                    onChangeText={setSearchBarQuery} 
                    placeholder={`Cari di ${infoKategori.nama}...`} 
                    placeholderTextColor="#BCAAA4" 
                  />
                </View>
              </View>

              <View style={styles.filterRowContainer}>
                {(['TERLARIS', 'JARAK', 'RATING'] as const).map((f) => (
                  <TouchableOpacity 
                    key={f} 
                    style={[styles.filterBadgeBtn, selectedFilter === f && styles.filterBadgeBtnActive]} 
                    onPress={() => setSelectedFilter(f)}
                  >
                    <Ionicons 
                      name={f === 'JARAK' ? "location-outline" : f === 'RATING' ? "star-outline" : "flame-outline"} 
                      size={11} 
                      color={selectedFilter === f ? '#fff' : '#4A3525'} 
                    />
                    <Text style={[styles.filterBtnText, selectedFilter === f && styles.filterBtnTextActive]}>
                      {f === 'JARAK' ? 'Terdekat' : f === 'RATING' ? 'Rating' : 'Laris'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
          renderItem={renderItemProduk}
          ListEmptyComponent={
            <View style={styles.emptyProductsPlaceholder}>
              <FontAwesome5 name="boxes" size={28} color="#D7CCC8" />
              <Text style={styles.emptyTextNote}>Produk belum tersedia di pilar ini.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FAF8F5' },
  centerLoadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingTextNote: { marginTop: 12, fontSize: 12, color: '#8D6E63', fontWeight: '500' },
  unifiedHeaderContainer: { backgroundColor: '#FAF8F5' },
  headerMetaSection: { backgroundColor: '#4A3525', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  mainTitleText: { fontSize: 16, fontWeight: '900', color: '#fff' },
  subTitleText: { fontSize: 11, color: '#D7CCC8', marginTop: 3, lineHeight: 15 },
  pencarianBoxWrapper: { backgroundColor: '#fff', paddingHorizontal: 12, borderRadius: 10, height: 38, flexDirection: 'row', alignItems: 'center', marginTop: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  pencarianInput: { flex: 1, marginLeft: 6, color: '#4A3525', fontSize: 11, paddingVertical: 0 },
  filterRowContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 6, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EFEBE9' },
  filterBadgeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 26, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: '#D7CCC8', backgroundColor: '#FAF8F5' },
  filterBadgeBtnActive: { backgroundColor: '#4A3525', borderColor: '#4A3525' },
  filterBtnText: { fontSize: 10, fontWeight: '700', color: '#4A3525' },
  filterBtnTextActive: { color: '#fff' },
  emptyProductsPlaceholder: { alignItems: 'center', justifyContent: 'center', marginTop: 40, paddingVertical: 40, marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D7CCC8' },
  emptyTextNote: { fontSize: 11, color: '#8D6E63', marginTop: 8, fontWeight: '500', textAlign: 'center' },
  gridList: { paddingHorizontal: 16, paddingTop: 12 },
  gridRow: { justifyContent: 'flex-start', gap: 6, marginBottom: 8 }, 
  card: { 
    width: columnWidth, 
    backgroundColor: '#fff', 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: '#EFEBE9', 
    overflow: 'hidden', 
    elevation: 1,
    shadowColor: '#4A3525',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 1
  },
  imageContainer: { width: '100%', height: columnWidth, backgroundColor: '#FFF3E0', position: 'relative' },
  productImage: { width: '100%', height: '100%' },
  fallbackImage: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  distanceBadge: { position: 'absolute', top: 4, left: 4, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, borderWidth: 0.5, borderColor: '#EFEBE9' },
  distanceBadgeText: { fontSize: 7, fontWeight: 'bold', color: '#4A3525' },
  cardInfo: { padding: 6 },
  productTitle: { fontSize: 10, fontWeight: 'bold', color: '#4A3525', height: 28, lineHeight: 14, marginBottom: 2 },
  productPrice: { fontSize: 11, fontWeight: '800', color: '#D35400' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  ratingText: { fontSize: 8, fontWeight: 'bold', color: '#4A3525', marginLeft: 2 },
  soldText: { fontSize: 8, color: '#A1887F', marginLeft: 2, flex: 1 }
});