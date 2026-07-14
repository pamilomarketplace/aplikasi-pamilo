// features/orders/useOrderHistory.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabaseClient';

export interface OrderHistoryItem {
  id: string;
  created_at: string;
  total_pembayaran: number;
  status_pesanan: string;
  driver_id: string | null;
  id_toko: string | null;
}

export const useOrderHistory = () => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return;

    const { data, error } = await supabase
      .from('pesanan')
      .select('id, created_at, total_pembayaran, status_pesanan, driver_id, id_toko')
      .eq('pembeli_id', auth.user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOrders(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { loading, orders, refreshHistory: fetchHistory };
};