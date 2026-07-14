// app/features/chat/useChatPengguna.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/utils/supabaseClient';
import * as ImagePicker from 'expo-image-picker';

export interface ChatMessage {
  id: string;
  order_id: string | null;
  sender_id: string;
  receiver_id: string | null;
  text_message: string;
  tipe_pesan: string;
  media_url: string | null;
  created_at: string;
}

interface UseChatPenggunaProps {
  orderId: string;
  receiverId: string;
}

// FUNGSI DECODER MANDIRI: Mengonversi Base64 menjadi ArrayBuffer murni tanpa bug jaringan OS
function decodeBase64ToBuffer(base64String: string): ArrayBuffer {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }
  
  let bufferLength = base64String.length * 0.75;
  const len = base64String.length;
  let p = 0;
  let encoded1, encoded2, encoded3, encoded4;

  if (base64String[base64String.length - 1] === '=') {
    bufferLength--;
    if (base64String[base64String.length - 2] === '=') {
      bufferLength--;
    }
  }

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const bytes = new Uint8Array(arrayBuffer);

  for (let i = 0; i < len; i += 4) {
    encoded1 = lookup[base64String.charCodeAt(i)];
    encoded2 = lookup[base64String.charCodeAt(i + 1)];
    encoded3 = lookup[base64String.charCodeAt(i + 2)];
    encoded4 = lookup[base64String.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
  }

  return arrayBuffer;
}

export const useChatPengguna = ({ orderId, receiverId }: UseChatPenggunaProps) => {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  
  const currentUserId = useRef<string | null>(null);

  // LOGIKA 1: MENARIK RIWAYAT CHAT BERDASARKAN ORDER TRANSAKSI
  const fetchChatHistory = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('chat_pengguna')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setMessages(data as ChatMessage[]);
    } catch (err: any) {
      Alert.alert('Gagal Memuat Chat', err.message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    const initChat = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        currentUserId.current = user.id;
        await fetchChatHistory();
      }
    };
    initChat();
  }, [fetchChatHistory]);

  // LOGIKA 2: PIPA UTARA REAL-TIME SUBSCRIPTION CHAT TRANSAKSI
  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`realtime-order-chat-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_pengguna',
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          setMessages((prev) => [newMessage, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  // LOGIKA 3: FUNGSI TRANSMISI KIRIM CHAT TEKS
  const handleSendMessage = async () => {
    if (!inputText.trim() || !currentUserId.current || !receiverId) return;

    const pesanKirim = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const { error } = await supabase.from('chat_pengguna').insert({
        order_id: orderId,
        sender_id: currentUserId.current,
        receiver_id: receiverId,
        text_message: pesanKirim,
        tipe_pesan: 'TEXT',
        media_url: null
      });

      if (error) throw error;
    } catch (err: any) {
      Alert.alert('Gagal Mengirim', err.message);
    } finally {
      setSending(false);
    }
  };

  // 🚀 LOGIKA BARU 4: TRANSMISI UNGGRAH FOTO BUKTI KURIR / MITRA (INSTAN & AMAN TS)
  const handlePickAndSendImage = async () => {
    if (!orderId || !receiverId || !currentUserId.current) return;

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin Ditolak', 'Aplikasi memerlukan akses galeri untuk mengirim lampiran foto.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Perilaku instan anti-bingung tombol potong murni
        quality: 0.3, // Kompresi tinggi penyelemat brankas storage Supabase
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const assetTarget = result.assets[0];
      const base64DataString = assetTarget.base64;

      if (!base64DataString) {
        Alert.alert('Gagal', 'Sistem biner ponsel gagal membaca gambar.');
        return;
      }

      setSending(true);

      const rawBuffer = decodeBase64ToBuffer(base64DataString);
      const fileExt = assetTarget.uri.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;
      const storagePath = `transactions/${orderId}/${fileName}`;

      // 1. Masukkan berkas ke bucket pamilo-chat
      const { error: uploadError } = await supabase.storage
        .from('pamilo-chat')
        .upload(storagePath, rawBuffer, {
          contentType: `image/${fileExt}`,
          cacheControl: '3600'
        });

      if (uploadError) throw uploadError;

      // 2. Tarik link publikasi gambar
      const { data: linkData } = supabase.storage
        .from('pamilo-chat')
        .getPublicUrl(storagePath);

      const publicUrl = linkData.publicUrl;

      // 3. Masukkan baris pesan bertipe IMAGE ke tabel chat_pengguna
      const { error: dbError } = await supabase.from('chat_pengguna').insert({
        order_id: orderId,
        sender_id: currentUserId.current,
        receiver_id: receiverId,
        text_message: '[Foto Lampiran Transaksi]',
        tipe_pesan: 'IMAGE',
        media_url: publicUrl
      });

      if (dbError) throw dbError;

    } catch (err: any) {
      Alert.alert('Gagal Mengunggah Lampiran', err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setSending(false);
    }
  };

  return {
    loading,
    sending,
    messages,
    inputText,
    setInputText,
    userId: currentUserId.current,
    handleSendMessage,
    handlePickAndSendImage
  };
};