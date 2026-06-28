// @ts-nocheck
import React, { useEffect, useState, useCallback } from 'react';
import { 
  StyleSheet, Text, View, FlatList, TouchableOpacity, StatusBar, 
  ActivityIndicator, Alert, Modal, RefreshControl, ScrollView, TextInput, Keyboard 
} from 'react-native'; 
import { useRouter, Stack } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// BACKEND: KONEKTOR UTAMA SUPABASE TUAN
import { supabase } from '../../supabaseConfig';

// --------------------------------------------------------
// 🛡️ INTERFACE BERSAMA: WARGA & MITRA
// --------------------------------------------------------
interface Warga {
  user_id: string; 
  user_name: string;
  user_email: string;
  user_phone: string;
  role: 'WARGA' | 'DRIVER' | 'SELLER' | 'ADMIN';
  status_aktif: boolean; 
  created_at?: string;
}

interface DataMitra {
  id: string; 
  id_spesifik: string; 
  nama: string;
  info: string;
  whatsapp: string;
  tipe: 'TOKO' | 'DRIVER';
  status: 'APPROVED' | 'REJECTED'; 
}

export default function ManajemenTerpaduScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // 🟢 STATE NAVIGASI & PENCARIAN PINTAR
  const [tabAktif, setTabAktif] = useState<'WARGA' | 'TOKO' | 'DRIVER'>('WARGA');
  const [searchQuery, setSearchQuery] = useState('');

  // 🟢 STATE DATA
  const [daftarWarga, setDaftarWarga] = useState<Warga[]>([]);
  const [mitraList, setMitraList] = useState<DataMitra[]>([]);
  
  // 🟢 STATE STATUS (LOADING & MODAL)
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [selectedWarga, setSelectedWarga] = useState<Warga | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // ========================================================
  // 🛰️ RADAR 1: PENARIK DATA WARGA
  // ========================================================
  const fetchSemuaWarga = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .neq('role', 'ADMIN') 
        .order('user_name', { ascending: true });

      if (error) throw error;
      if (data) setDaftarWarga(data as Warga[]);
    } catch (error: any) {
      Alert.alert("Gagal", `Sirkuit memuat data warga macet: ${error.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ========================================================
  // 🛰️ RADAR 2: PENARIK DATA MITRA (TOKO & DRIVER)
  // ========================================================
  const fetchMitraAktifDanSanksi = async () => {
    try {
      setLoading(true);
      const tempReady: DataMitra[] = [];

      if (tabAktif === 'TOKO') {
        const { data, error } = await supabase.from('toko').select(`
          id_toko, nama_toko, kategori_toko, user_id_toko,
          users!inner(user_id, user_phone, role)
        `);
        
        if (!error && data) {
          data.forEach((t: any) => {
            const isApproved = t.users.role === 'SELLER' || t.users.role === 'ADMIN';
            tempReady.push({ 
              id: t.users.user_id, id_spesifik: t.id_toko, nama: t.nama_toko, 
              info: `Kategori: ${t.kategori_toko || 'PASAR'}`, whatsapp: t.users.user_phone || 'Tidak Ada', 
              tipe: 'TOKO', status: isApproved ? 'APPROVED' : 'REJECTED'
            });
          });
        }
      } else if (tabAktif === 'DRIVER') {
        const { data, error } = await supabase.from('drivers').select(`
          id_driver, nama_driver, jenis_kendaraan, plat_nomor, user_id_driver,
          users!inner(user_id, user_phone, role)
        `);
        
        if (!error && data) {
          data.forEach((d: any) => {
            const isApproved = d.users.role === 'DRIVER' || d.users.role === 'ADMIN';
            tempReady.push({ 
              id: d.users.user_id, id_spesifik: d.id_driver, nama: d.nama_driver, 
              info: `${d.jenis_kendaraan || 'MOTOR'} (${d.plat_nomor || 'No Plat'})`, whatsapp: d.users.user_phone || 'Tidak Ada', 
              tipe: 'DRIVER', status: isApproved ? 'APPROVED' : 'REJECTED'
            });
          });
        }
      }
      setMitraList(tempReady);
    } catch (err) {
      console.error("Gagal memuat manajemen data mitra:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 🔄 PEMICU RADAR OTOMATIS SAAT PINDAH TAB
  useEffect(() => {
    if (tabAktif === 'WARGA') fetchSemuaWarga();
    else fetchMitraAktifDanSanksi();
  }, [tabAktif]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (tabAktif === 'WARGA') fetchSemuaWarga();
    else fetchMitraAktifDanSanksi();
  }, [tabAktif]);

  // ========================================================
  // 🎯 FILTER PENCARIAN PINTAR (REAL-TIME)
  // ========================================================
  const q = searchQuery.toLowerCase();
  const filteredWarga = daftarWarga.filter(w => 
    (w.user_name && w.user_name.toLowerCase().includes(q)) ||
    (w.user_email && w.user_email.toLowerCase().includes(q)) ||
    (w.user_phone && w.user_phone.toLowerCase().includes(q))
  );

  const filteredMitra = mitraList.filter(m => 
    (m.nama && m.nama.toLowerCase().includes(q)) ||
    (m.info && m.info.toLowerCase().includes(q)) ||
    (m.whatsapp && m.whatsapp.toLowerCase().includes(q))
  );


  // ========================================================
  // ⚡ AKSI 1: BEKUKAN / PULIHKAN WARGA
  // ========================================================
  const handleBekukanAkunWarga = async (warga: Warga) => {
    const statusBaru = !warga.status_aktif;
    Alert.alert(
      statusBaru ? "Aktifkan Kembali?" : "Blokir / Suspend?",
      `Apakah Tuan Septian yakin ingin ${statusBaru ? 'memulihkan akses' : 'memblokir total login'} akun "${warga.user_name}"?`,
      [
        { text: "Batal", style: "cancel" },
        { 
          text: statusBaru ? "Ya, Aktifkan" : "Ya, Blokir", 
          onPress: async () => {
            try {
              setLoadingAction(warga.user_id);
              const { error } = await supabase.from('users').update({ status_aktif: statusBaru }).eq('user_id', warga.user_id);
              if (error) throw error;
              
              setDaftarWarga(prev => prev.map(w => w.user_id === warga.user_id ? { ...w, status_aktif: statusBaru } : w));
              if (selectedWarga?.user_id === warga.user_id) setModalVisible(false);
              
              await supabase.from('notifications').insert([{
                user_id_notif: warga.user_id, judul_notif: statusBaru ? 'Akun Dipulihkan 🎉' : '⚠️ Akun Anda Ditangguhkan!',
                pesan_notif: statusBaru ? 'Selamat! Masa penangguhan akun Anda telah dicabut.' : 'Akses login akun Anda dibekukan oleh pusat karena terindikasi pelanggaran berat.',
                tipe_notif: 'SANKSI_SISTEM', is_read_notif: false
              }]);
              Alert.alert("Sukses", `Akun ${warga.user_name} berhasil ${statusBaru ? 'diaktifkan' : 'ditangguhkan'}.`);
            } catch (err: any) { Alert.alert("Gagal", err.message); } finally { setLoadingAction(null); }
          }
        }
      ]
    );
  };

  // ========================================================
  // ⚡ AKSI 2: HAPUS TOTAL WARGA
  // ========================================================
  const handleHapusAkunTotal = async (warga: Warga) => {
    Alert.alert(
      "🔥 TINDAKAN DESTRUKTIF OWNER!",
      `Apakah Tuan Septian yakin ingin MENGHAPUS PERMANEN profil "${warga.user_name}"?`,
      [
        { text: "Pertahankan", style: "cancel" },
        { 
          text: "Hapus Mutlak", style: "destructive",
          onPress: async () => {
            try {
              setLoadingAction(warga.user_id); setModalVisible(false);
              const { error } = await supabase.from('users').delete().eq('user_id', warga.user_id);
              if (error) throw error;
              setDaftarWarga(prev => prev.filter(w => w.user_id !== warga.user_id));
              Alert.alert("Sukses Mutlak", `Akun "${warga.user_name}" sah dimusnahkan dari sasis platform.`);
            } catch (err: any) { Alert.alert("Gagal Eksekusi", err.message); } finally { setLoadingAction(null); }
          }
        }
      ]
    );
  };

  // ========================================================
  // ⚡ AKSI 3: BEKUKAN / PULIHKAN MITRA TOKO & DRIVER
  // ========================================================
  const handleToggleStatusMitra = async (item: DataMitra) => {
    const isBekukan = item.status === 'APPROVED';
    const judulAlert = isBekukan ? "🚨 SANKSI PEMBEKUAN" : "🟢 PULIHKAN MITRA";
    const pesanAlert = isBekukan 
      ? `Apakah Owner Ganteng yakin ingin MEMBEKUKAN hak usaha "${item.nama}"? Hak akses kemitraan mereka akan dicabut seketika.`
      : `Apakah Owner Ganteng ingin MENGAKTIFKAN KEMBALI status kemitraan "${item.nama}"? Akses dashboard mereka akan dipulihkan tanpa daftar ulang.`;

    Alert.alert(
      judulAlert, pesanAlert,
      [
        { text: "Batal", style: "cancel" },
        { 
          text: isBekukan ? "Ya, Bekukan" : "Ya, Aktifkan", style: isBekukan ? "destructive" : "default", 
          onPress: async () => {
            try {
              setActionLoading(item.id);
              const roleBaru = isBekukan ? 'WARGA' : (item.tipe === 'TOKO' ? 'SELLER' : 'DRIVER');
              const statusBaru = isBekukan ? 'REJECTED' : 'APPROVED';

              const { error: errUser } = await supabase.from('users').update({ role: roleBaru }).eq('user_id', item.id);
              if (errUser) throw errUser;

              await supabase.from('notifications').insert([{
                user_id_notif: item.id, judul_notif: isBekukan ? 'Kemitraan Anda Dibekukan! 🚨' : 'Kemitraan Anda Aktif Kembali! 🟢',
                pesan_notif: isBekukan ? 'Mohon maaf, Admin mendeteksi adanya tindakan pelanggaran. Hubungi Owner untuk konfirmasi.' : 'Selamat, hak operasional kemitraan Anda telah dicabut masa pembekuannya oleh Admin.',
                tipe_notif: 'SANKSI_SISTEM', is_read_notif: false
              }]);

              Alert.alert("Berhasil", `Mitra "${item.nama}" telah di-${isBekukan ? 'bekukan menjadi WARGA' : 'aktifkan kembali'}!`);
              setMitraList(prev => prev.map(m => m.id === item.id ? { ...m, status: statusBaru } : m));
            } catch (error: any) { Alert.alert("Gagal Eksekusi Sakelar", error.message); } finally { setActionLoading(null); }
          }
        }
      ]
    );
  };

  const setActionLoading = (id: string | null) => setLoadingAction(id); // Helper bridge for Mitra toggle

  // ========================================================
  // 🧩 KOMPONEN: RENDER KARTU WARGA
  // ========================================================
  const renderItemWarga = ({ item: warga }: { item: Warga }) => {
    const isSuspended = warga.status_aktif === false;
    return (
      <TouchableOpacity style={[styles.userCard, isSuspended && styles.cardBanned]} onPress={() => { setSelectedWarga(warga); setModalVisible(true); }}>
        <View style={styles.cardLeft}>
          <View style={[styles.avatarBox, isSuspended && { backgroundColor: '#FADBD8' }]}>
            <FontAwesome5 name={isSuspended ? "user-slash" : "user"} size={14} color={isSuspended ? "#C0392B" : "#4A3525"} />
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.nameText} numberOfLines={1}>{warga.user_name}</Text>
            <Text style={styles.emailText} numberOfLines={1}>{warga.user_email}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.roleChip, warga.role === 'SELLER' ? styles.chipMitra : warga.role === 'DRIVER' ? styles.chipDriver : styles.chipWarga]}>
                <Text style={styles.chipText}>{warga.role === 'SELLER' ? 'Pedagang' : warga.role === 'DRIVER' ? 'Kurir MIGO' : 'Warga Biasa'}</Text>
              </View>
              {isSuspended && <View style={[styles.roleChip, { backgroundColor: '#E6B0AA' }]}><Text style={[styles.chipText, { color: '#78281F' }]}>TERBLOKIR</Text></View>}
            </View>
          </View>
        </View>

        <View style={styles.cardRight}>
          {loadingAction === warga.user_id ? (
            <ActivityIndicator size="small" color="#4A3525" />
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[styles.btnIcon, { backgroundColor: isSuspended ? '#E8F8F5' : '#FEF9E7' }]} onPress={() => handleBekukanAkunWarga(warga)}>
                <Ionicons name={isSuspended ? "play-back-outline" : "lock-open-outline"} size={16} color={isSuspended ? "#117A65" : "#D4AC0D"} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnIcon, { backgroundColor: '#FDEDEC' }]} onPress={() => handleHapusAkunTotal(warga)}>
                <Ionicons name="trash-outline" size={16} color="#C0392B" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ========================================================
  // 🧩 KOMPONEN: RENDER KARTU MITRA (TOKO/DRIVER)
  // ========================================================
  const renderItemMitra = ({ item }: { item: DataMitra }) => {
    const isAktif = item.status === 'APPROVED';
    return (
      <View style={[styles.mitraCard, !isAktif && styles.mitraCardSuspended]}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.nameText}>{item.nama}</Text>
            <View style={[styles.badgeStatus, isAktif ? styles.badgeAktif : styles.badgeBeku]}>
              <Text style={[styles.badgeStatusText, isAktif ? styles.textAktif : styles.textBeku]}>{isAktif ? "AKTIF" : "DIBEKUKAN"}</Text>
            </View>
          </View>
          <Text style={styles.infoText}>{item.info}</Text>
          <Text style={styles.waText}>📞 WA: {item.whatsapp}</Text>
        </View>
        <TouchableOpacity style={[styles.btnToggle, isAktif ? styles.btnBekukan : styles.btnAktifkan]} onPress={() => handleToggleStatusMitra(item)} disabled={loadingAction !== null}>
          {loadingAction === item.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnToggleText}>{isAktif ? "Bekukan" : "Aktifkan"}</Text>}
        </TouchableOpacity>
      </View>
    );
  };

  // ========================================================
  // 🚀 RENDER UTAMA APLIKASI
  // ========================================================
  return (
    <View style={styles.mainWrapper}>
      <Stack.Screen 
        options={{
          headerShown: true, headerTitle: 'Manajemen Pengguna & Mitra', headerTintColor: '#fff',
          headerStyle: { backgroundColor: '#1A0F05' }, headerTitleStyle: { fontWeight: 'bold', fontSize: 13 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 5, marginRight: 15 }}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          ),
        }} 
      />
      <StatusBar barStyle="light-content" backgroundColor="#1A0F05" />

      <View style={styles.container}>
        
        {/* 🔥 TABS KELOMPOK */}
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tabBtn, tabAktif === 'WARGA' && styles.tabActive]} onPress={() => { setTabAktif('WARGA'); setSearchQuery(''); }}>
            <Text style={[styles.tabText, tabAktif === 'WARGA' && styles.tabTextActive]}>👥 Warga</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, tabAktif === 'TOKO' && styles.tabActive]} onPress={() => { setTabAktif('TOKO'); setSearchQuery(''); }}>
            <Text style={[styles.tabText, tabAktif === 'TOKO' && styles.tabTextActive]}>🏪 Toko</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, tabAktif === 'DRIVER' && styles.tabActive]} onPress={() => { setTabAktif('DRIVER'); setSearchQuery(''); }}>
            <Text style={[styles.tabText, tabAktif === 'DRIVER' && styles.tabTextActive]}>🛵 Kurir</Text>
          </TouchableOpacity>
        </View>

        {/* 🔥 KOLOM PENCARIAN PINTAR */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color="#8D6E63" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Cari nama, ${tabAktif === 'WARGA' ? 'email' : 'plat/info'} atau WA...`}
            placeholderTextColor="#BCAAA4"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); Keyboard.dismiss(); }}>
              <Ionicons name="close-circle" size={16} color="#BCAAA4" />
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#4A3525" />
            <Text style={styles.loadingText}>Menyusun berkas data...</Text>
          </View>
        ) : (
          <FlatList
            data={tabAktif === 'WARGA' ? filteredWarga : filteredMitra}
            keyExtractor={(item, index) => tabAktif === 'WARGA' ? `warga-${(item as Warga).user_id}` : `mitra-${(item as DataMitra).id}-${index}`}
            contentContainerStyle={[styles.listContent, { paddingBottom: 30 }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#4A3525"]} />}
            renderItem={({ item }) => tabAktif === 'WARGA' ? renderItemWarga({ item: item as Warga }) : renderItemMitra({ item: item as DataMitra })}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Pencarian "{searchQuery}" tidak menemukan hasil.</Text>
              </View>
            }
          />
        )}
      </View>

      {/* ================= MODAL DRAWER DETAIL IDENTITAS WARGA ================= */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Identitas Lengkap Warga</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={22} color="#4A3525" /></TouchableOpacity>
            </View>

            {selectedWarga && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>ID UUID Akun Supabase:</Text><Text style={styles.detailValueCode}>{selectedWarga.user_id}</Text></View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Nama Pengguna (user_name):</Text><Text style={styles.detailValue}>{selectedWarga.user_name}</Text></View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Nomor Kontak WhatsApp (user_phone):</Text><Text style={styles.detailValue}>📞 {selectedWarga.user_phone || 'Tidak Terikat'}</Text></View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Alamat Surat Elektronik (Email):</Text><Text style={styles.detailValue}>{selectedWarga.user_email}</Text></View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Faksi Otoritas / Peran:</Text><Text style={[styles.detailValue, { color: '#D35400' }]}>✨ {selectedWarga.role}</Text></View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status Operasional Log-In:</Text>
                  <Text style={[styles.detailValue, { fontWeight: '900', color: selectedWarga.status_aktif === false ? '#C0392B' : '#117A65' }]}>{selectedWarga.status_aktif === false ? '🔴 AKUN DITANGGUHKAN (SUSPEND)' : '🟢 AKTIF & NORMAL'}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.modalActionGrid}>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: selectedWarga.status_aktif === false ? '#27AE60' : '#E67E22' }]} onPress={() => handleBekukanAkunWarga(selectedWarga)}>
                    <Ionicons name={selectedWarga.status_aktif === false ? "checkmark-circle-outline" : "alert-circle-outline"} size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.modalBtnText}>{selectedWarga.status_aktif === false ? 'Pulihkan Akun' : 'Blokir Akun'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#C0392B' }]} onPress={() => handleHapusAkunTotal(selectedWarga)}>
                    <Ionicons name="trash-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.modalBtnText}>Hapus Permanen</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <View style={{ height: insets.bottom, backgroundColor: '#1A0F05' }} />
    </View>
  );
}

