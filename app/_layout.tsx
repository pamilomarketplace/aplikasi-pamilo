// app/_layout.tsx
import React, { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { supabase } from '@/utils/supabaseClient';
import { DriverProvider } from '@/context/DriverContext';
import { TokoProvider } from '@/context/TokoContext'; // 🚀 TAMBAHAN: Import Satelit Toko
import { GlobalIncomingPopupRenderer } from '@/components/GlobalIncomingPopupRenderer';
import { TokoIncomingPopupRenderer } from '@/components/TokoIncomingPopupRenderer'; // 🚀 TAMBAHAN: Import Popup Toko

console.log('[PAMILO CORE] ⚡ Berkas app/_layout.tsx berhasil dievaluasi.');

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutNav() {
  const segments = useSegments();
  const router = useRouter();
  
  const [session, setSession] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // 1. Pemantau Sesi Tunggal Supabase Auth
  useEffect(() => {
    console.log('[PAMILO CORE] 📡 Mengaktifkan pemantau tunggal sesi Supabase Auth...');
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      console.log(`[PAMILO CORE] 🔄 Realtime Auth [${_event}]: Sesi aktif =`, !!currentSession);
      setSession(currentSession);
      setIsInitialized(true);
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  // 2. Penghancur Tirai Splash Screen
  useEffect(() => {
    if (isInitialized) {
      console.log('[PAMILO CORE] 🚀 Menghancurkan Splash Screen. Tirai aplikasi dibuka.');
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isInitialized]);

  // 3. 🛡️ Gerbang Aman Auth Guard (Dilengkapi Sensor Rute Root "/")
  useEffect(() => {
    if (!isInitialized || !segments) return;

    const beradaDiDalamLuarAplikasi = segments[0] === 'login' || segments[0] === '(auth)';
    const beradaDiRuteRoot = !segments[0]; 

    const routingDelay = setTimeout(() => {
      if (session) {
        if (beradaDiDalamLuarAplikasi || beradaDiRuteRoot) {
          console.log('[PAMILO CORE] 🗺️ Warga sudah login di rute root/luar, mengarahkan ke Beranda Utama.');
          router.replace('/(tabs)');
        } else {
          console.log('[PAMILO CORE] 🧭 Navigasi aman di dalam aplikasi rute:', segments.join('/'));
        }
      } else {
        if (!beradaDiDalamLuarAplikasi) {
          console.log('[PAMILO CORE] 🔒 Sesi kosong, menyeret warga ke halaman Login.');
          router.replace('/login');
        }
      }
    }, 10);

    return () => clearTimeout(routingDelay);
  }, [session, isInitialized, segments]);

  return (
    <>
      {/* RENDER SLOT HALAMAN AKTIF APLIKASI */}
      <Slot />
      
      {/* 🌟 OVERLAY GLOBAL DRIVER: Jendela Melayang Order Ojek & Kurir Masuk */}
      <GlobalIncomingPopupRenderer />

      {/* 🛍️ OVERLAY GLOBAL PENJUAL: Jendela Melayang Khusus Warga Beli Barang */}
      <TokoIncomingPopupRenderer />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      {/* 🌟 CONTEXT DRIVER PROVIDER: Menjaga Satelit Driver Tetap Hidup */}
      <DriverProvider>
        {/* 🛍️ CONTEXT TOKO PROVIDER: Menjaga Satelit Penjual Tetap Hidup Di Latar Belakang */}
        <TokoProvider>
          <RootLayoutNav />
        </TokoProvider>
      </DriverProvider>
    </SafeAreaProvider>
  );
}