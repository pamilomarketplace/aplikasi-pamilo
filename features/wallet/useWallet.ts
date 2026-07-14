// features/wallet/useWallet.ts
import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/utils/supabaseClient';

export const useWallet = () => {
  const [saldo, setSaldo] = useState<number>(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWalletData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.id) {
        throw new Error('Sesi masuk tidak ditemukan. Silakan autentikasi kembali.');
      }

      const currentUserId = session.user.id;

      // 1. Tarik Saldo Utama dari Tabel Users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('saldo')
        .eq('user_id', currentUserId);

      if (userError) throw userError;
      
      if (userData && userData.length > 0) {
        setSaldo(Number(userData[0].saldo) || 0);
      } else {
        setSaldo(0); 
      }

      // 2. Tarik Riwayat Mutasi (🚀 FAKTA SOLUSI: Batasi hanya 15 data terbaru untuk meringankan Server)
      const { data: transData, error: transError } = await supabase
        .from('transaksi_saldo')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(15); // <--- KUNCI PENGAMAN MEMORI & SERVER

      if (transError) throw transError;
      setTransactions(transData || []);

    } catch (err: any) {
      console.error('[PAMILO WALLET ERROR]', err.message);
      setError(err.message || 'Gagal memuat data dompet');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      if (isMounted) loadWalletData();
      return () => { isMounted = false; };
    }, [])
  );

  useEffect(() => {
    let isMounted = true;
    let realtimeChannel: any = null;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id && isMounted) {
        const uniqueChannel = `wallet_sync_${session.user.id}_${Date.now()}`;
        
        realtimeChannel = supabase
          .channel(uniqueChannel)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'transaksi_saldo', filter: `user_id=eq.${session.user.id}` },
            () => {
              if (isMounted) loadWalletData();
            }
          )
          .subscribe();
      }
    });

    return () => {
      isMounted = false;
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    };
  }, []);

  return { saldo, transactions, loading, error, refetch: loadWalletData };
};