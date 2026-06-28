// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Switch, 
  StatusBar, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../supabaseConfig';

export default function StatusSistemScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  
  // --- STATE KENDALI UTAMA INFRASTRUKTUR ---
  const [isSystemActive, setIsSystemActive] = useState(true);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);

  // --- 🟢 AMBIL KONFIGURASI GLOBAL (💡 KALIBRASI: Sasis Key-Value pengaturan_aplikasi) ---
  const fetchStatusInfrastruktur = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('pengaturan_aplikasi')
        .select('kunci_konfigurasi, nilai_konfigurasi')
        .in('kunci_konfigurasi', ['SYSTEM_ACTIVE', 'MAINTENANCE_MODE']);

      if (error) throw error;

      if (data && data.length > 0) {
        const configMap = new Map(data.map(item => [item.kunci_konfigurasi, item.nilai_konfigurasi]));
        
        setIsSystemActive(configMap.get('SYSTEM_ACTIVE') === 'TRUE');
        setIsMaintenanceMode(configMap.get('MAINTENANCE_MODE') === 'TRUE');
      }
    } catch (err) {
      console.log("Sirkuit settings global menggunakan local fallback, Tuan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusInfrastruktur();
  }, []);

  // --- 🟢 SIMPAN ATURAN DARURAT MASSAL (💡 KALIBRASI: Upsert ke pengaturan_aplikasi) ---
  const handleSimpanStatusGlobal = async () => {
    try {
      setLoading(true);
      
      const payloadDarurat = [
        { kunci_konfigurasi: 'SYSTEM_ACTIVE', nilai_konfigurasi: isSystemActive ? 'TRUE' : 'FALSE' },
        { kunci_konfigurasi: 'MAINTENANCE_MODE', nilai_konfigurasi: isMaintenanceMode ? 'TRUE' : 'FALSE' }
      ];

      // Kunci aturan sistem global massal berdasarkan constraint UNIQUE (kunci_konfigurasi)
      const { error } = await supabase
        .from('pengaturan_aplikasi')
        .upsert(payloadDarurat, { onConflict: 'kunci_konfigurasi' });

      if (error) throw error;

      Alert.alert(
        "Sirkuit Terkunci!",
        isSystemActive 
          ? "Pasar PAMILO resmi dibuka massal! Seluruh warga Ciamis bisa berbelanja kembali."
          : "🚨 EMERGENCY SHUTDOWN AKTIF! Arus transaksi di seluruh aplikasi pembeli berhasil diputus terpusat."
      );
      
      fetchStatusInfrastruktur();
    } catch (err: any) {
      Alert.alert("Gagal Mengunci", `Gagal memperbarui status server darurat: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: true,
          headerTitle: 'Pusat Kontrol Darurat Server',
          headerTintColor: '#fff',
          headerStyle: { backgroundColor: '#1A0F05' },
          headerTitleStyle: { fontWeight: 'bold', fontSize: 13 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 5, marginRight: 15 }}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          ),
        }} 
      />
      <StatusBar barStyle="light-content" backgroundColor="#1A0F05" />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4A3525" />
          <Text style={styles.loadingText}>Sinkronisasi gardu induk sistem...</Text>
        </View>
      ) : (
        <View style={styles.content}>
          
          <View style={styles.warningBanner}>
            <FontAwesome5 name="exclamation-triangle" size={14} color="#C62828" />
            <Text style={styles.warningText}>
              Otoritas penuh Tuan Septian. Perubahan di halaman ini berdampak langsung pada seluruh ekosistem pembeli, pedagang, dan kurir secara massal.
            </Text>
          </View>

          {/* SAKELAR 1: OPERASIONAL PASAR */}
          <View style={[styles.controlCard, isSystemActive ? styles.cardActive : styles.cardInactive]}>
            <View style={styles.cardLeft}>
              <View style={[styles.iconBox, { backgroundColor: isSystemActive ? '#E8F5E9' : '#FFEBEE' }]}>
                <Ionicons name="power" size={18} color={isSystemActive ? '#2E7D32' : '#C62828'} />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.titleText}>Status Operasional Pasar</Text>
                <Text style={styles.subText}>
                  {isSystemActive ? 'Seluruh fitur transaksi warga aktif 24 jam.' : 'Matikan semua proses checkout pembeli.'}
                </Text>
              </View>
            </View>
            <Switch 
              trackColor={{ false: '#BCAAA4', true: '#A5D6A7' }}
              thumbColor={isSystemActive ? '#2E7D32' : '#757575'}
              value={isSystemActive}
              onValueChange={(val) => setIsSystemActive(val)}
            />
          </View>

          {/* SAKELAR 2: MAINTENANCE MODE OVERRIDE */}
          <View style={[styles.controlCard, isMaintenanceMode ? styles.cardMaint : styles.cardNormal]}>
            <View style={styles.cardLeft}>
              <View style={[styles.iconBox, { backgroundColor: isMaintenanceMode ? '#FFF8E1' : '#F5F5F5' }]}>
                <FontAwesome5 name="tools" size={13} color={isMaintenanceMode ? '#F57F17' : '#616161'} />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.titleText}>Mode Perbaikan (Maintenance)</Text>
                <Text style={styles.subText}>
                  {isMaintenanceMode ? 'Tampilkan layar perbaikan sistem di HP warga.' : 'Server berjalan normal di awan cloud.'}
                </Text>
              </View>
            </View>
            <Switch 
              trackColor={{ false: '#BCAAA4', true: '#FFE082' }}
              thumbColor={isMaintenanceMode ? '#F57F17' : '#757575'}
              value={isMaintenanceMode}
              onValueChange={(val) => setIsMaintenanceMode(val)}
            />
          </View>

          {/* TOMBOL LOCK CONFIGURATION MASSAL */}
          <TouchableOpacity style={styles.btnLock} onPress={handleSimpanStatusGlobal}>
            <FontAwesome5 name="lock" size={11} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.btnLockText}>Terapkan Perubahan Massal</Text>
          </TouchableOpacity>

        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 11, color: '#8D6E63', fontWeight: '500' },
  content: { padding: 16 },
  warningBanner: { flexDirection: 'row', backgroundColor: '#FFEBEE', borderWidth: 1, borderColor: '#FFCDD2', borderRadius: 12, padding: 12, marginBottom: 20, alignItems: 'center' },
  warningText: { flex: 1, marginLeft: 12, fontSize: 11, color: '#C62828', lineHeight: 16, fontWeight: '500' },
  controlCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 14, backgroundColor: '#fff' },
  cardActive: { borderColor: '#C8E6C9' },
  cardInactive: { borderColor: '#FFCDD2' },
  cardMaint: { borderColor: '#FFE082' },
  cardNormal: { borderColor: '#EFEBE9' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 },
  iconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  textContainer: { marginLeft: 12, flex: 1 },
  titleText: { fontSize: 13, fontWeight: 'bold', color: '#1A0F05' },
  subText: { fontSize: 10, color: '#8D6E63', marginTop: 2, lineHeight: 14 },
  btnLock: { backgroundColor: '#1A0F05', flexDirection: 'row', height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginTop: 16, elevation: 1 },
  btnLockText: { color: '#fff', fontSize: 12, fontWeight: 'bold' }
});