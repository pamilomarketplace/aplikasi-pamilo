// app/chat/list.tsx
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Mengonsumsi pipa mesin data kotak masuk terisolasi
import { useChatList, ChatRoomThread } from '@/features/chat/useChatList';

export default function ChatListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const { loading, threads, refetch } = useChatList();

  const renderThreadItem = ({ item }: { item: ChatRoomThread }) => {
    return (
      <TouchableOpacity 
        style={styles.threadCardRow}
        onPress={() => router.push({
          pathname: '../chat',
          params: {
            orderId: item.order_id,
            receiverId: item.counterpart_id,
            nameTitle: item.counterpart_name
          }
        })}
      >
        {/* Render Lingkar Avatar Profil Lawan Bicara */}
        {item.counterpart_avatar ? (
          <Image source={{ uri: item.counterpart_avatar }} style={styles.avatarFrame} />
        ) : (
          <View style={[styles.avatarFrame, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={20} color="#7A6450" />
          </View>
        )}

        {/* Kolom Informasi Ringkasan */}
        <View style={styles.contentColumn}>
          <View style={styles.topMetaRow}>
            <Text style={styles.counterpartNameText} numberOfLines={1}>
              {item.counterpart_name}
            </Text>
            <Text style={styles.timeMetaText}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          
          <Text style={styles.lastMessagePreviewText} numberOfLines={1}>
            {item.last_message}
          </Text>
          <Text style={styles.orderIdBadgeText}>
            ID Order: {item.order_id.substring(0, 8).toUpperCase()}...
          </Text>
        </View>
        
        <Ionicons name="chevron-forward" size={16} color="#C0A995" style={{ marginLeft: 4 }} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.mainContainer, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#4A3420" />

      {/* NAVIGASI HEADER BOX */}
      <View style={styles.customNavBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.navBarTitle}>Kotak Masuk Chat Warga ✉️</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={refetch}>
          <Ionicons name="refresh" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerLoad}>
          <ActivityIndicator size="large" color="#4A3420" />
          <Text style={styles.loadText}>Menata susunan pesan masuk...</Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => `${item.order_id}_${item.counterpart_id}`}
          renderItem={renderThreadItem}
          contentContainerStyle={styles.listContainerStyle}
          ListEmptyComponent={
            <View style={styles.emptyInboxContainer}>
              <Ionicons name="mail-unread-outline" size={54} color="#C0A995" />
              <Text style={styles.emptyInboxTitle}>Kotak Masuk Kosong</Text>
              <Text style={styles.emptyInboxSub}>
                Belum ada aktivitas obrolan transaksi yang terdeteksi dengan driver maupun pedagang pasar.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FAF6F0' },
  customNavBar: { backgroundColor: '#4A3420', height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, elevation: 4 },
  backBtn: { width: 35, height: 40, justifyContent: 'center' },
  refreshBtn: { width: 35, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  navBarTitle: { color: '#FFF', fontSize: 15, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  centerLoad: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadText: { fontSize: 12, color: '#7A6450', fontWeight: 'bold' },
  listContainerStyle: { paddingVertical: 8 },
  
  // Desain Baris Kotak Masuk Premium (WhatsApp Style)
  threadCardRow: { flexDirection: 'row', backgroundColor: '#FFF', padding: 14, marginHorizontal: 14, marginVertical: 6, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E0D0C0', elevation: 1 },
  avatarFrame: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#E0D0C0' },
  avatarPlaceholder: { backgroundColor: '#EFEBE9', justifyContent: 'center', alignItems: 'center' },
  contentColumn: { flex: 1, marginLeft: 12, gap: 2 },
  topMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counterpartNameText: { fontSize: 13, fontWeight: 'bold', color: '#4A3420', flex: 1, marginRight: 10 },
  timeMetaText: { fontSize: 10, color: '#A1887F', fontWeight: '500' },
  lastMessagePreviewText: { fontSize: 12, color: '#7A6450' },
  orderIdBadgeText: { fontSize: 9, color: '#A1887F', backgroundColor: '#FAF6F0', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 2, borderWidth: 0.5, borderColor: '#E0D0C0', fontWeight: '600' },

  emptyInboxContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 50, marginTop: 160 },
  emptyInboxTitle: { fontSize: 15, fontWeight: 'bold', color: '#7A6450', marginTop: 12 },
  emptyInboxSub: { fontSize: 11, color: '#A1887F', textAlign: 'center', marginTop: 4, lineHeight: 16 }
});