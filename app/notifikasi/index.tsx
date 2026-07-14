// app/notifikasi/index.tsx
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 🚀 HUBUNGAN RIIL: Mengonsumsi data notifikasi langsung dari database
import { useNotifikasi, Notifikasi } from '@/features/notifikasi/useNotifikasi';

export default function NotifikasiScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // Menggunakan data asli dan fungsi interaktif dari hook
  const { loading, notifikasiList, tandaiSudahDibaca } = useNotifikasi();

  const renderNotifItem = ({ item }: { item: Notifikasi }) => (
    <TouchableOpacity 
      style={[styles.notifCard, item.is_unread && styles.notifUnread]}
      activeOpacity={0.8}
      onPress={() => {
        if (item.is_unread) {
          tandaiSudahDibaca(item.id); // Otomatis matikan titik merah saat diklik
        }
      }}
    >
      <View style={[styles.iconCircle, item.tipe === 'PROMO' ? { backgroundColor: '#FFE0B2' } : { backgroundColor: '#EADBC8' }]}>
        <Ionicons 
          name={item.tipe === 'PROMO' ? "megaphone" : item.tipe === 'ORDER' ? "receipt" : "shield-checkmark"} 
          size={20} 
          color={item.tipe === 'PROMO' ? "#E65100" : "#4A3420"} 
        />
      </View>
      <View style={styles.textCol}>
        <View style={styles.titleRow}>
          <Text style={[styles.titleText, item.is_unread && styles.textBold]}>{item.judul}</Text>
          <Text style={styles.timeText}>
            {new Date(item.created_at).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <Text style={styles.msgText} numberOfLines={2}>{item.pesan}</Text>
      </View>
      
      {/* Titik merah penanda pesan belum dibaca */}
      {item.is_unread && <View style={styles.dotUnread} />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#4A3420" />
      
      <View style={[styles.customNavBar, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.navBarTitle}>Notifikasi 🔔</Text>
        <View style={{ width: 35 }} />
      </View>

      {loading ? (
        <View style={styles.centerLoad}>
          <ActivityIndicator size="large" color="#4A3420" />
          <Text style={styles.loadText}>Membaca pemberitahuan sistem...</Text>
        </View>
      ) : (
        <FlatList
          data={notifikasiList}
          keyExtractor={(item) => item.id}
          renderItem={renderNotifItem}
          contentContainerStyle={styles.listPadding}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={60} color="#C0A995" />
              <Text style={styles.emptyTitle}>Tidak Ada Notifikasi</Text>
              <Text style={styles.emptySub}>Semua riwayat pengumuman, promo, dan laporan transaksi keuangan Anda akan muncul di sini.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FAF6F0' },
  customNavBar: { backgroundColor: '#4A3420', height: 95, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, elevation: 4 },
  backBtn: { width: 35, height: 40, justifyContent: 'center' },
  navBarTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  centerLoad: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadText: { fontSize: 12, color: '#7A6450', fontWeight: 'bold' },
  listPadding: { padding: 16 },
  notifCard: { backgroundColor: '#FFF', flexDirection: 'row', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#E0D0C0', marginBottom: 10, alignItems: 'flex-start', elevation: 1 },
  notifUnread: { backgroundColor: '#FAF3F0', borderColor: '#D7CCC8' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  textCol: { flex: 1, marginLeft: 14, paddingRight: 8 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  titleText: { fontSize: 13, color: '#4A3420', flex: 1 },
  textBold: { fontWeight: 'bold' },
  timeText: { fontSize: 10, color: '#A1887F', marginLeft: 6 },
  msgText: { fontSize: 12, color: '#7A6450', lineHeight: 18 },
  dotUnread: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E74C3C', marginTop: 4 },
  emptyContainer: { alignItems: 'center', marginTop: 150, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#7A6450', marginTop: 16 },
  emptySub: { fontSize: 12, color: '#A1887F', textAlign: 'center', marginTop: 6, lineHeight: 18 }
});