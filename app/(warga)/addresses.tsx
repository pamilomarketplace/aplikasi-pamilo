// @ts-nocheck
import React, { useEffect, useState, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator, 
  Alert, 
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Keyboard,
  DeviceEventEmitter
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 🗺️ PETA NATIVE ENGINE
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

// BACKEND KONEKTOR
import { supabase } from '@/supabaseConfig';

const { width } = Dimensions.get('window');

interface AlamatWarga {
  id_alamat: string; 
  label_alamat: string;
  alamat_lengkap: string;
  latitude_alamat: number;
  longitude_alamat: number;
  is_utama: boolean; 
}

export default function AddressesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode, event_name } = useLocalSearchParams(); 

  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [alamatList, setAlamatList] = useState<AlamatWarga[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mapReady, setMapReady] = useState(false); 
  const [searchingLocation, setSearchingLocation] = useState(false);

  // Form States
  const [searchQuery, setSearchQuery] = useState('');
  const [label, setLabel] = useState('');
  const [alamatTeks, setAlamatTeks] = useState('');
  const [koordinatForm, setKoordinatForm] = useState({ latitude: -7.3262, longitude: 108.3532 });
  
  // State Kamera Wilayah Peta Baku Ciamis Alun-Alun
  const [petaRegion, setPetaRegion] = useState({
    latitude: -7.3262,
    longitude: 108.3532,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  // --- 🟢 RADAR 1: AMBIL DATA ---
  const fetchDaftarAlamatWarga = async (uid: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', uid);

      if (error) throw error;
      
      if (data) {
        const sortedData = data.sort((a, b) => {
          const statusA = a.is_utama || false;
          const statusB = b.is_utama || false;
          return statusB ? 1 : -1;
        });

        const formattedData: AlamatWarga[] = sortedData.map(item => ({
          id_alamat: String(item.id || item.id_alamat),
          label_alamat: item.label_alamat || 'Alamat',
          alamat_lengkap: item.alamat_lengkap || 'Detail Alamat',
          latitude_alamat: Number(item.latitude || item.latitude_alamat || 0),
          longitude_alamat: Number(item.longitude || item.longitude_alamat || 0),
          is_utama: !!item.is_utama 
        }));

        setAlamatList(formattedData);
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert("Gagal Memuat", "Sirkuit penarik alamat hulu macet.");
    } finally {
      setLoading(false);
    }
  };

  // --- 🟢 RADAR 2: REVERSE GEOCODE ---
  const konversiKoordinatKeTeksAlamat = async (lat: number, lng: number) => {
    try {
      const hasil = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (hasil && hasil.length > 0) {
        const h = hasil[0];
        const jalanSah = `${h.name ? h.name + ', ' : ''}${h.street || ''} Kel. ${h.district || ''}, Kec. ${h.subregion || ''}`.trim();
        setAlamatTeks(jalanSah || `Koordinat (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      }
    } catch (e) {
      setAlamatTeks(`Koordinat Pilihan (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
    }
  };

  // --- 🟢 RADAR 3: FORWARD GEOCODE (Pencarian Alamat) ---
  const handleCariAlamat = async () => {
    if (!searchQuery.trim()) {
      return Alert.alert("Pencarian Kosong", "Masukkan nama jalan atau tempat yang ingin dicari.");
    }

    Keyboard.dismiss();
    setSearchingLocation(true);

    try {
      const queryCiamis = searchQuery.toLowerCase().includes('ciamis') ? searchQuery : `${searchQuery}, Ciamis`;
      const hasilPencarian = await Location.geocodeAsync(queryCiamis);

      if (hasilPencarian && hasilPencarian.length > 0) {
        const lokasiDitemukan = hasilPencarian[0];
        const newCoords = { latitude: lokasiDitemukan.latitude, longitude: lokasiDitemukan.longitude };
        
        setKoordinatForm(newCoords);
        setPetaRegion({
          ...newCoords,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });

        await konversiKoordinatKeTeksAlamat(newCoords.latitude, newCoords.longitude);
      } else {
        Alert.alert("Tidak Ditemukan", "Lokasi tidak ditemukan. Coba gunakan kata kunci yang lebih spesifik.");
      }
    } catch (e) {
      Alert.alert("Eror Pencarian", "Gagal mencari lokasi. Pastikan koneksi internet stabil.");
    } finally {
      setSearchingLocation(false);
    }
  };

  useEffect(() => {
    const inisialisasiSesiAlamat = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUserId(session.user.id);
        await fetchDaftarAlamatWarga(session.user.id);
        
        try {
          let { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            let lokasi = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = lokasi.coords;
            setKoordinatForm({ latitude, longitude });
            setPetaRegion({
              latitude,
              longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
            await konversiKoordinatKeTeksAlamat(latitude, longitude);
          }
        } catch (e) {}
      }
    };
    inisialisasiSesiAlamat();
  }, []);

  // --- 🟢 SIMPAN DATA ---
  const handleSimpanAlamatBaru = async () => {
    if (!label.trim() || !alamatTeks.trim()) {
      return Alert.alert("Data Kosong", "Mohon isi nama label (misal: Rumah) dan alamat lengkap.");
    }

    try {
      setSubmitting(true);
      const isAlamatPerdana = alamatList.length === 0;

      const { error } = await supabase
        .from('user_addresses')
        .insert([
          {
            user_id: currentUserId,
            label_alamat: label.trim(),
            alamat_lengkap: alamatTeks.trim(),
            latitude: koordinatForm.latitude, 
            longitude: koordinatForm.longitude, 
            is_utama: isAlamatPerdana
          }
        ]);

      if (error) throw error;

      Alert.alert("Sukses 🎉", "Sasis koordinat alamat pengiriman baru Anda berhasil dikunci!");
      setLabel('');
      setSearchQuery(''); 
      await fetchDaftarAlamatWarga(currentUserId);
    } catch (err: any) {
      Alert.alert("Gagal Menyimpan", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- 🟢 HAPUS DATA ---
  const handleHapusAlamat = async (idAlamat: string) => {
    try {
      const { error } = await supabase
        .from('user_addresses')
        .delete()
        .eq('id', idAlamat);
        
      if (error) {
        const idAngka = parseInt(idAlamat);
        if (!isNaN(idAngka)) {
          await supabase.from('user_addresses').delete().eq('id', idAngka);
        } else {
          throw error;
        }
      }
      
      await fetchDaftarAlamatWarga(currentUserId);
    } catch (err: any) {
      Alert.alert("Gagal Dihapus", err.message);
    }
  };

  // 🟢 FUNGSI PILIH ALAMAT TERISOLASI
  const handlePilihAlamat = (item: AlamatWarga) => {
    if (mode === 'select') {
      DeviceEventEmitter.emit(event_name || 'ALAMAT_WARGA_DIPILIH', item);
      router.back();
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.mainContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerTitle: mode === 'select' ? 'Pilih Alamat Tujuan' : 'Alamat Pengiriman Belanja', headerStyle: { backgroundColor: '#4A3525' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: 'bold', fontSize: 13 } }} />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />

      {/* PETA PENENTUAN PIN POINT */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.mapStyle}
          region={petaRegion}
          showsUserLocation={true}
          onMapReady={() => setMapReady(true)}
          onRegionChangeComplete={(reg) => {
            if (mapReady) {
              setKoordinatForm({ latitude: reg.latitude, longitude: reg.longitude });
            }
          }}
          onPress={async (e) => {
            const coords = e.nativeEvent.coordinate;
            setKoordinatForm(coords);
            await konversiKoordinatKeTeksAlamat(coords.latitude, coords.longitude);
          }}
        >
          <Marker 
            draggable 
            coordinate={koordinatForm} 
            onDragEnd={async (e) => {
              const targetCoords = e.nativeEvent.coordinate;
              setKoordinatForm(targetCoords);
              await konversiKoordinatKeTeksAlamat(targetCoords.latitude, targetCoords.longitude);
            }}
            title="Lokasi Pengiriman Paket"
          />
        </MapView>
        <View style={styles.mapTipBadge}>
          <Text style={styles.tipText}>💡 Tips: Geser pin atau ketuk peta untuk memindahkan lokasi</Text>
        </View>
      </View>

      {/* PANEL INPUT FORM ALAMAT */}
      <View style={styles.formPanel}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.inputSearch}
            placeholder="Cari lokasi di peta (mis. Alun-Alun)..."
            placeholderTextColor="#BCAAA4"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={handleCariAlamat}
          />
          <TouchableOpacity 
            style={styles.btnSearchMap} 
            onPress={handleCariAlamat}
            disabled={searchingLocation}
          >
            {searchingLocation ? (
               <ActivityIndicator size="small" color="#fff" />
            ) : (
               <Ionicons name="search" size={16} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        <TextInput 
          style={styles.inputLabel}
          placeholder="Nama Alamat (Contoh: Rumah Saya, Kantor, Kostan)"
          placeholderTextColor="#BCAAA4"
          value={label}
          onChangeText={setLabel}
        />
        <TextInput 
          style={[styles.inputLabel, styles.inputAlamatDetail]}
          placeholder="Alamat Lengkap Rumah (RT/RW, No Rumah, Patokan...)"
          placeholderTextColor="#BCAAA4"
          multiline
          numberOfLines={2}
          value={alamatTeks}
          onChangeText={setAlamatTeks}
        />
        <TouchableOpacity style={styles.btnSimpan} onPress={handleSimpanAlamatBaru} disabled={submitting}>
          {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnText}>Simpan Alamat Baru</Text>}
        </TouchableOpacity>
      </View>

      {/* LIST DAFTAR ALAMAT TERSIMPAN */}
      <Text style={styles.listTitle}>{mode === 'select' ? 'PILIH DARI ALAMAT TERSIMPAN' : 'DAFTAR ALAMAT TERSIMPAN'}</Text>
      {loading ? (
        <ActivityIndicator size="small" color="#4A3525" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={alamatList}
          keyExtractor={(item, index) => `${item.id_alamat}-${index}`}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 10 }}
          renderItem={({ item }) => (
            <TouchableOpacity 
              activeOpacity={mode === 'select' ? 0.7 : 1}
              onPress={() => handlePilihAlamat(item)}
              style={[styles.addressCard, item.is_utama ? styles.cardUtamaBorder : null, mode === 'select' && styles.cardSelectable]}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <View style={styles.labelRow}>
                  <Text style={styles.cardLabelText}>{item.label_alamat}</Text>
                  {item.is_utama && <View style={styles.badgeUtama}><Text style={styles.badgeText}>Utama</Text></View>}
                </View>
                <Text style={styles.cardDetailText} numberOfLines={2}>{item.alamat_lengkap}</Text>
              </View>
              {mode === 'select' ? (
                <Ionicons name="chevron-forward-circle" size={24} color="#D35400" />
              ) : (
                <TouchableOpacity onPress={() => handleHapusAlamat(item.id_alamat)} style={{ padding: 4 }}>
                  <Ionicons name="trash-outline" size={16} color="#C0392B" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FDFCFB' },
  mapContainer: { height: 180, width: '100%', position: 'relative' },
  mapStyle: { flex: 1 },
  mapTipBadge: { position: 'absolute', bottom: 8, left: 12, right: 12, backgroundColor: 'rgba(74, 53, 37, 0.9)', padding: 6, borderRadius: 6 },
  tipText: { color: '#FFE082', fontSize: 10, textAlign: 'center', fontWeight: '500' },
  formPanel: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#EFEBE9' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#EFEBE9', borderRadius: 10, backgroundColor: '#FDFCFB', overflow: 'hidden' },
  inputSearch: { flex: 1, paddingHorizontal: 12, height: 40, fontSize: 12, color: '#4A3525' },
  btnSearchMap: { backgroundColor: '#4A3525', height: 40, width: 45, justifyContent: 'center', alignItems: 'center' },
  inputLabel: { backgroundColor: '#FDFCFB', borderWidth: 1, borderColor: '#EFEBE9', borderRadius: 10, paddingHorizontal: 12, height: 40, fontSize: 12, color: '#4A3525', marginBottom: 10, fontWeight: '500' },
  inputAlamatDetail: { height: 60, paddingTop: 8, textAlignVertical: 'top' },
  btnSimpan: { backgroundColor: '#4A3525', height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 4, elevation: 1 },
  btnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  listTitle: { fontSize: 10, fontWeight: 'bold', color: '#8D6E63', marginHorizontal: 20, marginTop: 16, marginBottom: 8, letterSpacing: 1 },
  addressCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#EFEBE9', marginBottom: 10, elevation: 0.5 },
  cardUtamaBorder: { borderColor: '#4A3525', backgroundColor: '#FAF8F5' },
  cardSelectable: { borderStyle: 'dashed', borderColor: '#D35400', borderWidth: 1.5, backgroundColor: '#FFF8F4' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardLabelText: { fontSize: 13, fontWeight: 'bold', color: '#4A3525' },
  badgeUtama: { backgroundColor: '#4A3525', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { color: '#FFE082', fontSize: 8, fontWeight: 'bold' },
  cardDetailText: { fontSize: 11, color: '#8D6E63', lineHeight: 16 }
});