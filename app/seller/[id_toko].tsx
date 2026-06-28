// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Image, 
  TouchableOpacity, 
  Dimensions, 
  StatusBar,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';

// BACKEND: KONEKTOR UTAMA SUPABASE TUAN
import { supabase } from '@/supabaseConfig'; 

const { width } = Dimensions.get('window');
const columnWidth = (width - 44) / 2;

interface Toko {
  id_toko: string;
  nama_toko: string;
  alamat_toko: string;
  kategori_toko: string; 
  foto_toko?: string; // 🎯 FIX: Tambahkan slot untuk menampung URL foto toko
}

interface Product {
  id_produk: string;
  nama_produk: string;
  harga_produk: number;
  foto_produk?: string;
}

export default function StoreDetail() {
  const router = useRouter();
  const { id_toko } = useLocalSearchParams(); 

  const [loadingToko, setLoadingToko] = useState(true);
  const [loadingProduk, setLoadingProduk] = useState(true);
  const [toko, setToko] = useState<Toko | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  const isUuidValid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id_toko));

  useEffect(() => {
    if (id_toko === "oauth-callback" || id_toko === "--" || !isUuidValid) {
      console.log("✈️ Sasis [id_toko].tsx stand-by menahan visual sasis transisi...");
    }
  }, [id_toko, isUuidValid]);

  const fetchProfilTokoSupabase = async () => {
    if (!id_toko || id_toko === "oauth-callback" || id_toko === "--" || !isUuidValid) {
      setLoadingToko(false);
      return;
    }

    try {
      setLoadingToko(true);
      const { data, error } = await supabase
        .from('toko')
        // 🎯 FIX: Memanggil foto_toko dari Supabase
        .select('id_toko, nama_toko, alamat_toko, kategori_toko, foto_toko')
        .eq('id_toko', id_toko) 
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setToko(data as Toko);
      }
    } catch (err) {
      console.error("Gagal memuat profil toko:", err);
    } finally {
      setLoadingToko(false);
    }
  };

  const fetchProductsLapakSupabase = async () => {
    if (!id_toko || id_toko === "oauth-callback" || id_toko === "--" || !isUuidValid) {
      setLoadingProduk(false);
      return;
    }

    try {
      setLoadingProduk(true);
      const { data, error } = await supabase
        .from('produk')
        .select('id_produk, nama_produk, harga_produk, foto_produk')
        .eq('id_toko_produk', id_toko) 
        .gt('stok_ready_produk', 0)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setProducts(data as Product[]);
      }
    } catch (err) {
      console.error("Gagal memuat list produk toko:", err);
    } finally {
      setLoadingProduk(false); 
    }
  };

  useEffect(() => {
    if (id_toko) {
      fetchProfilTokoSupabase();
      fetchProductsLapakSupabase();
    }
  }, [id_toko]);

  const dapatkanInisial = (nama: string) => {
    if (!nama) return 'M';
    return nama.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  const dapatkanLabelPilarToko = (kategoriMentah: string) => {
    if (!kategoriMentah) return 'Pamilo Mart'; 
    const raw = kategoriMentah.toUpperCase();
    if (raw.includes('FOOD') || raw.includes('KULINER')) return 'Pamilo Food';
    if (raw.includes('SERVIS') || raw.includes('SERVICE') || raw.includes('JASA')) return 'Pamilo Servis';
    return 'Pamilo Mart';
  };

  if (id_toko === "oauth-callback" || id_toko === "--" || !isUuidValid) {
    return (
      <View style={styles.centerLoading}>
        <ActivityIndicator size="large" color="#4A3525" />
        <Text style={styles.loadingTextNote}>Menyelaraskan gerbang otentikasi login...</Text>
      </View>
    );
  }

  if (loadingToko) {
    return (
      <View style={styles.centerLoading}>
        <ActivityIndicator size="large" color="#4A3525" />
        <Text style={styles.loadingTextNote}>Membuka sasis gerbang lapak mitra...</Text>
      </View>
    );
  }

  const namaTokoReal = toko ? toko.nama_toko : 'Mitra Toko PAMILO';
  const alamatTokoReal = toko ? toko.alamat_toko : 'Ciamis, Jawa Barat';
  const inisialTokoReal = dapatkanInisial(namaTokoReal);
  const pilarTokoReal = dapatkanLabelPilarToko(toko?.kategori_toko || '');

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />
      
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.btnBack}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{namaTokoReal}</Text>
      </View>

      <View style={styles.storeBanner}>
        <View style={styles.storeProfile}>
          <View style={styles.logoCircle}>
            {/* 🎯 FIX: Logika Gambar Pintar. Jika foto ada, tampilkan. Jika tidak, pakai inisial huruf */}
            {toko?.foto_toko ? (
              <Image source={{ uri: toko.foto_toko }} style={styles.tokoLogoImage} resizeMode="cover" />
            ) : (
              <Text style={styles.avatarText}>{inisialTokoReal}</Text>
            )}
          </View>
          <View style={{ marginLeft: 15, flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
              <Text style={styles.storeName} numberOfLines={1}>{namaTokoReal}</Text>
              <Ionicons name="checkmark-circle" size={14} color="#4CAF50" style={{ marginLeft: 4 }} />
            </View>
            
            <View style={styles.badgePilarBox}>
              <Text style={styles.badgePilarText}>{pilarTokoReal}</Text>
            </View>

            <View style={styles.locRow}>
              <Ionicons name="location" size={11} color="#FFF3E0" style={{ marginRight: 4 }} />
              <Text style={styles.storeLoc} numberOfLines={1}>{alamatTokoReal}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={{ flex: 1, marginTop: 10 }}>
        <Text style={styles.sectionTitleText}>Katalog Resmi Produk Toko</Text>
        
        {loadingProduk ? (
          <ActivityIndicator size="small" color="#4A3525" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={products}
            keyExtractor={(item) => item.id_produk}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.gridList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.card}
                onPress={() => router.push({ pathname: '/detail/[id]', params: { id: item.id_produk } })}
              >
                <View style={styles.imageContainer}>
                  {item.foto_produk ? (
                    <Image source={{ uri: item.foto_produk }} style={styles.productImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.fallbackImage}>
                      <FontAwesome5 name="box" size={24} color="#BCAAA4" />
                    </View>
                  )}
                </View>
                
                <View style={styles.cardInfo}>
                  <Text style={styles.productTitle} numberOfLines={2}>{item.nama_produk}</Text>
                  <Text style={styles.productPrice}>Rp {Number(item.harga_produk || 0).toLocaleString('id-ID')}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyProductsPlaceholder}>
                <FontAwesome5 name="store-alt-slash" size={36} color="#EFEBE9" />
                <Text style={styles.emptyTextNote}>Toko ini belum memajang produk jualan apa-apa murni di etalase.</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5' },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF8F5' },
  loadingTextNote: { marginTop: 10, fontSize: 11, color: '#8D6E63', fontWeight: '500' },
  navBar: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#4A3525' },
  btnBack: { padding: 4 },
  navTitle: { fontSize: 15, fontWeight: 'bold', marginLeft: 12, color: '#fff', flex: 1 },
  storeBanner: { height: 125, backgroundColor: '#4A3525', justifyContent: 'center', paddingHorizontal: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, elevation: 3 },
  storeProfile: { flexDirection: 'row', alignItems: 'center' },
  logoCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFF3E0', overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#D7CCC8' },
  tokoLogoImage: { width: '100%', height: '100%' }, // 🎯 FIX: Styling untuk foto toko
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#4A3525' },
  storeName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  badgePilarBox: { backgroundColor: '#D35400', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 4 },
  badgePilarText: { color: '#fff', fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  locRow: { flexDirection: 'row', alignItems: 'center', opacity: 0.9 },
  storeLoc: { color: '#FFF3E0', fontSize: 11, fontWeight: '500', flex: 1 },
  sectionTitleText: { fontSize: 13, fontWeight: 'bold', color: '#4A3525', paddingHorizontal: 16, marginTop: 14, marginBottom: 4 },
  gridList: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 30 },
  gridRow: { justifyContent: 'space-between', marginBottom: 12 },
  card: { width: columnWidth, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#EFEBE9', overflow: 'hidden', elevation: 1 },
  imageContainer: { width: '100%', height: columnWidth, backgroundColor: '#FFF3E0', position: 'relative' },
  productImage: { width: '100%', height: '100%' },
  fallbackImage: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { padding: 10 },
  productTitle: { fontSize: 12, fontWeight: 'bold', color: '#4A3525', height: 34, lineHeight: 17 },
  productPrice: { fontSize: 13, fontWeight: '800', color: '#D35400', marginTop: 3 },
  emptyProductsPlaceholder: { alignItems: 'center', justifyContent: 'center', marginTop: 40, paddingVertical: 40, marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#EFEBE9' },
  emptyTextNote: { fontSize: 11, color: '#BCAAA4', marginTop: 10, fontWeight: '500', textAlign: 'center', paddingHorizontal: 20, lineHeight: 16 }
});