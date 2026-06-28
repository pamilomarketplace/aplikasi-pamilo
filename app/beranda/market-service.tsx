// @ts-nocheck
import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';

interface MarketServiceProps {
  // 🎯 SINKRONISASI MUTLAK: Parameter navigasi tetap terkunci aman
  onNavigate: (kategori: 'KULINER' | 'BELANJA' | 'HOME_SERVICE') => void;
}

export default function MarketService({ onNavigate }: MarketServiceProps) {
  return (
    <View style={styles.sectionContainer}>
      {/* JUDUL UTAMA BERANDA */}
      <Text style={styles.sectionTitle}>LAYANAN UTAMA PAMILO</Text>
      
      <View style={styles.gridMenuSection}>
        {/* 🍔 LAYANAN 1: PAMILO FOOD */}
        <TouchableOpacity style={styles.menuItemCard} onPress={() => onNavigate('KULINER')} activeOpacity={0.7}>
          <View style={styles.imageWrapper}>
            <Image 
              source={require('../../assets/images/pamilo_food.png')} 
              style={styles.brandIconImage} 
              resizeMode="contain"
            />
          </View>
          <Text style={styles.menuLabelTitle}>Pamilo Food</Text>
          <Text style={styles.menuSubLabel}>Kuliner & Jajan</Text>
        </TouchableOpacity>

        {/* 🛒 LAYANAN 2: PAMILO MART */}
        <TouchableOpacity style={styles.menuItemCard} onPress={() => onNavigate('BELANJA')} activeOpacity={0.7}>
          <View style={styles.imageWrapper}>
            <Image 
              source={require('../../assets/images/pamilo_market.png')} 
              style={styles.brandIconImage} 
              resizeMode="contain"
            />
          </View>
          <Text style={styles.menuLabelTitle}>Pamilo Mart</Text>
          <Text style={styles.menuSubLabel}>Sembako & UMKM</Text>
        </TouchableOpacity>
        
        {/* 🛠️ LAYANAN 3: PAMILO SERVIS */}
        <TouchableOpacity style={styles.menuItemCard} onPress={() => onNavigate('HOME_SERVICE')} activeOpacity={0.7}>
          <View style={styles.imageWrapper}>
            <Image 
              source={require('../../assets/images/pamilo_servis.png')} 
              style={styles.brandIconImage} 
              resizeMode="contain"
            />
          </View>
          <Text style={styles.menuLabelTitle}>Pamilo Servis</Text>
          <Text style={styles.menuSubLabel}>Jasa & Solusi</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: { marginTop: 22 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#4A3525', letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' },
  gridMenuSection: { 
    flexDirection: 'row', 
    backgroundColor: '#4A3525', 
    borderRadius: 18, // 🟢 Sedikit dilembutkan untuk menyesuaikan ikon besar
    borderWidth: 1, 
    borderColor: '#5D4037', 
    paddingVertical: 18, // 🟢 Ruang atas bawah dilegakan
    paddingHorizontal: 10,
    justifyContent: 'space-between', 
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4
  },
  menuItemCard: { 
    width: '32%', 
    alignItems: 'center',
    paddingHorizontal: 2
  }, 
  imageWrapper: {
    width: 68,     // 🎯 UPGRADE: Diperbesar dari 54 menjadi 68 agar super jelas
    height: 68,    // 🎯 UPGRADE: Diperbesar dari 54 menjadi 68 agar super jelas
    borderRadius: 18, // 🟢 Sudut disesuaikan dengan dimensi baru
    backgroundColor: '#ffffff', 
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10, // Jarak ke teks agak direnggangkan
    borderWidth: 1,
    borderColor: '#5D4037', 
    elevation: 2
  },
  brandIconImage: {
    width: '100%',
    height: '100%'
  },
  menuLabelTitle: { 
    fontSize: 12, // 🟢 Diperbesar dari 11 agar seimbang dengan ikon raksasa
    fontWeight: '800', 
    color: '#ffffff', 
    textAlign: 'center' 
  },
  menuSubLabel: { 
    fontSize: 9, // 🟢 Sedikit ditebalkan dari 8.5
    fontWeight: '600', 
    color: '#FFB74D', 
    textAlign: 'center', 
    marginTop: 2, 
    opacity: 0.95 
  }
});