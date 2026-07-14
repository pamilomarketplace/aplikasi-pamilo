// app/produk/[id].tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StatusBar, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabaseClient';

// IMPOR MESIN LOGIKA
import { useDetailProduk } from '@/features/produk/useDetailProduk';
import { useKeranjang } from '@/features/keranjang/useKeranjang'; 

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); 
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const { detail, loadingDetail, errorDetail } = useDetailProduk(id);
  const { tambahKeKeranjang, isAdding } = useKeranjang(); 

  const [isFavorit, setIsFavorit] = useState<boolean>(false);
  const [loadingFav, setLoadingFav] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [rataRataRating, setRataRataRating] = useState<number>(0);
  const [totalUlasan, setTotalUlasan] = useState<number>(0);
  const [loadingRating, setLoadingRating] = useState<boolean>(true);

  useEffect(() => {
    const checkUserAndFavorite = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data, error } = await supabase
          .from('favorit')
          .select('id_favorit')
          .eq('user_id_favorit', user.id)
          .eq('produk_id_favorit', id)
          .maybeSingle();

        if (data && !error) setIsFavorit(true);
      }
    };
    checkUserAndFavorite();
  }, [id]);

  useEffect(() => {
    const hitungRatingProduk = async () => {
      try {
        const { data, error } = await supabase.from('ulasan_produk').select('bintang').eq('produk_id', id);
        if (error) throw error;

        if (data && data.length > 0) {
          const totalBintang = data.reduce((acc, curr) => acc + Number(curr.bintang), 0);
          setRataRataRating(Number((totalBintang / data.length).toFixed(1)));
          setTotalUlasan(data.length);
        }
      } catch (err) {
        console.error('[Gagal kalkulasi rating]', err);
      } finally {
        setLoadingRating(false);
      }
    };
    hitungRatingProduk();
  }, [id]);

  useEffect(() => {
    if (errorDetail) {
      Alert.alert('Gagal Memuat', 'Data produk tidak ditemukan atau sudah dihapus penjual.', [
        { text: 'Kembali', onPress: () => router.back() }
      ]);
    }
  }, [errorDetail]);

  const handleToggleFavorit = async () => {
    if (!currentUserId || loadingFav) return;
    setLoadingFav(true);

    try {
      if (isFavorit) {
        const { error } = await supabase.from('favorit').delete().eq('user_id_favorit', currentUserId).eq('produk_id_favorit', id);
        if (error) throw error;
        setIsFavorit(false);
      } else {
        const { error } = await supabase.from('favorit').insert({ user_id_favorit: currentUserId, produk_id_favorit: id });
        if (error) throw error;
        setIsFavorit(true);
      }
    } catch (err: any) {
      Alert.alert('Gagal Mengubah Wishlist', err.message);
    } finally {
      setLoadingFav(false);
    }
  };

  // 🚀 PERBAIKAN: Logika Beli Sekarang (Jalur Cepat / Bypass Keranjang)
  const handleBeliSekarang = () => {
    router.push({
      pathname: '/checkout',
      params: { 
        mode: 'beli_langsung', 
        id_produk: id, 
        kuantitas: 1 
      }
    } as any);
  };

  if (loadingDetail) {
    return (
      <View style={styles.centerLoader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAF3F0" />
        <ActivityIndicator size="large" color="#4A3420" />
      </View>
    );
  }

  const formatRupiah = (angka: number) => `Rp ${Number(angka).toLocaleString('id-ID')}`;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#E0D0C0" />
      
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollArea}>
        <View style={styles.bannerHeader}>
          <TouchableOpacity style={[styles.floatingBackBtn, { top: insets.top + 12 }]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#4A3420" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.floatingFavBtn, { top: insets.top + 12 }]} onPress={handleToggleFavorit} disabled={loadingFav}>
            <Ionicons name={isFavorit ? "heart" : "heart-outline"} size={22} color={isFavorit ? "#E74C3C" : "#4A3420"} />
          </TouchableOpacity>

          {detail?.foto_produk ? (
            <Image source={{ uri: detail.foto_produk }} style={styles.fullImage} resizeMode="cover" />
          ) : (
            <Text style={styles.bigIcon}>🏪</Text>
          )}
        </View>

        <View style={styles.infoBox}>
          <View style={styles.badgeAndRatingRow}>
            <Text style={styles.badgeType}>{detail?.kategori_label_produk || 'PRODUK'}</Text>
            
            {loadingRating ? (
              <ActivityIndicator size="small" color="#4A3420" />
            ) : totalUlasan > 0 ? (
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color="#F1C40F" />
                <Text style={styles.ratingValueText}>{`${rataRataRating} (${totalUlasan} Ulasan)`}</Text>
              </View>
            ) : (
              <View style={styles.ratingRow}>
                <Ionicons name="star-outline" size={14} color="#A1887F" />
                <Text style={styles.noRatingText}>Belum ada penilaian</Text>
              </View>
            )}
          </View>

          <Text style={styles.titleName}>{detail?.nama_produk}</Text>
          <Text style={styles.priceTag}>{formatRupiah(detail?.harga_produk || 0)}</Text>
          
          <View style={styles.divider} />
          
          <Text style={styles.sectionLabel}>Deskripsi Produk</Text>
          <Text style={styles.descriptionText}>
            {detail?.deskripsi_produk || 'Pemilik lapak tidak memberikan deskripsi tambahan untuk produk ini.'}
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footerBar, { paddingBottom: insets.bottom + 12 }]}>
        
        {/* Tombol Add to Cart (Masuk Database) */}
        <TouchableOpacity 
          style={styles.cartIconBtn}
          onPress={() => tambahKeKeranjang(id, 1)}
          disabled={isAdding}
        >
          {isAdding ? (
            <ActivityIndicator size="small" color="#E28743" />
          ) : (
            <Ionicons name="cart-outline" size={24} color="#E28743" />
          )}
        </TouchableOpacity>

        {/* Tombol Beli Sekarang (Jalur Cepat) */}
        <TouchableOpacity 
          style={styles.orderBtn}
          onPress={handleBeliSekarang} 
        >
          <Text style={styles.orderBtnText}>Beli Sekarang</Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF3F0' },
  centerLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF3F0' },
  scrollArea: { flex: 1 },
  bannerHeader: { height: 280, backgroundColor: '#E0D0C0', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  fullImage: { width: '100%', height: '100%' }, 
  floatingBackBtn: { position: 'absolute', left: 16, backgroundColor: 'rgba(255, 255, 255, 0.9)', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 2, zIndex: 10 },
  floatingFavBtn: { position: 'absolute', right: 16, backgroundColor: 'rgba(255, 255, 255, 0.9)', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 2, zIndex: 10 },
  bigIcon: { fontSize: 70 },
  infoBox: { backgroundColor: '#FFF', padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -24, minHeight: 400, elevation: 2 },
  badgeAndRatingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  badgeType: { backgroundColor: '#FAF3F0', color: '#4A3420', fontSize: 10, fontWeight: 'bold', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, textTransform: 'uppercase' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingValueText: { fontSize: 12, fontWeight: 'bold', color: '#4A3420' },
  noRatingText: { fontSize: 11, color: '#A1887F', fontStyle: 'italic' },
  titleName: { fontSize: 20, fontWeight: 'bold', color: '#4A3420', lineHeight: 26 },
  priceTag: { fontSize: 22, fontWeight: 'bold', color: '#E28743', marginTop: 8 },
  divider: { height: 1, backgroundColor: '#FAF6F0', marginVertical: 15 },
  sectionLabel: { fontSize: 12, fontWeight: 'bold', color: '#A1887F', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 },
  descriptionText: { fontSize: 14, color: '#7A6450', lineHeight: 22 },
  footerBar: { flexDirection: 'row', backgroundColor: '#FFF', padding: 15, borderTopWidth: 1, borderTopColor: '#E0D0C0', elevation: 8, gap: 12 },
  cartIconBtn: { width: 48, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: '#E28743', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8E1' },
  orderBtn: { flex: 1, backgroundColor: '#4A3420', height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  orderBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 }
});