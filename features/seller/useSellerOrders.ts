// features/seller/useSellerOrders.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { useRouter } from 'expo-router';

export interface CustomAlertState {
  visible: boolean;
  title: string;
  message: string;
  isConfirm?: boolean;
  onConfirm?: () => Promise<void> | void;
}

export const useSellerOrders = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [tokoId, setTokoId] = useState<string | null>(null);

  const [alertState, setAlertState] = useState<CustomAlertState>({ visible: false, title: '', message: '' });
  const [alertLoading, setAlertLoading] = useState<boolean>(false);

  const showAlert = (title: string, message: string, onConfirm?: () => void) => {
    setAlertState({ visible: true, title, message, isConfirm: false, onConfirm });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => Promise<void> | void) => {
    setAlertState({ visible: true, title, message, isConfirm: true, onConfirm });
  };

  const closeAlert = () => setAlertState(prev => ({ ...prev, visible: false }));

  const handleAlertConfirm = async () => {
    if (alertState.onConfirm) {
      setAlertLoading(true);
      try {
        await alertState.onConfirm();
      } finally {
        setAlertLoading(false);
      }
    } else {
      closeAlert();
    }
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return;

    const { data: toko } = await supabase.from('toko').select('id_toko').eq('user_id_toko', auth.user.id).single();
    
    if (toko) {
      setTokoId(toko.id_toko);
      const { data: pesanan } = await supabase
        .from('pesanan')
        .select('*, item_pesanan(*, produk(nama_produk))')
        .eq('id_toko', toko.id_toko)
        .not('status_pesanan', 'in', '("SELESAI", "BATAL")')
        .order('created_at', { ascending: false }); 
        
      if (pesanan) setOrders(pesanan);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();

    if (tokoId) {
      const subscription = supabase
        .channel(`seller_orders_local_${tokoId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pesanan', filter: `id_toko=eq.${tokoId}` }, () => { fetchOrders(); })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pesanan', filter: `id_toko=eq.${tokoId}` }, () => { fetchOrders(); })
        .subscribe();

      return () => { supabase.removeChannel(subscription); };
    }
  }, [fetchOrders, tokoId]);

  const handleTerimaOrderan = async (orderId: string) => {
    showConfirm('Terima Pesanan? 🍳', 'Anda sudah mengecek barangnya dan siap untuk diproses?', async () => {
      try {
        const { error } = await supabase.from('pesanan').update({ status_pesanan: 'DIKEMAS' }).eq('id', orderId);
        if (error) throw error;
        fetchOrders();
        closeAlert();
      } catch (err: any) {
        showAlert('Gagal ❌', err.message);
      }
    });
  };

  // 🚀 FUNGSI BARU: PENJUAL MENOLAK ORDERAN MASUK
  const handleTolakOrderan = async (orderId: string) => {
    showConfirm('Tolak Pesanan? 🛑', 'Apakah Anda yakin ingin menolak pesanan dari warga ini? Pesanan akan langsung dibatalkan.', async () => {
      try {
        const { error } = await supabase.from('pesanan').update({ status_pesanan: 'BATAL' }).eq('id', orderId);
        if (error) throw error;
        fetchOrders();
        closeAlert();
      } catch (err: any) {
        showAlert('Gagal ❌', err.message);
      }
    });
  };

  const handlePanggilKurir = async (orderId: string) => {
    showConfirm('Panggil Kurir? 🛵', 'Barang sudah dibungkus? Satelit akan memanggil armada Migo terdekat sekarang.', async () => {
      try {
        const { error } = await supabase.from('pesanan').update({ status_pesanan: 'SIAP_PICKUP' }).eq('id', orderId);
        if (error) throw error;
        
        const { error: blastError } = await supabase.rpc('panggil_kurir_logistik', { p_pesanan_id: orderId });
        if (blastError) throw blastError;

        fetchOrders();
        closeAlert();
        
        setTimeout(() => {
          showAlert('Kurir Dipanggil! 📡', 'Sinyal berhasil ditembakkan ke armada Migo terdekat. Silakan tunggu kurir datang.');
        }, 500);
      } catch (err: any) {
        showAlert('Gagal ❌', err.message);
      }
    });
  };

  return { 
    loading, orders, router, handleTerimaOrderan, handleTolakOrderan, handlePanggilKurir, refreshData: fetchOrders,
    alertState, alertLoading, handleAlertConfirm, closeAlert 
  };
};