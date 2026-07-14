// app/(tabs)/wallet/index.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '@/features/wallet/useWallet';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function WalletScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const { saldo, transactions, loading, error, refetch } = useWallet();

  const formatRupiah = (angka: number) => `Rp ${Number(angka).toLocaleString('id-ID')}`;

  const formatTanggal = (isoString: string) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'BERHASIL': return '#2ECC71';
      case 'DITOLAK': 
      case 'GAGAL': return '#E74C3C';
      default: return '#F1C40F'; // PENDING
    }
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#4A3420" />

      <View style={[styles.walletHeaderCurved, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitlePage}>PAMILO-Pay</Text>
        
        <View style={styles.balanceDisplayRow}>
          <Text style={styles.balanceLabelText}>Saldo Anda</Text>
          <Text style={styles.balanceValueText}>{loading ? '...' : formatRupiah(saldo)}</Text>
        </View>

        <View style={styles.actionButtonsRow}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#E28743' }]} 
            onPress={() => router.push('/wallet/topup' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={20} color="#FFF" />
            <Text style={styles.actionButtonText}>Top Up</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#2B1D12', borderWidth: 1, borderColor: '#5D4037' }]} 
            onPress={() => router.push('/wallet/withdraw' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="cash" size={20} color="#FFF" />
            <Text style={styles.actionButtonText}>Withdraw</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.historyContainer}>
        <View style={styles.historyHeaderTitleRow}>
          <Text style={styles.historySectionTitle}>Riwayat Transaksi</Text>
          <TouchableOpacity onPress={refetch} disabled={loading}>
            <Ionicons name="refresh" size={18} color="#7A6450" />
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorWrapper}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {loading ? (
          <View style={styles.centerPemuat}>
            <ActivityIndicator size="large" color="#4A3420" />
          </View>
        ) : transactions.length === 0 ? (
          <ScrollView contentContainerStyle={styles.emptyCenterContainer} showsVerticalScrollIndicator={false}>
            <Ionicons name="receipt-outline" size={48} color="#C0A995" />
            <Text style={styles.emptyMutationText}>Belum ada aktivitas mutasi saldo pada akun Anda.</Text>
          </ScrollView>
        ) : (
          <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={[styles.scrollListPadding, { paddingBottom: insets.bottom + 90 }]}
          >
            {transactions.map((item) => {
              // 🚀 FAKTA SOLUSI: Perbaikan Logika Warna & Plus/Minus (KREDIT = Uang Masuk, DEBIT = Uang Keluar)
              const isKredit = item.arah_mutasi === 'KREDIT'; 
              
              return (
                <View key={item.id} style={styles.mutationCardItem}>
                  <View style={styles.mutationLeftRow}>
                    <View style={[styles.iconIndicatorWrapper, { backgroundColor: isKredit ? '#E8F8F5' : '#FDEDEC' }]}>
                      <Ionicons 
                        name={isKredit ? 'arrow-down-circle' : 'arrow-up-circle'} 
                        size={24} 
                        color={isKredit ? '#2ECC71' : '#E74C3C'} 
                      />
                    </View>
                    <View style={styles.mutationMetaColumn}>
                      <Text style={styles.mutationTypeTitle} numberOfLines={1}>{item.tipe_transaksi.replace(/_/g, ' ')}</Text>
                      <Text style={styles.mutationTimeSub}>{formatTanggal(item.created_at)}</Text>
                    </View>
                  </View>

                  <View style={styles.mutationRightColumn}>
                    <Text style={[styles.mutationAmountValue, { color: isKredit ? '#2ECC71' : '#E74C3C' }]}>
                      {isKredit ? '+ ' : '- '}{formatRupiah(item.jumlah)}
                    </Text>
                    <View style={[styles.statusBadgeDot, { borderColor: getStatusColor(item.status_transaksi) }]}>
                      <Text style={[styles.statusBadgeText, { color: getStatusColor(item.status_transaksi) }]}>
                        {item.status_transaksi}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FAF6F0' },
  walletHeaderCurved: { backgroundColor: '#4A3420', paddingHorizontal: 20, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, elevation: 5 },
  headerTitlePage: { color: '#C0A995', fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' },
  balanceDisplayRow: { alignItems: 'center', marginTop: 16, marginBottom: 20 },
  balanceLabelText: { color: '#FFF', fontSize: 13, opacity: 0.8 },
  balanceValueText: { color: '#FFF', fontSize: 28, fontWeight: 'bold', marginTop: 4, letterSpacing: 0.5 },
  actionButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, marginTop: 4 },
  actionButton: { flex: 1, height: 44, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, elevation: 2 },
  actionButtonText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  historyContainer: { flex: 1, paddingTop: 20, paddingHorizontal: 20 },
  historyHeaderTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  historySectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#7A6450', textTransform: 'uppercase', letterSpacing: 0.5 },
  scrollListPadding: { paddingTop: 4 },
  mutationCardItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E0D0C0' },
  mutationLeftRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconIndicatorWrapper: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  mutationMetaColumn: { flex: 1, paddingRight: 8 },
  mutationTypeTitle: { fontSize: 13, fontWeight: 'bold', color: '#4A3420' },
  mutationTimeSub: { fontSize: 10, color: '#A1887F', marginTop: 3 },
  mutationRightColumn: { alignItems: 'flex-end', minWidth: 90 },
  mutationAmountValue: { fontSize: 13, fontWeight: 'bold' },
  statusBadgeDot: { borderWidth: 1, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6, marginTop: 4 },
  statusBadgeText: { fontSize: 9, fontWeight: 'bold' },
  centerPemuat: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorWrapper: { backgroundColor: '#FDEDEC', padding: 10, borderRadius: 10, marginBottom: 10 },
  errorText: { color: '#E74C3C', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  emptyCenterContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyMutationText: { textAlign: 'center', color: '#7A6450', fontSize: 12, fontStyle: 'italic', marginTop: 10, paddingHorizontal: 30 }
});