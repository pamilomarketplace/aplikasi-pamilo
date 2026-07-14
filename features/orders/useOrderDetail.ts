// features/orders/useOrderDetail.ts
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabaseClient';

// 🚀 RUMUS RAHASIA: Menghitung jarak lurus (Km) antara dua titik koordinat
const hitungJarakKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius Bumi dalam Kilometer
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
};

export const useOrderDetail = (orderId: string | undefined) => {
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<any>(null);
  const [tokoData, setTokoData] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // 🚀 STATE BARU: Jarak Pengiriman (Km)
  const [jarakPengiriman, setJarakPengiriman] = useState<number>(0);

  const tarifResmiRef = useRef<number>(0); 

  useEffect(() => {
    if (!orderId) return;

    const fetchDetail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      const { data: config } = await supabase.from('pengaturan_aplikasi').select('nilai_konfigurasi').eq('kunci_konfigurasi', 'BIAYA_LAYANAN_TRANSAKSI').maybeSingle();
      if (config && config.nilai_konfigurasi) tarifResmiRef.current = Number(config.nilai_konfigurasi);

      const { data: pesanan } = await supabase.from('pesanan').select('*').eq('id', orderId).single();
      
      if (pesanan) {
        if (pesanan.pembeli_id) {
          const { data: buyer } = await supabase.from('users').select('user_name, user_phone').eq('user_id', pesanan.pembeli_id).maybeSingle();
          pesanan.pembeli = buyer;
        }

        let dataToko = null;
        if (pesanan.id_toko) {
          const { data: toko } = await supabase.from('toko').select('nama_toko, latitude_toko, longitude_toko').eq('id_toko', pesanan.id_toko).single();
          if (toko) {
            setTokoData(toko);
            dataToko = toko;
          }
        }

        // 🚀 MENGHITUNG JARAK OTOMATIS JIKA ADA KOORDINAT
        if (dataToko && pesanan.latitude_pengiriman && pesanan.longitude_pengiriman) {
          const km = hitungJarakKm(
            Number(dataToko.latitude_toko), Number(dataToko.longitude_toko),
            Number(pesanan.latitude_pengiriman), Number(pesanan.longitude_pengiriman)
          );
          setJarakPengiriman(km);
        }

        let finalPesanan = { ...pesanan };
        finalPesanan.ongkos_kirim = finalPesanan.ongkos_kirim || 0;
        finalPesanan.biaya_layanan = finalPesanan.biaya_layanan ?? tarifResmiRef.current;
        finalPesanan.subtotal_produk = finalPesanan.subtotal_produk || 0;

        if (!finalPesanan.total_pembayaran || isNaN(finalPesanan.total_pembayaran)) {
          finalPesanan.total_pembayaran = finalPesanan.subtotal_produk + finalPesanan.ongkos_kirim + finalPesanan.biaya_layanan;
        }

        setOrderData(finalPesanan);

        const { data: pesananItems } = await supabase.from('item_pesanan').select('*, produk(nama_produk)').eq('pesanan_id', pesanan.id);
        if (pesananItems) setItems(pesananItems);
      }
      setLoading(false);
    };

    fetchDetail();

    const subscription = supabase
      .channel(`order_detail_${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pesanan', filter: `id=eq.${orderId}` }, 
      (payload) => {
        setOrderData((prev: any) => {
          if (!prev) return payload.new;
          const dataBaru = { ...prev, ...payload.new, pembeli: prev.pembeli };
          
          dataBaru.ongkos_kirim = dataBaru.ongkos_kirim || 0;
          dataBaru.biaya_layanan = dataBaru.biaya_layanan ?? tarifResmiRef.current;
          dataBaru.subtotal_produk = dataBaru.subtotal_produk || 0;
          
          if (!dataBaru.total_pembayaran || isNaN(dataBaru.total_pembayaran)) {
            dataBaru.total_pembayaran = dataBaru.subtotal_produk + dataBaru.ongkos_kirim + dataBaru.biaya_layanan;
          }
          return dataBaru;
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, [orderId]);

  return { loading, orderData, tokoData, items, currentUserId, jarakPengiriman };
};