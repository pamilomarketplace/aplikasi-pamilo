// @ts-nocheck
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity, 
  Image, Dimensions, StatusBar, ActivityIndicator, RefreshControl, FlatList, Alert, Share
} from 'react-native';
import * as Clipboard from 'expo-clipboard'; 
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter, Tabs, useLocalSearchParams, useFocusEffect } from 'expo-router'; 

// KONEKTOR CORE DATABASE SUPABASE & LOKASI
import { supabase } from '@/supabaseConfig';
import * as Location from 'expo-location'; 

// IMPOR JALUR SUB-KOMPONEN MODULAR BERANDA
import MigoTransport from '../beranda/migo-transport';
import MarketService from '../beranda/market-service';

const { width } = Dimensions.get('window');
const columnWidth = (width - 28 - (3 * 6)) / 4; 
const BANNER_WIDTH = width - 28; 

interface Berita {
  id_berita: string;
  judul_berita: string;
  isi_berita: string;
  gambar_berita: string;
  created_at: any;
  is_iklan: boolean;
  id_produk_berita: string | null;
}

interface Product {
  id_produk: string;
  nama_produk: string;
  harga_produk: number;
  deskripsi_produk: string;
  kategori_produk: string; 
  foto_produk?: string;
  stok_ready_produk?: number;
  id_toko_produk?: string;
  is_promo?: boolean;
  harga_coret_produk?: number;
  pilar_utama?: string; 
}

// 🚀 3 PILAR UTAMA PAMILO UNIVERSE
const CATEGORIES_FILTER = [
  { id: 'ALL', label: '🎯 Semua' },
  { id: 'FOOD', label: '🍔 Pamilo Food' },
  { id: 'MART', label: '🛒 Pamilo Mart' },
  { id: 'SERVIS', label: '🛠️ Pamilo Service' },
];

