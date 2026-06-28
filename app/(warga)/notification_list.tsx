// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { supabase } from '../../supabaseConfig';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NotificationListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notifList, setNotifList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // 👑 BRANKAS EMAIL OWNER UTAMA TUAN SEPTIAN
  const EMAIL_ADMIN_SAKRAL = 'agieldoank85@gmail.com';

  // --- 🟢 RADAR UTAMA: AMBIL DATA NOTIFIKASI CLOUD (💡 KALIBRASI: Sasis Kolom Baru) ---
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const emailLoginn = session.user.email;
      const uid = session.user.id;
      
      let query = supabase.from('notifications').select('*');

      if (emailLoginn === EMAIL_ADMIN_SAKRAL) {
        setIsAdmin(true);
        // Admin: Hanya melihat notifikasi pendaftaran yang mengambang murni (user_id_notif is null)
        query = query.in('tipe_notif', ['REGISTRASI_MITRA', 'REGISTRASI_KURIR']);
      } else {
        setIsAdmin(false);
        // User Biasa: Hanya melihat notifikasi privat yang dikirim ke user_id_notif miliknya
        query = query.eq('user_id_notif', uid);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setNotifList(data || []);
    } catch (error) {
      console.error(error);
      Alert.alert("Gagal", "Gagal memuat pemberitahuan.");
    } finally {
      setLoading(false);
    }
  };

  // --- 🟢 KETUK UPDATE STATUS NOTIF (💡 KALIBRASI: is_read_notif & id_notif) ---
  const handleActionNotif = async (item: any) => {
    try {
      // 1. Matikan status belum dibaca murni menembak database gres
      await supabase
        .from('notifications')
        .update({ is_read_notif: true })
        .eq('id_notif', item.id_notif);

      // 2. PAGAR KEAMANAN KETAT KONSOL ADMIN PUSAT TUAN OWNER
      if (item.tipe_notif === 'REGISTRASI_MITRA' || item.tipe_notif === 'REGISTRASI_KURIR') {
        if (isAdmin) {
          router.push('/admin'); // Admin agieldoank85 lolos murni masuk ruang kendali utama
        } else {
          Alert.alert("Akses Ditolak", "Maaf, Anda tidak memiliki hak akses pemilik untuk masuk ke Konsol Admin.");
          fetchNotifications();
        }
      } else {
        fetchNotifications();
      }
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#4A3525" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifikasi Sistem</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#D35400" />
        </View>
      ) : (
        <FlatList
          data={notifList}
          keyExtractor={(item) => item.id_notif.toString()}
          contentContainerStyle={{ paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.notifCard, !item.is_read_notif && styles.notifUnread]} 
              onPress={() => handleActionNotif(item)}
            >
              <View style={styles.iconContainer}>
                <MaterialIcons 
                  name={item.tipe_notif && item.tipe_notif.includes('MITRA') ? 'storefront' : 'motorcycle'} 
                  size={20} color="#D35400" 
                />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.notifTitle}>{item.judul_notif}</Text>
                <Text style={styles.notifMessage}>{item.pesan_notif}</Text>
              </View>
              {!item.is_read_notif && <View style={styles.dotUnread} />}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Belum ada pemberitahuan baru.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDFCFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EFEBE9' },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 15, fontWeight: 'bold', color: '#4A3525' },
  notifCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', alignItems: 'center' },
  notifUnread: { backgroundColor: '#FFF8F4' },
  iconContainer: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center' },
  textContainer: { marginLeft: 12, flex: 1 },
  notifTitle: { fontSize: 13, fontWeight: 'bold', color: '#4A3525' },
  notifMessage: { fontSize: 11, color: '#8D6E63', marginTop: 3, lineHeight: 15 },
  dotUnread: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E74C3C', marginLeft: 10 },
  emptyText: { textAlign: 'center', color: '#BCAAA4', fontSize: 12, marginTop: 50 },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDFCFB' }
});