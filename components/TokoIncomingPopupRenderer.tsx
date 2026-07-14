// components/TokoIncomingPopupRenderer.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router'; 
import { useGlobalToko } from '@/context/TokoContext';

const { width } = Dimensions.get('window');

export function TokoIncomingPopupRenderer() {
  const router = useRouter(); 
  const { popupTokoVisible, incomingPesanan, tutupPopupToko } = useGlobalToko();

  if (!popupTokoVisible || !incomingPesanan) return null;

  const handleBukaPesanan = () => {
    tutupPopupToko();
    // Mengarahkan ke halaman seller orders yang ada di gambar (app/seller/orders.tsx)
    router.push('/seller/orders' as any);
  };

  return (
    <View style={styles.absoluteOverlayContainer}>
      <View style={styles.popupCardContainer}>
        <View style={styles.typeBadgeHeader}>
          <Ionicons name="storefront" size={16} color="#FFF" />
          <Text style={styles.textBadgeHeader}>🛍️ PESANAN TOKO MASUK</Text>
        </View>

        <View style={styles.bodyNotificationDetails}>
          <Text style={styles.alertTitleAnimation}>Ada Warga yang Belanja! 🎉</Text>
          <Text style={styles.subtitleText}>Segera konfirmasi agar kurir bisa menjemput.</Text>
          
          <View style={styles.feeHighlightContainer}>
            <View>
              <Text style={styles.labelFeeTitle}>TOTAL NILAI PESANAN</Text>
              <Text style={styles.valueFeeText}>
                Rp {Number(incomingPesanan.total_pembayaran).toLocaleString('id-ID')}
              </Text>
            </View>
            <View style={styles.methodPaymentBadge}>
              <Text style={styles.textMethodPayment}>{incomingPesanan.metode_pembayaran.replace('_', ' ')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionButtonGroupRow}>
          <TouchableOpacity style={styles.btnRejectStyle} onPress={tutupPopupToko}>
            <Text style={styles.textBtnReject}>Tutup Alarm</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnAcceptStyle} onPress={handleBukaPesanan}>
            <Text style={styles.textBtnAccept}>Lihat Pesanan</Text>
            <Ionicons name="arrow-forward-circle" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  absoluteOverlayContainer: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // 🚀 DIUBAH: Menjadi Hitam Transparan Elegan
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 99999, 
    padding: 20 
  },popupCardContainer: { width: width - 40, backgroundColor: '#FFF', borderRadius: 24, borderWidth: 1, borderColor: '#27AE60', overflow: 'hidden', elevation: 12 },
  typeBadgeHeader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 12, backgroundColor: '#2ECC71' },
  textBadgeHeader: { color: '#FFF', fontSize: 13, fontWeight: 'bold', letterSpacing: 0.5 },
  bodyNotificationDetails: { padding: 24, alignItems: 'center' },
  alertTitleAnimation: { fontSize: 18, fontWeight: 'bold', color: '#2C3E50', textAlign: 'center' },
  subtitleText: { fontSize: 13, color: '#7F8C8D', textAlign: 'center', marginTop: 6, marginBottom: 16 },
  feeHighlightContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderTopWidth: 1, borderTopColor: '#ECF0F1', paddingTop: 16 },
  labelFeeTitle: { fontSize: 10, fontWeight: 'bold', color: '#95A5A6', letterSpacing: 0.5 },
  valueFeeText: { fontSize: 22, fontWeight: '900', color: '#27AE60', marginTop: 2 },
  methodPaymentBadge: { backgroundColor: '#E8F8F5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 0.5, borderColor: '#1ABC9C' },
  textMethodPayment: { color: '#16A085', fontSize: 10, fontWeight: 'bold' },
  actionButtonGroupRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#ECF0F1', height: 54 },
  btnRejectStyle: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9F9' },
  textBtnReject: { color: '#7F8C8D', fontSize: 14, fontWeight: 'bold' },
  btnAcceptStyle: { flex: 1.3, justifyContent: 'center', alignItems: 'center', backgroundColor: '#27AE60', flexDirection: 'row', gap: 8 },
  textBtnAccept: { color: '#FFF', fontSize: 14, fontWeight: 'bold' }
});