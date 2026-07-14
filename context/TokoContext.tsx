// context/TokoContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Vibration } from 'react-native';
import { Audio } from 'expo-av'; 
import { supabase } from '@/utils/supabaseClient';

export interface PesananMasukData {
  id: string;
  total_pembayaran: number;
  metode_pembayaran: string;
  status_pesanan: string;
  pembeli_id: string;
}

interface TokoContextType {
  isToko: boolean;
  tokoId: string | null;
  popupTokoVisible: boolean;
  incomingPesanan: PesananMasukData | null;
  setPopupTokoVisible: (visible: boolean) => void;
  tutupPopupToko: () => void;
}

const TokoContext = createContext<TokoContextType | undefined>(undefined);

export const TokoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isToko, setIsToko] = useState<boolean>(false);
  const [tokoId, setTokoId] = useState<string | null>(null);
  
  const [popupTokoVisible, setPopupTokoVisible] = useState<boolean>(false);
  const [incomingPesanan, setIncomingPesanan] = useState<PesananMasukData | null>(null);
  
  const soundObjectRef = useRef<Audio.Sound | null>(null);

  // 1. Cek apakah user punya Toko
  useEffect(() => {
    const cekToko = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 🚀 FIX: Menggunakan kolom 'user_id_toko' sesuai database Tuan Master!
      const { data: toko } = await supabase
        .from('toko')
        .select('id_toko')
        .eq('user_id_toko', user.id)
        .maybeSingle();

      if (toko) {
        setIsToko(true);
        setTokoId(toko.id_toko);
      }
    };
    cekToko();
  }, []);

  // 2. Nyalakan Satelit Penjual
  useEffect(() => {
    if (!tokoId) return;

    const channelToko = supabase
      .channel(`toko_radar_global_${tokoId}`)
      .on(
        'postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'pesanan', filter: `id_toko=eq.${tokoId}` }, 
        (payload) => {
          console.log('📦 [RADAR TOKO] Pesanan Baru Masuk!', payload.new);
          const pesananBaru = payload.new as PesananMasukData;
          setIncomingPesanan(pesananBaru);
          setPopupTokoVisible(true);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ [SATELIT TOKO] Terhubung untuk Toko ID: ${tokoId}`);
        }
      });

    return () => { supabase.removeChannel(channelToko); };
  }, [tokoId]);

  // 3. Sistem Alarm & Getar
  useEffect(() => {
    let isMounted = true;
    async function nyalakanAlarm() {
      if (popupTokoVisible && incomingPesanan) {
        try {
          Vibration.vibrate([500, 1000, 500, 1000], true);
          await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true });
          const { sound } = await Audio.Sound.createAsync(require('../assets/migo.mp3'), { shouldPlay: true, isLooping: true, volume: 1.0 });
          if (isMounted) soundObjectRef.current = sound;
          else await sound.unloadAsync();
        } catch (e) { console.warn('[ALARM TOKO ERROR]', e); }
      }
    }
    
    async function matikanAlarm() {
      if (!popupTokoVisible) {
        if (soundObjectRef.current) {
          try {
            await soundObjectRef.current.stopAsync();
            await soundObjectRef.current.unloadAsync();
            soundObjectRef.current = null;
          } catch (e) {}
        }
        Vibration.cancel();
      }
    }

    if (popupTokoVisible) nyalakanAlarm();
    else matikanAlarm();

    return () => {
      isMounted = false;
      Vibration.cancel();
      if (soundObjectRef.current) soundObjectRef.current.unloadAsync().catch(() => {});
    };
  }, [popupTokoVisible, incomingPesanan]);

  const tutupPopupToko = () => {
    setPopupTokoVisible(false);
    setIncomingPesanan(null);
  };

  return (
    <TokoContext.Provider value={{ isToko, tokoId, popupTokoVisible, incomingPesanan, setPopupTokoVisible, tutupPopupToko }}>
      {children}
    </TokoContext.Provider>
  );
};

export const useGlobalToko = () => {
  const context = useContext(TokoContext);
  if (!context) throw new Error('useGlobalToko harus dibungkus dalam TokoProvider');
  return context;
};