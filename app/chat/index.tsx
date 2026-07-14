// app/chat/index.tsx
import React from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, StatusBar, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Mengonsumsi pipa mesin logika terisolasi murni
import { useChatPengguna, ChatMessage } from '@/features/chat/useChatPengguna';

export default function ChatPenggunaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const { orderId, receiverId, nameTitle } = useLocalSearchParams<{ orderId: string; receiverId: string; nameTitle: string }>();

  const {
    loading,
    sending,
    messages,
    inputText,
    setInputText,
    userId,
    handleSendMessage,
    handlePickAndSendImage
  } = useChatPengguna({ orderId: orderId!, receiverId: receiverId! });

  const renderBubble = ({ item }: { item: ChatMessage }) => {
    const isMe = item.sender_id === userId;
    const isImage = item.tipe_pesan === 'IMAGE';
    
    return (
      <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowTarget]}>
        <View style={[styles.bubbleCard, isMe ? styles.cardMe : styles.cardTarget, isImage && styles.cardImagePadding]}>
          
          {/* RENDER KONDISIONAL: Foto Bukti atau Teks Koordinasi */}
          {isImage && item.media_url ? (
            <Image 
              source={{ uri: item.media_url }} 
              style={styles.chatImageRender}
              resizeMode="cover"
            />
          ) : (
            <Text style={[styles.chatText, isMe ? styles.textMe : styles.textTarget]}>
              {item.text_message}
            </Text>
          )}

          <Text style={[styles.timeText, isMe ? styles.timeMe : styles.timeTarget]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.select({ ios: 95, android: 95 })}
      style={styles.mainContainer}
    >
      <StatusBar barStyle="light-content" backgroundColor="#4A3420" />

      {/* NAVIGASI HEADER ATAS */}
      <View style={[styles.customNavBar, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleCol}>
          <Text style={styles.navBarTitle}>{nameTitle || 'Hubungan Warga PAMILO'}</Text>
          <Text style={styles.navBarSubtitle}>ID Pesanan: {orderId?.substring(0, 8)}...</Text>
        </View>
        <View style={{ width: 30 }} />
      </View>

      {loading ? (
        <View style={styles.centerLoad}>
          <ActivityIndicator size="large" color="#4A3420" />
          <Text style={styles.loadText}>Menyambungkan saluran enkripsi obrolan...</Text>
        </View>
      ) : (
        <View style={styles.chatArea}>
          
          {messages.length === 0 ? (
            <View style={styles.emptyChatContainer}>
              <Ionicons name="chatbubble-outline" size={44} color="#C0A995" />
              <Text style={styles.emptyTitle}>Mulai Obrolan</Text>
              <Text style={styles.emptySub}>Kirim pesan koordinasi atau foto bukti lampiran demi kelancaran pesanan lapangan.</Text>
            </View>
          ) : (
            <FlatList
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderBubble}
              inverted={true}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* BAR BAWAH INPUT TEKS & ATTACH MEDIA */}
          <View style={[styles.inputBarRow, { paddingBottom: insets.bottom + 10 }]}>
            
            {/* Tombol Klip Unggah Media Transaksi */}
            <TouchableOpacity 
              style={styles.btnAttachMedia} 
              onPress={handlePickAndSendImage}
              disabled={sending}
            >
              <Ionicons name="attach" size={22} color="#4A3420" />
            </TouchableOpacity>

            <TextInput
              style={styles.chatInputField}
              placeholder="Tulis pesan ke kurir / mitra..."
              placeholderTextColor="#A1887F"
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            <TouchableOpacity 
              style={[styles.btnSendExecute, !inputText.trim() && styles.btnSendDisabled]} 
              onPress={handleSendMessage}
              disabled={!inputText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="send" size={18} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FAF6F0' },
  customNavBar: { backgroundColor: '#4A3420', height: 95, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, elevation: 4 },
  backBtn: { width: 35, height: 40, justifyContent: 'center' },
  headerTitleCol: { flex: 1, marginLeft: 4 },
  navBarTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  navBarSubtitle: { color: '#C0A995', fontSize: 10, marginTop: 2, fontWeight: '500' },
  centerLoad: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadText: { fontSize: 12, color: '#7A6450', fontWeight: 'bold' },
  chatArea: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 20 },
  bubbleRow: { flexDirection: 'row', width: '100%', marginBottom: 12 },
  bubbleRowMe: { justifyContent: 'flex-end' },
  bubbleRowTarget: { justifyContent: 'flex-start' },
  bubbleCard: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, elevation: 1 },
  cardImagePadding: { padding: 4, borderRadius: 12 },
  cardMe: { backgroundColor: '#4A3420', borderBottomRightRadius: 2 },
  cardTarget: { backgroundColor: '#FFF', borderBottomLeftRadius: 2, borderWidth: 1, borderColor: '#E0D0C0' },
  chatText: { fontSize: 13, lineHeight: 18 },
  textMe: { color: '#FFF' },
  textTarget: { color: '#4A3420' },
  timeText: { fontSize: 9, marginTop: 4, marginRight: 4, marginBottom: 2, alignSelf: 'flex-end', fontWeight: '500' },
  timeMe: { color: '#C0A995' },
  timeTarget: { color: '#A1887F' },
  
  // RENDER DOKUMEN GAMBAR TRANSAKSI
  chatImageRender: { width: 220, height: 160, borderRadius: 10 },

  inputBarRow: { flexDirection: 'row', paddingHorizontal: 14, paddingTop: 10, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E0D0C0', alignItems: 'center', gap: 10 },
  btnAttachMedia: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FAF6F0', borderWidth: 1, borderColor: '#E0D0C0', justifyContent: 'center', alignItems: 'center' },
  chatInputField: { flex: 1, backgroundColor: '#FAF6F0', borderWidth: 1, borderColor: '#E0D0C0', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, maxHeight: 100, fontSize: 13, color: '#4A3420', textAlignVertical: 'center' },
  btnSendExecute: { backgroundColor: '#E28743', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  btnSendDisabled: { backgroundColor: '#C0A995', elevation: 0 },
  emptyChatContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 15, fontWeight: 'bold', color: '#7A6450', marginTop: 12 },
  emptySub: { fontSize: 11, color: '#A1887F', textAlign: 'center', marginTop: 4, lineHeight: 16 }
});