// app/(tabs)/_layout.tsx
import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomGap = insets.bottom > 0 ? insets.bottom : 16;
  const TOTAL_BAR_HEIGHT = 60 + bottomGap;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#E28743',
        tabBarInactiveTintColor: '#C0A995',
        tabBarStyle: {
          height: TOTAL_BAR_HEIGHT,
          backgroundColor: 'transparent',
          borderTopWidth: 1,
          borderTopColor: '#5D4037',
          elevation: 8,
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
        },
        tabBarBackground: () => (
          <View style={{ flex: 1 }}>
            <View style={{ height: 60, backgroundColor: '#4A3420' }} />
            <View style={{ flex: 1, backgroundColor: '#2B1D12' }} />
          </View>
        ),
        tabBarItemStyle: { height: 60, justifyContent: 'center', alignItems: 'center', paddingVertical: 4 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 0 },
      }}
    >
      {/* TAB 1: BERANDA */}
      <Tabs.Screen name="index" options={{ title: 'Beranda', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} /> }} />

      {/* TAB 2: INFO GALUH */}
      <Tabs.Screen name="info-galuh/index" options={{ title: 'Info Galuh', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'information-circle' : 'information-circle-outline'} size={23} color={color} /> }} />

      {/* TAB 3: WALLET UTAMA */}
      <Tabs.Screen
        name="wallet/index"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* 🔐 KUNCI SAKTI: Menyembunyikan Sub-Menu Top Up & Withdraw agar tidak muncul di bar bawah */}
      <Tabs.Screen
        name="wallet/topup"
        options={{
          href: null, // Mengosongkan tautan agar tombol tab tidak digambar oleh sistem
        }}
      />

      <Tabs.Screen
        name="wallet/withdraw"
        options={{
          href: null, // Mengosongkan tautan agar tombol tab tidak digambar oleh sistem
        }}
      />

      {/* TAB 4: AKUN / PROFILE */}
      <Tabs.Screen name="profile/index" options={{ title: 'Akun', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} /> }} />
    </Tabs>
  );
}