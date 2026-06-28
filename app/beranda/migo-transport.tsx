// @ts-nocheck
import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Image } from 'react-native';

const { width } = Dimensions.get('window');
const cardWidth = (width - 28 - 10) / 2; // Disesuaikan presisi dengan margin padding beranda baru

interface MigoTransportProps {
  onNavigate: (kategori: 'MOTOR' | 'MOBIL') => void;
}

export default function MigoTransport({ onNavigate }: MigoTransportProps) {
  return (
    <View style={styles.sectionContainer}>
      {/* 🎯 FIX KONTRAS: Judul utama Coklat Espresso */}
      <Text style={styles.sectionTitle}>LAYANAN TRANSPORTASI MIGO</Text>
      
      <View style={styles.rowContainer}>
        {/* 🏍️ LAYANAN 1: MIGO MOTOR */}
        <TouchableOpacity style={styles.cardTransport} onPress={() => onNavigate('MOTOR')} activeOpacity={0.8}>
          <View style={styles.imageWrapper}>
            <Image 
              source={require('../../assets/images/migo_motor.png')} 
              style={styles.brandIconImage} 
              resizeMode="contain"
            />
          </View>
          <View style={styles.textGroup}>
            <Text style={styles.menuLabel}>MIGO Motor</Text>
            <Text style={styles.menuSubLabel}>Antar cepat kilat</Text>
          </View>
        </TouchableOpacity>
        
        {/* 🚗 LAYANAN 2: MIGO MOBIL */}
        <TouchableOpacity style={styles.cardTransport} onPress={() => onNavigate('MOBIL')} activeOpacity={0.8}>
          <View style={styles.imageWrapper}>
            <Image 
              source={require('../../assets/images/migo_mobil.png')} 
              style={styles.brandIconImage} 
              resizeMode="contain"
            />
          </View>
          <View style={styles.textGroup}>
            <Text style={styles.menuLabel}>MIGO Mobil</Text>
            <Text style={styles.menuSubLabel}>Nyaman bebas hujan</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: { marginTop: 18 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#4A3525', letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' },
  rowContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  cardTransport: { 
    width: cardWidth, 
    flexDirection: 'row', 
    backgroundColor: '#4A3525', 
    borderRadius: 16, // 🟢 Dinaikkan dari 14 agar lebih proporsional dengan gambar besar
    padding: 14, // 🟢 Padding dilonggarkan agar gambar besar tidak sesak
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#5D4037', 
    elevation: 3, // 🟢 Shadow dipertegas agar kartu lebih menonjol
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3
  },
  imageWrapper: { 
    width: 58,  // 🎯 UPGRADE: Diperbesar dari 46 ke 58 agar mantap
    height: 58, // 🎯 UPGRADE: Diperbesar dari 46 ke 58 agar mantap
    borderRadius: 14, // 🟢 Radius disesuaikan dengan dimensi baru
    backgroundColor: '#ffffff', 
    overflow: 'hidden',
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#5D4037', 
    elevation: 1
  },
  brandIconImage: {
    width: '100%',
    height: '100%'
  },
  textGroup: { marginLeft: 12, flex: 1 }, // 🟢 Margin kiri diperlebar agar tidak menempel
  menuLabel: { fontSize: 13, fontWeight: '900', color: '#ffffff', letterSpacing: 0.3 }, // 🟢 Font diperbesar jadi 13
  menuSubLabel: { fontSize: 9.5, color: '#FFF3E0', marginTop: 2, fontWeight: '600', opacity: 0.85, lineHeight: 12 } // 🟢 Font deskripsi disesuaikan
});