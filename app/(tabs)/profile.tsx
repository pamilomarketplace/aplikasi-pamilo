// @ts-nocheck
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, ActivityIndicator, 
  RefreshControl, StatusBar, Image, Modal, TextInput, Platform, Linking
} from 'react-native';
import { supabase } from '../../supabaseConfig'; 
import { useRouter, Tabs, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [userEmail, setUserEmail] = useState<string>('');
  const [namaAsli, setNamaAsli] = useState<string>('Memuat nama...');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false); 
  const [userRole, setUserRole] = useState<string>('warga');

  const [modalEditNamaVisible, setModalEditNamaVisible] = useState(false);
  const [inputNamaBaru, setInputNamaBaru] = useState('');
  const [menyimpanNama, setMenyimpanNama] = useState(false);

  const [statusMitra, setStatusMitra] = useState<'BELUM_DAFTAR' | 'PENDING' | 'APPROVED' | 'REJECTED'>('BELUM_DAFTAR');
  const [statusDriver, setStatusDriver] = useState<'BELUM_DAFTAR' | 'PENDING' | 'APPROVED' | 'REJECTED'>('BELUM_DAFTAR');

  const EMAIL_ADMIN_SAKRAL = 'agieldoank85@gmail.com';
  const isFirstMount = useRef(true); 

  const picuDeringSuksesAkunAktif = async (judul: string, pesan: string) => {
    try {
      if (!Notifications || typeof Notifications.scheduleNotificationAsync !== 'function') return;
      await Notifications.scheduleNotificationAsync({
        content: { title: judul, body: pesan, sound: Platform.OS === 'android' ? 'migo.mp3' : true, priority: 'max' },
        trigger: { seconds: 1 },
      });
    } catch (e) {}
  };

  const fetchProfilLengkapRiil = async (userId: string, isInitialLoad = false) => {
    try {
      if (isInitialLoad) setLoading(true);

      const { data: dataUser } = await supabase.from('users').select('user_name, role, user_avatar, is_seller, is_driver').eq('user_id', userId).maybeSingle(); 
      if (dataUser) {
        setNamaAsli(dataUser.user_name || 'Warga Galuh');
        setAvatarUrl(dataUser.user_avatar || null);
        setUserRole(dataUser.role ? dataUser.role.toLowerCase() : 'warga');
      } else {
        setNamaAsli('Warga Baru PAMILO');
        setAvatarUrl(null);
        setUserRole('warga');
      }

      const { data: dataToko } = await supabase.from('toko').select('id_toko, is_verified').eq('user_id_toko', userId).maybeSingle();
      if (dataUser?.is_seller === true || dataToko?.is_verified === true || dataUser?.role === 'ADMIN') setStatusMitra('APPROVED'); 
      else if (dataToko) setStatusMitra('PENDING'); 
      else setStatusMitra('BELUM_DAFTAR');

      const { data: dataSupir } = await supabase.from('drivers').select('id_driver, is_verified').eq('user_id_driver', userId).maybeSingle();
      if (dataUser?.is_driver === true || dataSupir?.is_verified === true || dataUser?.role === 'ADMIN') setStatusDriver('APPROVED');
      else if (dataSupir) setStatusDriver('PENDING'); 
      else setStatusDriver('BELUM_DAFTAR');

    } catch (error) {
      console.log("Gagal memvalidasi profil riil:", error);
    } finally {
      if (isInitialLoad) setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (isFirstMount.current) {
        isFirstMount.current = false;
      } else if (currentUserId) {
        fetchProfilLengkapRiil(currentUserId, false); 
      }
    }, [currentUserId])
  );

  const handleGantiFotoProfil = async () => {
    Alert.alert("Ganti Foto Profil", "Silakan pilih media pengambilan foto profil:", [
      { text: "Buka Kamera", onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') return Alert.alert("Izin Ditolak", "Butuh akses kamera.");
          let hasil = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.5 });
          if (!hasil.canceled && hasil.assets && hasil.assets.length > 0) eksekusiUploadAvatar(hasil.assets[0].uri);
      }},
      { text: "Pilih dari Galeri", onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') return Alert.alert("Izin Ditolak", "Butuh akses galeri.");
          let hasil = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.5 });
          if (!hasil.canceled && hasil.assets && hasil.assets.length > 0) eksekusiUploadAvatar(hasil.assets[0].uri);
      }},
      { text: "Batal", style: "cancel" }
    ]);
  };

  const eksekusiUploadAvatar = async (uriLokal: string) => {
    try {
      setUploading(true);
      const formatFile = uriLokal.split('.').pop() || 'jpg';
      const namaFileUnik = `avatars/usr_${currentUserId}_${Date.now()}.${formatFile}`;
      const paketData = new FormData();
      paketData.append('file', { uri: uriLokal, name: namaFileUnik, type: `image/${formatFile === 'jpg' ? 'jpeg' : formatFile}` } as any);

      const { error: uploadError } = await supabase.storage.from('pamilo-assets').upload(namaFileUnik, paketData, { contentType: 'multipart/form-data', upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlPublik } = supabase.storage.from('pamilo-assets').getPublicUrl(namaFileUnik);
      const urlGambarSah = urlPublik.publicUrl;

      const { error: updateError } = await supabase.from('users').update({ user_avatar: urlGambarSah }).eq('user_id', currentUserId);
      if (updateError) throw updateError;

      setAvatarUrl(urlGambarSah);
      Alert.alert("Sukses 🎉", "Foto profil indah Kamu berhasil diperbarui!");
    } catch (err: any) {
      Alert.alert("Gagal Mengunggah", `Kendala sirkuit storage/database: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const bukaModalEditNama = () => {
    setInputNamaBaru(namaAsli !== 'Warga Baru PAMILO' && namaAsli !== 'Warga Galuh' ? namaAsli : '');
    setModalEditNamaVisible(true);
  };

  const simpanNamaBaru = async () => {
    const namaBersih = inputNamaBaru.trim();
    if (!namaBersih) { Alert.alert("Nama Kosong", "Silakan masukkan nama baru Anda."); return; }
    if (namaBersih === namaAsli) { setModalEditNamaVisible(false); return; }

    try {
      setMenyimpanNama(true);
      const { error } = await supabase.from('users').update({ user_name: namaBersih }).eq('user_id', currentUserId);
      if (error) throw error;
      setNamaAsli(namaBersih);
      setModalEditNamaVisible(false);
      Alert.alert("Berhasil", "Nama profil Anda telah diperbarui.");
    } catch (err: any) {
      Alert.alert("Gagal Menyimpan", "Gagal memperbarui nama: " + err.message);
    } finally {
      setMenyimpanNama(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Konfirmasi Keluar", "Apakah Kamu yakin ingin menutup sesi perdagangan PAMILO saat ini?", [
      { text: "Batal", style: "cancel" },
      { text: "Ya, Keluar 🏁", onPress: async () => {
          try { await supabase.auth.signOut(); Alert.alert("Sesi Ditutup", "Brankas perdagangan Anda berhasil dikunci."); } catch (err: any) { Alert.alert("Gagal Keluar", err.message); }
      }}
    ]);
  };

  const handleHapusAkunPamilo = () => {
    Alert.alert("Hapus Akun PAMILO", "Apakah Anda benar-benar yakin ingin menghapus akun ini? Tindakan ini tidak dapat dibatalkan.", [
      { text: "Batal", style: "cancel" },
      { text: "Lanjutkan", style: "destructive", onPress: pemicuKonfirmasiFinalPamilo }
    ]);
  };

  const pemicuKonfirmasiFinalPamilo = () => {
    Alert.alert("⚠️ PERINGATAN TERAKHIR", "Semua data riwayat pesanan belanja, status kurir Driver MIGO, data UMKM Mitra, serta sasis info terdaftar di Tatar Galuh Anda akan dimusnahkan secara permanen. Tetap hapus?", [
      { text: "Urungkan", style: "cancel" },
      { text: "Ya, Hapus Permanen", style: "destructive", onPress: eksekusiPemusnahanAkunRiil }
    ]);
  };

  const eksekusiPemusnahanAkunRiil = async () => {
    try {
      setDeletingAccount(true);
      const { error: rpcError } = await supabase.rpc('hapus_akun_pamilo_permanen');
      if (rpcError) throw rpcError;
      await supabase.auth.signOut();

      setTimeout(() => {
        fetch('https://api.pamilo.store/send-email', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userEmail, type: 'PERPISAHAN', subject: '[PAMILO] Konfirmasi Penghapusan Akun Permanen', nama: namaAsli }),
        }).catch(err => console.log("API Email OTP gagal dijangkau.", err));
      }, 1000);

      Alert.alert("Akun Dihapus", "Akun Anda telah resmi dibersihkan dari ekosistem PAMILO.");
    } catch (error: any) {
      Alert.alert("Gagal Menghapus Akun", error.message || "Terjadi kendala jaringan pada server database.");
    } finally {
      setDeletingAccount(false);
    }
  };

  useEffect(() => {
    const muatSesiDanProfilTuan = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          const uid = session.user.id;
          setCurrentUserId(uid);
          setUserEmail(session.user.email || '');
          await fetchProfilLengkapRiil(uid, true); 
        } else {
          setLoading(false);
        }
      } catch (error) {
        setLoading(false);
      }
    };
    muatSesiDanProfilTuan();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') router.replace('/login');
      else if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        const uid = session.user.id;
        setCurrentUserId(uid);
        setUserEmail(session.user.email || '');
        await fetchProfilLengkapRiil(uid, true); 
      }
    });

    return () => { subscription?.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    const channelName = `radar-realtime-acc-profile-${currentUserId}-${Date.now()}`;
    const streamRadarPemberitahuanProfil = supabase.channel(channelName)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'toko', filter: `user_id_toko=eq.${currentUserId}` }, async (payload) => {
        if (payload.new.is_verified === true) {
          setStatusMitra('APPROVED');
          await picuDeringSuksesAkunAktif("Mitra Toko Disetujui! 🏪🎉", `Selamat, UMKM Anda resmi di-ACC oleh Admin. Silakan kelola lapak jualan!`);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'drivers', filter: `user_id_driver=eq.${currentUserId}` }, async (payload) => {
        if (payload.new.is_verified === true) {
          setStatusDriver('APPROVED');
          await picuDeringSuksesAkunAktif("Mitra Driver Disetujui! 🛵🎉", `Selamat, sasis registrasi kurir Anda aktif. Selamat mencari nafkah harian!`);
        }
      });

    streamRadarPemberitahuanProfil.subscribe();

    return () => { if (streamRadarPemberitahuanProfil) supabase.removeChannel(streamRadarPemberitahuanProfil); };
  }, [currentUserId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (currentUserId) await fetchProfilLengkapRiil(currentUserId, false);
    else setRefreshing(false);
  }, [currentUserId]);

  if (loading) return <View style={styles.mainWrapper}><ActivityIndicator size="large" color="#4A3525" style={{ flex: 1, justifyContent: 'center' }} /></View>;

  return (
    <View style={styles.mainWrapper}>
      <Tabs.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#4A3525"]} />}>
        <View style={[styles.header, { paddingTop: insets.top + 30 }]}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarBorder}>
              <View style={styles.avatarCircleInner}>
                {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatarImageReal} /> : <FontAwesome5 name="user-tie" size={42} color="#4A3525" />}
              </View>
            </View>
            <TouchableOpacity style={styles.btnEditPena} onPress={handleGantiFotoProfil} disabled={uploading}>
              {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={12} color="#fff" />}
            </TouchableOpacity>
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{namaAsli}</Text>
            {userEmail === EMAIL_ADMIN_SAKRAL && <View style={styles.badgeOwner}><Text style={styles.badgeOwnerText}>👑 OWNER</Text></View>}
            <TouchableOpacity onPress={bukaModalEditNama} style={styles.btnEditNama}><Ionicons name="pencil" size={14} color="#FFE082" /></TouchableOpacity>
          </View>
          <Text style={styles.userEmail}>{userEmail || 'pamilo-user@gmail.com'}</Text>
        </View>

        {['super_admin', 'admin_spv', 'admin_cs'].includes(userRole) && (
          <View style={styles.specialPanelSection}>
            <Text style={styles.sectionTitle}>Ruang Kendali Utama Platform</Text>
            <TouchableOpacity style={styles.adminCard} onPress={() => router.push('/admin')}>
              <View style={styles.adminCardLeft}>
                <View style={styles.adminIconBox}><FontAwesome5 name="user-shield" size={14} color="#FFB74D" /></View>
                <View style={styles.specialTextContainer}>
                  <Text style={styles.adminTitle}>Konsol Utama Admin</Text>
                  <Text style={styles.adminSub}>Masuk ke pusat kendali operasional internal PAMILO ({userRole.toUpperCase()})</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#FFB74D" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.specialPanelSection}>
          <Text style={styles.sectionTitle}>Akses Khusus Ekosistem</Text>
          {statusMitra === 'APPROVED' ? (
            <TouchableOpacity style={styles.specialCard} onPress={() => router.push('/seller')}>
              <View style={styles.specialCardLeft}>
                <View style={[styles.specialIconBox, { backgroundColor: '#EFEBE9' }]}><MaterialIcons name="storefront" size={22} color="#4A3525" /></View>
                <View style={styles.specialTextContainer}>
                  <Text style={styles.specialTitle}>Dashboard Penjual (Mitra)</Text>
                  <Text style={styles.specialSub}>Kelola produk, stok, and pantau pesanan toko Anda</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#4A3525" />
            </TouchableOpacity>
          ) : statusMitra === 'PENDING' ? (
            <View style={[styles.specialCard, styles.cardPending]}>
              <View style={styles.specialCardLeft}>
                <View style={[styles.specialIconBox, { backgroundColor: '#ECEFF1' }]}><Ionicons name="time" size={22} color="#455A64" /></View>
                <View style={styles.specialTextContainer}>
                  <Text style={[styles.specialTitle, { color: '#455A64' }]}>Mitra Sedang Ditinjau</Text>
                  <Text style={styles.specialSub}>Berkas toko Anda sedang diperiksa oleh Admin PAMILO</Text>
                </View>
              </View>
              <ActivityIndicator size="small" color="#455A64" />
            </View>
          ) : (
            <TouchableOpacity style={styles.specialCard} onPress={() => router.push('/pendaftaran/mitra')}>
              <View style={styles.specialCardLeft}>
                <View style={[styles.specialIconBox, { backgroundColor: '#EFEBE9' }]}><MaterialIcons name="storefront" size={22} color="#4A3525" /></View>
                <View style={styles.specialTextContainer}>
                  <Text style={styles.specialTitle}>Daftar Jadi Mitra UMKM</Text>
                  <Text style={styles.specialSub}>Buka tokomu and jangkau warga mikro lokal Ciamis</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#4A3525" />
            </TouchableOpacity>
          )}

          {statusDriver === 'APPROVED' ? (
            <TouchableOpacity style={[styles.specialCard, { borderColor: '#FFE0B2', marginTop: 12 }]} onPress={() => router.push('/driver')}>
              <View style={styles.specialCardLeft}>
                <View style={[styles.specialIconBox, { backgroundColor: '#FFF3E0' }]}><Ionicons name="bicycle" size={22} color="#D35400" /></View>
                <View style={styles.specialTextContainer}>
                  <Text style={[styles.specialTitle, { color: '#D35400' }]}>Dashboard Kurir PAMILO</Text>
                  <Text style={styles.specialSub}>Nyalakan radar kerja and ambil orderan antar sekarang</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#D35400" />
            </TouchableOpacity>
          ) : statusDriver === 'PENDING' ? (
            <View style={[styles.specialCard, styles.cardPending, { marginTop: 12 }]}>
              <View style={styles.specialCardLeft}>
                <View style={[styles.specialIconBox, { backgroundColor: '#ECEFF1' }]}><Ionicons name="time" size={22} color="#455A64" /></View>
                <View style={styles.specialTextContainer}>
                  <Text style={[styles.specialTitle, { color: '#455A64' }]}>Kurir Sedang Ditinjau</Text>
                  <Text style={styles.specialSub}>Berkas KTP/STNK Anda sedang diverifikasi keamanan Admin</Text>
                </View>
              </View>
              <ActivityIndicator size="small" color="#455A64" />
            </View>
          ) : (
            <TouchableOpacity style={[styles.specialCard, { borderColor: '#FFE0B2', marginTop: 12 }]} onPress={() => router.push('/pendaftaran/kurir')}>
              <View style={styles.specialCardLeft}>
                <View style={[styles.specialIconBox, { backgroundColor: '#FFF3E0' }]}><Ionicons name="bicycle" size={22} color="#D35400" /></View>
                <View style={styles.specialTextContainer}>
                  <Text style={[styles.specialTitle, { color: '#D35400' }]}>Daftar Jadi Mitra Driver</Text>
                  <Text style={styles.specialSub}>Mulai hasilkan uang harian bersama Kurir Galuh</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#D35400" />
            </TouchableOpacity>
          )}
        </View>

        {/* 🟢 TOMBOL BUKU ALAMAT WARGA */}
        <View style={styles.menuContainer}>
          <Text style={styles.sectionTitle}>Utilitas Warga</Text>
          <View style={styles.premiumCardList}>
            <TouchableOpacity style={styles.menuItem} onPress={() => router.push({ pathname: '/(warga)/addresses', params: { mode: 'manage' } })}>
              <View style={styles.menuLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: '#FFF3E0' }]}>
                  <Ionicons name="map" size={18} color="#D35400" />
                </View>
                <View style={styles.menuTextBox}>
                  <Text style={styles.menuTextMain}>Buku Alamat Saya</Text>
                  <Text style={styles.menuSubText}>Atur lokasi rumah, kantor, dll</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#D7CCC8" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.menuContainer, { paddingTop: 16 }]}>
          <Text style={styles.sectionTitle}>Konfigurasi FinTech & Akun</Text>
          <View style={styles.premiumCardList}>
            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/pengaturan-bank')} activeOpacity={0.7}>
              <View style={styles.menuLeft}>
                <Ionicons name="wallet-outline" size={20} color="#4A3525" />
                <Text style={styles.menuText}>Rekening Bank Pencairan Dana</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#BCAAA4" />
            </TouchableOpacity>
            
            {/* 🟢 TOMBOL KEBIJAKAN PRIVASI UNTUK GOOGLE PLAY STORE */}
            <View style={{ height: 1, backgroundColor: '#EFEBE9' }} />
            <TouchableOpacity style={styles.menuItem} onPress={() => Linking.openURL('https://pamilo.store/kebijakan-privasi.html')} activeOpacity={0.7}>
              <View style={styles.menuLeft}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#4A3525" />
                <Text style={styles.menuText}>Kebijakan Privasi (Privacy Policy)</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#BCAAA4" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}><Ionicons name="log-out" size={18} color="#fff" /><Text style={styles.logoutText}>KELUAR SESI</Text></TouchableOpacity>
          <TouchableOpacity style={styles.deleteAccountBtn} onPress={handleHapusAkunPamilo} disabled={deletingAccount}>
            {deletingAccount ? <ActivityIndicator size="small" color="#E74C3C" /> : <><Ionicons name="trash-outline" size={13} color="#E74C3C" style={{ marginRight: 6 }} /><Text style={styles.deleteAccountText}>Hapus Permanen Akun PAMILO Saya</Text></>}
          </TouchableOpacity>
        </View>
        <Text style={styles.versionText}>PAMILO Core FinTech v1.2.0 {'\n'} Tatar Galuh Ciamis Digital</Text>
      </ScrollView>

      <Modal visible={modalEditNamaVisible} transparent={true} animationType="fade" onRequestClose={() => setModalEditNamaVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ubah Nama Profil</Text>
            <TextInput style={styles.modalInput} value={inputNamaBaru} onChangeText={setInputNamaBaru} placeholder="Masukkan nama baru..." placeholderTextColor="#BCAAA4" autoFocus maxLength={30} />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setModalEditNamaVisible(false)} disabled={menyimpanNama}><Text style={styles.modalBtnTextCancel}>Batal</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={simpanNamaBaru} disabled={menyimpanNama}>{menyimpanNama ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalBtnTextSave}>Simpan</Text>}</TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: '#FAF8F5' },
  container: { flex: 1 },
  header: { alignItems: 'center', paddingBottom: 35, backgroundColor: '#4A3525', borderBottomLeftRadius: 32, borderBottomRightRadius: 32, elevation: 6, shadowColor: '#111', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6 },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatarBorder: { padding: 3, borderRadius: 100, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#FFE082' },
  avatarCircleInner: { width: 86, height: 86, borderRadius: 43, backgroundColor: '#FAF8F5', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImageReal: { width: '100%', height: '100%' },
  btnEditPena: { position: 'absolute', bottom: 2, right: 2, backgroundColor: '#4A3525', width: 28, height: 26, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff', elevation: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  userName: { fontSize: 16, fontWeight: 'bold', color: '#FFF', textTransform: 'uppercase', letterSpacing: 0.5 },
  btnEditNama: { marginLeft: 8, padding: 4 },
  badgeOwner: { backgroundColor: '#FFB74D', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  badgeOwnerText: { fontSize: 9, fontWeight: '900', color: '#1A0F05' },
  userEmail: { fontSize: 11, color: '#FFF3E0', marginTop: 4, fontWeight: '500', opacity: 0.75, letterSpacing: 0.3 },
  specialPanelSection: { paddingHorizontal: 20, paddingTop: 20 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', color: '#A1887F', marginBottom: 12, letterSpacing: 1.5, textTransform: 'uppercase' },
  specialCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#EFEBE9', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  cardPending: { backgroundColor: '#ECEFF1', borderColor: '#CFD8DC', borderStyle: 'dashed' },
  specialCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  specialIconBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#FAF8F5', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F5EBE6' },
  specialTextContainer: { marginLeft: 12, flex: 1, paddingRight: 5 },
  specialTitle: { fontSize: 13, fontWeight: 'bold', color: '#4A3525' },
  specialSub: { fontSize: 10, color: '#8D6E63', marginTop: 3, lineHeight: 15 },
  adminCard: { flexDirection: 'row', backgroundColor: '#1A0F05', padding: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#3E2723', elevation: 4 },
  adminCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  adminIconBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#2D190B', justifyContent: 'center', alignItems: 'center' },
  adminTitle: { fontSize: 13, fontWeight: '900', color: '#FFB74D' },
  adminSub: { fontSize: 10, color: '#D7CCC8', marginTop: 3, lineHeight: 15 },
  menuContainer: { paddingHorizontal: 20, paddingTop: 22 },
  premiumCardList: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#EFEBE9', paddingHorizontal: 14, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  menuIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuTextBox: { marginLeft: 12 },
  menuTextMain: { fontSize: 13, color: '#4A3525', fontWeight: 'bold' },
  menuSubText: { fontSize: 10, color: '#8D6E63', marginTop: 2 },
  menuText: { marginLeft: 12, fontSize: 13, color: '#4A3525', fontWeight: '600' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 24, height: 44, borderRadius: 14, backgroundColor: '#C0392B', justifyContent: 'center', elevation: 2, shadowColor: '#C0392B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  logoutText: { marginLeft: 8, color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  deleteAccountBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingVertical: 10, justifyContent: 'center' },
  deleteAccountText: { color: '#E74C3C', fontSize: 11, fontWeight: '600', textDecorationLine: 'underline' },
  versionText: { textAlign: 'center', color: '#BCAAA4', fontSize: 10, fontWeight: '600', marginTop: 30, marginBottom: 30, lineHeight: 16, letterSpacing: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(26, 15, 5, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', backgroundColor: '#fff', borderRadius: 20, padding: 20, elevation: 6 },
  modalTitle: { fontSize: 15, fontWeight: 'bold', color: '#4A3525', marginBottom: 15 },
  modalInput: { borderWidth: 1, borderColor: '#D7CCC8', borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 14, color: '#4A3525', backgroundColor: '#FAF8F5', marginBottom: 20 },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, minWidth: 80, alignItems: 'center', justifyContent: 'center' },
  modalBtnCancel: { backgroundColor: '#EFEBE9' },
  modalBtnSave: { backgroundColor: '#4A3525' },
  modalBtnTextCancel: { color: '#4A3525', fontWeight: 'bold', fontSize: 13 },
  modalBtnTextSave: { color: '#fff', fontWeight: 'bold', fontSize: 13 }
});