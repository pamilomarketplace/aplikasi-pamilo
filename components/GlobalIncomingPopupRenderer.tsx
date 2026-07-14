// components/GlobalIncomingPopupRenderer.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router'; 
import { useGlobalDriver } from '@/context/DriverContext';

const { width } = Dimensions.get('window');

export function GlobalIncomingPopupRenderer() {
  const router = useRouter(); 
  const { popupVisible, incomingOrder, setPopupVisible, acceptOrder, hitungPendapatanBersihMigo } = useGlobalDriver();
  const [isProcessing, setIsProcessing] = useState(false);

  if (!popupVisible || !incomingOrder) return null;

  const isLogistik = incomingOrder.tipe_order === 'PAMILO';

  const handleTerimaTugasGlobal = async () => {
    try {
      setIsProcessing(true);
      
      // 1. Kunci pesanan di Database
      const result = await acceptOrder(incomingOrder.id, incomingOrder.db_table);
      
      if (result.success) {
        setPopupVisible(false); 
        
        // 🚀 FIX: POLISI LALU LINTAS NAVIGASI (Migo vs Logistik)
        if (isLogistik) {
          // Jika paket barang, arahkan ke halaman pelacakan logistik
          router.replace({ pathname: '/orders/[id]', params: { id: incomingOrder.id } } as any);
        } else {
          // Jika ojek, arahkan ke halaman pelacakan Migo (Pastikan nama rute Anda benar)
          router.replace({ pathname: '/migo/tracking', params: { orderId: incomingOrder.id } } as any);
        }
        
      } else {
        Alert.alert('Gagal ❌', result.message);
        setPopupVisible(false);
      }
    } catch (err: any) {
      Alert.alert('Eror Sistem', err.message);
      setPopupVisible(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.absoluteOverlayContainer}>
      <View style={styles.popupCardContainer}>
        {/* HEADER DINAMIS (BUNGLON) */}
        <View style={[styles.typeBadgeHeader, { 
          backgroundColor: isLogistik ? '#2ECC71' : (incomingOrder.tipe_layanan === 'MIGO_CAR' ? '#4A3420' : '#E28743') 
        }]}>
          <Ionicons name={isLogistik ? 'cube' : (incomingOrder.tipe_layanan === 'MIGO_CAR' ? 'car' : 'bicycle')} size={16} color="#FFF" />
          <Text style={styles.textBadgeHeader}>
            {isLogistik ? '📦 LOGISTIK PAMILO' : (incomingOrder.tipe_layanan === 'MIGO_CAR' ? '🚗 MIGO MOBIL' : '🛵 MIGO MOTOR')}
          </Text>
        </View>

        <View style={styles.bodyNotificationDetails}>
          <Text style={styles.alertTitleAnimation}>
            {isLogistik ? 'Ada Orderan Barang Masuk! 🎉' : 'Ada Tawaran Kerja Migo! 🎉'}
          </Text>
          <Text style={styles.distanceValueHighlight}>{incomingOrder.jarak_km} Km Menuju Lokasi</Text>
          
          <View style={styles.routeBoxOutline}>
            <View style={styles.routeRowNode}>
              <Text style={styles.emojiMarker}>🟢</Text>
              <Text style={styles.addressTextNode} numberOfLines={1}>
                {isLogistik ? 'Toko: ' : 'Jemput: '} {incomingOrder.alamat_jemput}
              </Text>
            </View>
            <View style={styles.dashedLineVertical} />
            <View style={styles.routeRowNode}>
              <Text style={styles.emojiMarker}>🔴</Text>
              <Text style={styles.addressTextNode} numberOfLines={1}>Antar: {incomingOrder.alamat_antar}</Text>
            </View>
          </View>

          <View style={styles.feeHighlightContainer}>
            <View>
              <Text style={styles.labelFeeTitle}>PENDAPATAN ONGKIR (BERSIH)</Text>
              <Text style={styles.valueFeeText}>
                Rp {hitungPendapatanBersihMigo(incomingOrder.ongkos_kirim).toLocaleString('id-ID')}
              </Text>
            </View>
            <View style={styles.methodPaymentBadge}>
              <Text style={styles.textMethodPayment}>{incomingOrder.metode_pembayaran.replace('_', ' ')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionButtonGroupRow}>
          <TouchableOpacity style={styles.btnRejectStyle} onPress={() => setPopupVisible(false)} disabled={isProcessing}>
            <Text style={styles.textBtnReject}>Lewatkan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnAcceptStyle} onPress={handleTerimaTugasGlobal} disabled={isProcessing}>
            {isProcessing ? <ActivityIndicator color="#FFF" size="small" /> : (
              <>
                <Text style={styles.textBtnAccept}>Ambil Tugas</Text>
                <Ionicons name="checkmark-circle" size={16} color="#FFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  absoluteOverlayContainer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(74, 52, 32, 0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 99999, padding: 20 },
  popupCardContainer: { width: width - 40, backgroundColor: '#FFF', borderRadius: 24, borderWidth: 1, borderColor: '#E0D0C0', overflow: 'hidden', elevation: 12 },
  typeBadgeHeader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 10 },
  textBadgeHeader: { color: '#FFF', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 },
  bodyNotificationDetails: { padding: 20, alignItems: 'center' },
  alertTitleAnimation: { fontSize: 16, fontWeight: 'bold', color: '#4A3420' },
  distanceValueHighlight: { fontSize: 13, color: '#E28743', fontWeight: 'bold', marginTop: 2 },
  routeBoxOutline: { backgroundColor: '#FAF6F0', width: '100%', borderRadius: 14, padding: 12, marginVertical: 16, borderWidth: 0.5, borderColor: '#E0D0C0' },
  routeRowNode: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emojiMarker: { fontSize: 12 },
  addressTextNode: { fontSize: 12, color: '#4A3420', fontWeight: '500', flex: 1 },
  dashedLineVertical: { width: 1, height: 12, backgroundColor: '#C0A995', marginLeft: 6, marginVertical: 3 },
  feeHighlightContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderTopWidth: 1, borderTopColor: '#FAF6F0', paddingTop: 12 },
  labelFeeTitle: { fontSize: 9, fontWeight: 'bold', color: '#A1887F', letterSpacing: 0.5 },
  valueFeeText: { fontSize: 20, fontWeight: 'bold', color: '#2ECC71', marginTop: 2 },
  methodPaymentBadge: { backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 0.5, borderColor: '#FFB74D' },
  textMethodPayment: { color: '#F57C00', fontSize: 9, fontWeight: 'bold' },
  actionButtonGroupRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#E0D0C0', height: 50 },
  btnRejectStyle: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF6F0' },
  textBtnReject: { color: '#7A6450', fontSize: 13, fontWeight: 'bold' },
  btnAcceptStyle: { flex: 1.3, justifyContent: 'center', alignItems: 'center', backgroundColor: '#4A3420', flexDirection: 'row', gap: 6 },
  textBtnAccept: { color: '#FFF', fontSize: 13, fontWeight: 'bold' }
});