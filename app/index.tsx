import React from 'react';
import { StyleSheet, View, ActivityIndicator, Image } from 'react-native';

export default function IndexLanding() {
  // 🟢 KUNCI SUKSES: Biarkan file ini pasif tanpa logic router.
  // Begitu komponen ini naik (mount), Satpam di _layout.tsx akan langsung mendeteksi rute ini (segments kosong)
  // dan otomatis melempar user ke /(tabs) jika login, atau ke /login jika belum sah.
  
  return (
    <View style={styles.container}>
      <Image 
        source={require('../assets/images/new_icon.png')} 
        style={styles.logo} 
        resizeMode="contain" 
      />
      {/* Loading bar dengan warna orange khas PAMILO */}
      <ActivityIndicator size="large" color="#D35400" style={{ marginTop: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // 🎨 Disinkronkan dengan warna latar Splash Screen di app.json Tuan
    backgroundColor: '#E5C9A6', 
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
  },
});