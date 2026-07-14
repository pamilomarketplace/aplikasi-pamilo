// app/(tabs)/index.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, StatusBar, Dimensions, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useBanners } from '@/features/banners/useBanners';
import { useProfile } from '@/features/profile/useProfile';
import { useCurrentLocation } from '@/features/location/useCurrentLocation'; 
import { ActiveOrderFloatingBanner } from '@/components/ActiveOrderFloatingBanner'; 

// 🚀 HUBUNGAN EKOSISTEM UTUH: Mengimpor seluruh mesin logika baru pamungkas kita
import { useDaftarProduk } from '@/features/produk/useDaftarProduk';
import { Produk } from '@/features/produk/produkRepository';
import { useKeranjang } from '@/features/keranjang/useKeranjang';
import { useNotifikasi } from '@/features/notifikasi/useNotifikasi';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLUMN_GAP = 6;
const CARD_WIDTH = (SCREEN_WIDTH - 32 - (3 * COLUMN_GAP)) / 4;

const SERVICE_GAP = 12; 
const SERVICE_BOX_WIDTH = (SCREEN_WIDTH - 32 - (2 * SERVICE_GAP)) / 3;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeFilter, setActiveFilter] = useState('Semua');

  const { profile, loading: profileLoading } = useProfile();
  const { banners, isLoading: bannerLoading } = useBanners();
  const { locationName, loadingLocation } = useCurrentLocation();

  // 1. Hook Logika Produk & Fitur Pencarian Beranda
  const { produk, loadingProduk, kataKunciCari, setKataKunciCari } = useDaftarProduk(activeFilter);

  // 2. Hook Logika Keranjang Riil untuk memancarkan angka live badge keranjang
  const { cartItems } = useKeranjang();

  // 3. Hook Logika Notifikasi Riil untuk memancarkan titik merah live badge notifikasi
  const { unreadCount } = useNotifikasi();

  const formatRupiah = (angka: number) => `Rp ${Number(angka).toLocaleString('id-ID')}`;

  const handleBannerScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const offset = event.nativeEvent.contentOffset.x;
    const activeIndex = Math.floor((offset + slideSize / 2) / slideSize);
    setCurrentSlide(activeIndex);
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#4A3420" />

      {/* HEADER UTAMA */}
      <View style={[styles.curvedHeader, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTopRow}>
          <View style={styles.locationBox}>
            <Ionicons name="location" size={18} color="#FFF" />
            <Text style={styles.locationText}>
              {loadingLocation ? 'Melacak...' : locationName}
            </Text>
          </View>
          
          {/* 🚀 AKSI SINKRONISASI BADGE & NAVIGASI 100% LIVE */}
          <View style={styles.headerIconsRow}>
            {/* Ikon Chat CS */}
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/pesan' as any)}>
              <Ionicons name="chatbubbles-outline" size={22} color="#FFF" />
            </TouchableOpacity>

            {/* Ikon Wishlist Favorit */}
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/favorit' as any)}>
              <Ionicons name="heart-outline" size={22} color="#FFF" />
            </TouchableOpacity>

            {/* Ikon Keranjang Belanja Ber-Angka Live */}
            <TouchableOpacity style={styles.badgeContainer} onPress={() => router.push('/keranjang' as any)}>
              <Ionicons name="cart-outline" size={22} color="#FFF" />
              {cartItems.length > 0 && (
                <View style={styles.badgeNumber}>
                  <Text style={styles.badgeNumberText}>{cartItems.length}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Ikon Notifikasi Ber-Titik Merah Live */}
            <TouchableOpacity style={styles.badgeContainer} onPress={() => router.push('/notifikasi' as any)}>
              <Ionicons name="notifications-outline" size={22} color="#FFF" />
              {unreadCount > 0 && (
                <View style={styles.badgeDot} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* KOLOM PENCARIAN REALTIME BERANDA */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#A1887F" style={styles.searchIcon} />
          <TextInput 
            style={styles.searchInput}
            placeholder="Cari kebutuhan harian Anda di PAMILO..."
            placeholderTextColor="#A1887F"
            value={kataKunciCari}
            onChangeText={setKataKunciCari}
          />
          {kataKunciCari.length > 0 && (
            <TouchableOpacity onPress={() => setKataKunciCari('')}>
              <Ionicons name="close-circle" size={18} color="#E74C3C" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPadding}>
        
        {/* BANNER SLIDER */}
        <View style={styles.carouselContainer}>
          {bannerLoading ? (
            <View style={[{ width: SCREEN_WIDTH - 32, height: 160 }, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#EADBC8' }]}>
              <ActivityIndicator color="#4A3420" />
            </View>
          ) : banners.length === 0 ? (
            <View style={[{ width: SCREEN_WIDTH - 32, height: 160 }, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#EADBC8', padding: 20 }]}>
              <Text style={{ color: '#4A3420', fontWeight: 'bold', fontSize: 14 }}>✨ PAMILO Pasar Mitra Lokal</Text>
            </View>
          ) : (
            <React.Fragment>
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={handleBannerScroll} scrollEventThrottle={16}>
                {banners.map((slide) => (
                  <TouchableOpacity 
                    key={slide.id_berita} 
                    activeOpacity={0.9}
                    style={styles.bannerImage}
                    onPress={() => {
                      if (slide.id_produk_berita) {
                        router.push({ pathname: `/produk/[id]`, params: { id: slide.id_produk_berita } } as any);
                      }
                    }}
                  >
                    {slide.gambar_berita ? (
                      <Image source={{ uri: slide.gambar_berita }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <View style={[{ width: '100%', height: '100%' }, { backgroundColor: '#EADBC8', justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
                        <Text style={{ color: '#4A3420', fontWeight: 'bold', fontSize: 14, textAlign: 'center' }}>{slide.judul_berita}</Text>
                        <Text style={{ color: '#7A6450', fontSize: 11, marginTop: 4, textAlign: 'center' }} numberOfLines={2}>{slide.isi_berita}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.dotsRow}>
                {banners.map((_, index) => (
                  <View key={index} style={[styles.dot, currentSlide === index && styles.dotActive]} />
                ))}
              </View>
            </React.Fragment>
          )}
        </View>

        {/* LAYANAN TRANSPORTASI MIGO */}
        <Text style={styles.sectionTitle}>Layanan Transportasi Migo</Text>
        <View style={styles.migoContainer}>
          <TouchableOpacity 
            style={styles.migoIndividualCard} 
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: '/migo/booking', params: { serviceType: 'motor' } })}
          >
            <View style={styles.migoLeftRow}>
              <Image source={require('@/assets/images/migo-motor.png')} style={styles.migoAssetIconJumbo} />
              <View style={styles.migoTextWrapper}>
                <Text style={styles.migoCardTitleJumbo}>MIGO Motor</Text>
                <Text style={styles.migoCardSubJumbo}>Solusi perjalanan kilat, lincah, dan anti-macet.</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward-circle" size={22} color="#E28743" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.migoIndividualCard} 
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: '/migo/booking', params: { serviceType: 'mobil' } })}
          >
            <View style={styles.migoLeftRow}>
              <Image source={require('@/assets/images/migo-mobil.png')} style={styles.migoAssetIconJumbo} />
              <View style={styles.migoTextWrapper}>
                <Text style={styles.migoCardTitleJumbo}>MIGO Mobil</Text>
                <Text style={styles.migoCardSubJumbo}>Perjalanan nyaman, santai, bebas panas dan hujan.</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward-circle" size={22} color="#E28743" />
          </TouchableOpacity>
        </View>

        {/* LAYANAN UTAMA PAMILO */}
        <Text style={styles.sectionTitle}>Layanan Utama Pamilo</Text>
        <View style={styles.pamiloMainGrid}>
          <TouchableOpacity 
            style={[styles.mainServiceColumn, { width: SERVICE_BOX_WIDTH }]} 
            onPress={() => router.push({ pathname: '/produk', params: { initialType: 'FOOD' } } as any)}
          >
            <View style={styles.serviceIconContainerFull}>
              <Image source={require('@/assets/images/pamilo-food.png')} style={styles.actualServiceIconFull} />
            </View>
            <Text style={styles.serviceTitleTextOutside}>Pamilo Food</Text>
            <Text style={styles.serviceSubTitleTextOutside} numberOfLines={1}>Kuliner Lezat</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.mainServiceColumn, { width: SERVICE_BOX_WIDTH }]} 
            onPress={() => router.push({ pathname: '/produk', params: { initialType: 'MART' } } as any)}
          >
            <View style={styles.serviceIconContainerFull}>
              <Image source={require('@/assets/images/pamilo-mart.png')} style={styles.actualServiceIconFull} />
            </View>
            <Text style={styles.serviceTitleTextOutside}>Pamilo Mart</Text>
            <Text style={styles.serviceSubTitleTextOutside} numberOfLines={1}>Belanja UMKM</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.mainServiceColumn, { width: SERVICE_BOX_WIDTH }]} 
            onPress={() => router.push({ pathname: '/produk', params: { initialType: 'SERVICE' } } as any)}
          >
            <View style={styles.serviceIconContainerFull}>
              <Image source={require('@/assets/images/pamilo-service.png')} style={styles.actualServiceIconFull} />
            </View>
            <Text style={styles.serviceTitleTextOutside}>Pamilo Service</Text>
            <Text style={styles.serviceSubTitleTextOutside} numberOfLines={1}>Jasa & Solusi</Text>
          </TouchableOpacity>
        </View>

        {/* FILTERS REKOMENDASI */}
        <Text style={styles.sectionTitle}>Rekomendasi Hari Ini</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
          {['Semua', 'Pamilo Food', 'Pamilo Mart', 'Pamilo Service'].map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <TouchableOpacity 
                key={filter} 
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setActiveFilter(filter)}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {filter === 'Semua' ? '🎯 Semua' : filter === 'Pamilo Food' ? '🍔 Pamilo Food' : filter === 'Pamilo Mart' ? '🛒 Pamilo Mart' : '🛠️ Pamilo Service'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* GRID PRODUK KATALOG REALTIME */}
        {loadingProduk ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#4A3420" />
          </View>
        ) : produk.length === 0 ? (
          <Text style={styles.emptyText}>
            {kataKunciCari !== '' ? `Pencarian "${kataKunciCari}" tidak ditemukan.` : 'Belum ada produk jualan warga di kategori ini.'}
          </Text>
        ) : (
          <View style={styles.productsGrid}>
            {produk.map((item: Produk) => (
              <TouchableOpacity 
                key={item.id_produk} 
                style={styles.productCard}
                onPress={() => router.push({ pathname: `/produk/[id]`, params: { id: item.id_produk } } as any)}
              >
                <View style={styles.productImageSection}>
                  {item.foto_produk ? (
                    <Image source={{ uri: item.foto_produk }} style={styles.actualProductImg} resizeMode="cover" />
                  ) : (
                    <View style={[styles.actualProductImg, { backgroundColor: '#E0D0C0', justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="image-outline" size={20} color="#7A6450" />
                    </View>
                  )}
                  <View style={styles.categoryLabelBadge}>
                    <Text style={styles.categoryLabelText}>{item.kategori_label_produk || 'Umum'}</Text>
                  </View>
                  {item.is_promo && (
                    <View style={styles.promoBadge}><Text style={styles.promoBadgeText}>🔥 PROMO</Text></View>
                  )}
                </View>
                
                <View style={styles.productInfoSection}>
                  <Text style={styles.productTitleName} numberOfLines={2}>{item.nama_produk}</Text>
                  <Text style={styles.productPriceText} numberOfLines={1}>{formatRupiah(item.harga_produk)}</Text>
                  <View style={styles.productCardFooterRow}>
                    <Text style={styles.ratingText}>⭐ 5.0</Text>
                    <TouchableOpacity style={styles.addCartCircleBtn}>
                      <Ionicons name="add" size={10} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

      </ScrollView>

      <ActiveOrderFloatingBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FAF6F0' },
  curvedHeader: { backgroundColor: '#4A3420', paddingHorizontal: 16, paddingBottom: 22, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, elevation: 4 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  locationBox: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  locationText: { color: '#FFF', fontWeight: 'bold', fontSize: 13, letterSpacing: 0.3 },
  headerIconsRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  iconBtn: { padding: 2 },
  
  // Styles Badge Indikator Atas
  badgeContainer: { position: 'relative', padding: 2 },
  badgeNumber: { position: 'absolute', top: -5, right: -5, backgroundColor: '#E74C3C', minWidth: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#4A3420', paddingHorizontal: 3 },
  badgeNumberText: { color: '#FFF', fontSize: 8, fontWeight: 'bold' },
  badgeDot: { position: 'absolute', top: 0, right: 2, backgroundColor: '#E74C3C', width: 9, height: 9, borderRadius: 4.5, borderWidth: 1.5, borderColor: '#4A3420' },

  searchContainer: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 12, alignItems: 'center', paddingHorizontal: 12, height: 42 },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 13, color: '#4A3420' },
  scrollPadding: { paddingHorizontal: 16, paddingTop: 15, paddingBottom: 160 }, 
  carouselContainer: { width: '100%', height: 160, borderRadius: 16, overflow: 'hidden', marginBottom: 15, position: 'relative' },
  bannerImage: { width: SCREEN_WIDTH - 32, height: 160 },
  dotsRow: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { width: 14, backgroundColor: '#FFF' },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#7A6450', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  migoContainer: { flexDirection: 'column', gap: 10, marginBottom: 20 },
  migoIndividualCard: { 
    width: '100%', backgroundColor: '#4A3420', padding: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3
  },
  migoLeftRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  migoAssetIconJumbo: { width: 50, height: 50, borderRadius: 12 },
  migoTextWrapper: { flex: 1 },
  migoCardTitleJumbo: { fontSize: 14, fontWeight: 'bold', color: '#FFF' },
  migoCardSubJumbo: { fontSize: 10, color: '#E0D0C0', marginTop: 3, lineHeight: 14, paddingRight: 8 },  
  pamiloMainGrid: { flexDirection: 'row', justifyContent: 'flex-start', gap: SERVICE_GAP, marginBottom: 22 },
  mainServiceColumn: { alignItems: 'center' },
  serviceIconContainerFull: {
    width: '100%', aspectRatio: 1, backgroundColor: '#FFF', borderRadius: 18, borderWidth: 1, borderColor: '#E0D0C0', overflow: 'hidden', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 3 
  },
  actualServiceIconFull: { width: '100%', height: '100%', resizeMode: 'cover' },
  serviceTitleTextOutside: { fontSize: 12, fontWeight: 'bold', color: '#4A3420', marginTop: 8, textAlign: 'center' },
  serviceSubTitleTextOutside: { fontSize: 10, color: '#7A6450', marginTop: 2, fontWeight: '500', textAlign: 'center', paddingHorizontal: 2 },
  filterBar: { flexDirection: 'row', marginBottom: 15 },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#FFF', marginRight: 8, borderWidth: 1, borderColor: '#E0D0C0' },
  filterChipActive: { backgroundColor: '#4A3420', borderColor: '#4A3420' },
  filterChipText: { fontSize: 11, color: '#4A3420', fontWeight: '500' },
  filterChipTextActive: { color: '#FFF', fontWeight: 'bold' },
  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: COLUMN_GAP },
  productCard: { width: CARD_WIDTH, backgroundColor: '#FFF', borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: '#E0D0C0', overflow: 'hidden', elevation: 1 },
  productImageSection: { height: 72, backgroundColor: '#FAF3F0', position: 'relative' },
  actualProductImg: { width: '100%', height: '100%' },
  categoryLabelBadge: { position: 'absolute', bottom: 3, left: 3, backgroundColor: 'rgba(74, 52, 32, 0.85)', paddingVertical: 1, paddingHorizontal: 4, borderRadius: 3 },
  categoryLabelText: { color: '#FFF', fontSize: 7, fontWeight: 'bold' },
  promoBadge: { position: 'absolute', top: 3, right: 3, backgroundColor: '#E74C3C', paddingVertical: 1, paddingHorizontal: 4, borderRadius: 3 },
  promoBadgeText: { color: '#FFF', fontSize: 7, fontWeight: 'bold' },
  productInfoSection: { padding: 5 }, 
  productTitleName: { fontSize: 10, fontWeight: 'bold', color: '#4A3420', height: 28, lineHeight: 13 }, 
  productPriceText: { fontSize: 9, fontWeight: 'bold', color: '#E28743', marginTop: 1 }, 
  productCardFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 },
  ratingText: { fontSize: 8, fontWeight: '600', color: '#7A6450' },
  addCartCircleBtn: { backgroundColor: '#4A3420', width: 16, height: 16, borderRadius: 5, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', color: '#7A6450', width: '100%', paddingVertical: 30, fontSize: 12, fontStyle: 'italic' }
});