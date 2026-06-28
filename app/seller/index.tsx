// @ts-nocheck
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar, 
  ActivityIndicator,
  RefreshControl,
  Image,
  Switch,
  Vibration,
  Dimensions,
  Modal
} from 'react-native';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av'; 
import { supabase } from '../../supabaseConfig';
import * as Notifications from 'expo-notifications'; // 🔥 SUNTIKAN NOTIFIKASI EXPO

if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

const { width } = Dimensions.get('window');

export default function DashboardSellerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [idToko, setIdToko] = useState<string | null>(null); 
  const [namaToko, setNamaToko] = useState('Memuat nama lapak...');
  const [statusToko, setStatusToko] = useState('TUTUP'); 
  const [alamatToko, setAlamatToko] = useState('Alamat belum diatur');
  const [kategoriToko, setKategoriToko] = useState('Kategori Umum');
  const [fotoToko, setFotoToko] = useState<string | null>(null);
  const [deskripsiToko, setDeskripsiToko] = useState('Belum ada deskripsi singkat.');
  const [jamOperasional, setJamOperasional] = useState('08:00 - 20:00');
  
  const [isSaldoKurang, setIsSaldoKurang] = useState(false);
  const [daftarProduk, setDaftarProduk] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalProduk: 0, pesananBaru: 0, totalOmset: 0 });

  // 🟢 STATE UNTUK CUSTOM MODAL ALERT
  const [infoModal, setInfoModal] = useState({ visible: false, title: '', message: '', type: 'warning' }); 

  const idTokoRef = useRef<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null); 
  const isFirstMount = useRef(true); 

  // 🟢 FUNGSI PEMANGGIL CUSTOM ALERT
  const showCustomAlert = (title: string, message: string, type: 'warning' | 'error' | 'success' = 'warning') => {
    setInfoModal({ visible: true, title, message, type });
  };

  // 🔥 POINT 3a: PEMICU ALARM KASTA TERTINGGI UNTUK DASHBOARD UTAMA
  const pemicuAlarmLapak = async (pesanAlert: string, isJasa: boolean = false) => {
    try {
      Vibration.vibrate([0, 500, 200, 500, 200, 500]); 

      if (Notifications && typeof Notifications.scheduleNotificationAsync === 'function') {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: isJasa ? "🚨 PANGGILAN JASA BARU MASUK!" : "📦 PESANAN BARU MASUK DI TOKO!",
            body: isJasa 
              ? "Warga membutuhkan layanan Servis Anda sekarang. Buka pesanan untuk konfirmasi." 
              : "Pesanan masuk. Segera siapkan barang sebelum kurir datang menjemput.",
            sound: 'migo.mp3', 
          },
          trigger: null, 
        });
      }

      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => null); 
      }

      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/migo.mp3'),
        { shouldPlay: true, volume: 1.0, isLooping: false }
      );
      soundRef.current = sound;
    } catch (soundError) {
      console.log("Pipa pemutaran audio terhambat:", soundError.message);
    }
  };

  const fetchStatistikMitra = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const uid = session.user.id;

      const { data: dataTokoInduk } = await supabase
        .from('toko')
        .select('id_toko, nama_toko, status_toko, alamat_toko, kategori_toko, foto_toko, deskripsi, jam_operasional') 
        .eq('user_id_toko', uid)
        .maybeSingle();

      if (dataTokoInduk) {
        setIdToko(dataTokoInduk.id_toko);
        idTokoRef.current = dataTokoInduk.id_toko;
        setNamaToko(dataTokoInduk.nama_toko || 'Lapak Mitra PAMILO');
        setStatusToko(dataTokoInduk.status_toko || 'TUTUP');
        setAlamatToko(dataTokoInduk.alamat_toko || 'Belum mengisi alamat.');
        setKategoriToko(dataTokoInduk.kategori_toko || 'Umum');
        setFotoToko(dataTokoInduk.foto_toko || null); 
        setDeskripsiToko(dataTokoInduk.deskripsi || 'Belum ada deskripsi singkat.');
        setJamOperasional(dataTokoInduk.jam_operasional || '08:00 - 20:00');
      } else {
        setNamaToko('Lapak Belum Terdaftar');
        return;
      }

      const targetIdToko = dataTokoInduk.id_toko;
      let produkCount = 0;
      let orderCount = 0;

      const { data: produkRows } = await supabase
        .from('produk')
        .select('id_produk, nama_produk, harga_produk, stok_ready_produk, foto_produk')
        .eq('id_toko_produk', targetIdToko)
        .order('created_at', { ascending: false });
      
      if (produkRows) {
        setDaftarProduk(produkRows);
        produkCount = produkRows.length;
      }

      const { data: orderRows, error: ordErr } = await supabase
        .from('order_items')
        .select('id, status_item, orders!inner(status_order)')
        .eq('penjual_id', targetIdToko);

      if (!ordErr && orderRows) {
        const statusLegal = ['PENDING', 'MENUNGGU_KONFIRMASI_MITRA', 'DIPROSES', 'MENCARI_KURIR', 'DIKIRIM', 'MENCARI_DRIVER'];
        const pesananAktifMurni = orderRows.filter(item => {
          return statusLegal.includes(String(item.status_item).toUpperCase().trim()) && 
                 statusLegal.includes(String(item.orders?.status_order || '').toUpperCase().trim());
        });
        orderCount = pesananAktifMurni.length;
      }

      const { data: dataUser } = await supabase
        .from('users')
        .select('saldo')
        .eq('user_id', uid)
        .maybeSingle();

      const saldoSekarang = dataUser ? (Number(dataUser.saldo) || 0) : 0;

      if (saldoSekarang < 10000) {
        setIsSaldoKurang(true);
        if (dataTokoInduk.status_toko === 'BUKA') {
          await supabase.from('toko').update({ status_toko: 'TUTUP' }).eq('id_toko', targetIdToko);
          setStatusToko('TUTUP');
          showCustomAlert("Lapak Dinonaktifkan 🚨", "Saldo brankas Tuan berada di bawah limit minimal Rp 10.000. Toko otomatis ditutup dari aplikasi warga.", "error");
        }
      } else {
        setIsSaldoKurang(false);
      }

      setStats({
        totalProduk: produkCount,
        pesananBaru: orderCount,
        totalOmset: saldoSekarang
      });

    } catch (err) {
      console.log("Sinkronisasi gagal:", err);
    } finally {
      setLoading(false); 
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (isFirstMount.current) {
        fetchStatistikMitra(true);
        isFirstMount.current = false;
      } else {
        fetchStatistikMitra(false); 
      }
    }, [])
  );

  useEffect(() => {
    // 🔥 POINT 3a: SENSOR DETEKSI ORDERAN BARU KASTA TERTINGGI DARI DASHBOARD
    const channelDashboardBadge = supabase
      .channel(`radar-seller-unified-stream-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_items' }, (payload) => {
        if (idTokoRef.current && payload.new.penjual_id === idTokoRef.current) {
          fetchStatistikMitra(false); 
          const isJasaServis = String(payload.new?.status_item).toUpperCase() === 'MENUNGGU_KONFIRMASI_MITRA';
          pemicuAlarmLapak(
            isJasaServis ? "Ada pesanan Jasa masuk!" : "Ada pesanan warga mendarat! Segera buka Pesanan.", 
            isJasaServis
          );
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'order_items' }, () => { 
        if (idTokoRef.current) fetchStatistikMitra(false); 
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { 
        if (idTokoRef.current) fetchStatistikMitra(false); 
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(channelDashboardBadge); 
      if (soundRef.current) soundRef.current.unloadAsync().catch(() => null); 
    };
  }, []);

  const handleToggleStatusToko = async (val: boolean) => {
    const statusBaru = val ? 'BUKA' : 'TUTUP';
    
    if (val) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { data: dataSaldoLive } = await supabase
          .from('users')
          .select('saldo')
          .eq('user_id', session.user.id)
          .maybeSingle();

        const saldoDetikIni = dataSaldoLive ? (Number(dataSaldoLive.saldo) || 0) : 0;

        if (saldoDetikIni < 10000) {
          setIsSaldoKurang(true);
          setStats(prev => ({ ...prev, totalOmset: saldoDetikIni }));
          showCustomAlert(
            "Pintu Gerbang Terkunci! 🔒", 
            `Saldo Anda (Rp ${saldoDetikIni.toLocaleString('id-ID')}) kurang dari batas minimum Rp 10.000. Silakan isi saldo terlebih dahulu.`,
            "warning"
          );
          return; 
        }
      } catch (e) {
        return;
      }
    }

    try {
      setStatusToko(statusBaru);
      const { error } = await supabase.from('toko').update({ status_toko: statusBaru }).eq('id_toko', idToko);
      if (error) throw error;
    } catch (err) {
      setStatusToko(statusToko === 'BUKA' ? 'TUTUP' : 'BUKA');
      showCustomAlert("Gangguan Sirkuit 🛑", "Gagal memperbarui status operasional lapak.", "error");
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStatistikMitra(false);
  };

  const pilarText = String(kategoriToko).toUpperCase().includes('JASA') || String(kategoriToko).toUpperCase().includes('SERVIS') ? 'LAYANAN' : 'PRODUK';

  if (loading && !refreshing) {
    return (
      <View style={styles.centerLoading}>
        <ActivityIndicator size="large" color="#4A3525" />
        <Text style={styles.loadingText}>Menghubungkan ke pusat kendali Mitra...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: true,
          headerTitle: 'Konsol Merchant Utama',
          headerTintColor: '#fff',
          headerStyle: { backgroundColor: '#4A3525' },
          headerTitleStyle: { fontWeight: 'bold', fontSize: 13 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.replace('/(tabs)/profile')} style={{ paddingVertical: 4 }}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          ),
        }} 
      />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#4A3525"]} />}
      >
        
        {isSaldoKurang && (
          <TouchableOpacity style={styles.alertBanner} onPress={() => router.push('/saldo')} activeOpacity={0.8}>
            <Ionicons name="warning" size={18} color="#C62828" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.alertBannerTitle}>Sasis Dana Kritis</Text>
              <Text style={styles.alertBannerText}>Isi saldo PAMILO-Pay untuk mengaktifkan kembali lapak.</Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color="#C62828" />
          </TouchableOpacity>
        )}

        <View style={styles.heroStoreCard}>
          <View style={styles.welcomeRow}>
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text style={styles.welcomeLabel}>Selamat Datang Kembali!</Text>
              <Text style={styles.storeNameText}>{namaToko}</Text>
            </View>
            
            <View style={styles.switchWrapper}>
              <Text style={[styles.switchLabel, statusToko === 'BUKA' ? { color: '#2E7D32' } : { color: '#757575' }]}>
                {statusToko === 'BUKA' ? '🟢 BUKA' : '⚪ TUTUP'}
              </Text>
              <Switch 
                trackColor={{ false: '#D7CCC8', true: '#A5D6A7' }} 
                thumbColor={statusToko === 'BUKA' ? '#2E7D32' : '#757575'} 
                onValueChange={handleToggleStatusToko} 
                value={statusToko === 'BUKA'} 
              />
            </View>
          </View>

          <View style={styles.storeProfileRow}>
            <View style={styles.logoFrame}>
              {fotoToko ? (
                <Image source={{ uri: fotoToko }} style={styles.logoImageReal} />
              ) : (
                <FontAwesome5 name="store" size={18} color="#4A3525" />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.txtStoreDesc} numberOfLines={1}>📍 Lokasi: {alamatToko}</Text>
              <Text style={styles.txtStoreDesc} numberOfLines={1}>📝 Info: {deskripsiToko}</Text>
              <Text style={styles.txtStoreHours}>🕒 Ops: <Text style={{fontWeight: 'bold'}}>{jamOperasional}</Text> | 🏷️ {kategoriToko.toUpperCase()}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.btnEditProfileQuick} onPress={() => router.push('/seller/pengaturan-toko')} activeOpacity={0.7}>
            <Ionicons name="create-outline" size={14} color="#4A3525" />
            <Text style={styles.btnEditProfileText}>Edit Informasi Lapak Anda</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.totalProduk}</Text>
            <Text style={styles.statLabel}>{pilarText} Aktif</Text>
          </View>
          <View style={[styles.statBox, stats.pesananBaru > 0 ? { borderColor: '#E67E22', backgroundColor: '#FBEEE6' } : null]}>
            <Text style={[styles.statValue, stats.pesananBaru > 0 ? { color: '#E67E22' } : null]}>{stats.pesananBaru}</Text>
            <Text style={styles.statLabel}>Permintaan Baru</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { fontSize: 13, marginTop: 4 }, isSaldoKurang && { color: '#C62828' }]}>
              Rp {stats.totalOmset.toLocaleString('id-ID')}
            </Text>
            <Text style={styles.statLabel}>Total Saldo</Text>
          </View>
        </View>

        <Text style={styles.menuGroupTitle}>OPERASIONAL INTI MITRA</Text>
        <View style={styles.menuContainer}>
          <TouchableOpacity style={styles.menuRowBtn} onPress={() => router.push('/seller/pesanan-masuk')} activeOpacity={0.8}>
            <View style={[styles.iconWrapper, { backgroundColor: '#FFF3E0' }]}><FontAwesome5 name="clipboard-list" size={14} color="#D35400" /></View>
            <View style={styles.menuTextSection}>
              <Text style={styles.menuTitleText}>Kelola Pesanan Masuk</Text>
              <Text style={styles.menuSubtitleText}>Proses konfirmasi & panggil Kurir/Jadwalkan Servis.</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#BCAAA4" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuRowBtn, { borderBottomWidth: 0 }]} onPress={() => router.push('/seller/riwayat-pesanan')} activeOpacity={0.8}>
            <View style={[styles.iconWrapper, { backgroundColor: '#E8F5E9' }]}><FontAwesome5 name="history" size={14} color="#2E7D32" /></View>
            <View style={styles.menuTextSection}>
              <Text style={styles.menuTitleText}>Arsip Pekerjaan & Penjualan</Text>
              <Text style={styles.menuSubtitleText}>Pantau catatan pesanan yang selesai maupun dibatalkan.</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#BCAAA4" />
          </TouchableOpacity>
        </View>

        <Text style={styles.menuGroupTitle}>PEMASARAN & KELOLA IKLAN</Text>
        <View style={styles.menuContainer}>
          
          <TouchableOpacity style={styles.menuRowBtn} onPress={() => router.push('/seller/pasang-iklan')} activeOpacity={0.8}>
            <View style={[styles.iconWrapper, { backgroundColor: '#E0F2F1' }]}><FontAwesome5 name="bullhorn" size={13} color="#00695C" /></View>
            <View style={styles.menuTextSection}>
              <Text style={styles.menuTitleText}>Pasang Iklan Banner Depan</Text>
              <Text style={styles.menuSubtitleText}>Pajang promosi Anda di Beranda Utama PAMILO.</Text>
            </View>
            <View style={styles.badgePromoAksen}><Text style={styles.badgePromoText}>BOOST</Text></View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuRowBtn, { borderBottomWidth: 0 }]} onPress={() => router.push('/seller/kelola-promo')} activeOpacity={0.8}>
            <View style={[styles.iconWrapper, { backgroundColor: '#FBE9E7' }]}><FontAwesome5 name="ticket-alt" size={13} color="#D84315" /></View>
            <View style={styles.menuTextSection}>
              <Text style={styles.menuTitleText}>Manajemen Diskon & Voucher</Text>
              <Text style={styles.menuSubtitleText}>Buat kode voucher, harga coret, & tarik minat warga.</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#BCAAA4" />
          </TouchableOpacity>

        </View>

        <View style={styles.productCatalogSectionTitleRow}>
          <Text style={styles.menuGroupTitle}>DAFTAR KATALOG {pilarText} ({daftarProduk.length})</Text>
          <TouchableOpacity style={styles.btnTambahProdukQuick} onPress={() => router.push('/seller/produk-saya')} activeOpacity={0.6}>
            <Ionicons name="add-circle" size={14} color="#D35400" />
            <Text style={styles.txtTambahQuick}>Kelola {pilarText}</Text>
          </TouchableOpacity>
        </View>

        {daftarProduk.length === 0 ? (
          <View style={styles.boxProdukKosong}>
            <FontAwesome5 name="box-open" size={30} color="#D7CCC8" />
            <Text style={styles.txtProdukKosong}>Belum ada {pilarText.toLowerCase()} yang ter-upload di lapak ini. Ketuk tombol Kelola di atas untuk memulai.</Text>
          </View>
        ) : (
          <View style={styles.listProdukContainer}>
            {daftarProduk.map((item) => {
              const apakahReady = Number(item.stok_ready_produk || 0) > 0;
              return (
                <TouchableOpacity key={item.id_produk} style={styles.cardProdukLive} onPress={() => router.push('/seller/produk-saya')} activeOpacity={0.8}>
                  {item.foto_produk ? (
                    <Image source={{ uri: item.foto_produk }} style={styles.imgProdukLive} />
                  ) : (
                    <View style={styles.imgProdukPlaceholder}><FontAwesome5 name="image" size={14} color="#A1887F" /></View>
                  )}
                  
                  <View style={styles.infoProdukLive}>
                    <Text style={styles.namaProdukLive} numberOfLines={1}>{item.nama_produk}</Text>
                    <Text style={styles.hargaProdukLive}>Rp {Number(item.harga_produk || 0).toLocaleString('id-ID')}</Text>
                    
                    <View style={styles.rowBadgeProduk}>
                      {pilarText === 'PRODUK' && <View style={styles.badgeStok}><Text style={styles.txtBadgeStok}>Stok: {item.stok_ready_produk || 0}</Text></View>}
                      <View style={[styles.badgeStatusReady, apakahReady ? {backgroundColor: '#E8F5E9'} : {backgroundColor: '#FFEBEE'}]}>
                        <Text style={[styles.txtReady, apakahReady ? {color: '#2E7D32'} : {color: '#C62828'}]}>
                          {apakahReady ? 'AKTIF' : 'TDK TERSEDIA'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Ionicons name="create-outline" size={15} color="#BCAAA4" style={{marginRight: 4}} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

      </ScrollView>

      {/* 🟢 CUSTOM MODAL ALERT PREMIUM */}
      <Modal visible={infoModal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.infoModalCard}>
            <View style={[styles.infoIconCircle, { 
              backgroundColor: infoModal.type === 'error' ? '#C62828' : (infoModal.type === 'warning' ? '#D35400' : '#2E7D32') 
            }]}>
              <Ionicons 
                name={infoModal.type === 'error' ? 'close-outline' : (infoModal.type === 'warning' ? 'warning-outline' : 'checkmark-outline')} 
                size={36} color="#fff" 
              />
            </View>
            <Text style={styles.infoModalTitle}>{infoModal.title}</Text>
            <Text style={styles.infoModalMessage}>{infoModal.message}</Text>
            <TouchableOpacity 
              style={[styles.btnInfoClose, { 
                backgroundColor: infoModal.type === 'error' ? '#C62828' : (infoModal.type === 'warning' ? '#D35400' : '#2E7D32') 
              }]} 
              onPress={() => setInfoModal({ ...infoModal, visible: false })}
            >
              <Text style={styles.btnInfoCloseText}>MENGERTI</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5' },
  scrollContent: { padding: 16 },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF8F5' },
  loadingText: { marginTop: 10, fontSize: 11, color: '#8D6E63', fontWeight: '600' },
  alertBanner: { flexDirection: 'row', backgroundColor: '#FFEBEE', borderWidth: 1, borderColor: '#FFCDD2', padding: 12, borderRadius: 14, alignItems: 'center', marginBottom: 16 },
  alertBannerTitle: { fontSize: 12, fontWeight: 'bold', color: '#C62828' },
  alertBannerText: { fontSize: 10, color: '#D32F2F', marginTop: 1, lineHeight: 14 },
  heroStoreCard: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#EFEBE9', padding: 16, marginBottom: 16, elevation: 0.5 },
  welcomeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: '#FAF8F5', paddingBottom: 12 },
  welcomeLabel: { fontSize: 10, fontWeight: 'bold', color: '#BCAAA4', letterSpacing: 0.5 },
  storeNameText: { fontSize: 15, fontWeight: '900', color: '#4A3525', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
  switchWrapper: { alignItems: 'flex-end', minWidth: 75 },
  switchLabel: { fontSize: 9, fontWeight: '900', marginBottom: 2, letterSpacing: 0.5 },
  storeProfileRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  logoFrame: { width: 54, height: 52, borderRadius: 14, backgroundColor: '#F5EBE6', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#E0D4CE' },
  logoImageReal: { width: '100%', height: '100%', resizeMode: 'cover' },
  txtStoreDesc: { fontSize: 11, color: '#6D4C41', lineHeight: 15, fontWeight: '500', marginTop: 1 },
  txtStoreHours: { fontSize: 10, color: '#8D6E63', marginTop: 3, fontWeight: '600' },
  btnEditProfileQuick: { flexDirection: 'row', height: 34, backgroundColor: '#FAF8F5', borderWidth: 1, borderColor: '#E0D4CE', borderRadius: 10, marginTop: 14, justifyContent: 'center', alignItems: 'center', gap: 6 },
  btnEditProfileText: { fontSize: 10, fontWeight: '700', color: '#4A3525' },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statBox: { flex: 1, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#EFEBE9', paddingVertical: 14, alignItems: 'center', justifyContent: 'center', elevation: 0.5 },
  statValue: { fontSize: 17, fontWeight: '900', color: '#4A3525' },
  statLabel: { fontSize: 9, color: '#8D6E63', marginTop: 4, fontWeight: '600' },
  menuGroupTitle: { fontSize: 10, fontWeight: 'bold', color: '#A1887F', letterSpacing: 1.2, marginVertical: 10, paddingLeft: 2, textTransform: 'uppercase' },
  menuContainer: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#EFEBE9', overflow: 'hidden', elevation: 0.5, marginBottom: 12 },
  menuRowBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#FAF8F5' },
  iconWrapper: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuTextSection: { flex: 1, marginLeft: 14, paddingRight: 8 },
  menuTitleText: { fontSize: 12, fontWeight: 'bold', color: '#4A3525' },
  menuSubtitleText: { fontSize: 10, color: '#8D6E63', marginTop: 2, lineHeight: 15 },
  badgePromoAksen: { backgroundColor: '#E0F2F1', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, borderWidth: 0.5, borderColor: '#00695C' },
  badgePromoText: { fontSize: 8, color: '#00695C', fontWeight: 'bold' },
  productCatalogSectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  btnTambahProdukQuick: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8 },
  txtTambahQuick: { fontSize: 11, fontWeight: 'bold', color: '#D35400' },
  boxProdukKosong: { alignItems: 'center', paddingHorizontal: 30, paddingVertical: 40, backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#EFEBE9', borderStyle: 'dashed', marginTop: 4 },
  txtProdukKosong: { fontSize: 11, color: '#A1887F', textAlign: 'center', marginTop: 10, lineHeight: 16 },
  listProdukContainer: { marginTop: 4, gap: 10 },
  cardProdukLive: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#EFEBE9' },
  imgProdukLive: { width: 48, height: 48, borderRadius: 10, resizeMode: 'cover' },
  imgProdukPlaceholder: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#FAF8F5', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E0D4CE' },
  infoProdukLive: { flex: 1, marginLeft: 12, paddingRight: 8 },
  namaProdukLive: { fontSize: 13, fontWeight: 'bold', color: '#4A3525' },
  hargaProdukLive: { fontSize: 12, fontWeight: '800', color: '#D35400', marginTop: 2 },
  rowBadgeProduk: { flexDirection: 'row', gap: 6, marginTop: 4 },
  badgeStok: { backgroundColor: '#FAF8F5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 0.5, borderColor: '#E0D4CE' },
  txtBadgeStok: { fontSize: 8, fontWeight: 'bold', color: '#6D4C41' },
  badgeStatusReady: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  txtReady: { fontSize: 8, fontWeight: 'bold' },

  // 🟢 STYLE CUSTOM ALERT MODAL PREMIUM
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  infoModalCard: { width: width - 60, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, alignItems: 'center', elevation: 10 },
  infoIconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16, marginTop: -10, borderWidth: 4, borderColor: '#FFF', elevation: 2 },
  infoModalTitle: { fontSize: 16, fontWeight: '900', color: '#111', textAlign: 'center', marginBottom: 8 },
  infoModalMessage: { fontSize: 12, color: '#5D4037', textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  btnInfoClose: { width: '100%', paddingVertical: 14, borderRadius: 14, alignItems: 'center', elevation: 2 },
  btnInfoCloseText: { color: '#FFF', fontWeight: 'bold', fontSize: 12, letterSpacing: 1 }
});