// --------------------------------------------------------
// 🎨 STYLING GABUNGAN SUPER DASHBOARD
// --------------------------------------------------------
const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: '#1A0F05' }, 
  container: { flex: 1, backgroundColor: '#FAF8F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 12, color: '#8D6E63', fontWeight: '500' },
  
  // TABS & SEARCH
  tabRow: { flexDirection: 'row', backgroundColor: '#1A0F05', marginHorizontal: 16, marginTop: 16, marginBottom: 10, padding: 4, borderRadius: 10 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  tabActive: { backgroundColor: '#D35400' },
  tabText: { fontSize: 11, fontWeight: 'bold', color: '#BCAAA4' },
  tabTextActive: { color: '#fff' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#EFEBE9', height: 44 },
  searchInput: { flex: 1, fontSize: 12, color: '#4A3525', fontWeight: '600' },
  
  // LIST BERSAMA
  listContent: { paddingHorizontal: 16 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: '#8D6E63', fontSize: 11, fontStyle: 'italic' },
  nameText: { fontSize: 13, fontWeight: 'bold', color: '#1A0F05' },

  // GAYA KHUSUS KARTU WARGA
  userCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#EFEBE9', padding: 12, marginBottom: 12, alignItems: 'center', justifyContent: 'space-between', elevation: 0.5 },
  cardBanned: { backgroundColor: '#FEF9F9', borderColor: '#FADBD8' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 },
  avatarBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EFEBE9', justifyContent: 'center', alignItems: 'center' },
  infoBox: { marginLeft: 12, flex: 1 },
  emailText: { fontSize: 11, color: '#A1887F', marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  roleChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  chipWarga: { backgroundColor: '#E8F8F5' },
  chipMitra: { backgroundColor: '#E8EAF6' },
  chipDriver: { backgroundColor: '#FFF3E0' },
  chipText: { fontSize: 8, fontWeight: 'bold', color: '#5D4037', textTransform: 'uppercase' },
  cardRight: { justifyContent: 'center' },
  btnIcon: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  // GAYA KHUSUS KARTU MITRA
  mitraCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#EFEBE9', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1 },
  mitraCardSuspended: { borderColor: '#FFCDD2', backgroundColor: '#FFFDE7' }, 
  infoText: { fontSize: 11, color: '#8D6E63', marginTop: 3 },
  waText: { fontSize: 11, color: '#2E7D32', marginTop: 5, fontWeight: '500' },
  badgeStatus: { paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 4 },
  badgeAktif: { backgroundColor: '#E8F5E9' },
  badgeBeku: { backgroundColor: '#FFEBEE' },
  badgeStatusText: { fontSize: 8, fontWeight: 'bold' },
  textAktif: { color: '#2E7D32' },
  textBeku: { color: '#C62828' },
  btnToggle: { height: 32, paddingHorizontal: 14, borderRadius: 8, justifyContent: 'center', alignItems: 'center', minWidth: 80 },
  btnBekukan: { backgroundColor: '#C62828' },
  btnAktifkan: { backgroundColor: '#2E7D32' },
  btnToggleText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  // MODAL DETAIL WARGA
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F5F5F5', paddingBottom: 14, marginBottom: 16 },
  modalHeaderTitle: { fontSize: 14, fontWeight: 'bold', color: '#4A3525' },
  modalBody: { paddingVertical: 4 },
  detailRow: { marginBottom: 14 },
  detailLabel: { fontSize: 11, color: '#A1887F', fontWeight: '500' },
  detailValue: { fontSize: 13, fontWeight: 'bold', color: '#4A3525', marginTop: 4 },
  detailValueCode: { fontSize: 11, color: '#7E57C2', fontFamily: 'monospace', fontWeight: 'bold', marginTop: 4, backgroundColor: '#F3E5F5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
  divider: { height: 1, backgroundColor: '#F5F5F5', marginVertical: 14 },
  modalActionGrid: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalBtn: { flex: 1, flexDirection: 'row', height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 1 },
  modalBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' }
});