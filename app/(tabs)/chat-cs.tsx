// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard 
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/supabaseConfig'; // Sesuaikan path dengan lokasi supabaseConfig Tuan

export default function ChatCSScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [pesanTeks, setPesanTeks] = useState('');
  const [daftarPesan, setDaftarPesan] = useState<any[]>([]);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // 1️⃣ INISIASI: Cari Tiket yang masih OPEN milik User ini
  useEffect(() => {
    const siapkanRuangObrolan = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        const uid = session.user.id;
        setMyUserId(uid);

        // Cari apakah ada tiket/room chat yang belum ditutup (OPEN)
        const { data: tiketAktif, error: errTiket } = await supabase
          .from('cs_tickets')
          .select('id')
          .eq('user_id', uid)
          .eq('status', 'OPEN')
          .single();

        if (tiketAktif) {
          setTicketId(tiketAktif.id);
          await tarikRiwayatPesan(tiketAktif.id);
        }
      } catch (error) {
        console.log("Ruang obrolan baru akan dibuat saat chat pertama dikirim.");
      } finally {
        setLoadingInitial(false);
      }
    };

    siapkanRuangObrolan();
  }, []);

  // 2️⃣ TARIK DATA PESAN & AKTIFKAN RADAR REAL-TIME
  const tarikRiwayatPesan = async (idTiket: string) => {
    const { data } = await supabase
      .from('cs_messages')
      .select('*')
      .eq('ticket_id', idTiket)
      .order('created_at', { ascending: true });
    
    if (data) setDaftarPesan(data);
  };

  useEffect(() => {
    if (!ticketId) return;

    // Menyalakan Radar Real-Time Supabase khusus untuk Tiket ini
    const channelObrolan = supabase
      .channel(`chat_room_${ticketId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'cs_messages', 
        filter: `ticket_id=eq.${ticketId}` 
      }, (payload) => {
        // Tambahkan pesan baru ke layar secara ajaib
        setDaftarPesan((prev) => [...prev, payload.new]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channelObrolan); };
  }, [ticketId]);

  // 3️⃣ ENGINE KIRIM PESAN KE SERVER
  const handleKirimPesan = async () => {
    if (!pesanTeks.trim() || !myUserId) return;
    setIsSending(true);
    const teksKirim = pesanTeks.trim();
    setPesanTeks(''); // Langsung kosongkan input agar terasa responsif

    try {
      let idTiketSekarang = ticketId;

      // Jika belum punya tiket, Buatkan Tiket Baru!
      if (!idTiketSekarang) {
        const { data: tiketBaru, error: errBuat } = await supabase
          .from('cs_tickets')
          .insert([{ user_id: myUserId, kategori_kendala: 'UMUM', status: 'OPEN', pesan_terakhir: teksKirim }])
          .select()
          .single();
        
        if (errBuat) throw errBuat;
        idTiketSekarang = tiketBaru.id;
        setTicketId(idTiketSekarang);
      } else {
        // Update pesan terakhir di tiket
        await supabase
          .from('cs_tickets')
          .update({ pesan_terakhir: teksKirim, waktu_terakhir: new Date().toISOString() })
          .eq('id', idTiketSekarang);
      }

      // Suntik Pesan ke Database (Tipe Pengirim: USER)
      await supabase.from('cs_messages').insert([{
        ticket_id: idTiketSekarang,
        pengirim_id: myUserId,
        tipe_pengirim: 'USER',
        teks_pesan: teksKirim
      }]);

    } catch (error) {
      console.log("Gagal mengirim pesan:", error);
    } finally {
      setIsSending(false);
    }
  };

  // UI KOMPONEN: BUBBLE CHAT
  const renderItemPesan = ({ item }: { item: any }) => {
    const isMe = item.tipe_pengirim === 'USER';
    const jamFormat = new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={[styles.bubbleContainer, isMe ? styles.bubbleContainerRight : styles.bubbleContainerLeft]}>
        <View style={[styles.bubbleBlock, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
          {!isMe && <Text style={styles.senderLabel}>🎧 Admin PAMILO</Text>}
          <Text style={[styles.messageText, isMe ? { color: '#fff' } : { color: '#1A0F05' }]}>
            {item.teks_pesan}
          </Text>
          <Text style={[styles.timeLabel, isMe ? { color: '#FFD1B3' } : { color: '#A1887F' }]}>
            {jamFormat}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen 
        options={{
          headerTitle: 'Pusat Bantuan CS',
          headerStyle: { backgroundColor: '#4A3525' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 5, marginRight: 15 }}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          )
        }} 
      />

      {loadingInitial ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#D35400" />
          <Text style={styles.loadingText}>Menghubungkan ke Pusat...</Text>
        </View>
      ) : (
        <>
          {daftarPesan.length === 0 ? (
            <View style={styles.centerBox}>
              <Ionicons name="chatbubbles-outline" size={60} color="#D7CCC8" />
              <Text style={styles.emptyTitle}>Layanan Terpadu PAMILO</Text>
              <Text style={styles.emptyDesc}>
                Sampaikan kendala, pertanyaan, atau laporan Anda di sini. Admin kami akan segera membalasnya.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={daftarPesan}
              keyExtractor={(item, index) => item.id || index.toString()}
              renderItem={renderItemPesan}
              contentContainerStyle={styles.listContent}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />
          )}

          {/* AREA INPUT CHAT */}
          <View style={[styles.inputArea, { paddingBottom: insets.bottom + 10 }]}>
            <TextInput
              style={styles.inputField}
              placeholder="Ketik keluhan atau pesan Anda..."
              placeholderTextColor="#A1887F"
              value={pesanTeks}
              onChangeText={setPesanTeks}
              multiline
            />
            <TouchableOpacity 
              style={[styles.btnKirim, (!pesanTeks.trim() || isSending) && { backgroundColor: '#BCAAA4' }]} 
              onPress={handleKirimPesan}
              disabled={!pesanTeks.trim() || isSending}
            >
              <Ionicons name="send" size={18} color="#fff" style={{ marginLeft: 3 }} />
            </TouchableOpacity>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5' },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  loadingText: { marginTop: 10, fontSize: 13, color: '#8D6E63', fontWeight: 'bold' },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#4A3525', marginTop: 10 },
  emptyDesc: { fontSize: 13, color: '#8D6E63', textAlign: 'center', marginTop: 5, lineHeight: 20 },
  
  listContent: { padding: 15, paddingBottom: 20 },
  bubbleContainer: { width: '100%', marginVertical: 6, flexDirection: 'row' },
  bubbleContainerRight: { justifyContent: 'flex-end' },
  bubbleContainerLeft: { justifyContent: 'flex-start' },
  
  bubbleBlock: { maxWidth: '80%', padding: 12, borderRadius: 16 },
  bubbleRight: { backgroundColor: '#D35400', borderBottomRightRadius: 4 }, // Warna Oranye Pamilo utk User
  bubbleLeft: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#EFEBE9' }, // Putih utk Admin
  
  senderLabel: { fontSize: 10, fontWeight: 'bold', color: '#0288D1', marginBottom: 4 },
  messageText: { fontSize: 14, lineHeight: 20 },
  timeLabel: { fontSize: 9, alignSelf: 'flex-end', marginTop: 6, fontWeight: '500' },
  
  inputArea: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#EFEBE9' },
  inputField: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 20, minHeight: 44, maxHeight: 100, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 14, color: '#1A0F05' },
  btnKirim: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4A3525', justifyContent: 'center', alignItems: 'center', marginLeft: 10, marginBottom: 2, elevation: 2 }
});