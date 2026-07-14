// app/(tabs)/info-galuh.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  FlatList, 
  StatusBar,
  ActivityIndicator,
  Linking,
  Modal,
  Alert,
  Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfoGaluh } from '@/features/info-galuh/useInfoGaluh';

const { width } = Dimensions.get('window');
const BANNER_WIDTH = width - 32; 

const BannerCarousel = ({ news, loadingNews, onBannerPress }: { news: any[], loadingNews: boolean, onBannerPress: (item: any) => void }) => {
  const bannerRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (news.length > 1) {
      interval = setInterval(() => {
        setCurrentIndex((prevIndex) => {
          const nextIndex = prevIndex === news.length - 1 ? 0 : prevIndex + 1;
          if (bannerRef.current) {
            bannerRef.current.scrollTo({ x: nextIndex * BANNER_WIDTH, animated: true });
          }
          return nextIndex;
        });
      }, 8000); 
    }
    return () => { if (interval) clearInterval(interval); };
  }, [news.length]);

  const handleScrollEnd = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / BANNER_WIDTH);
    setCurrentIndex(index);
  };

  if (loadingNews) {
    return <View style={[styles.bannerContainer, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color="#4A3525" /></View>;
  }

  if (news.length === 0) {
    return <View style={[styles.bannerContainer, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#EFEBE9' }]}><Text style={{ color: '#8D6E63', fontSize: 11, fontStyle: 'italic' }}>Belum ada sorotan berita Galuh saat ini.</Text></View>;
  }

  return (
    <View style={styles.bannerContainer}>
      <ScrollView ref={bannerRef} horizontal showsHorizontalScrollIndicator={false} snapToInterval={BANNER_WIDTH} snapToAlignment="center" decelerationRate="fast" onMomentumScrollEnd={handleScrollEnd}>
        {news.map((item, index) => (
          <TouchableOpacity key={item.id_berita ? item.id_berita.toString() : index.toString()} activeOpacity={0.9} onPress={() => onBannerPress(item)} style={{ width: BANNER_WIDTH, height: 140 }}>
            <View style={{ width: '100%', height: '100%', position: 'relative' }}>
              {item.gambar_berita ? (
                <Image source={{ uri: item.gambar_berita }} style={styles.bannerImage} resizeMode="cover" />
              ) : (
                <View style={[styles.bannerImage, { backgroundColor: '#BCAAA4', justifyContent: 'center', alignItems: 'center' }]}><FontAwesome5 name="landmark" size={28} color="#fff" style={{ opacity: 0.4 }} /></View>
              )}
              <View style={styles.bannerOverlay}>
                <Text style={styles.bannerTag}>📢 SOROTAN KABAR GALUH</Text>
                <Text style={styles.bannerText} numberOfLines={2}>{item.judul_berita}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const ZONA_CIAMIS = [
  { id: 'pusat', label: 'Ciamis Pusat', kecamatan: ['Ciamis Kota', 'Sadananya', 'Cikoneng', 'Sindangkasih', 'Baregbeg'] },
  { id: 'utara', label: 'Ciamis Utara', kecamatan: ['Kawali', 'Panjalu', 'Sukamantri', 'Panawangan', 'Lumbung', 'Jatinagara'] },
  { id: 'timur', label: 'Ciamis Timur', kecamatan: ['Rancah', 'Rajadesa', 'Tambaksari', 'Cisaga', 'Sukadana'] },
  { id: 'selatan', label: 'Ciamis Selatan', kecamatan: ['Cijeungjing', 'Cidolog', 'Pamarican', 'Cimaragas'] },
  { id: 'banjarsari', label: 'Banjarsari Raya', kecamatan: ['Banjarsari', 'Banjaranyar', 'Lakbok', 'Purwadadi'] },
];

export default function InfoGaluhScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Memanggil semua status logika dan state terpusat dari hook
  const {
    loading,
    loadingDarurat,
    activeSubMenu,
    setActiveSubMenu,
    beritaList,
    lokerList,
    wisataList,
    kontakDaruratList,
    bannerHighlightList,
    selectedZona,
    setSelectedZona,
    selectedKecamatan,
    setSelectedKecamatan,
    modalDaruratVisible,
    setModalDaruratVisible,
    handlePilihKecamatanDarurat,
    handleHubungiNomor,
    closeModalDarurat
  } = useInfoGaluh();

  const getIconKategoriRescue = (kategori: string) => {
    if (kategori === 'Kesehatan' || kategori?.includes('Medis') || kategori?.includes('Puskesmas')) return 'medical';
    if (kategori === 'Keamanan' || kategori?.includes('Polisi') || kategori?.includes('Polsek')) return 'shield';
    return 'flame';
  };

  const getColorKategoriRescue = (kategori: string) => {
    if (kategori === 'Kesehatan' || kategori?.includes('Medis') || kategori?.includes('Puskesmas')) return '#2E7D32';
    if (kategori === 'Keamanan' || kategori?.includes('Polisi') || kategori?.includes('Polsek')) return '#0D47A1';
    return '#C62828';
  };

  return (
    <View style={styles.mainWrapper}>
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />
      <View style={[styles.headerContainer, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}><FontAwesome5 name="landmark" size={16} color="#FFB74D" /><Text style={styles.headerTitleText}>INFO GALUH CIAMIS</Text></View>
        <Text style={styles.headerSubtitleText}>Pusat Informasi, Lowongan Kerja, Wisata & Direktori Darurat Warga</Text>
      </View>

      {loading ? (
        <View style={styles.centerLoading}><ActivityIndicator size="large" color="#4A3525" /><Text style={styles.loadingText}>Menghubungkan ke pusat sirkuit informasi Ciamis...</Text></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          <BannerCarousel news={bannerHighlightList} loadingNews={loading} onBannerPress={(item) => Alert.alert(item.judul_berita || "Kabar Galuh", item.isi_berita || 'Baca selengkapnya di aplikasi.')} />
          
          <Text style={styles.sectionTitle}>4 PILAR KENDALI OPERASIONAL UTILITAS</Text>
          <View style={styles.gridMenuContainer}>
            <TouchableOpacity style={[styles.gridItem, activeSubMenu === 'BERITA' && styles.gridItemActive]} onPress={() => setActiveSubMenu(activeSubMenu === 'BERITA' ? 'ALL' : 'BERITA')}><View style={[styles.gridIconBg, { backgroundColor: '#E3F2FD' }]}><Ionicons name="newspaper" size={20} color="#0D47A1" /></View><Text style={styles.gridLabel}>Kabar Ciamis</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.gridItem, activeSubMenu === 'LOKER' && styles.gridItemActive]} onPress={() => setActiveSubMenu(activeSubMenu === 'LOKER' ? 'ALL' : 'LOKER')}><View style={[styles.gridIconBg, { backgroundColor: '#E8F5E9' }]}><Ionicons name="briefcase" size={20} color="#1B5E20" /></View><Text style={styles.gridLabel}>Loker Galuh</Text></TouchableOpacity>
            <TouchableOpacity style={styles.gridItem} onPress={() => setModalDaruratVisible(true)}><View style={[styles.gridIconBg, { backgroundColor: '#FFEBEE' }]}><Ionicons name="call" size={20} color="#B71C1C" /></View><Text style={styles.gridLabel}>Kontak Darurat</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.gridItem, activeSubMenu === 'WISATA' && styles.gridItemActive]} onPress={() => setActiveSubMenu(activeSubMenu === 'WISATA' ? 'ALL' : 'WISATA')}><View style={[styles.gridIconBg, { backgroundColor: '#FFF3E0' }]}><FontAwesome5 name="map-marked-alt" size={18} color="#E65100" /></View><Text style={styles.gridLabel}>Pesona Galuh</Text></TouchableOpacity>
          </View>

          {(activeSubMenu === 'ALL' || activeSubMenu === 'LOKER') && (
            <View style={styles.subSectionBlock}>
              <View style={styles.sectionHeaderRow}><Text style={styles.blockTitle}>💼 LOWONGAN KERJA TERVALIDASI DISNAKER</Text>{activeSubMenu === 'ALL' && <Text style={styles.seeAllText} onPress={() => setActiveSubMenu('LOKER')}>Lihat Semua</Text>}</View>
              {lokerList.length === 0 ? <View style={styles.emptyContainer}><Text style={styles.emptyText}>Belum ada lowongan kerja aktif minggu ini.</Text></View> : lokerList.map(loker => (
                <View key={loker.id} style={styles.lokerCard}>
                  <View style={styles.lokerHeader}><Text style={styles.lokerPosisi}>{loker.judul_loker}</Text><View style={styles.badgeValid}><Text style={styles.badgeValidText}>✓ VALID</Text></View></View>
                  <Text style={styles.lokerToko}><Ionicons name="storefront" size={11} color="#8D6E63" /> {loker.perusahaan}</Text>
                  <Text style={styles.lokerSyarat}>{loker.deskripsi_loker}</Text>
                  <TouchableOpacity style={styles.btnLokerCall} onPress={() => handleHubungiNomor(loker.no_whatsapp, 'wa')}><Ionicons name="logo-whatsapp" size={12} color="#fff" style={{ marginRight: 6 }} /><Text style={styles.btnLokerCallText}>Ajukan Lamaran Lewat WA</Text></TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {(activeSubMenu === 'ALL' || activeSubMenu === 'WISATA') && (
            <View style={styles.subSectionBlock}>
              <View style={styles.sectionHeaderRow}><Text style={styles.blockTitle}>🗺️ PESONA GALUH (DESTINASI WISATA CIAMIS)</Text>{activeSubMenu === 'ALL' && <Text style={styles.seeAllText} onPress={() => setActiveSubMenu('WISATA')}>Lihat Semua</Text>}</View>
              {wisataList.length === 0 ? <View style={styles.emptyContainer}><Text style={styles.emptyText}>Katalog destinasi wisata sedang disinkronkan.</Text></View> : (
                <FlatList horizontal showsHorizontalScrollIndicator={false} data={wisataList} keyExtractor={(item) => item.id.toString()} contentContainerStyle={{ paddingLeft: 2, gap: 12 }} renderItem={({ item }) => (
                  <View style={styles.wisataCard}>
                    <Image source={{ uri: item.gambar_url || 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=500' }} style={styles.wisataImage} />
                    <View style={styles.wisataInfo}>
                      <Text style={styles.wisataNama}>{item.nama_destinasi}</Text>
                      <Text style={styles.wisataWilayah}>🏷️ {item.kategori}</Text>
                      <Text style={styles.wisataDesc} numberOfLines={2}>{item.deskripsi}</Text>
                      {item.lat && item.lng && (
                          <TouchableOpacity style={styles.btnOrderMigo} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`)}>
                            <FontAwesome5 name="map-marker-alt" size={11} color="#fff" style={{ marginRight: 6 }} /><Text style={styles.btnOrderMigoText}>Lihat di Google Maps</Text>
                          </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}/>
              )}
            </View>
          )}

          {(activeSubMenu === 'ALL' || activeSubMenu === 'BERITA') && (
            <View style={styles.subSectionBlock}>
              <Text style={styles.blockTitle}>📰 KABAR HARIAN SEPUTAR CIAMIS</Text>
              {beritaList.length === 0 ? <View style={styles.emptyContainer}><Text style={styles.emptyText}>Tidak ada kabar atau pengumuman hari ini.</Text></View> : beritaList.map(berita => (
                <View key={berita.id_berita} style={styles.beritaCard}>
                  <View style={[styles.beritaIconBg, { backgroundColor: berita.warna_tema ? berita.warna_tema + '25' : '#E3F2FD' }]}>
                    <Ionicons name={(berita.tipe_ikon as any) || 'newspaper'} size={18} color={berita.warna_tema || '#0288D1'} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.beritaTitle}>{berita.judul_berita}</Text>
                      <Text style={styles.beritaDate}>{berita.tanggal_tayang}</Text>
                      <Text style={styles.beritaDesc}>{berita.isi_berita}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={modalDaruratVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitleText}>🚨 DIREKTORI DARURAT SE-CIAMIS</Text>
              <TouchableOpacity onPress={closeModalDarurat}><Ionicons name="close-circle" size={24} color="#C62828" /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
              {!selectedZona ? (
                <View>
                  <Text style={styles.modalGuideText}>Silakan pilih Zona Lokasi Anda di Ciamis Tuan:</Text>
                  {ZONA_CIAMIS.map((zona) => (
                    <TouchableOpacity key={zona.id} style={styles.zonaItem} onPress={() => setSelectedZona(zona)}><Text style={styles.zonaLabelText}>{zona.label}</Text><Ionicons name="chevron-forward" size={14} color="#8D6E63" /></TouchableOpacity>
                  ))}
                </View>
              ) : !selectedKecamatan ? (
                <View>
                  <TouchableOpacity style={styles.btnBackModal} onPress={() => setSelectedZona(null)}><Ionicons name="arrow-back" size={14} color="#8D6E63" /><Text style={styles.btnBackModalText}>Kembali ke Pilihan Zona</Text></TouchableOpacity>
                  <Text style={styles.modalGuideText}>Pilih Kecamatan Domisili Anda:</Text>
                  <View style={styles.kecamatanGrid}>
                    {selectedZona.kecamatan.map((kec: string) => (<TouchableOpacity key={kec} style={styles.kecamatanBox} onPress={() => handlePilihKecamatanDarurat(kec)}><Text style={styles.kecamatanText}>{kec}</Text></TouchableOpacity>))}
                  </View>
                </View>
              ) : (
                <View style={{ flex: 1 }}>
                  <TouchableOpacity style={styles.btnBackModal} onPress={() => { setSelectedKecamatan(null); }}><Ionicons name="arrow-back" size={14} color="#8D6E63" /><Text style={styles.btnBackModalText}>Kembali ke Pilihan Kecamatan</Text></TouchableOpacity>
                  <Text style={styles.daruratHeaderTarget}>📍 Unit Penyelamat Kec. {selectedKecamatan}</Text>
                  {loadingDarurat ? (
  <View style={{ paddingVertical: 40, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator size="small" color="#4A3525" />
    <Text style={{ fontSize: 11, color: '#8D6E63', marginTop: 8 }}>Memanggil unit penyelamat terdekat...</Text>
  </View>
) : (
  <View style={{ gap: 10, marginTop: 10, paddingBottom: 20 }}>
    {kontakDaruratList.length === 0 ? (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Nomor darurat khusus kecamatan ini belum diinput di database.</Text>
      </View>
    ) : (
      // Perbaikan: Menghapus tanda '<' dan menambahkan tipe data :any & :number
      kontakDaruratList.map((rescue: any, index: number) => (
        <View key={rescue.id || String(index)} style={styles.kontakRescueCard}>
          <View style={styles.rescueHeaderRow}>
            <Text style={styles.rescueName}>{rescue.nama_instansi}</Text>
            <Ionicons name={getIconKategoriRescue(rescue.kategori)} size={14} color={getColorKategoriRescue(rescue.kategori)} />
          </View>
          <TouchableOpacity 
            style={[styles.btnCallRescue, { backgroundColor: getColorKategoriRescue(rescue.kategori) }]} 
            onPress={() => handleHubungiNomor(rescue.nomor_telepon)}
          >
            <Ionicons name="call" size={12} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.btnCallRescueText}>Hubungi Bantuan</Text>
          </TouchableOpacity>
        </View>
      ))
    )}
  </View>
)}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: '#FAF8F5' },
  headerContainer: { backgroundColor: '#4A3525', paddingHorizontal: 16, paddingBottom: 14, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitleText: { fontSize: 13, fontWeight: 'bold', color: '#fff', letterSpacing: 0.5 },
  headerSubtitleText: { fontSize: 10, color: '#D7CCC8', marginTop: 4, lineHeight: 13 },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, color: '#8D6E63', fontSize: 12, textAlign: 'center' },
  bannerContainer: { marginHorizontal: 16, marginTop: 16, marginBottom: 14, borderRadius: 16, overflow: 'hidden', height: 140, elevation: 2, backgroundColor: '#fff' },
  bannerImage: { width: '100%', height: '100%' },
  bannerOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(26,15,5,0.75)', padding: 12 },
  bannerTag: { fontSize: 9, fontWeight: 'bold', color: '#FFB74D' },
  bannerText: { fontSize: 10, color: '#fff', marginTop: 2, lineHeight: 13 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', color: '#A1887F', letterSpacing: 1, paddingHorizontal: 16, marginBottom: 10, marginTop: 4 },
  gridMenuContainer: { flexDirection: 'row', paddingHorizontal: 16, justifyContent: 'space-between', marginBottom: 14 },
  gridItem: { width: '23%', backgroundColor: '#fff', borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#EFEBE9' },
  gridItemActive: { borderColor: '#4A3525', backgroundColor: '#F5EFEA' },
  gridIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  gridLabel: { fontSize: 9, fontWeight: 'bold', color: '#4A3525', textAlign: 'center' },
  subSectionBlock: { paddingHorizontal: 16, marginBottom: 16 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  blockTitle: { fontSize: 10, fontWeight: 'bold', color: '#8D6E63', letterSpacing: 0.5, marginBottom: 8 },
  seeAllText: { fontSize: 10, fontWeight: 'bold', color: '#D35400' },
  lokerCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#EFEBE9', marginBottom: 8 },
  lokerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lokerPosisi: { fontSize: 12, fontWeight: 'bold', color: '#4A3525' },
  badgeValid: { backgroundColor: '#E8F5E9', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 4 },
  badgeValidText: { fontSize: 7, color: '#2E7D32', fontWeight: 'bold' },
  lokerToko: { fontSize: 10, color: '#8D6E63', marginTop: 2 },
  lokerSyarat: { fontSize: 10, color: '#546E7A', marginTop: 4, lineHeight: 13 },
  btnLokerCall: { backgroundColor: '#2E7D32', flexDirection: 'row', height: 28, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  btnLokerCallText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  wisataCard: { backgroundColor: '#fff', width: 200, borderRadius: 12, borderWidth: 1, borderColor: '#EFEBE9', overflow: 'hidden' },
  wisataImage: { width: 200, height: 110, resizeMode: 'cover' },
  wisataInfo: { padding: 10 },
  wisataNama: { fontSize: 12, fontWeight: 'bold', color: '#4A3525' },
  wisataWilayah: { fontSize: 9, fontWeight: '600', color: '#D35400', marginTop: 2 },
  wisataDesc: { fontSize: 9, color: '#8D6E63', marginTop: 4, lineHeight: 12 },
  btnOrderMigo: { backgroundColor: '#4A3525', flexDirection: 'row', height: 26, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  btnOrderMigoText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  beritaCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#EFEBE9', marginBottom: 8, alignItems: 'center' },
  beritaIconBg: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  beritaTitle: { fontSize: 11, fontWeight: 'bold', color: '#4A3525' },
  beritaDate: { fontSize: 8, color: '#A1887F', marginTop: 1 },
  beritaDesc: { fontSize: 10, color: '#8D6E63', marginTop: 4, lineHeight: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#EFEBE9', paddingBottom: 12, marginBottom: 10 },
  modalTitleText: { fontSize: 12, fontWeight: 'bold', color: '#4A3525' },
  modalGuideText: { fontSize: 11, fontWeight: '500', color: '#8D6E63', marginVertical: 8 },
  zonaItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FAF8F5', padding: 14, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#EFEBE9' },
  zonaLabelText: { fontSize: 12, fontWeight: 'bold', color: '#4A3525' },
  btnBackModal: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  btnBackModalText: { fontSize: 11, fontWeight: 'bold', color: '#8D6E63' },
  kecamatanGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  kecamatanBox: { backgroundColor: '#FDFCFB', borderWidth: 1, borderColor: '#EFEBE9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, width: '48%' },
  kecamatanText: { fontSize: 11, fontWeight: '600', color: '#4A3525', textAlign: 'center' },
  daruratHeaderTarget: { fontSize: 12, fontWeight: 'bold', color: '#D35400', marginTop: 4 },
  kontakRescueCard: { backgroundColor: '#FAF8F5', borderWidth: 1, borderColor: '#EFEBE9', borderRadius: 12, padding: 12 },
  rescueHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  rescueName: { fontSize: 11, fontWeight: 'bold', color: '#4A3525' },
  btnCallRescue: { backgroundColor: '#0D47A1', flexDirection: 'row', height: 28, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  btnCallRescueText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  emptyContainer: { padding: 16, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#EFEBE9', alignItems: 'center', width: '100%' },
  emptyText: { fontSize: 11, color: '#A1887F', fontStyle: 'italic', textAlign: 'center', lineHeight: 14 }
});