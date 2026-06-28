// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar, 
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 🚀 IMPORT AMUNISI EXPO NOTIFICATIONS ADAPTIF
import * as Notifications from 'expo-notifications';

// BACKEND: KONEKTOR UTAMA SUPABASE CLOUD TUAN
import { supabase } from '../../supabaseConfig';

export default function AdminConsoleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // 💡 STATE IDENTITAS & KASTA ADMIN
  const [userRole, setUserRole] = useState<string>('admin_cs'); 
  const [namaAdmin, setNamaAdmin] = useState<string>('Admin');

  // STATE KEUANGAN PASIF PLATFORM TUAN OWNER
  const [adminRevenue, setAdminRevenue] = useState(0); 
  const [totalTurnover, setTotalTurnover] = useState(0); 
  
  // DETAIL ANTREAN VERIFIKASI MITRA, DRIVER, & SALDO MANUAL
  const [detailAntrean, setDetailAntrean] = useState({
    tokoPending: 0,
    driverPending: 0,
    saldoPending: 0, 
    totalGabungan: 0
  });

  const [liveStats, setLiveStats] = useState({
    totalOrders: 0,
    merchantCount: 0, 
    driverOnline: 0,
    totalUsers: 0, 
  });

  const getUcapanWaktu = () => {
    const jamSekarang = new Date().getHours();
    if (jamSekarang >= 0 && jamSekarang < 10) return 'Selamat Pagi';
    if (jamSekarang >= 10 && jamSekarang < 15) return 'Selamat Siang';
    if (jamSekarang >= 15 && jamSekarang < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  const getPangkatAdmin = (role: string) => {
    if (role === 'super_admin') return '👑 Super Admin (Owner)';
    if (role === 'admin_spv') return '🕵️‍♂️ Supervisor Executive';
    if (role === 'admin_cs') return '🎧 Customer Service';
    return '🛡️ Staff Admin';
  };
  
  // 🟢 FIX ADMIN: FUNGSI PICU SIRINE ALARM DENGAN JALUR TOL "MAX"
  const picuSuaraSirineAdmin = async (judul: string, pesan: string) => {
    try {
      if (!Notifications || typeof Notifications.scheduleNotificationAsync !== 'function') {
        console.log(`📡 [REALTIME ADMIN ALERT] ${judul}: ${pesan}`);
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: judul,
          body: pesan,
          sound: 'default', 
          priority: Notifications.AndroidNotificationPriority.MAX, 
          // @ts-ignore
          channelId: 'pamilo-urgent', 
        },
        trigger: null, 
      });
    } catch (err) {
      console.log("Gagal memicu audio notifikasi admin:", err);
    }
  };

  const fetchKondisiPasarPamilo = async () => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        Alert.alert("Sesi Habis", "Silakan login ulang.");
        router.replace('/login');
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('user_name, role')
        .eq('user_id', session.user.id)
        .single();

      if (userError || !userData) {
        Alert.alert("Akses Ditolak", "Identitas akun gagal divalidasi.");
        return;
      }

      const roleTerdeteksi = userData.role ? userData.role.toLowerCase() : 'admin_cs';
      setUserRole(roleTerdeteksi);
      setNamaAdmin(userData.user_name || 'Admin');

      if (roleTerdeteksi !== 'super_admin' && roleTerdeteksi !== 'admin_spv' && roleTerdeteksi !== 'admin_cs') {
        Alert.alert("Bukan Wilayah Anda 🚨", "Hak akses konsol eksekutif ditolak.");
        router.replace('/(tabs)/profile');
        return;
      }

      let hitungKomisiAdmin = 0;
      let hitungTotalPerputaran = 0;
      let totalNota = 0;
      let mCount = 0;
      let dCount = 0;
      let uCount = 0; 
      let pToko = 0;
      let pDriver = 0;
      let pSaldo = 0;

      const [resTokoPending, resDriversPending, resSaldoPending, resUsers] = await Promise.all([
        supabase.from('toko').select('id_toko', { count: 'exact', head: true }).eq('is_verified', false),
        supabase.from('drivers').select('id_driver', { count: 'exact', head: true }).eq('is_verified', false),
        supabase.from('transaksi_saldo').select('id', { count: 'exact', head: true }).eq('status_transaksi', 'PENDING'),
        supabase.from('users').select('user_id, role, is_seller, is_driver')
      ]);

      if (roleTerdeteksi === 'super_admin') {
        const { data: configData } = await supabase
          .from('pengaturan_aplikasi')
          .select('kunci_konfigurasi, nilai_konfigurasi');

        const configMap = new Map(configData?.map(c => [c.kunci_konfigurasi, c.nilai_konfigurasi]) || []);
        const nominalAdminAplikasi = parseInt(configMap.get('BIAYA_ADMIN_APLIKASI') || '2000');
        const feeDriverPersen = 10; 
        const feeSellerPersen = 5;

        const [resOrders, resMigoOrders] = await Promise.all([
          supabase.from('orders').select('total_pembayaran, total_harga_barang, biaya_ongkir, biaya_admin, status_order'),
          supabase.from('migo_orders').select('total_pembayaran, biaya_ongkir, status_order')
        ]);

        if (!resOrders.error && resOrders.data) {
          totalNota += resOrders.data.length;
          resOrders.data.forEach(item => {
            hitungTotalPerputaran += Number(item.total_pembayaran || 0);
            if (item.status_order === 'SELESAI') {
              const untungSeller = Math.round(Number(item.total_harga_barang || 0) * (feeSellerPersen / 100));
              const untungKurir = Math.round(Number(item.biaya_ongkir || 0) * (feeDriverPersen / 100));
              const untungSistem = Number(item.biaya_admin || nominalAdminAplikasi);
              hitungKomisiAdmin += (untungSeller + untungKurir + untungSistem);
            }
          });
        }

        if (!resMigoOrders.error && resMigoOrders.data) {
          totalNota += resMigoOrders.data.length;
          resMigoOrders.data.forEach(item => {
            hitungTotalPerputaran += Number(item.total_pembayaran || 0);
            if (item.status_order === 'SELESAI') {
              const untungOjol = Math.round(Number(item.total_pembayaran || 0) * (feeDriverPersen / 100));
              hitungKomisiAdmin += untungOjol;
            }
          });
        }
        setAdminRevenue(hitungKomisiAdmin);
        setTotalTurnover(hitungTotalPerputaran);
      }

      if (!resUsers.error && resUsers.data) {
        uCount = resUsers.data.length; 
        mCount = resUsers.data.filter(u => u.is_seller === true).length;
        dCount = resUsers.data.filter(u => u.is_driver === true).length;
        if (roleTerdeteksi !== 'super_admin') {
          totalNota = uCount * 2; 
        }
      }

      pToko = resTokoPending.count || 0;
      pDriver = resDriversPending.count || 0;
      pSaldo = resSaldoPending.count || 0;
      
      setDetailAntrean({ 
        tokoPending: pToko, 
        driverPending: pDriver, 
        saldoPending: pSaldo, 
        totalGabungan: pToko + pDriver 
      });
      
      setLiveStats({ totalOrders: totalNota, merchantCount: mCount, driverOnline: dCount, totalUsers: uCount });

      const sekarang = new Date();
      setLastUpdated(sekarang.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

    } catch (error) {
      console.error("Kesalahan sirkuit global admin:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKondisiPasarPamilo();

    const channelAdminStream = supabase
      .channel('executive-live-monitor-secure-v6')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'toko' }, async (payload) => { 
        if (payload.eventType === 'INSERT' && payload.new.is_verified === false) {
          const namaTokoBaru = payload.new.nama_toko || 'Toko Baru';
          await picuSuaraSirineAdmin("🏪 CALON MITRA TOKO BARU!", `Registrasi form masuk dari: "${namaTokoBaru}". Harap cek berkas penunjang!`);
        }
        fetchKondisiPasarPamilo(); 
      }) 
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, async (payload) => { 
        if (payload.eventType === 'INSERT' && payload.new.is_verified === false) {
          const namaDriverBaru = payload.new.nama_driver || 'Kurir MIGO';
          await picuSuaraSirineAdmin("🛵 CALON MITRA DRIVER BARU!", `Form masuk atas nama: "${namaDriverBaru}". Ketuk panel verifikasi sekarang!`);
        }
        fetchKondisiPasarPamilo(); 
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transaksi_saldo' }, async (payload) => {
        if (payload.eventType === 'INSERT' && payload.new.status_transaksi === 'PENDING') {
          const jenisReq = payload.new.tipe_transaksi === 'TOPUP' ? '💰 ISI SALDO MANUAL' : '💸 PENARIKAN DANA DIVER';
          const nominalUang = Number(payload.new.jumlah).toLocaleString('id-ID');
          await picuSuaraSirineAdmin(jenisReq, `Ada pengajuan baru senilai Rp ${nominalUang}. Harap verifikasi mutasi bank pusat!`);
        }
        fetchKondisiPasarPamilo();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { fetchKondisiPasarPamilo(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'migo_orders' }, () => { fetchKondisiPasarPamilo(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pengaturan_aplikasi' }, () => { fetchKondisiPasarPamilo(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => { fetchKondisiPasarPamilo(); })
      .subscribe();

    return () => { supabase.removeChannel(channelAdminStream); };
  }, []);

  const handleSistemKontrol = (fitur: 'GOD_MODE' | 'VERIFIKASI' | 'MANAJEMEN' | 'BERITA' | 'TARIF' | 'EMERGENCY' | 'LOKER' | 'WISATA' | 'DARURAT' | 'SALDO') => {
    if (fitur === 'GOD_MODE') {
      if (userRole === 'super_admin' || userRole === 'admin_spv') {
        router.push('/admin/god-mode');
      } else {
        Alert.alert("Akses Ditolak 🛑", "Kasta Customer Service tidak diizinkan memegang remot kendali radar MIGO.");
      }
    }
    else if (fitur === 'VERIFIKASI') {
      if (userRole === 'super_admin' || userRole === 'admin_spv') {
        router.push('/admin/verifikasi-mitra');
      } else {
        Alert.alert("Akses Ditolak 🛑", "Tingkat kasta Anda tidak diizinkan memverifikasi berkas.");
      }
    } 
    else if (fitur === 'SALDO') {
      if (userRole === 'super_admin' || userRole === 'admin_spv') {
        router.push('/admin/manajemen-saldo');
      } else {
        Alert.alert("Akses Ditolak 🛑", "Tingkat kasta Customer Service tidak diberikan izin mengolah sirkuit finansial.");
      }
    }
    else if (fitur === 'TARIF') {
      if (userRole === 'super_admin') {
        router.push('/admin/konsol-tarif');
      } else {
        Alert.alert("Akses Terkunci 🔒", "Hanya Super Admin (Owner) yang berhak mengonfigurasi keuangan platform.");
      }
    }
    else if (fitur === 'EMERGENCY') {
      if (userRole === 'super_admin') {
        router.push('/admin/status-sistem');
      } else {
        Alert.alert("Akses Terkunci 🔒", "Hanya Super Admin yang memegang tombol darurat server.");
      }
    }
    else if (fitur === 'MANAJEMEN') {
      // 🟢 Rute Manajemen Tunggal: Kini menangani Warga & Mitra sekaligus
      router.push('/admin/manajemen-user'); 
    }
    else if (fitur === 'BERITA') router.push('/admin/input-berita');
    else if (fitur === 'LOKER') router.push('/admin/input-loker');
    else if (fitur === 'WISATA') router.push('/admin/input-wisata');
    else if (fitur === 'DARURAT') router.push('/admin/input-darurat');
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FFB74D" />
        <Text style={styles.loadingText}>Membuka retina & kasta akses eksekutif...</Text>
      </View>
    );
  }

  return (
    <View style={styles.mainWrapper}>
      <Stack.Screen 
        options={{
          headerShown: true,
          headerTitle: 'Konsol Utama Eksekutif',
          headerTintColor: '#fff',
          headerStyle: { backgroundColor: '#1A0F05' }, 
          headerTitleStyle: { fontWeight: 'bold', fontSize: 13 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.replace('/(tabs)/profile')} style={{ marginLeft: 5, marginRight: 15, paddingVertical: 4 }}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          ),
        }} 
      />
      <StatusBar barStyle="light-content" backgroundColor="#1A0F05" />

      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: 30 }]}>
          
          {/* BANNER IDENTITAS JABATAN */}
          <View style={styles.adminBanner}>
            <FontAwesome5 name="user-shield" size={16} color="#FFB74D" />
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={styles.adminTitle}>{getUcapanWaktu()}, {namaAdmin.split(' ')[0]}</Text>
              <Text style={styles.adminSubtitle}>{getPangkatAdmin(userRole)}</Text>
            </View>
            <View style={styles.liveIndicatorRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>RADAR {lastUpdated}</Text>
            </View>
          </View>

          {/* 🔒 BRANKAS COKLAT: AREA EXCLUSIVE SUPER_ADMIN */}
          {userRole === 'super_admin' && (
            <>
              <Text style={styles.groupTitle}>BRANKAS UTAMA PENDAPATAN PLATFORM (REVENUE SPLIT)</Text>

              <View style={styles.revenueCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.badgeIncome}><Text style={styles.badgeIncomeText}>FINTECH INDEKS AKTIF</Text></View>
                  <FontAwesome5 name="coins" size={14} color="#FFD700" />
                </View>
                <Text style={styles.revenueValue}>Rp {adminRevenue.toLocaleString('id-ID')}</Text>
                <Text style={styles.revenueSubLabel}>Total bagi hasil murni terakumulasi (Potongan Toko + Potongan Driver MIGO + Jasa Transaksi Belanja, Top Up, & WD Massal).</Text>
              </View>

              <View style={styles.turnoverCard}>
                <Text style={styles.turnoverLabel}>Volume Perputaran Uang Pasar (GMV)</Text>
                <Text style={styles.turnoverValue}>Rp {totalTurnover.toLocaleString('id-ID')}</Text>
              </View>
            </>
          )}

          {/* LOG DATA STATISTIK */}
          <Text style={styles.groupTitle}>LOG MONITOR AKTIVITAS PASAR</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Ionicons name="people" size={16} color="#8E24AA" />
                <Text style={styles.statNumber}>{liveStats.totalUsers}</Text>
                <Text style={styles.statLabel}>Total User</Text>
              </View>
              <View style={styles.statBox}>
                <Ionicons name="receipt" size={16} color="#D35400" />
                <Text style={styles.statNumber}>{liveStats.totalOrders}</Text>
                <Text style={styles.statLabel}>Nota Masuk</Text>
              </View>
            </View>
            <View style={[styles.statsRow, { marginTop: 10 }]}>
              <View style={styles.statBox}>
                <FontAwesome5 name="store" size={12} color="#2E7D32" />
                <Text style={styles.statNumber}>{liveStats.merchantCount}</Text>
                <Text style={styles.statLabel}>Mitra Aktif</Text>
              </View>
              <View style={styles.statBox}>
                <FontAwesome5 name="motorcycle" size={13} color="#0288D1" />
                <Text style={styles.statNumber}>{liveStats.driverOnline}</Text>
                <Text style={styles.statLabel}>Kurir MIGO</Text>
              </View>
            </View>
          </View>

          {/* INPUT INFO GALUH */}
          <Text style={styles.groupTitle}>PANEL INPUT KONTEN & UTILITAS INFO GALUH</Text>
          <View style={styles.consoleCard}>
            
            <TouchableOpacity style={styles.consoleRow} onPress={() => handleSistemKontrol('BERITA')}>
              <View style={[styles.actionIconBg, { backgroundColor: '#F3E5F5' }]}>
                <Ionicons name="megaphone-outline" size={14} color="#8E24AA" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.actionTitle}>Input Berita & Pengumuman</Text>
                <Text style={styles.actionSubtitle}>Unggah pamflet banner promo, jadwal agenda, info pemadaman PLN/PDAM.</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="#BCAAA4" />
            </TouchableOpacity>

            <View style={styles.cardDivider} />

            <TouchableOpacity style={styles.consoleRow} onPress={() => handleSistemKontrol('LOKER')}>
              <View style={[styles.actionIconBg, { backgroundColor: '#E8F5E9' }]}>
                <FontAwesome5 name="briefcase" size={12} color="#2E7D32" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.actionTitle}>Input Lowongan Kerja Baru</Text>
                <Text style={styles.actionSubtitle}>Tambahkan data loker tervalidasi Ciamis lengkap dengan sasis WhatsApp.</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="#BCAAA4" />
            </TouchableOpacity>

            <View style={styles.cardDivider} />

            <TouchableOpacity style={styles.consoleRow} onPress={() => handleSistemKontrol('WISATA')}>
              <View style={[styles.actionIconBg, { backgroundColor: '#FFF3E0' }]}>
                <FontAwesome5 name="map-marked-alt" size={12} color="#E65100" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.actionTitle}>Input Katalog Pesona Wisata & Kuliner</Text>
                <Text style={styles.actionSubtitle}>Masukkan nama destinasi baru lengkap dengan tautan gambar & GPS MIGO.</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="#BCAAA4" />
            </TouchableOpacity>

            <View style={styles.cardDivider} />

            <TouchableOpacity style={styles.consoleRow} onPress={() => handleSistemKontrol('DARURAT')}>
              <View style={[styles.actionIconBg, { backgroundColor: '#FFEBEE' }]}>
                <Ionicons name="call-outline" size={14} color="#C62828" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.actionTitle}>Manajemen Nomor Kontak Darurat</Text>
                <Text style={styles.actionSubtitle}>Kelola nomor darurat Polsek, Puskesmas, & Damkar tiap kecamatan.</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="#BCAAA4" />
            </TouchableOpacity>

          </View>

          {/* KONSOL KENDALI UTAMA */}
          <Text style={styles.groupTitle}>KONSOL AKSI KENDALI INTI</Text>
          <View style={styles.consoleCard}>

            {/* KOMANDO GOD MODE */}
            {(userRole === 'super_admin' || userRole === 'admin_spv') && (
              <>
                <TouchableOpacity style={styles.consoleRow} onPress={() => handleSistemKontrol('GOD_MODE')}>
                  <View style={[styles.actionIconBg, { backgroundColor: '#FFF8E1' }]}>
                    <FontAwesome5 name="satellite" size={12} color="#FF8F00" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.actionTitle, { color: '#D35400' }]}>Pusat Komando God Mode MIGO</Text>
                    <Text style={styles.actionSubtitle}>Pantau peta 45 driver realtime & lakukan tembak order paksa (Force Dispatch).</Text>
                  </View>
                  <View style={styles.badgeLiveRadar}><Text style={styles.badgeLiveRadarText}>LIVE MAP</Text></View>
                </TouchableOpacity>
                <View style={styles.cardDivider} />
              </>
            )}
            
            {/* VERIFIKASI MITRA DENGAN NOTIFIKASI COUNTER */}
            {(userRole === 'super_admin' || userRole === 'admin_spv') && (
              <>
                <TouchableOpacity style={styles.consoleRow} onPress={() => handleSistemKontrol('VERIFIKASI')}>
                  <View style={[styles.actionIconBg, { backgroundColor: '#E8F5E9' }]}>
                    <FontAwesome5 name="user-check" size={12} color="#2E7D32" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.actionTitle}>Verifikasi Berkas Masuk</Text>
                    <Text style={styles.actionSubtitle}>
                      {detailAntrean.totalGabungan > 0 ? `Tertahan: ${detailAntrean.tokoPending} Toko & ${detailAntrean.driverPending} Driver` : "Seluruh sirkuit pendaftaran bersih."}
                    </Text>
                  </View>
                  {detailAntrean.totalGabungan > 0 ? (
                    <View style={styles.badgeAlert}><Text style={styles.badgeAlertText}>{detailAntrean.totalGabungan} ANTREAN</Text></View>
                  ) : (
                    <Ionicons name="chevron-forward" size={14} color="#BCAAA4" />
                  )}
                </TouchableOpacity>
                <View style={styles.cardDivider} />
              </>
            )}

            {/* INTEGRASI BRANKAS SALDO DENGAN LIVE BADGE COUNTER */}
            {(userRole === 'super_admin' || userRole === 'admin_spv') && (
              <>
                <TouchableOpacity style={styles.consoleRow} onPress={() => handleSistemKontrol('SALDO')}>
                  <View style={[styles.actionIconBg, { backgroundColor: '#E0F2F1' }]}>
                    <FontAwesome5 name="wallet" size={12} color="#00695C" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.actionTitle}>Manajemen Saldo Manual</Text>
                    <Text style={styles.actionSubtitle}>
                      {detailAntrean.saldoPending > 0 ? `Tertahan ${detailAntrean.saldoPending} request dana masuk/keluar` : "Verifikasi pengajuan Top Up & Tarik Tunai warga"}
                    </Text>
                  </View>
                  {detailAntrean.saldoPending > 0 ? (
                    <View style={styles.badgeAlert}><Text style={styles.badgeAlertText}>{detailAntrean.saldoPending} REQ</Text></View>
                  ) : (
                    <Ionicons name="chevron-forward" size={14} color="#BCAAA4" />
                  )}
                </TouchableOpacity>
                <View style={styles.cardDivider} />
              </>
            )}

            {/* TARIF & PENGATURAN LOGISTIK */}
            {userRole === 'super_admin' && (
              <>
                <TouchableOpacity style={styles.consoleRow} onPress={() => handleSistemKontrol('TARIF')}>
                  <View style={[styles.actionIconBg, { backgroundColor: '#FFF3E0' }]}>
                    <FontAwesome5 name="sliders-h" size={12} color="#E65100" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.actionTitle}>Atur Ongkir & Fee Aplikasi</Text>
                    <Text style={styles.actionSubtitle}>Kendalikan biaya logistik MIGO per KM, komisi, and biaya FinTech.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#BCAAA4" />
                </TouchableOpacity>
                <View style={styles.cardDivider} />
              </>
            )}

            {/* MANAJEMEN PENGGUNA TERPADU */}
            <TouchableOpacity style={styles.consoleRow} onPress={() => handleSistemKontrol('MANAJEMEN')}>
              <View style={[styles.actionIconBg, { backgroundColor: '#E1F5FE' }]}>
                <MaterialIcons name="gavel" size={14} color="#0288D1" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.actionTitle}>Manajemen Pengguna Terpadu</Text>
                <Text style={styles.actionSubtitle}>Cari warga, toko, atau driver serta berikan sanksi teguran dari satu pintu.</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="#BCAAA4" />
            </TouchableOpacity>

            {/* EMERGENCY SWITCH */}
            {userRole === 'super_admin' && (
              <>
                <View style={styles.cardDivider} />
                <TouchableOpacity style={styles.consoleRow} onPress={() => handleSistemKontrol('EMERGENCY')}>
                  <View style={[styles.actionIconBg, { backgroundColor: '#FFEBEE' }]}>
                    <Ionicons name="power" size={14} color="#C62828" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.actionTitle}>Status Sistem Server</Text>
                    <Text style={styles.actionSubtitle}>Pantau dan kendalikan pusat sirkuit database Supabase.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#BCAAA4" />
                </TouchableOpacity>
              </>
            )}

          </View>

          <TouchableOpacity style={styles.btnRefresh} onPress={fetchKondisiPasarPamilo}>
            <Ionicons name="refresh" size={14} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.btnRefreshText}>Segarkan Radar Pemantau</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={{ height: insets.bottom, backgroundColor: '#4A3525' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: '#4A3525' }, 
  container: { flex: 1, backgroundColor: '#FAF8F5' }, 
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A0F05' },
  loadingText: { marginTop: 12, color: '#FFB74D', fontSize: 12, fontWeight: '500' },
  scrollContent: { padding: 16 },
  adminBanner: { backgroundColor: '#1A0F05', borderRadius: 16, padding: 16, paddingRight: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  adminTitle: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
  adminSubtitle: { fontSize: 10, color: '#FFB74D', marginTop: 2, fontWeight: 'bold' }, 
  liveIndicatorRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, gap: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2ECC71' },
  liveText: { color: '#fff', fontSize: 8, fontWeight: 'bold' },
  groupTitle: { fontSize: 10, fontWeight: 'bold', color: '#A1887F', letterSpacing: 1, marginBottom: 10, marginTop: 10, paddingLeft: 2 },
  revenueCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#EFEBE9', padding: 16, marginBottom: 10 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badgeIncome: { backgroundColor: '#FFF8E1', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 0.5, borderColor: '#FFE082' },
  badgeIncomeText: { fontSize: 8, color: '#F57F17', fontWeight: 'bold' },
  revenueValue: { fontSize: 26, fontWeight: '900', color: '#D35400' },
  revenueSubLabel: { fontSize: 11, color: '#8D6E63', marginTop: 4, lineHeight: 15 },
  turnoverCard: { backgroundColor: '#ECEFF1', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#CFD8DC' },
  turnoverLabel: { fontSize: 10, color: '#546E7A', fontWeight: '600' },
  turnoverValue: { fontSize: 15, fontWeight: '800', color: '#37474F', marginTop: 2 },
  statsContainer: { marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#EFEBE9', padding: 12, alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: '900', color: '#4A3525', marginTop: 4 },
  statLabel: { fontSize: 9, color: '#8D6E63', marginTop: 2, fontWeight: '500' },
  consoleCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#EFEBE9', paddingHorizontal: 14, paddingVertical: 4, marginBottom: 16 },
  consoleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  actionIconBg: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  actionTitle: { fontSize: 12, fontWeight: 'bold', color: '#4A3525' },
  actionSubtitle: { fontSize: 10, color: '#8D6E63', marginTop: 2 },
  cardDivider: { height: 1, backgroundColor: '#F5EFEA' },
  badgeAlert: { backgroundColor: '#FFEBEE', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  badgeAlertText: { fontSize: 8, color: '#C62828', fontWeight: 'bold' },
  badgeLiveRadar: { backgroundColor: '#FFF3E0', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, borderWidth: 0.5, borderColor: '#FFA726' },
  badgeLiveRadarText: { fontSize: 8, color: '#E65100', fontWeight: 'bold' },
  btnRefresh: { backgroundColor: '#1A0F05', flexDirection: 'row', height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  btnRefreshText: { color: '#fff', fontSize: 12, fontWeight: 'bold' }
});