const BannerCarousel = ({ news, loadingNews, onBannerPress }: { news: Berita[], loadingNews: boolean, onBannerPress: (item: Berita) => void }) => {
  const bannerRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (news && news.length > 1) {
      interval = setInterval(() => {
        setCurrentIndex((prevIndex) => {
          const nextIndex = prevIndex === news.length - 1 ? 0 : prevIndex + 1;
          if (bannerRef.current) {
            bannerRef.current.scrollTo({
              x: nextIndex * BANNER_WIDTH,
              animated: true,
            });
          }
          return nextIndex;
        });
      }, 10000); 
    }
    return () => { if (interval) clearInterval(interval); };
  }, [news]); 

  const handleScrollEnd = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / BANNER_WIDTH);
    setCurrentIndex(index);
  };

  if (loadingNews && news.length === 0) { 
    return (
      <View style={[styles.bannerWrapper, { justifyContent: 'center' }]}>
        <ActivityIndicator color="#4A3525" />
      </View>
    );
  }

  if (news && news.length === 1) {
    return (
      <TouchableOpacity activeOpacity={0.9} onPress={() => onBannerPress(news[0])}>
        <View style={styles.bannerWrapper}>
          {news[0].gambar_berita ? (
            <Image source={{ uri: news[0].gambar_berita }} style={styles.bannerImageFull} resizeMode="cover" />
          ) : (
            <View style={[styles.bannerImageFull, { backgroundColor: '#EFEBE9', justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ color: '#8D6E63', fontSize: 11, fontWeight: '600' }}>Tidak ada gambar</Text>
            </View>
          )}
          {news[0].judul_berita ? (
            <View style={styles.bannerOverlay}>
              <View style={styles.badgeRow}>
                <Text style={styles.bannerTitle}>{news[0].judul_berita}</Text>
                {news[0].is_iklan && <View style={styles.sponsorBadge}><Text style={styles.sponsorBadgeText}>SPONSOR</Text></View>}
              </View>
              <Text style={styles.bannerDesc} numberOfLines={1}>{news[0].isi_berita}</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }

  if (news && news.length > 1) {
    return (
      <ScrollView 
        ref={bannerRef}
        horizontal 
        showsHorizontalScrollIndicator={false} 
        snapToInterval={BANNER_WIDTH} 
        snapToAlignment="center" 
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
      >
        {news.map((item, index) => (
          <TouchableOpacity key={item.id_berita ? item.id_berita.toString() : index.toString()} activeOpacity={0.9} onPress={() => onBannerPress(item)}>
            <View style={styles.bannerWrapper}>
              {item.gambar_berita ? (
                <Image source={{ uri: item.gambar_berita }} style={styles.bannerImageFull} resizeMode="cover" />
              ) : (
                <View style={[styles.bannerImageFull, { backgroundColor: '#EFEBE9', justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ color: '#8D6E63', fontSize: 11, fontWeight: '600' }}>Tidak ada gambar</Text>
                </View>
              )}
              {item.judul_berita ? (
                <View style={styles.bannerOverlay}>
                  <View style={styles.badgeRow}>
                    <Text style={styles.bannerTitle}>{item.judul_berita}</Text>
                    {item.is_iklan && <View style={styles.sponsorBadge}><Text style={styles.sponsorBadgeText}>SPONSOR</Text></View>}
                  </View>
                  <Text style={styles.bannerDesc} numberOfLines={1}>{item.isi_berita}</Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={styles.bannerWrapper}>
      <Text style={{ color: '#8D6E63', fontSize: 11, fontWeight: '600' }}>Tidak ada gambar</Text>
    </View>
  );
};

export default function PamiHomeScreen() {
  const router = useRouter(); 
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ refresh?: string }>();
  
  const channelRef = useRef<any>(null);
  const orderChannelRef = useRef<any>(null); 
  const migoChannelRef = useRef<any>(null); 
  
  const [news, setNews] = useState<Berita[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [loadingNews, setLoadingNews] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [locationName, setLocationName] = useState('Mendeteksi Lokasi...');
  const [searchQuery, setSearchQuery] = useState('');
  const [supabaseCartCount, setSupabaseCartCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [saldoUserWarga, setSaldoUserWarga] = useState(0);
  
  const [kodeReferral, setKodeReferral] = useState('PML-......');

  const [pesananAktifWarga, setPesananAktifWarga] = useState<any | null>(null);
  const [pesananAktifDriver, setPesananAktifDriver] = useState<any | null>(null); 
  const [migoAktif, setMigoAktif] = useState<any | null>(null); 
  const [migoAktifDriver, setMigoAktifDriver] = useState<any | null>(null); 

  const [selectedCategory, setSelectedCategory] = useState('ALL');
  
  const lastUserIdRef = useRef<string | null>(null);

  const cekKondisiPesananBerjalan = async () => {
    try {
      const uid = lastUserIdRef.current;
      if (!uid) return;

      const { data: dataPasarPembeli } = await supabase
        .from('orders')
        .select('id, status_order, total_pembayaran')
        .or(`pembeli_id.eq.${uid},user_id_pembeli.eq.${uid}`)
        .in('status_order', ['MENCARI_KURIR', 'PENDING', 'DIPROSES', 'DIKIRIM']) 
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setPesananAktifWarga(dataPasarPembeli || null);

      const { data: dataPasarDriver } = await supabase
        .from('orders')
        .select('id, status_order, total_pembayaran')
        .eq('kurir_id', uid)
        .in('status_order', ['DIPROSES', 'DIKIRIM']) 
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setPesananAktifDriver(dataPasarDriver || null);

      const { data: dataMigoPembeli } = await supabase
        .from('migo_orders')
        .select('*')
        .eq('pembeli_id', uid)
        .in('status_order', ['MENCARI_DRIVER', 'DIPROSES', 'MENUJU_JEMPUT', 'DIANTAR']) 
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setMigoAktif(dataMigoPembeli || null);

      const { data: dataMigoDriver } = await supabase
        .from('migo_orders')
        .select('*')
        .eq('driver_id', uid)
        .in('status_order', ['DIPROSES', 'MENUJU_JEMPUT', 'DIANTAR']) 
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setMigoAktifDriver(dataMigoDriver || null);

    } catch (err) {
      console.log("Gagal memantau radar orderan beranda:", err);
    }
  };

  const handleHubungiBantuanAdmin = () => {
    const uid = lastUserIdRef.current;
    if (!uid) {
      Alert.alert("Akses Terkunci", "Silakan login terlebih dahulu untuk menghubungi Admin PAMILO.");
      return;
    }
    router.push('/(tabs)/chat-cs');
  };

  const fetchKodeReferralUser = async () => {
    try {
      const uid = lastUserIdRef.current;
      if (!uid) return;

      const { data, error } = await supabase
        .from('users')
        .select('kode_referral_saya')
        .eq('user_id', uid)
        .maybeSingle();
      if (!error && data?.kode_referral_saya) {
        setKodeReferral(data.kode_referral_saya);
      }
    } catch (error) {
      console.log("Gagal membaca sasis kode referral di beranda:", error);
    }
  };

  const fetchSaldoUserRiil = async () => {
    try {
      const uid = lastUserIdRef.current;
      if (!uid) return;

      const { data: dataSaldo, error } = await supabase
        .from('users')
        .select('saldo')
        .eq('user_id', uid)
        .maybeSingle();
        
      if (!error && dataSaldo) {
        setSaldoUserWarga(Number(dataSaldo.saldo) || 0);
      } else {
        setSaldoUserWarga(0); 
      }
    } catch (error) {
      console.log("Gagal membaca sasis saldo user di beranda:", error);
    }
  };

  const fetchJumlahNotifikasiRiil = async () => {
    try {
      const uid = lastUserIdRef.current;
      if (!uid) {
        setUnreadNotifCount(0);
        return;
      }

      let queryNotif = supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read_notif', false)
        .eq('user_id_notif', uid);

      const { count, error } = await queryNotif;
      if (!error && count !== null) setUnreadNotifCount(count);
    } catch (error) {
      console.log("Gagal sinkronisasi nomor badge lonceng beranda.");
    }
  };

  const fetchJumlahKeranjangRiil = async () => {
    try {
      const uid = lastUserIdRef.current;
      if (!uid) {
        setSupabaseCartCount(0);
        return;
      }

      const { data, error } = await supabase
        .from('keranjang')
        .select('id')
        .eq('pembeli_id', uid);
      if (error) throw error;
      setSupabaseCartCount(data ? data.length : 0);
    } catch (error) {
      console.log("Gagal sinkronisasi nomor badge beranda, stand-by.");
    }
  };

  const fetchNewsFromSupabase = async (isBackground = false) => {
    try {
      if (!isBackground) setLoadingNews(true); 
      
      const sekarangIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('berita')
        .select('*')
        .or(`is_iklan.eq.false,expired_at.gt.${sekarangIso}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setNews(data as Berita[]);
    } catch (error: any) {
      console.error("Gagal ambil berita & iklan:", error.message || error);
    } finally {
      setLoadingNews(false);
    }
  };

  const fetchLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationName('Ciamis, Jawa Barat');
        return;
      }

      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = location.coords.latitude;
      const lon = location.coords.longitude;

      let place = null;
      try {
        let geoRiset = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
        if (geoRiset && geoRiset.length > 0) {
          place = geoRiset[0];
        }
      } catch (geocodeError) {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, { 
            headers: { 'User-Agent': 'PAMILO-App/1.0' } 
          });
          const data = await res.json();
          if (data && data.address) {
            place = {
              district: data.address.village || data.address.suburb || data.address.city_district || data.address.district || '',
              name: data.address.neighbourhood || data.address.residential || '',
              street: data.address.road || '',
              subregion: data.address.county || data.address.city || '',
              city: data.address.city || data.address.town || '',
              region: data.address.state || ''
            };
          }
        } catch (nominatimError) {
          console.log("Sistem geocode nominatim offline.");
        }
      }

      if (place) {
        let namaKecamatan = place.district || '';
        let namaDesaAtauJalan = place.name || place.street || '';
        let namaWilayahInduk = place.subregion || place.city || place.region || 'Indonesia';

        if (namaDesaAtauJalan.includes('+')) {
          namaDesaAtauJalan = namaDesaAtauJalan.includes(',') ? namaDesaAtauJalan.split(',')[1].trim() : '';
        }

        let tampilanLokasiFinal = '';
        if (namaDesaAtauJalan && namaKecamatan) {
          tampilanLokasiFinal = `${namaDesaAtauJalan}, ${namaKecamatan}`;
        } else if (namaKecamatan) {
          tampilanLokasiFinal = ` ${namaKecamatan}`;
        } else {
          tampilanLokasiFinal = namaWilayahInduk;
        }
        setLocationName(tampilanLokasiFinal);
      } else {
        setLocationName('Ciamis, Jawa Barat'); 
      }
    } catch (error) {
      setLocationName('Ciamis, Jawa Barat');
    }
  };

  const fetchProductsSupabase = async (isBackground = false) => {
    try {
      if (!isBackground) setLoadingProducts(true); 
      
      const { data, error } = await supabase
        .from('produk_valid_tampil') 
        .select('id_produk, nama_produk, harga_produk, deskripsi_produk, kategori_produk, foto_produk, stok_ready_produk, id_toko_produk, is_promo, harga_coret_produk')
        .gte('stok_ready_produk', 0); 
      if (error) throw error;
      
      if (data) {
        const pilarMappedProducts = data.map((item: any) => {
          const catUpper = String(item.kategori_produk || '').toUpperCase().trim();
          let pilar = 'MART';
          if (catUpper.includes('FOOD') || catUpper.includes('MAKANAN')) pilar = 'FOOD';
          else if (catUpper.includes('SERVIS') || catUpper.includes('JASA') || catUpper.includes('SERVICE')) pilar = 'SERVIS';
          return { ...item, pilar_utama: pilar };
        });

        const produkAcak = [...pilarMappedProducts].sort(() => Math.random() - 0.5);
        setProducts(produkAcak as Product[]);
      }
    } catch (error: any) {
      console.error("Gagal tarik produk ke beranda:", error.message || error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleTambahKeranjangKilat = async (productId: string, namaProduk: string) => {
    try {
      const userId = lastUserIdRef.current;
      if (!userId) {
        return Alert.alert("Akses Ditolak", "Silakan login terlebih dahulu untuk mulai belanja.");
      }
      
      const { data: itemEksis, error: cekError } = await supabase
        .from('keranjang')
        .select('id, kuantitas')
        .eq('pembeli_id', userId)
        .eq('produk_id', productId)
        .maybeSingle();

      if (cekError) throw cekError;

      if (itemEksis) {
        const { error: updateError } = await supabase
          .from('keranjang')
          .update({ kuantitas: itemEksis.kuantitas + 1 })
          .eq('id', itemEksis.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('keranjang')
          .insert([{ pembeli_id: userId, produk_id: productId, kuantitas: 1 }]);
        if (insertError) throw insertError;
      }
      await fetchJumlahKeranjangRiil();
      Alert.alert("Sukses Belanja! 🛒", `1 item "${namaProduk}" berhasil masuk ke keranjang.`);
    } catch (error: any) {
      Alert.alert("Gagal Belanja", "Terjadi gangguan koneksi ke sasis keranjang.");
    }
  };

  const handleBannerPress = (item: Berita) => {
    if (item.is_iklan && item.id_produk_berita) {
      router.push({ pathname: '/detail/[id]', params: { id: item.id_produk_berita.toString() } });
    } else {
      router.push({ pathname: "/news/[id]", params: { id: item.id_berita } });
    }
  };

  const handleSalinKodeReferral = async () => {
    await Clipboard.setStringAsync(kodeReferral);
    Alert.alert("Tersalin! 📋", "Kode referral berhasil dicopy ke memori HP.");
  };

  // 🟢 FUNGSI SHARE KODE REFERRAL (POIN 5)
  const handleShareKodeReferral = async () => {
    try {
      await Share.share({
        message: `Ayo pakai aplikasi PAMILO! Masukkan kode referal saya: ${kodeReferral} saat mendaftar dan dapatkan bonus saldo menarik. Yuk, bantu UMKM lokal!`,
      });
    } catch (error) {
      console.log("Gagal membagikan kode referral:", error);
    }
  };

  const muatSeluruhSasisData = async (isBackground = false) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoadingProducts(false);
        setLoadingNews(false);
        return;
      }

      lastUserIdRef.current = session.user.id;
      
      if (!isBackground && locationName === 'Mendeteksi Lokasi...') {
        fetchLocation();
      }

      await Promise.all([
        fetchProductsSupabase(isBackground),
        fetchNewsFromSupabase(isBackground),
        fetchJumlahKeranjangRiil(),
        fetchJumlahNotifikasiRiil(),
        fetchSaldoUserRiil(),
        fetchKodeReferralUser(),
        cekKondisiPesananBerjalan()
      ]);
    } catch (err) {
      console.log("Reset antrean awal beranda senyap error");
    } finally {
      if (!isBackground) {
        setLoadingProducts(false);
        setLoadingNews(false);
      }
    }
  };

  const isFirstMount = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (isFirstMount.current) {
        muatSeluruhSasisData(false);
        isFirstMount.current = false;
      } else {
        muatSeluruhSasisData(true);
      }
    }, [params.refresh])
  );

  useEffect(() => {
    const channelName = `live-bell-home-${Date.now()}`;
    const channel = supabase.channel(channelName);
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => { fetchSaldoUserRiil(); });
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => { fetchJumlahNotifikasiRiil(); });
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'berita' }, () => { fetchNewsFromSupabase(true); }); 
    channel.subscribe();
    channelRef.current = channel;

    const orderChannel = supabase
      .channel(`live-order-home-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { cekKondisiPesananBerjalan(); })
      .subscribe();
    orderChannelRef.current = orderChannel;

    const migoChannel = supabase
      .channel(`live-migo-home-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'migo_orders' }, () => { cekKondisiPesananBerjalan(); })
      .subscribe();
    migoChannelRef.current = migoChannel;

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (orderChannelRef.current) supabase.removeChannel(orderChannelRef.current);
      if (migoChannelRef.current) supabase.removeChannel(migoChannelRef.current);
    };
  }, []); 

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    fetchLocation(); 
    await muatSeluruhSasisData(true); 
    setRefreshing(false);
  }, []);

  const handleMenuNavigation = (kategori: string) => {
    const katUpper = kategori.toUpperCase().trim();
    if (katUpper === 'MOTOR') return router.push('/migo/motor');
    if (katUpper === 'MOBIL') return router.push('/migo/mobil');
    
    if (katUpper === 'KULINER') router.push({ pathname: "/katalog/[id]", params: { id: 'FOOD' } }); 
    else if (katUpper === 'BELANJA') router.push({ pathname: "/katalog/[id]", params: { id: 'MART' } }); 
    else if (katUpper === 'HOME_SERVICE') router.push({ pathname: "/katalog/[id]", params: { id: 'SERVIS' } }); 
  };

  const filteredProducts = products.filter(item => {
    if (selectedCategory === 'ALL') return true;
    return item.pilar_utama === selectedCategory;
  });

  const renderHeaderSections = () => {
    return (
      <View style={styles.headerInnerContainer}>
        <View style={styles.bannerSlider}>
          <BannerCarousel news={news} loadingNews={loadingNews} onBannerPress={handleBannerPress} />
        </View>

        {pesananAktifWarga && (
          <TouchableOpacity 
            style={styles.dynamicOrderWidget} 
            onPress={() => router.push({ pathname: `/orders/detail`, params: { id: pesananAktifWarga.id, asal_tabel: 'orders' } })}
          >
            <View style={styles.widgetLeftContent}>
              <View style={styles.widgetIconCircle}>
                <FontAwesome5 name="shipping-fast" size={13} color="#fff" />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.widgetMainTitle}>Aktivitas Pesanan Anda</Text>
                <Text style={styles.widgetSubStatus}>
                  Status: <Text style={{fontWeight: '900'}}>{pesananAktifWarga.status_order === 'MENCARI_KURIR' ? 'Mencari Ahli / Kurir...' : pesananAktifWarga.status_order.replace('_', ' ')}</Text>
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward-circle" size={20} color="#D35400" />
          </TouchableOpacity>
        )}

        {pesananAktifDriver && (
          <TouchableOpacity 
            style={[styles.dynamicOrderWidget, { backgroundColor: '#E8F5E9', borderColor: '#C8E6C9' }]} 
            onPress={() => router.push({ pathname: '/driver/tugas-aktif', params: { id: pesananAktifDriver.id, asal_tabel: 'orders' } })}
          >
            <View style={styles.widgetLeftContent}>
              <View style={[styles.widgetIconCircle, { backgroundColor: '#2E7D32' }]}>
                <FontAwesome5 name="boxes" size={13} color="#fff" />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.widgetMainTitle}>Tugas Kirim Barang Aktif</Text>
                <Text style={[styles.widgetSubStatus, { color: '#2E7D32' }]}>
                  Status Muatan: <Text style={{fontWeight: '900'}}>{pesananAktifDriver.status_order}</Text>
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward-circle" size={20} color="#2E7D32" />
          </TouchableOpacity>
        )}

        <View style={styles.pamiloPayWidget}>
          <View style={styles.walletLeft}>
            <View style={styles.walletLogoRow}>
              <FontAwesome5 name="wallet" size={12} color="#ffffff" />
              <Text style={styles.walletBrandName}>PAMILO-Pay</Text>
            </View>
            <Text style={styles.walletBalanceAmount}>Rp {saldoUserWarga.toLocaleString('id-ID')}</Text>
          </View>
          <View style={styles.walletRightActions}>
            <TouchableOpacity style={styles.walletActionBtn} onPress={() => router.push('/saldo')} activeOpacity={0.7}>
              <Ionicons name="add-circle" size={22} color="#ffffff" />
              <Text style={styles.walletActionLabel}>Top Up</Text>
            </TouchableOpacity>
          </View>
        </View>

        {migoAktif && (
          <TouchableOpacity 
            style={[styles.dynamicOrderWidget, { backgroundColor: '#E1F5FE', borderColor: '#B3E5FC', marginTop: 10 }]} 
            onPress={() => router.push({ pathname: `/orders/detail`, params: { id: migoAktif.id, asal_tabel: 'migo_orders' } })}
          >
            <View style={styles.widgetLeftContent}>
              <View style={[styles.widgetIconCircle, { backgroundColor: '#0288D1' }]}>
                <FontAwesome5 name={migoAktif.tipe_layanan === 'MIGO_RIDE' ? 'motorcycle' : 'car'} size={13} color="#fff" />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.widgetMainTitle}>Perjalanan MIGO Anda</Text>
                <Text style={[styles.widgetSubStatus, { color: '#0288D1' }]}>
                  Status: <Text style={{fontWeight: '900'}}>{migoAktif.status_order.replace('_', ' ')}</Text>
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward-circle" size={20} color="#0288D1" />
          </TouchableOpacity>
        )}

        {migoAktifDriver && (
          <TouchableOpacity 
            style={[styles.dynamicOrderWidget, { backgroundColor: '#E8F5E9', borderColor: '#C8E6C9', marginTop: 10 }]} 
            onPress={() => router.push({ pathname: '/driver/tugas-aktif', params: { id: migoAktifDriver.id, asal_tabel: 'migo_orders' } })}
          >
            <View style={styles.widgetLeftContent}>
              <View style={[styles.widgetIconCircle, { backgroundColor: '#2E7D32' }]}>
                <FontAwesome5 name={migoAktifDriver.tipe_layanan === 'MIGO_RIDE' ? 'motorcycle' : 'car'} size={13} color="#fff" />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.widgetMainTitle}>Tugas Narik MIGO Aktif</Text>
                <Text style={[styles.widgetSubStatus, { color: '#2E7D32' }]}>
                  Status Narik: <Text style={{fontWeight: '900'}}>{migoAktifDriver.status_order.replace('_', ' ')}</Text>
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward-circle" size={20} color="#2E7D32" />
          </TouchableOpacity>
        )}

        <View style={styles.referralWidgetContainer}>
          <View style={styles.referralTextBonusInfo}>
            <Text style={styles.referralTitleText}>📢 Bela Tetangga, Dapat Saldo!</Text>
            <Text style={styles.referralSubtitleText}>Ajak teman download PAMILO. Dapat bonus saldo Rp 10.000 tiap mereka belanja minimal Rp 50.000.</Text>
          </View>
          
          {/* 🟢 AREA TOMBOL SALIN & SHARE REFERRAL */}
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <TouchableOpacity style={styles.referralBadgeBoxClick} onPress={handleSalinKodeReferral} activeOpacity={0.8}>
              <Text style={styles.referralCodeValueText}>{kodeReferral}</Text>
              <View style={styles.referralSalinButtonBadge}>
                <Ionicons name="copy" size={10} color="#fff" />
                <Text style={styles.referralSalinText}>Salin</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnShareReferral} onPress={handleShareKodeReferral} activeOpacity={0.8}>
              <Ionicons name="share-social" size={20} color="#D35400" />
            </TouchableOpacity>
          </View>
        </View>

        <MigoTransport onNavigate={handleMenuNavigation} />
        <MarketService onNavigate={handleMenuNavigation} />

        <View style={{ marginTop: 24, marginBottom: 8, paddingLeft: 2 }}>
          <Text style={styles.sectionTitle}>Rekomendasi Hari Ini</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBarContainer}>
          {CATEGORIES_FILTER.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.filterTabButton, isSelected && styles.filterTabButtonActive]}
                onPress={() => setSelectedCategory(cat.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterTabText, isSelected && styles.filterTabTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Tabs.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <View style={styles.locationContainer}>
            <Ionicons name="location" size={15} color="#fff" />
            <Text style={styles.locationText} numberOfLines={1}>{locationName}</Text>
          </View>
          
          <View style={styles.headerIcons}>
            <TouchableOpacity onPress={handleHubungiBantuanAdmin} style={styles.iconGapHeader}>
              <Ionicons name="chatbubbles-outline" size={21} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/favorites')} style={styles.iconGapHeader}>
              <Ionicons name="heart-outline" size={21} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/cart')} style={styles.iconGapHeader}>
              {supabaseCartCount > 0 && (
                <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{supabaseCartCount}</Text></View>
              )}
              <Ionicons name="cart-outline" size={21} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/notification_list')} style={styles.iconGapHeader}>
              {unreadNotifCount > 0 && (
                <View style={styles.notifBadge}><Text style={styles.notifBadgeText}>{unreadNotifCount}</Text></View>
              )}
              <Ionicons name="notifications-outline" size={21} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color="#4A3525" />
          <TextInput 
            placeholder="Cari kebutuhan harian Anda di PAMILO..." 
            style={styles.searchInput} placeholderTextColor="#A1887F" value={searchQuery} onChangeText={setSearchQuery} returnKeyType="search"
            onSubmitEditing={() => {
              if (searchQuery.trim() !== '') {
                router.push({ pathname: "/katalog/[id]", params: { id: 'pencarian', title: `Hasil: ${searchQuery}` } });
              }
            }}
          />
        </View>
      </View>
      
      {loadingProducts && products.length === 0 ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#4A3525" />
          <Text style={styles.loadingText}>Menghubungkan ke satelit PAMILO...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts} 
          keyExtractor={(item, index) => (item.id_produk || item.id || index).toString()} 
          numColumns={4} 
          columnWrapperStyle={styles.gridRow} 
          contentContainerStyle={styles.gridList} 
          ListHeaderComponent={renderHeaderSections()} 
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.centerEmpty}>
              <FontAwesome5 name="box-open" size={26} color="#D7CCC8" />
              <Text style={styles.emptyText}>Tidak ada rekomendasi di kategori ini.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const currentProductId = item.id_produk;
            const currentHarga = item.harga_produk || 0;
            const apakahSedangPromo = item.is_promo === true && Number(item.harga_coret_produk) > 0;
            const hargaCoret = Number(item.harga_coret_produk || 0);

            const pilarUpper = (item.pilar_utama || 'MART');
            let labelTampil = 'Pamilo Mart';
            let iconFallback = 'shopping-basket';
            
            if (pilarUpper === 'FOOD') { labelTampil = 'Pamilo Food'; iconFallback = 'hamburger'; }
            else if (pilarUpper === 'SERVIS') { labelTampil = 'Pamilo Servis'; iconFallback = 'tools'; }
            
            return (
              <TouchableOpacity 
                style={styles.card} 
                onPress={() => router.push({ pathname: '/detail/[id]', params: { id: currentProductId.toString() } })}
              >
                <View style={styles.imageContainer}>
                  {item.foto_produk ? (
                    <Image source={{ uri: item.foto_produk }} style={styles.productImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.fallbackImage}><FontAwesome5 name={iconFallback} size={14} color="#BCAAA4" /></View>
                  )}
                  
                  {apakahSedangPromo && (
                    <View style={styles.badgePromoLapak}>
                      <Text style={styles.badgePromoLapakText}>🔥 PROMO</Text>
                    </View>
                  )}

                  <View style={styles.tagKategori}>
                    <Text style={styles.tagKategoriText} numberOfLines={1}>{labelTampil}</Text>
                  </View>
                </View>

                <View style={styles.cardInfo}>
                  <Text style={styles.productTitle} numberOfLines={2}>{item.nama_produk}</Text>
                  
                  {apakahSedangPromo ? (
                    <View style={{ gap: 1 }}>
                      <Text style={styles.productPriceActual}>Rp {currentHarga.toLocaleString('id-ID')}</Text>
                      <Text style={styles.productPriceCoret}>Rp {hargaCoret.toLocaleString('id-ID')}</Text>
                    </View>
                  ) : (
                    <Text style={styles.productPrice}>Rp {currentHarga.toLocaleString('id-ID')}</Text>
                  )}
                  
                  <View style={styles.cardFooter}>
                    <View style={styles.metaInfoRow}>
                      <Ionicons name="star" size={9} color="#FFB74D" />
                      <Text style={styles.ratingText}>5.0</Text>
                    </View>
                    
                    {(item.stok_ready_produk ?? 0) > 0 || pilarUpper === 'SERVIS' ? (
                      <TouchableOpacity 
                        style={styles.btnQuickCart} 
                        onPress={() => handleTambahKeranjangKilat(currentProductId, item.nama_produk)}
                      >
                        <Ionicons name="add" size={12} color="#fff" />
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.badgeStokHabis}>
                        <Text style={styles.stokHabisText}>HABIS</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#4A3525"]} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4EFEA' }, 
  header: { backgroundColor: '#4A3525', paddingBottom: 10, paddingHorizontal: 14, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, elevation: 4 }, 
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', presidential: 'center', alignItems: 'center', marginBottom: 12 },
  locationContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  locationText: { color: '#fff', fontSize: 13, fontWeight: 'bold', marginLeft: 4, maxWidth: width * 0.45 }, 
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  iconGapHeader: { marginLeft: 14, position: 'relative', justifyContent: 'center', alignItems: 'center' }, 
  cartBadge: { position: 'absolute', right: -6, top: -4, backgroundColor: '#D35400', borderRadius: 9, width: 14, height: 14, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  cartBadgeText: { color: '#fff', fontSize: 8.5, fontWeight: 'bold' },
  notifBadge: { position: 'absolute', right: -4, top: -4, backgroundColor: '#E74C3C', borderRadius: 9, width: 14, height: 14, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  notifBadgeText: { color: '#fff', fontSize: 8.5, fontWeight: 'bold' },
  searchContainer: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 12, height: 40 },
  searchInput: { flex: 1, marginLeft: 8, color: '#4A3525', fontSize: 12, paddingVertical: 0, fontWeight: '600' },
  headerInnerContainer: { paddingHorizontal: 0, paddingBottom: 10 }, 
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4EFEA', paddingTop: 60 }, 
  loadingText: { marginTop: 10, color: '#8D6E63', fontSize: 12, fontWeight: '500' },
  bannerSlider: { marginTop: 16, marginBottom: 8, width: '100%', alignItems: 'center', justifyContent: 'center' },
  bannerWrapper: { width: width - 28, aspectRatio: 2.2, borderRadius: 16, backgroundColor: '#EFEBE9', overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E0D4CE' },
  bannerImageFull: { width: '100%', height: '100%' },
  bannerOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, backgroundColor: 'rgba(26, 15, 5, 0.75)' },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  bannerTitle: { color: '#fff', fontSize: 12, fontWeight: 'bold', flex: 1 },
  sponsorBadge: { backgroundColor: '#FFB74D', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  sponsorBadgeText: { color: '#4A3525', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  bannerDesc: { color: '#FFF3E0', fontSize: 10, marginTop: 2 },
  dynamicOrderWidget: { flexDirection: 'row', backgroundColor: '#FFF8F4', marginHorizontal: 2, marginTop: 8, marginBottom: 4, borderRadius: 14, borderWidth: 1, borderColor: '#FFCCAB', padding: 10, justifyContent: 'space-between', alignItems: 'center', elevation: 1 },
  widgetLeftContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  widgetIconCircle: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#D35400', justifyContent: 'center', alignItems: 'center' },
  widgetMainTitle: { fontSize: 12, fontWeight: 'bold', color: '#4A3525' },
  widgetSubStatus: { fontSize: 10, color: '#D35400', marginTop: 2, fontWeight: '700' },
  pamiloPayWidget: { flexDirection: 'row', backgroundColor: '#4A3525', marginHorizontal: 2, marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: '#5D4037', padding: 10, justifyContent: 'space-between', alignItems: 'center', elevation: 1 },
  walletLeft: { flex: 1 },
  walletLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  walletBrandName: { fontSize: 11, fontWeight: '700', color: '#FFB74D', letterSpacing: 0.5 },
  walletBalanceAmount: { fontSize: 20, fontWeight: '900', color: '#ffffff', marginTop: 2 },
  walletRightActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  walletActionBtn: { alignItems: 'center', justifyContent: 'center' },
  walletActionLabel: { fontSize: 9, color: '#ffffff', fontWeight: 'bold', marginTop: 2 },
  referralWidgetContainer: { flexDirection: 'row', backgroundColor: '#FFFDF9', marginHorizontal: 2, marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: '#E0D4CE', padding: 10, justifyContent: 'space-between', alignItems: 'center' },
  referralTextBonusInfo: { flex: 1, paddingRight: 10 },
  referralTitleText: { fontSize: 12, fontWeight: 'bold', color: '#D35400' },
  referralSubtitleText: { fontSize: 9, color: '#8D6E63', marginTop: 2, lineHeight: 13, fontWeight: '500' },
  referralBadgeBoxClick: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D35400', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, alignItems: 'center', minWidth: 95 },
  referralCodeValueText: { fontSize: 11, fontWeight: '900', color: '#4A3525', fontFamily: 'monospace', letterSpacing: 0.5 },
  referralSalinButtonBadge: { flexDirection: 'row', backgroundColor: '#D35400', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignItems: 'center', gap: 3, marginTop: 4 },
  referralSalinText: { color: '#fff', fontSize: 7.5, fontWeight: 'bold' },
  btnShareReferral: { backgroundColor: '#FFF8F4', borderWidth: 1, borderColor: '#FFCCAB', borderRadius: 8, height: 42, width: 42, justifyContent: 'center', alignItems: 'center' }, // 🟢 GAYA TOMBOL SHARE REFERRAL
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#4A3525', textTransform: 'uppercase', letterSpacing: 0.8 },
  gridList: { paddingHorizontal: 14, paddingTop: 5, paddingBottom: 15 },
  gridRow: { flexDirection: 'row', justifyContent: 'flex-start', gap: 5, marginBottom: 8 },
  card: { width: columnWidth, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#EFEBE9', overflow: 'hidden', elevation: 1 },
  imageContainer: { width: '100%', height: columnWidth, backgroundColor: '#FAF8F5', position: 'relative' }, 
  productImage: { width: '100%', height: '100%' },
  fallbackImage: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  badgePromoLapak: { position: 'absolute', top: 4, right: 4, backgroundColor: '#C62828', paddingHorizontal: 4, paddingVertical: 1.5, borderRadius: 3, zIndex: 2 },
  badgePromoLapakText: { color: '#fff', fontSize: 7, fontWeight: '900', letterSpacing: 0.2 },
  tagKategori: { position: 'absolute', bottom: 4, left: 4, right: 4, backgroundColor: 'rgba(74, 53, 37, 0.82)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  tagKategoriText: { color: '#FFF3E0', fontSize: 7.5, fontWeight: 'bold', textAlign: 'center' }, 
  cardInfo: { padding: 5, flex: 1, justifyContent: 'space-between' },
  productTitle: { fontSize: 10, fontWeight: 'bold', color: '#4A3525', height: 28, lineHeight: 14, marginBottom: 2 },
  productPrice: { fontSize: 10.5, fontWeight: 'bold', color: '#D35400' },
  productPriceActual: { fontSize: 10.5, fontWeight: 'bold', color: '#2E7D32' },
  productPriceCoret: { fontSize: 8, color: '#9E9E9E', textDecorationLine: 'line-through' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  metaInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 8.5, fontWeight: 'bold', color: '#8D6E63' },
  btnQuickCart: { backgroundColor: '#4A3525', width: 18, height: 18, borderRadius: 5, justifyContent: 'center', alignItems: 'center' },
  badgeStokHabis: { backgroundColor: '#EFEBE9', paddingHorizontal: 4, paddingVertical: 1.5, borderRadius: 3 },
  stokHabisText: { fontSize: 7.5, fontWeight: 'bold', color: '#8D6E63' },
  filterBarContainer: { paddingVertical: 8, gap: 5, paddingLeft: 2, height: 46 },
  filterTabButton: { backgroundColor: '#FFF8F4', paddingHorizontal: 12, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FFCCBC' }, 
  filterTabButtonActive: { backgroundColor: '#4A3525', borderColor: '#4A3525' },
  filterTabText: { fontSize: 11, fontWeight: '600', color: '#8D6E63' },
  filterTabTextActive: { color: '#fff', fontWeight: 'bold' },
  centerEmpty: { width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 60, backgroundColor: '#FAF8F5' },
  emptyText: { marginTop: 8, fontSize: 11, color: '#8D6E63', fontStyle: 'italic', fontWeight: '500' }
});