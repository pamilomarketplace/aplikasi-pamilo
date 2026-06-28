// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Image, 
  ScrollView, 
  ActivityIndicator, 
  TouchableOpacity, 
  StatusBar,
  Dimensions
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// INTEGRASI TOTAL: MURNI KONEKTOR SUPABASE CLOUD UTAMA
import { supabase } from '../../supabaseConfig';

const { width } = Dimensions.get('window');

interface DetailBerita {
  id_berita: string;
  judul_berita: string;
  isi_berita: string;
  gambar_berita: string;
  created_at: string;
}

export default function DetailNewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [news, setNews] = useState<DetailBerita | null>(null);
  const [loading, setLoading] = useState(true);

  // --- 🟢 RADAR AMBIL DETAIL DATA BERITA DARI SUPABASE (💡 KALIBRASI: id_berita) ---
  const fetchDetailBeritaSupabase = async () => {
    try {
      setLoading(true);
      if (!id) return;

      const { data, error } = await supabase
        .from('berita')
        .select('*')
        .eq('id_berita', id)
        .maybeSingle(); // Ambil satu baris data murni berdasarkan ID sakral baru

      if (error) throw error;
      if (data) {
        setNews(data as DetailBerita);
      }
    } catch (error) {
      console.error("Gagal menarik detail berita dari Supabase:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetailBeritaSupabase();
  }, [id]);

  // Format visual tanggal lokal Ciamis
  const formatTanggalLokal = (dateString: string) => {
    if (!dateString) return '';
    const opsi: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('id-ID', opsi);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4A3525" />
        <Text style={styles.loadingText}>Memuat informasi promo...</Text>
      </View>
    );
  }

  if (!news) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="newspaper-outline" size={48} color="#BCAAA4" />
        <Text style={styles.errorText}>Maaf, detail pemberitahuan tidak ditemukan atau telah dihapus.</Text>
        <TouchableOpacity style={styles.btnBackError} onPress={() => router.back()}>
          <Text style={styles.btnTextError}>Kembali ke Beranda</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: true,
          headerTitle: 'Info & Promo PAMILO',
          headerTintColor: '#4A3525',
          headerStyle: { backgroundColor: '#fff' },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 5 }}>
              <Ionicons name="arrow-back" size={22} color="#4A3525" />
            </TouchableOpacity>
          ),
        }} 
      />
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
        {/* GAMBAR BANNER PROMO UTAMA */}
        {news.gambar_berita ? (
          <Image source={{ uri: news.gambar_berita }} style={styles.bannerImage} resizeMode="cover" />
        ) : (
          <View style={styles.fallbackBanner}>
            <Ionicons name="image-outline" size={48} color="#BCAAA4" />
          </View>
        )}

        {/* AREA KONTEN INFORMASI */}
        <View style={styles.contentBody}>
          <Text style={styles.titleText}>{news.judul_berita}</Text>
          
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={13} color="#8D6E63" />
            <Text style={styles.dateText}>Diterbitkan: {formatTanggalLokal(news.created_at)}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <Text style={styles.bodyText}>{news.isi_berita}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDFCFB', paddingHorizontal: 40 },
  loadingText: { marginTop: 12, color: '#8D6E63', fontSize: 12, fontWeight: '500' },
  errorText: { textAlign: 'center', color: '#8D6E63', fontSize: 13, marginTop: 14, lineHeight: 20 },
  btnBackError: { backgroundColor: '#4A3525', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, marginTop: 20 },
  btnTextError: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  bannerImage: { width: width, height: width * 0.55, backgroundColor: '#FFF3E0' },
  fallbackBanner: { width: width, height: width * 0.55, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  contentBody: { padding: 20 },
  titleText: { fontSize: 18, fontWeight: 'bold', color: '#4A3525', lineHeight: 24 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 5 },
  dateText: { fontSize: 11, color: '#8D6E63', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#EFEBE9', marginVertical: 16 },
  bodyText: { fontSize: 13, color: '#4A3525', lineHeight: 22, textAlign: 'justify' }
});