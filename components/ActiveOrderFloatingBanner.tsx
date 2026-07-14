// components/ActiveOrderFloatingBanner.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabaseClient';

const { width } = Dimensions.get('window');

function useActiveOrderReminder() {
  const pathname = usePathname();
  const [activeOrder, setActiveOrder] = useState<{id: string, status: string, type: 'MIGO' | 'PAMILO' | 'SELLER'} | null>(null);

  useEffect(() => {
    let channelGlobalReminder: any;
    
    async function fetchActiveOrders() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Cek Orderan Toko (Sebagai Penjual) - 🚀 FITUR BARU
      const { data: toko } = await supabase.from('toko').select('id_toko').eq('user_id_toko', user.id).maybeSingle();
      if (toko) {
        const { data: pesananToko } = await supabase
          .from('pesanan')
          .select('id, status_pesanan')
          .eq('id_toko', toko.id_toko)
          .in('status_pesanan', ['DIPROSES', 'DIKEMAS', 'SIAP_PICKUP', 'MENUJU_TOKO', 'MENUJU_LOKASI'])
          .order('created_at', { ascending: false })
          .limit(1).maybeSingle();

        if (pesananToko) {
          setActiveOrder({ id: pesananToko.id, status: pesananToko.status_pesanan, type: 'SELLER' });
          return;
        }
      }

      // 2. Cek Orderan Ojek (Sebagai Pembeli / Driver)
      const { data: migo } = await supabase
        .from('migo_orders')
        .select('id, status_order')
        .or(`pembeli_id.eq.${user.id},driver_id.eq.${user.id}`)
        .in('status_order', ['MENCARI_DRIVER', 'MENUJU_LOKASI', 'DIANTAR'])
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle();

      if (migo) {
        setActiveOrder({ id: migo.id, status: migo.status_order, type: 'MIGO' });
        return;
      }

      // 3. Cek Orderan Belanjaan (Sebagai Pembeli)
      const { data: pesanan } = await supabase
        .from('pesanan')
        .select('id, status_pesanan')
        .eq('pembeli_id', user.id)
        .in('status_pesanan', ['DIPROSES', 'DIKEMAS', 'SIAP_PICKUP', 'MENUJU_TOKO', 'MENUJU_LOKASI'])
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle();

      if (pesanan) {
        setActiveOrder({ id: pesanan.id, status: pesanan.status_pesanan, type: 'PAMILO' });
        return;
      }

      setActiveOrder(null);
    }

    fetchActiveOrders();

    const uniqueChannelName = `global_reminder_${Date.now()}`;
    channelGlobalReminder = supabase
      .channel(uniqueChannelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'migo_orders' }, fetchActiveOrders)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pesanan' }, fetchActiveOrders)
      .subscribe();

    return () => { if (channelGlobalReminder) supabase.removeChannel(channelGlobalReminder); };
  }, []);

  const shouldRender = activeOrder && 
    !pathname.includes('/orders/') && 
    !pathname.includes('/migo/tracking') && 
    !pathname.includes('/seller/orders'); // 🛡️ Sembunyikan jika sudah di halaman radar toko

  return { activeOrder, shouldRender };
}

export function ActiveOrderFloatingBanner() {
  const router = useRouter();
  const { activeOrder, shouldRender } = useActiveOrderReminder();

  if (!shouldRender || !activeOrder) return null;

  const isLogistik = activeOrder.type === 'PAMILO';
  const isSeller = activeOrder.type === 'SELLER';

  const handleBukaOrderan = () => {
    if (isSeller) {
      router.push('/seller/orders' as any);
    } else if (isLogistik) {
      router.push({ pathname: '/orders/[id]', params: { id: activeOrder.id } } as any);
    } else {
      router.push({ pathname: '/migo/tracking', params: { orderId: activeOrder.id } } as any);
    }
  };

  return (
    <View style={styles.floatingContainerWrapper}>
      <TouchableOpacity 
        style={[
          styles.bannerBarContainer, 
          isLogistik && { backgroundColor: '#2ECC71' },
          isSeller && { backgroundColor: '#27AE60' } // 🛒 Warna Hijau Toko
        ]}
        onPress={handleBukaOrderan}
      >
        <View style={styles.leftInfoRow}>
          <View style={styles.pulseBadgeDot}>
            <Text style={styles.emojiIcon}>{isSeller ? '🏪' : (isLogistik ? '📦' : '🛵')}</Text>
          </View>
          <View>
            <Text style={styles.titleBannerText}>
              {isSeller ? 'Pesanan Warga di Toko!' : (isLogistik ? 'Pesanan Belanjaan Aktif!' : 'Perjalanan Migo Aktif!')}
            </Text>
            <Text style={styles.subtitleBannerText}>Status: {activeOrder.status.replace('_', ' ')}</Text>
          </View>
        </View>
        <View style={styles.rightActionRow}>
          <Text style={styles.textActionLink}>Buka</Text>
          <Ionicons name="arrow-forward" size={14} color="#FFF" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainerWrapper: { position: 'absolute', bottom: 90, left: 16, right: 16, zIndex: 999999 }, 
  bannerBarContainer: { backgroundColor: '#E28743', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 8 },
  leftInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pulseBadgeDot: { backgroundColor: '#FFF', width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  emojiIcon: { fontSize: 16 },
  titleBannerText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  subtitleBannerText: { color: '#FAF0E6', fontSize: 10, fontWeight: '600', marginTop: 1, textTransform: 'uppercase' },
  rightActionRow: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0, 0, 0, 0.2)', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20 },
  textActionLink: { color: '#FFF', fontSize: 11, fontWeight: 'bold' }
});