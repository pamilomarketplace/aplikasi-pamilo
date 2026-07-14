// app/migo/booking.tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions, Alert, Keyboard } from 'react-native'; 
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location'; 
import { useMigo } from '@/features/migo/useMigo';

const { width, height } = Dimensions.get('window');

export default function MigoBookingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { serviceType } = useLocalSearchParams<{ serviceType: 'motor' | 'mobil' }>();
  const finalServiceType = serviceType === 'mobil' ? 'mobil' : 'motor';

  const {
    loading, submitting, activeInput, setActiveInput, pickup, destination, pickupQuery, destinationQuery, suggestions, searchingData,
    distanceKm, tarifMurni, biayaLayanan, totalFare, paymentMethod, setPaymentMethod,
    forceMapCenter, reverseGeocode, searchAddress, selectSuggestion, clearInput, createMigoOrder
  } = useMigo(finalServiceType);

  const mapRef = useRef<MapView | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const mapDraggedRef = useRef<boolean>(false);

  useEffect(() => {
    if (forceMapCenter && mapRef.current && isMapReady) {
      mapDraggedRef.current = false; 
      mapRef.current.animateToRegion({ latitude: forceMapCenter.lat, longitude: forceMapCenter.lng, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 600);
    }
  }, [forceMapCenter, isMapReady]);

  const handleCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Izin Ditolak', 'Mohon izinkan akses lokasi GPS HP Anda.'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      
      mapDraggedRef.current = false; 
      mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 600);
      reverseGeocode(latitude, longitude); 
    } catch (error) { Alert.alert('Gagal', 'Tidak dapat mengambil lokasi GPS.'); }
  };

  const handleBookingSubmit = async () => {
    if (!pickup || !destination) {
       Alert.alert('Gagal', 'Tentukan lokasi jemput dan tujuan terlebih dahulu.');
       return;
    }
    const hasil = await createMigoOrder();
    if (hasil.success && hasil.orderId) {
      // Memberi jeda 100 milidetik agar memori HP siap memuat Peta baru di layar Tracking 
      // tanpa membekukan layar Booking
      setTimeout(() => {
        router.replace({ pathname: '/migo/tracking', params: { orderId: hasil.orderId } });
      }, 100);
    } else {
      Alert.alert('Gagal Memesan ❌', hasil.message || 'Gagal memproses pesanan.');
    }
  };

  const formatRupiah = (angka: number) => `Rp ${Number(angka).toLocaleString('id-ID')}`;
  const isPanelOpen = pickup && destination && distanceKm > 0;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef} 
        provider={PROVIDER_DEFAULT} 
        style={styles.map}
        initialRegion={{ latitude: -7.3274, longitude: 108.3553, latitudeDelta: 0.015, longitudeDelta: 0.015 }}
        showsUserLocation={true} 
        showsMyLocationButton={false} 
        onMapReady={() => setIsMapReady(true)}
        
        onPanDrag={() => {
          mapDraggedRef.current = true;
        }}

        onRegionChangeComplete={(region, details) => {
          if (mapDraggedRef.current && details?.isGesture) {
             reverseGeocode(region.latitude, region.longitude);
             mapDraggedRef.current = false; 
          }
        }}
      >
        <UrlTile urlTemplate="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" maximumZ={19} flipY={false} />
        
        {pickup && <Marker coordinate={{ latitude: pickup.latitude, longitude: pickup.longitude }} title="Titik Jemput Warga" pinColor="#4CAF50" />}
        {destination && <Marker coordinate={{ latitude: destination.latitude, longitude: destination.longitude }} title="Titik Tujuan Antar" pinColor="#F44336" />}
      </MapView>

      <View style={styles.centerPinContainer} pointerEvents="none">
        <Text style={styles.centerPinIcon}>{activeInput === 'pickup' ? '🟢' : '🔴'}</Text>
        <View style={styles.centerPinShadow} />
      </View>

      <TouchableOpacity style={[styles.myLocationBtn, { bottom: isPanelOpen ? 320 : 40 }]} onPress={handleCurrentLocation}>
        <Ionicons name="locate" size={24} color="#4A3420" />
      </TouchableOpacity>

      <View style={[styles.topPanel, { top: insets.top + 10 }]}>
        <Text style={styles.inputSectionLabel}>Alamat Penjemputan Warga</Text>
        
        {/* PENGHAPUSAN BUG ELEVATION PADA VIEW */}
        <View style={[styles.inputWrapper, activeInput === 'pickup' && styles.activeInputLine]}>
          <Text style={styles.inputMarkerIcon}>🟢</Text>
          <TextInput
            style={styles.textInputBox} 
            placeholder="Geser peta atau ketik lokasi jemput..." 
            placeholderTextColor="#A1887F"
            value={pickupQuery} 
            onChangeText={(text) => searchAddress(text, 'pickup')} 
            onFocus={() => {
              setActiveInput('pickup');
              mapDraggedRef.current = false; 
            }}
          />
          {pickupQuery.length > 0 && (
            <TouchableOpacity onPress={() => clearInput('pickup')} style={styles.clearTextButton}><Text style={styles.clearTextIcon}>✕</Text></TouchableOpacity>
          )}
        </View>

        <Text style={[styles.inputSectionLabel, { marginTop: 12 }]}>Alamat Tujuan Antar</Text>
        
        {/* PENGHAPUSAN BUG ELEVATION PADA VIEW */}
        <View style={[styles.inputWrapper, activeInput === 'destination' && styles.activeInputLine]}>
          <Text style={styles.inputMarkerIcon}>🔴</Text>
          <TextInput
            style={styles.textInputBox} 
            placeholder="Geser peta atau ketik tujuan antar..." 
            placeholderTextColor="#A1887F"
            value={destinationQuery} 
            onChangeText={(text) => searchAddress(text, 'destination')} 
            onFocus={() => { 
              setActiveInput('destination'); 
              mapDraggedRef.current = false; 
            }}
          />
          {destinationQuery.length > 0 && (
            <TouchableOpacity onPress={() => clearInput('destination')} style={styles.clearTextButton}><Text style={styles.clearTextIcon}>✕</Text></TouchableOpacity>
          )}
        </View>

        

        {suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 180 }}>
              {suggestions.map((item, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={[styles.suggestionItem, index < suggestions.length - 1 && styles.suggestionDivider]} 
                  onPress={() => {
                    Keyboard.dismiss(); 
                    selectSuggestion(item, activeInput);
                  }}
                >
                  <Text style={styles.suggestionItemIcon}>📍</Text>
                  <Text style={styles.suggestionItemText} numberOfLines={2}>{item.display_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {isPanelOpen && (
        <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 15 }]}>
          <Text style={styles.bottomSectionLabel}>Pilih Metode Pembayaran</Text>
          <View style={styles.paymentSelectorRow}>
            <TouchableOpacity style={[styles.paymentTab, paymentMethod === 'TUNAI' && styles.paymentTabActive]} onPress={() => setPaymentMethod('TUNAI')}>
              <Ionicons name="cash" size={18} color={paymentMethod === 'TUNAI' ? '#FFF' : '#7A6450'} />
              <Text style={[styles.paymentTabText, paymentMethod === 'TUNAI' && styles.paymentTabTextActive]}>Tunai</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.paymentTab, paymentMethod === 'PAMILO_PAY' && styles.paymentTabActive]} onPress={() => setPaymentMethod('PAMILO_PAY')}>
              <Ionicons name="wallet" size={18} color={paymentMethod === 'PAMILO_PAY' ? '#FFF' : '#7A6450'} />
              <Text style={[styles.paymentTabText, paymentMethod === 'PAMILO_PAY' && styles.paymentTabTextActive]}>PAMILO-Pay</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.bottomSectionLabel}>Rincian Pembayaran</Text>
          <View style={styles.invoiceCard}>
            <View style={styles.invoiceRow}>
              <Text style={styles.invoiceLabelText}>Tarif {finalServiceType === 'mobil' ? '🚗 Migo Car' : '🏍️ Migo Ride'} ({distanceKm} Km)</Text>
              <Text style={styles.invoiceValueText}>{formatRupiah(tarifMurni)}</Text>
            </View>
            <View style={styles.invoiceRow}>
              <Text style={styles.invoiceLabelText}>Biaya Layanan Aplikasi</Text>
              <Text style={styles.invoiceValueText}>{formatRupiah(biayaLayanan)}</Text>
            </View>
            <View style={styles.invoiceDividerLine} />
            <View style={styles.invoiceRow}>
              <Text style={styles.totalLabelText}>Total Pembayaran</Text>
              <Text style={styles.totalValueText}>{formatRupiah(totalFare)}</Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.orderButton, submitting && styles.orderButtonDisabled]} onPress={handleBookingSubmit} disabled={submitting}>
            {submitting ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.orderButtonText}>Pesan Sekarang</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF3F0' },
  map: { width: width, height: height },
  centerPinContainer: { position: 'absolute', top: '50%', left: '50%', marginLeft: -18, marginTop: -36, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  centerPinIcon: { fontSize: 32 },
  centerPinShadow: { width: 8, height: 8, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 4, marginTop: -2 },
  myLocationBtn: { position: 'absolute', right: 20, backgroundColor: '#FFF', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, zIndex: 10 },
  topPanel: { position: 'absolute', left: 20, right: 20, backgroundColor: '#FFF', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#E0D0C0', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 5, zIndex: 10 },
  inputSectionLabel: { fontSize: 11, fontWeight: 'bold', color: '#7A6450', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAF3F0', borderRadius: 10, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: '#FAF3F0' },
  
  // 🚀 FAKTA PENYELESAIAN: 'elevation: 2' DIHAPUS MUTLAK dari sini agar Keyboard tidak pernah terbunuh
  activeInputLine: { borderColor: '#E28743', backgroundColor: '#FFF' },
  
  inputMarkerIcon: { fontSize: 13, marginRight: 8 }, 
  textInputBox: { flex: 1, fontSize: 13, color: '#4A3420', fontWeight: '500', paddingVertical: 0 },
  clearTextButton: { padding: 4, marginLeft: 5 },
  clearTextIcon: { fontSize: 12, color: '#A1887F', fontWeight: 'bold' },
  loadingSuggestionsBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  loadingSuggestionsText: { marginLeft: 8, fontSize: 12, color: '#7A6450', fontWeight: '500' },
  suggestionsContainer: { backgroundColor: '#FFF', marginTop: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E0D0C0', overflow: 'hidden' },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#FFF' },
  suggestionDivider: { borderBottomWidth: 1, borderBottomColor: '#FAF3F0' },
  suggestionItemIcon: { fontSize: 14, marginRight: 10 },
  suggestionItemText: { fontSize: 13, color: '#4A3420', flex: 1, lineHeight: 18 },
  bottomPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingHorizontal: 24, borderWidth: 1, borderColor: '#E0D0C0', elevation: 15, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 6 },
  bottomSectionLabel: { fontSize: 13, fontWeight: 'bold', color: '#4A3420', marginBottom: 10 },
  paymentSelectorRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  paymentTab: { flex: 1, height: 48, backgroundColor: '#FAF3F0', borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E0D0C0', gap: 8 },
  paymentTabActive: { backgroundColor: '#4A3420', borderColor: '#4A3420', elevation: 2 },
  paymentTabText: { fontSize: 14, fontWeight: 'bold', color: '#7A6450' },
  paymentTabTextActive: { color: '#FFF' },
  invoiceCard: { backgroundColor: '#FAF3F0', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#E0D0C0', marginBottom: 20 },
  invoiceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  invoiceLabelText: { fontSize: 12, color: '#7A6450', fontWeight: '500' },
  invoiceValueText: { fontSize: 13, color: '#4A3420', fontWeight: 'bold' },
  invoiceDividerLine: { height: 1, backgroundColor: '#E0D0C0', marginVertical: 10, borderStyle: 'dashed' },
  totalLabelText: { fontSize: 14, fontWeight: 'bold', color: '#4A3420' },
  totalValueText: { fontSize: 18, fontWeight: 'bold', color: '#E28743' },
  orderButton: { backgroundColor: '#4A3420', paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 4, marginBottom: 5 },
  orderButtonDisabled: { backgroundColor: '#A1887F', elevation: 0 },
  orderButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 }
});