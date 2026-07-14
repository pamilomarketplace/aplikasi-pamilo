// app/pesan/index.tsx
import React from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, StatusBar, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 🚀 NAMA HOOK DISESUAIKAN KE BAHASA INDONESIA (Silakan rename file hook lama Anda)
import { usePesanCs, PesanCs } from '@/features/pesan/usePesanCs';

export default function PesanCsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const { loading, sending, messages, inputText, setInputText, handleSendMessage, handlePickAndSendImage } = usePesanCs();

  const renderMessageBubble = ({ item }: { item: PesanCs }) => {
    const isMe = item.tipe_pengirim === 'USER';
    const isImage = item.tipe_pesan === 'IMAGE';
    
    return (
      <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowCs]}>
        <View style={[styles.bubbleCard, isMe ? styles.cardMe : styles.cardCs, isImage && styles.cardImagePadding]}>
          {isImage && item.media_url ? (
            <Image source={{ uri: item.media_url }} style={styles.chatImageRender} resizeMode="cover" />
          ) : (
            <Text style={[styles.chatText, isMe ? styles.textMe : styles.textCs]}>{item.teks_pesan}</Text>
          )}
          <Text style={[styles.timeText, isMe ? styles.timeMe : styles.timeCs]}>
            {new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#4A3420" />

      {/* HEADER KHUSUS CS */}
      <View style={[styles.customNavBar, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleCol}>
          <Text style={styles.navBarTitle}>Customer Service PAMILO 🛡️</Text>
          <Text style={styles.navBarSubtitle}>Bantuan, Aduan & Verifikasi Akun Warga</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerLoad}>
          <ActivityIndicator size="large" color="#4A3420" />
          <Text style={styles.loadText}>Membuka Saluran Bantuan Terenkripsi...</Text>
        </View>
      ) : (
        <View style={styles.chatArea}>
          {messages.length === 0 ? (
            <View style={styles.emptyChatContainer}>
              <Ionicons name="headset-outline" size={54} color="#C0A995" />
              <Text style={styles.emptyTitle}>Saluran Siaga 24 Jam</Text>
              <Text style={styles.emptySub}>Admin PAMILO siap membantu Anda. Silakan kirimkan keluhan atau bukti foto transaksi Anda.</Text>
            </View>
          ) : (
            <FlatList
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessageBubble}
              inverted={true} // Membuat chat terbaru ada di bawah
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* INPUT BAR */}
          <View style={[styles.inputBarRow, { paddingBottom: insets.bottom + 10 }]}>
            <TouchableOpacity style={styles.btnAttachMedia} onPress={handlePickAndSendImage} disabled={sending}>
              <Ionicons name="camera-outline" size={22} color="#4A3420" />
            </TouchableOpacity>

            <TextInput
              style={styles.chatInputField}
              placeholder="Ketik keluhan Anda..."
              placeholderTextColor="#A1887F"
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            
            <TouchableOpacity style={[styles.btnSendExecute, !inputText.trim() && styles.btnSendDisabled]} onPress={handleSendMessage} disabled={!inputText.trim() || sending}>
              {sending ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="send" size={16} color="#FFF" style={{ marginLeft: 3 }} />}
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
  bubbleRowCs: { justifyContent: 'flex-start' },
  bubbleCard: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, elevation: 1 },
  cardImagePadding: { padding: 4, borderRadius: 12 },
  cardMe: { backgroundColor: '#4A3420', borderBottomRightRadius: 2 },
  cardCs: { backgroundColor: '#FFF', borderBottomLeftRadius: 2, borderWidth: 1, borderColor: '#E0D0C0' },
  chatText: { fontSize: 13, lineHeight: 18 },
  textMe: { color: '#FFF' },
  textCs: { color: '#4A3420' },
  timeText: { fontSize: 9, marginTop: 4, marginRight: 4, marginBottom: 2, alignSelf: 'flex-end', fontWeight: '500' },
  timeMe: { color: '#C0A995' },
  timeCs: { color: '#A1887F' },
  chatImageRender: { width: 220, height: 160, borderRadius: 10 },
  inputBarRow: { flexDirection: 'row', paddingHorizontal: 14, paddingTop: 10, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E0D0C0', alignItems: 'center', gap: 10 },
  btnAttachMedia: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FAF6F0', borderWidth: 1, borderColor: '#E0D0C0', justifyContent: 'center', alignItems: 'center' },
  chatInputField: { flex: 1, backgroundColor: '#FAF6F0', borderWidth: 1, borderColor: '#E0D0C0', borderRadius: 20, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, maxHeight: 100, fontSize: 13, color: '#4A3420' },
  btnSendExecute: { backgroundColor: '#E28743', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  btnSendDisabled: { backgroundColor: '#C0A995', elevation: 0 },
  emptyChatContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 15, fontWeight: 'bold', color: '#7A6450', marginTop: 12 },
  emptySub: { fontSize: 12, color: '#A1887F', textAlign: 'center', marginTop: 6, lineHeight: 18 }
});