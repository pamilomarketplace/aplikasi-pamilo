// app/features/chat/useChatList.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabaseClient';

export interface ChatRoomThread {
  order_id: string;
  counterpart_id: string;
  counterpart_name: string;
  counterpart_avatar: string | null;
  last_message: string;
  created_at: string;
}

export const useChatList = () => {
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<ChatRoomThread[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchActiveThreads = useCallback(async (currentId: string) => {
    try {
      setLoading(true);

      // 1. Tarik seluruh pesan transaksi yang melibatkan warga ini (OR query)
      const { data: rawChats, error: chatErr } = await supabase
        .from('chat_pengguna')
        .select('*')
        .or(`sender_id.eq.${currentId},receiver_id.eq.${currentId}`)
        .order('created_at', { ascending: false });

      if (chatErr) throw chatErr;
      if (!rawChats || rawChats.length === 0) {
        setThreads([]);
        return;
      }

      // 2. Kelompokkan secara unik berdasarkan kombinasi order_id + lawan bicara (Inbox grouping)
      const uniqueThreadsMap = new Map<string, any>();
      const counterpartIdsSet = new Set<string>();

      rawChats.forEach((chat) => {
        const counterpartId = chat.sender_id === currentId ? chat.receiver_id : chat.sender_id;
        if (!counterpartId || !chat.order_id) return;

        // Key unik gabungan ruang transaksi
        const threadKey = `${chat.order_id}_${counterpartId}`;

        if (!uniqueThreadsMap.has(threadKey)) {
          uniqueThreadsMap.set(threadKey, {
            order_id: chat.order_id,
            counterpart_id: counterpartId,
            last_message: chat.text_message,
            created_at: chat.created_at
          });
          counterpartIdsSet.add(counterpartId);
        }
      });

      const threadListArray = Array.from(uniqueThreadsMap.values());
      const allCounterpartIds = Array.from(counterpartIdsSet);

      if (allCounterpartIds.length === 0) {
        setThreads([]);
        return;
      }

      // 3. Tarik massal profil data (Nama & Avatar) dari tabel users murni
      const { data: profiles, error: profileErr } = await supabase
        .from('users')
        .select('user_id, user_name, user_avatar')
        .in('user_id', allCounterpartIds);

      if (profileErr) throw profileErr;

      // Map profil ke objek pencari kilat
      const profileLookup: Record<string, { name: string; avatar: string | null }> = {};
      profiles?.forEach((p) => {
        profileLookup[p.user_id] = {
          name: p.user_name || 'Warga PAMILO',
          avatar: p.user_avatar
        };
      });

      // 4. Rakit kesatuan data komplit untuk disuplai ke UI
      const finalThreads: ChatRoomThread[] = threadListArray.map((t) => {
        const lookup = profileLookup[t.counterpart_id];
        return {
          order_id: t.order_id,
          counterpart_id: t.counterpart_id,
          counterpart_name: lookup?.name || 'Mitra PAMILO',
          counterpart_avatar: lookup?.avatar || null,
          last_message: t.last_message,
          created_at: t.created_at
        };
      });

      setThreads(finalThreads);
    } catch (err) {
      console.error('[PAMILO CHAT LIST ERROR]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let channel: any = null;

    const initListAndRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setUserId(user.id);
      await fetchActiveThreads(user.id);

      // 🚀 REAL-TIME INBOX: Pipa udara otomatis menyegarkan susunan kotak masuk jika ada chat masuk baru
      channel = supabase
        .channel('realtime-inbox-global')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_pengguna' },
          () => {
            fetchActiveThreads(user.id); // Tarik ulang struktur urutan terbaru secara instan
          }
        )
        .subscribe();
    };

    initListAndRealtime();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchActiveThreads]);

  return {
    loading,
    threads,
    userId,
    refetch: () => userId && fetchActiveThreads(userId)
  };
};