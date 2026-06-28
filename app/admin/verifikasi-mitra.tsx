// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  StatusBar, 
  ActivityIndicator, 
  Alert,
  Image,
  ScrollView,
  Modal,
  Dimensions
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../supabaseConfig';

const { width, height } = Dimensions.get('window');

interface CalonMitra {
  user_id: string; 
  id_spesifik: string; 
  nama_toko: string;
  deskripsi: string;
  whatsapp: string;
  alamat: string;
  tipe: 'TOKO' | 'DRIVER';
  foto_1: string | null; 
  foto_2: string | null; 
  foto_3: string | null; 
}

export default function VerifikasiMitraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [calonMitraList, setCalonMitraList] = useState<CalonMitra[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tabAktif, setTabAktif] = useState<'TOKO' | 'DRIVER'>('TOKO');
  
  // State untuk melihat gambar full screen
  const [modalImageVisible, setModalImageVisible] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  const fetchAntreanMitra = async () => {
    try {
      setLoading(true);
      const tempAntrean: CalonMitra[] = [];

      if (tabAktif === 'TOKO') {
        const { data: dataToko, error: errorToko } = await supabase
          .from('toko')
          .select(`
            id_toko, nama_toko, kategori_toko, alamat_toko, 
            foto_toko, whatsapp_toko, user_id_toko, 
            users (user_phone)
          `)
          .eq('is_verified', false);

        if (errorToko) throw errorToko;

        dataToko?.forEach((t: any) => {
          tempAntrean.push({
            user_id: t.user_id_toko,
            id_spesifik: t.id_toko,
            nama_toko: t.nama_toko,
            deskripsi: `Kategori Usaha: ${t.kategori_toko || 'PASAR'}`,
            whatsapp: t.whatsapp_toko || t.users?.user_phone || 'Tidak Ada WA',
            alamat: t.alamat_toko || '',
            tipe: 'TOKO',
            foto_1: t.foto_toko,
            foto_2: null,
            foto_3: null
          });
        });

      } else {
        const { data: dataDriver, error: errorDriver } = await supabase
          .from('drivers')
          .select(`
            id_driver, nama_driver, jenis_kendaraan, plat_nomor, 
            foto_wajah, foto_sim, foto_stnk, user_id_driver, 
            users (user_phone)
          `)
          .eq('is_verified', false); 

        if (errorDriver) throw errorDriver;

        dataDriver?.forEach((d: any) => {
          tempAntrean.push({
            user_id: d.user_id_driver,
            id_spesifik: d.id_driver,
            nama_toko: d.nama_driver,
            deskripsi: `Armada: ${d.jenis_kendaraan || 'MOTOR'} (${d.plat_nomor || 'Tanpa Plat'})`,
            whatsapp: d.users?.user_phone || 'Tidak Ada WA',
            alamat: 'Berkas kurir terikat dokumen fisik (KTP/STNK)',
            tipe: 'DRIVER',
            foto_1: d.foto_wajah,
            foto_2: d.foto_sim,
            foto_3: d.foto_stnk
          });
        });
      }

      setCalonMitraList(tempAntrean);
    } catch (err: any) {
      console.log("Gagal memuat antrean juri:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAntreanMitra();
  }, [tabAktif]);

  const handleApproveMitra = async (idUser: string, namaToko: string, tipe: 'TOKO' | 'DRIVER') => {
    try {
      setActionLoading(idUser);

      if (tipe === 'TOKO') {
        await Promise.all([
          supabase.from('toko').update({ is_verified: true, status_toko: 'BUKA' }).eq('user_id_toko', idUser),
          supabase.from('users').update({ is_seller: true }).eq('user_id', idUser)
        ]);
      } else {
        await Promise.all([
          supabase.from('drivers').update({ is_verified: true }).eq('user_id_driver', idUser),
          supabase.from('users').update({ is_driver: true }).eq('user_id', idUser)
        ]);
      }

      await supabase.from('notifications').insert([{
        user_id_notif: idUser,
        judul_notif: 'Verifikasi Berhasil! 🎉',
        pesan_notif: `Selamat, pengajuan pendaftaran kemitraan ${tipe === 'TOKO' ? 'Toko' : 'Driver'} Anda telah disetujui. Dashboard kini terbuka!`,
        tipe_notif: 'VERIFIKASI_SUKSES',
        is_read_notif: false
      }]);

      Alert.alert("Sah!", `Mitra "${namaToko}" resmi di-ACC dan diaktifkan fiturnya!`);
      setCalonMitraList(prev => prev.filter(item => item.user_id !== idUser));

    } catch (error: any) {
      Alert.alert("Sirkuit Gagal", `Gagal melakukan approval: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectMitra = async (idUser: string, namaToko: string, idSpesifik: string, tipe: 'TOKO' | 'DRIVER') => {
    try {
      setActionLoading(idUser);
      const tabelTarget = tipe === 'TOKO' ? 'toko' : 'drivers';
      const columnTargetId = tipe === 'TOKO' ? 'id_toko' : 'id_driver';

      const { error: errorDelete } = await supabase
        .from(tabelTarget)
        .delete()
        .eq(columnTargetId, idSpesifik);

      if (errorDelete) throw errorDelete;

      await supabase.from('notifications').insert([{
        user_id_notif: idUser,
        judul_notif: 'Pendaftaran Ditolak ❌',
        pesan_notif: 'Mohon maaf, berkas pengajuan pendaftaran kemitraan Anda ditolak karena dinilai kurang valid oleh Admin. Silakan ajukan ulang dengan data yang benar.',
        tipe_notif: 'VERIFIKASI_GAGAL',
        is_read_notif: false
      }]);

      Alert.alert("Ditolak", `Berkas pendaftaran "${namaToko}" resmi dikembalikan and dihapus dari sistem.`);
      setCalonMitraList(prev => prev.filter(item => item.user_id !== idUser));

    } catch (error: any) {
      Alert.alert("Gagal", "Gagal memproses penolakan berkas.");
    } finally {
      setActionLoading(null);
    }
  };

  const openFullImage = (uri: string) => {
    setSelectedImageUri(uri);
    setModalImageVisible(true);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: true,
          headerTitle: 'Verifikasi Juri Baru',
          headerTintColor: '#fff',
          headerStyle: { backgroundColor: '#1A0F05' },
          headerTitleStyle: { fontWeight: 'bold', fontSize: 13 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 5, marginRight: 15 }}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          ),
        }} 
      />
      <StatusBar barStyle="light-content" backgroundColor="#1A0F05" />

      {/* MODAL FULL SCREEN GAMBAR */}
      <Modal visible={modalImageVisible} transparent={true} animationType="fade" onRequestClose={() => setModalImageVisible(false)}>
        <View style={styles.modalFullImageBg}>
          <TouchableOpacity style={styles.btnCloseModal} onPress={() => setModalImageVisible(false)}>
            <Ionicons name="close-circle" size={36} color="#fff" />
          </TouchableOpacity>
          {selectedImageUri && (
            <Image source={{ uri: selectedImageUri }} style={styles.fullScreenImage} resizeMode="contain" />
          )}
        </View>
      </Modal>

      <View style={styles.tabBarRow}>
        <TouchableOpacity style={[styles.tabItem, tabAktif === 'TOKO' && styles.tabItemActive]} onPress={() => setTabAktif('TOKO')}>
          <Text style={[styles.tabLabel, tabAktif === 'TOKO' && styles.tabLabelActive]}>Toko Mitra</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabItem, tabAktif === 'DRIVER' && styles.tabItemActive]} onPress={() => setTabAktif('DRIVER')}>
          <Text style={[styles.tabLabel, tabAktif === 'DRIVER' && styles.tabLabelActive]}>Kurir Driver</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4A3525" />
        </View>
      ) : (
        <FlatList
          data={calonMitraList}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
          renderItem={({ item: mitra }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <FontAwesome5 name={tabAktif === 'TOKO' ? "store-alt" : "motorcycle"} size={12} color="#D35400" />
                  <Text style={styles.tokoName}>{mitra.nama_toko}</Text>
                </View>
                <View style={styles.badgePending}>
                  <Text style={styles.badgePendingText}>MENUNGGU ACC</Text>
                </View>
              </View>

              <Text style={styles.tokoDesc}>{mitra.deskripsi}</Text>
              <Text style={styles.waText}>📞 No WhatsApp: {mitra.whatsapp}</Text>
              {mitra.alamat ? <Text style={styles.alamatText}>📍 {mitra.alamat}</Text> : null}

              <Text style={styles.sectionTitle}>Dokumen Terlampir (Klik untuk Perbesar):</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
                {mitra.foto_1 && (
                  <TouchableOpacity style={styles.photoContainer} onPress={() => openFullImage(mitra.foto_1!)}>
                    <Image source={{ uri: mitra.foto_1 }} style={styles.docImage} />
                    <Text style={styles.photoLabel}>{mitra.tipe === 'TOKO' ? 'Logo/Lokasi' : 'Foto Wajah'}</Text>
                  </TouchableOpacity>
                )}
                {mitra.foto_2 && (
                  <TouchableOpacity style={styles.photoContainer} onPress={() => openFullImage(mitra.foto_2!)}>
                    <Image source={{ uri: mitra.foto_2 }} style={styles.docImage} />
                    <Text style={styles.photoLabel}>KTP / SIM</Text>
                  </TouchableOpacity>
                )}
                {mitra.foto_3 && (
                  <TouchableOpacity style={styles.photoContainer} onPress={() => openFullImage(mitra.foto_3!)}>
                    <Image source={{ uri: mitra.foto_3 }} style={styles.docImage} />
                    <Text style={styles.photoLabel}>STNK Kendaraan</Text>
                  </TouchableOpacity>
                )}
                {!mitra.foto_1 && !mitra.foto_2 && !mitra.foto_3 && (
                  <Text style={{ fontSize: 11, color: '#BCAAA4', fontStyle: 'italic' }}>Tidak ada berkas foto dilampirkan.</Text>
                )}
              </ScrollView>
              
              <View style={styles.btnRow}>
                <TouchableOpacity 
                  style={styles.btnReject} 
                  onPress={() => handleRejectMitra(mitra.user_id, mitra.nama_toko, mitra.id_spesifik, mitra.tipe)}
                  disabled={actionLoading !== null}
                >
                  <Text style={styles.btnTextReject}>Tolak Berkas</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.btnAccept} 
                  onPress={() => handleApproveMitra(mitra.user_id, mitra.nama_toko, mitra.tipe)}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === mitra.user_id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.btnTextAccept}>Approve Mitra</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <FontAwesome5 name="check-double" size={38} color="#C8E6C9" />
              <Text style={styles.emptyTitle}>Antrean Clean!</Text>
              <Text style={styles.emptySub}>Tidak ada antrean dokumen pelamar yang tertunda pada kategori juri ini.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabBarRow: { flexDirection: 'row', backgroundColor: '#1A0F05', margin: 16, padding: 4, borderRadius: 12 },
  tabItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabItemActive: { backgroundColor: '#D35400' },
  tabLabel: { fontSize: 12, fontWeight: 'bold', color: '#BCAAA4' },
  tabLabelActive: { color: '#fff' },
  list: { padding: 16, paddingTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#EFEBE9', elevation: 0.5 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  tokoName: { fontSize: 13, fontWeight: 'bold', color: '#1A0F05', marginLeft: 8 },
  badgePending: { backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#FFB74D' },
  badgePendingText: { fontSize: 9, fontWeight: 'bold', color: '#E65100' },
  tokoDesc: { fontSize: 11, color: '#8D6E63', lineHeight: 16, marginBottom: 4 },
  waText: { fontSize: 11, color: '#2E7D32', marginBottom: 4, fontWeight: '600' },
  alamatText: { fontSize: 11, color: '#4A3525', marginBottom: 10, fontWeight: '500' },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', color: '#BCAAA4', marginBottom: 8, borderTopWidth: 1, borderTopColor: '#F5F5F5', paddingTop: 10, textTransform: 'uppercase' },
  photoScroll: { flexDirection: 'row', marginBottom: 16 },
  photoContainer: { marginRight: 12, alignItems: 'center' },
  docImage: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#EFEBE9' },
  photoLabel: { fontSize: 9, color: '#8D6E63', marginTop: 6, fontWeight: 'bold' },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  btnReject: { height: 32, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#FFEBEE', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: '#FFCDD2' },
  btnTextReject: { color: '#C62828', fontSize: 11, fontWeight: 'bold' },
  btnAccept: { height: 32, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#2E7D32', justifyContent: 'center', alignItems: 'center', elevation: 1 },
  btnTextAccept: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  empty: { alignItems: 'center', justifyContent: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 14, fontWeight: 'bold', color: '#2E7D32', marginTop: 16 },
  emptySub: { fontSize: 11, color: '#8D6E63', textAlign: 'center', marginTop: 4, lineHeight: 16 },
  
  // Styles Modal Gambar Fullscreen
  modalFullImageBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  fullScreenImage: { width: width, height: height * 0.7 },
  btnCloseModal: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 }
});