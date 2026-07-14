// features/orders/useOrderTracking.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabaseClient';

export interface OrderTrackingData {
  id: string;
  status_order: 'PENDING' | 'ACCEPTED' | 'PICKED_UP' | 'DELIVERED' | 'CANCELLED';
  total_pembayaran: number;
  metode_pembayaran: string;
  alamat_pengiriman: string;
  catatan_tambahan: string;
  created_at: string;
  nama_merchant?: string;
  nama_kurir?: string;
  plat_nomor_kurir?: string;
}

export const useOrderTracking = (orderId: string) => {
  const [order, setOrder] = useState<OrderTrackingData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchTrackingStatus = async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('id, status_order, total_pembayaran, metode_pembayaran, alamat_pengiriman, catatan_tambahan, created_at')
        .eq('id', orderId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setOrder(data as OrderTrackingData);
      }
    } catch (err: any) {
      console.error('[TRACKING FETCH ERROR]:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackingStatus();

    if (!orderId) return;

    // Pipa Realtime: Mengunci pemantauan status pesanan warga secara instan
    const trackingChannel = supabase
      .channel(`order_tracking_${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', filter: `id=eq.${orderId}`, schema: 'public', table: 'orders' },
        (payload) => {
          setOrder(payload.new as OrderTrackingData);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(trackingChannel);
    };
  }, [orderId]);

  return { order, loading, refresh: fetchTrackingStatus };
};