// @ts-nocheck
import React, { useState, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  StatusBar, 
  ActivityIndicator, 
  RefreshControl,
  Alert 
} from 'react-native';
import { useRouter, Stack, useFocusEffect } from 'expo-router'; 
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// BACKEND KONEKTOR SUPABASE
import { supabase } from '../../supabaseConfig';

interface Produk {
  id_produk: string;
  nama_produk: string;
  harga_produk: number;
  deskripsi_produk: string;
  kategori_produk: string; 
  stok_ready_produk: number; 
  terjual: number;
  foto_produk: string;
}

export default function ProdukSayaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [daftarProduk, setDaftarProduk] = useState<Produk[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const ambilDataProdukMitra = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const uid = session.user.id;

      const { data: dataTokoInduk, error: errorToko } = await supabase
        .from('toko')
        .select('id_toko')
        .eq('user_id_toko', uid)
        .maybeSingle();

      if (errorToko || !dataTokoInduk) {
        setDaftarProduk([]);
        return;
      }

      const { data, error } = await supabase
        .from('produk')
        .select('*')
        .eq('id_toko_produk', dataTokoInduk.id_toko)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setDaftarProduk(data as Produk[]);
    } catch (error: any) {
      console.error("Gagal menarik katalog produk:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      ambilDataProdukMitra();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    ambilDataProdukMitra();
  }, []);

  const handleHapusProduk = (idProduk: string, nama: string, urlFoto: string) => {
    Alert.alert(
      "Konfirmasi Hapus 🚨", 
      `Apakah Tuan yakin ingin menarik produk "${nama}" dari etalase PAMILO?`, 
      [
        { text: "Batal", style: "cancel" },
        { 
          text: "Ya, Hapus", 
          style: "destructive", 
          onPress: async () => {
            try {
              if (urlFoto && urlFoto.includes('pamilo-assets')) {
                const namaFileMentah = urlFoto.split('/toko/').pop();
                if (namaFileMentah) {
                  await supabase.storage.from('pamilo-assets').remove([`toko/${namaFileMentah}`]);
                }
              }

              const { error } = await supabase.from('produk').delete().eq('id_produk', idProduk);
              if (error) throw error;
              
              setDaftarProduk(prev => prev.filter(p => p.id_produk !== idProduk));
              Alert.alert("Sukses Selesai", "Produk telah berhasil dihapus.");
            } catch (err: any) {
              Alert.alert("Gagal", `Gagal menghapus: ${err.message}`);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: true,
          headerTitle: 'Katalog Produk Saya',
          headerTintColor: '#fff',
          headerStyle: { backgroundColor: '#4A3525' },
          headerTitleStyle: { fontWeight: 'bold', fontSize: 13 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 5, marginRight: 10 }}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/seller/form-produk')} style={{ marginRight: 5 }}>
              <Ionicons name="add-circle-outline" size={22} color="#fff" />
            </TouchableOpacity>
          )
        }} 
      />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#4A3525" />
          <Text style={styles.loadingText}>Membuka brankas etalase Tuan...</Text>
        </View>
      ) : daftarProduk.length > 0 ? (
        <FlatList
          data={daftarProduk}
          keyExtractor={(item) => item.id_produk}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#4A3525"]} tintColor="#4A3525" />
          }
          renderItem={({ item }) => {
            // 🎯 DIREKTUR KATEGORI MURNI 3 PILAR
            const pilar = (item.kategori_produk || '').toUpperCase().trim();
            let labelFinal = 'PAMILO MART';
            let labelColor = '#D35400';
            let bgColor = '#FFF8F4';

            if (pilar === 'FOOD') {
              labelFinal = 'PAMILO FOOD'; labelColor = '#C62828'; bgColor = '#FFEBEE';
            } else if (pilar === 'SERVIS') {
              labelFinal = 'PAMILO SERVIS'; labelColor = '#00838F'; bgColor = '#E0F7FA';
            }

            return (
              <View style={styles.productCard}>
                {item.foto_produk ? (
                  <Image source={{ uri: item.foto_produk }} style={styles.productImage} />
                ) : (
                  <View style={[styles.productImage, { justifyContent: 'center', alignItems: 'center' }]}>
                    <FontAwesome5 name="box" size={22} color="#BCAAA4" />
                  </View>
                )}
                
                <View style={styles.productInfo}>
                  <View style={[styles.categoryBadge, { backgroundColor: bgColor }]}>
                    <Text style={[styles.categoryText, { color: labelColor }]}>{labelFinal}</Text>
                  </View>
                  <Text style={styles.productName} numberOfLines={1}>{item.nama_produk}</Text>
                  <Text style={styles.productPrice}>Rp {Number(item.harga_produk || 0).toLocaleString('id-ID')}</Text>
                  
                  <View style={styles.rowStock}>
                    <Text style={styles.stockText}>Stok: {item.stok_ready_produk ?? 0} Pcs</Text>
                    <Text style={styles.divider}>•</Text>
                    <Text style={styles.soldText}>Terjual: {item.terjual || 0} Pcs</Text>
                  </View>
                </View>

                <View style={styles.actionContainer}>
                  <TouchableOpacity 
                    style={styles.btnEdit} 
                    onPress={() => router.push({ pathname: '/seller/form-produk', params: { id_produk: item.id_produk } })}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="pencil-outline" size={14} color="#4A3525" />
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.btnDelete} 
                    onPress={() => handleHapusProduk(item.id_produk, item.nama_produk, item.foto_produk)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={14} color="#C0392B" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      ) : (
        <View style={styles.centerEmpty}>
          <FontAwesome5 name="store-alt-slash" size={48} color="#D7CCC8" />
          <Text style={styles.emptyTitle}>Etalase Masih Kosong</Text>
          <Text style={styles.emptySubtitle}>Klik tombol + di kanan atas untuk merilis produk pertama Tuan!</Text>
          <TouchableOpacity style={styles.btnTambahKini} onPress={() => router.push('/seller/form-produk')} activeOpacity={0.8}>
            <Text style={styles.btnTambahKiniText}>Tambah Produk Sekarang</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5' }, 
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 11, color: '#8D6E63', fontWeight: '700' },
  listContent: { padding: 16 },
  productCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#EFEBE9', elevation: 0.5 },
  productImage: { width: 70, height: 70, borderRadius: 12, backgroundColor: '#FAF8F5', resizeMode: 'cover' },
  productInfo: { flex: 1, marginLeft: 14, justifyContent: 'center' },
  categoryBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, marginBottom: 4, alignSelf: 'flex-start' },
  categoryText: { fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.3 },
  productName: { fontSize: 13, fontWeight: 'bold', color: '#1A0F05' },
  productPrice: { fontSize: 13, fontWeight: '900', color: '#D35400', marginTop: 2 },
  rowStock: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  stockText: { fontSize: 11, color: '#6D4C41', fontWeight: '700' },
  divider: { fontSize: 11, color: '#BCAAA4', marginHorizontal: 6 },
  soldText: { fontSize: 11, color: '#A1887F', fontWeight: '500' },
  actionContainer: { flexDirection: 'column', justifyContent: 'center', gap: 8, marginLeft: 6 },
  btnEdit: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FAF8F5', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E0D4CE' },
  btnDelete: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FDEDEC', justifyContent: 'center', alignItems: 'center' },
  centerEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 14, fontWeight: 'bold', color: '#4A3525', marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  emptySubtitle: { fontSize: 12, color: '#8D6E63', textAlign: 'center', marginTop: 6, lineHeight: 18, fontStyle: 'italic' },
  btnTambahKini: { backgroundColor: '#4A3525', height: 40, paddingHorizontal: 20, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 18, elevation: 1 },
  btnTambahKiniText: { color: '#fff', fontSize: 12, fontWeight: 'bold' }
});