// @ts-nocheck
import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBehaviorAsync('inset-touch').catch(() => {});
    }
  }, []);

  return (
    // BUNGKUS UTAMANYA MENGGUNAKAN WARNA COKELAT ESPRESSO KHAS PAMILO
    <View style={{ flex: 1, backgroundColor: '#4A3525' }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          
          // 🎯 RESTORASI SASIS TAB BAR: Full Coklat Espresso Mewah
          tabBarStyle: {
            backgroundColor: '#4A3525', 
            borderTopWidth: 1,
            borderTopColor: '#5D4037', // Garis pembatas coklat gelap premium lembut
            height: 60 + insets.bottom, 
            paddingBottom: insets.bottom + 4, 
            paddingTop: 6,
            elevation: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
          },
          
          // 🗑️ Mengizinkan tabBarStyle mengekspos warna asli cokelat secara bersih
          tabBarBackground: undefined,
          
          // 🎯 INTEGRASI WARNA PREMIUM MATCHING
          tabBarActiveTintColor: '#FFB74D',   // 🟢 Emas Jingga Menyala saat Menu Terpilih
          tabBarInactiveTintColor: '#BCAAA4', // 🟢 Coklat Susu Muted saat Menu Tidak Aktif
          
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '700', // Tebal agar mudah dibaca dengan cepat (scannable)
            marginBottom: 4, 
            letterSpacing: 0.3,
          }
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Beranda',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "home" : "home-outline"} size={20} color={color} />
            ),
          }}
        />

        {/* 🌟 HUB INFO GALUH CIAMIS */}
        <Tabs.Screen
          name="info-galuh"
          options={{
            title: 'Info Galuh',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons 
                name={focused ? "information-circle" : "information-circle-outline"} 
                size={22} 
                color={color} 
              />
            ),
          }}
        />

        <Tabs.Screen
          name="pesanan"
          options={{
            title: 'Pesanan',
            headerShown: true,
            headerTitle: 'Riwayat Pesanan Anda',
            headerTintColor: '#fff',
            headerStyle: { backgroundColor: '#4A3525' },
            headerTitleStyle: { fontSize: 14, fontWeight: 'bold' },
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "document-text" : "document-text-outline"} size={20} color={color} />
            ),
          }}
        />

        {/* 🟢 FIXED: MENAMBAHKAN TAB BANTUAN CS SECARA EKSPLISIT AGAR IKONNYA MUNCUL */}
        <Tabs.Screen
          name="chat-cs"
          options={{
            title: 'Bantuan',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={22} color={color} />
            ),
          }}
        />
        
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Akun',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={22} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}