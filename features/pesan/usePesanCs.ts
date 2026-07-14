// features/pesan/usePesanCs.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabaseClient';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export interface PesanCs {
  id: string;
  ticket_id: string | null;
  pengirim_id: string;
  tipe_pengirim: 'USER' | 'CS';
  teks_pesan: string;
  is_read: boolean;
  tipe_pesan: 'TEXT' | 'IMAGE';
  media_url: string | null;
  created_at: string;
}

export const usePesanCs = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);
  const [messages, setMessages] = useState<PesanCs[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchMessages = useCallback(async (userId: string) => {
    try {
      // Catatan Arsitektur: Idealnya pesan diambil berdasarkan 'ticket_id'.
      // Namun untuk saat ini kita ambil semua pesan dimana pengirim_id adalah user ini
      // agar UI bisa langsung berjalan.
      const { data, error } = await supabase
        .from('pesan_cs')
        .select('*')
        .eq('pengirim_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages(data as PesanCs[]);
    } catch (error) {
      console.error('[Pesan CS Error]', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let channel: any;

    const initializeChat = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        await fetchMessages(user.id);

        channel = supabase
          .channel('pesan_cs_realtime')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pesan_cs', filter: `pengirim_id=eq.${user.id}` }, (payload) => {
            setMessages((prev) => [payload.new as PesanCs, ...prev]);
          })
          .subscribe();
      } else {
        setLoading(false);
      }
    };

    initializeChat();

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [fetchMessages]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !currentUserId) return;

    setSending(true);
    const pesanTeks = inputText.trim();
    setInputText(''); 

    try {
      const { error } = await supabase.from('pesan_cs').insert({
        pengirim_id: currentUserId, // 🚀 PERBAIKAN: Sesuai DDL
        teks_pesan: pesanTeks,
        tipe_pesan: 'TEXT',
        tipe_pengirim: 'USER'
      });
      if (error) throw error;
    } catch (error: any) {
      Alert.alert('Gagal Mengirim', error.message);
      setInputText(pesanTeks); 
    } finally {
      setSending(false);
    }
  };

  const handlePickAndSendImage = async () => {
    if (!currentUserId) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Izin Ditolak', 'Dibutuhkan izin akses galeri untuk mengirim foto.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0].uri) {
      setSending(true);
      try {
        const photoUri = result.assets[0].uri;
        const fileExt = photoUri.split('.').pop();
        const fileName = `${currentUserId}_${Date.now()}.${fileExt}`;
        const formData = new FormData();
        
        formData.append('file', { uri: photoUri, name: fileName, type: `image/${fileExt}` } as any);

        const { error: uploadErr } = await supabase.storage.from('chat_media').upload(fileName, formData);
        if (uploadErr) throw uploadErr;

        const { data: publicUrlData } = supabase.storage.from('chat_media').getPublicUrl(fileName);

        const { error: insertErr } = await supabase.from('pesan_cs').insert({
          pengirim_id: currentUserId,
          media_url: publicUrlData.publicUrl,
          teks_pesan: '[Gambar Terkirim]', // teks wajib (not null di DDL)
          tipe_pesan: 'IMAGE',
          tipe_pengirim: 'USER'
        });

        if (insertErr) throw insertErr;
      } catch (error: any) {
        Alert.alert('Gagal Mengirim Foto', error.message);
      } finally {
        setSending(false);
      }
    }
  };

  return { loading, sending, messages, inputText, setInputText, handleSendMessage, handlePickAndSendImage };
};