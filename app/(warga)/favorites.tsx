// @ts-nocheck
import React, { useEffect, useState, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator, 
  Alert, 
  StatusBar,
  RefreshControl
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// BACKEND KONEKTOR UTAMA
import { supabase } from '@/supabaseConfig';

interface ProdukFavorit {
  id_favorit: string;
  id_produk: string;
  nama_produk: string;
  harga_produk: number;
  gambar_produk: string | null;
}

export default function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [favoritesList, setFavoritesList] = useState<ProdukFavorit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // --- 🟢 AMBIL DATA VIA STRATEGI DUA JALUR INDEPENDEN (💡 KEBAL EROR PGRST200) ---
  const fetchDaftarFavoritWarga = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const uid = session.user.id;

      // JALUR 1: Tarik baris data indeks dari user_favorites secara murni menggunakan bintang (*)
      const { data: dataFavorit, error: errorFavorit } = await supabase
        .from('user_favorites')
        .select('*')
        .eq('user_id', uid);

      if (errorFavorit) throw errorFavorit;

      if (!dataFavorit || dataFavorit.length === 0) {
        setFavoritesList([]);
        return;
      }

      // JALUR 2: Ambil seluruh spesifikasi komoditas pasar secara global dari tabel master produk
      const { data: dataMasterProduk, error: errorProduk } = await supabase
        .from('produk')
        .select('id_produk, nama_produk, harga_produk, foto_produk');

      if (errorProduk) throw errorProduk;

      // Bangun struktur pencarian instan (Map) di dalam memori RAM lokal HP
      const produkMap = new Map(dataMasterProduk?.map(p => [String(p.id_produk), p]) || []);

      // TAHAP MERAKIT DATA: Jodohkan data secara lokal tanpa join relasi server cloud
      const formatFavorit: ProdukFavorit[] = dataFavorit.map((row) => {
        const targetIdProduk = row.produk_id;
        const liveProduk = produkMap.get(String(targetIdProduk));

        return {
          id_favorit: String(row.id),
          id_produk: String(targetIdProduk),
          nama_produk: liveProduk?.nama_produk || 'Produk Pasar PAMILO',
          harga_produk: Number(liveProduk?.harga_produk || 0),
          gambar_produk: liveProduk?.foto_produk || null
        };
      }).filter(item => item.nama_produk !== 'Produk Pasar PAMILO'); // Eliminasi otomatis jika produk sudah dihapus admin

      setFavoritesList(formatFavorit);

    } catch (err: any) {
      console.error("Gagal memuat favorit:", err);
      Alert.alert("Gagal Memuat", "Sirkuit penarik data favorit bermasalah.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDaftarFavoritWarga();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDaftarFavoritWarga();
  }, []);

  // --- 🟢 HAPUS FAVORIT (Murni membidik ID string/UUID tabel baru) ---
  const handleHapusDariFavorit = async (idFavorit: string) => {
    try {
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('id', idFavorit);

      if (error) throw error;

      // Potong antrean state lokal UI secara instan agar animasi terasa responsif
      setFavoritesList(prev => prev.filter(item => item.id_favorit !== idFavorit));
    } catch (err: any) {
      Alert.alert("Gagal Dihapus", err.message);
    }
  };

  return (
    <View style={styles.mainContainer}>
      <Stack.Screen 
        options={{ 
          headerTitle: 'Favorit Saya', 
          headerStyle: { backgroundColor: '#4A3525' }, 
          headerTintColor: '#fff', 
          headerTitleStyle: { fontWeight: 'bold', fontSize: 14 } 
        }} 
      />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4A3525" />
          <Text style={styles.loadingText}>Membuka daftar produk idaman Tuan...</Text>
        </View>
      ) : favoritesList.length > 0 ? (
        <FlatList
          data={favoritesList}
          keyExtractor={(item, index) => `${item.id_favorit}-${index}`}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#4A3525"]} />}
          renderItem={({ item: produk }) => (
            <TouchableOpacity 
              style={styles.favoriteCard}
              activeOpacity={0.8}
              onPress={() => router.push(`/detail/${produk.id_produk}`)}
            >
              <View style={styles.imageWrapper}>
                {produk.gambar_produk ? (
                  <Image source={{ uri: produk.gambar_produk }} style={styles.productImage} />
                ) : (
                  <FontAwesome5 name="box" size={20} color="#D7CCC8" />
                )}
              </View>

              <View style={styles.infoWrapper}>
                <Text style={styles.productName} numberOfLines={2}>{produk.nama_produk}</Text>
                <Text style={styles.productPrice}>Rp {produk.harga_produk.toLocaleString('id-ID')}</Text>
              </View>

              <TouchableOpacity 
                style={styles.btnDelete} 
                onPress={() => handleHapusDariFavorit(produk.id_favorit)}
              >
                <Ionicons name="heart" size={20} color="#C0392B" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={styles.centerContainer}>
          <FontAwesome5 name="heart-broken" size={54} color="#D7CCC8" />
          <Text style={styles.emptyTitle}>Daftar Favorit Kosong</Text>
          <Text style={styles.emptySubtitle}>Warga belum menandai produk favorit apapun di Pasar PAMILO saat ini.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FDFCFB' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  loadingText: { marginTop: 10, color: '#8D6E63', fontSize: 12, fontWeight: '500' },
  listContent: { padding: 16 },
  favoriteCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#EFEBE9', marginBottom: 12, alignItems: 'center', elevation: 0.5 },
  imageWrapper: { width: 64, height: 64, borderRadius: 10, backgroundColor: '#FAF8F5', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#F5F5F5' },
  productImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  infoWrapper: { flex: 1, marginLeft: 14, paddingRight: 8 },
  productName: { fontSize: 13, fontWeight: 'bold', color: '#1A0F05', lineHeight: 18 },
  productPrice: { fontSize: 13, fontWeight: '900', color: '#D35400', marginTop: 4 },
  btnDelete: { padding: 8, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: 'bold', color: '#4A3525', marginTop: 16 },
  emptySubtitle: { fontSize: 12, color: '#8D6E63', textAlign: 'center', marginTop: 6, lineHeight: 18 }
});