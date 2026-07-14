// features/notifikasi/useNotifikasi.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabaseClient';

export interface Notifikasi {
  id: string; // Akan diisi dari id_notif
  judul: string; // Akan diisi dari judul_notif
  pesan: string; // Akan diisi dari pesan_notif
  tipe: string; // Akan diisi dari tipe_notif
  is_unread: boolean; // Dibalik dari is_read_notif
  created_at: string;
}

export const useNotifikasi = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [notifikasiList, setNotifikasiList] = useState<Notifikasi[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchNotifikasi = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      // 🚀 PERBAIKAN: Memanggil berdasarkan DDL riil Anda (user_id_notif)
      const { data, error } = await supabase
        .from('notifikasi')
        .select('*')
        .eq('user_id_notif', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Menerjemahkan nama kolom database ke variabel UI
      const list: Notifikasi[] = data.map((n: any) => ({
        id: n.id_notif,
        judul: n.judul_notif,
        pesan: n.pesan_notif,
        tipe: n.tipe_notif,
        is_unread: !n.is_read_notif, // Logika dibalik: belum dibaca = false di is_read
        created_at: n.created_at
      }));

      setNotifikasiList(list);
      setUnreadCount(list.filter(n => n.is_unread).length);

    } catch (error) {
      console.error('[Notifikasi Error]', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let channel: any;

    const initNotif = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        await fetchNotifikasi(user.id);

        channel = supabase
          .channel('notif_realtime')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifikasi', filter: `user_id_notif=eq.${user.id}` }, (payload) => {
            const n = payload.new as any;
            const newNotif: Notifikasi = {
              id: n.id_notif,
              judul: n.judul_notif,
              pesan: n.pesan_notif,
              tipe: n.tipe_notif,
              is_unread: !n.is_read_notif,
              created_at: n.created_at
            };
            setNotifikasiList(prev => [newNotif, ...prev]);
            setUnreadCount(prev => prev + 1);
          })
          .subscribe();
      } else {
        setLoading(false);
      }
    };

    initNotif();

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [fetchNotifikasi]);

  const tandaiSudahDibaca = async (idNotif: string) => {
    try {
      setNotifikasiList(prev => prev.map(n => n.id === idNotif ? { ...n, is_unread: false } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      // 🚀 PERBAIKAN: Update kolom sesuai DDL
      await supabase.from('notifikasi').update({ is_read_notif: true }).eq('id_notif', idNotif);
    } catch (err) {
      console.error(err);
    }
  };

  return { loading, notifikasiList, unreadCount, tandaiSudahDibaca, refreshNotif: () => currentUserId && fetchNotifikasi(currentUserId) };
};