// @ts-nocheck
import React, { useEffect, useState, useCallback } from 'react';
import { 
  StyleSheet, Text, View, FlatList, TouchableOpacity, 
  ActivityIndicator, RefreshControl, Image, Modal, StatusBar
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../supabaseConfig';

export default function ManajemenSaldoAdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [antreanTransaksi, setAntreanTransaksi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingAksi, setLoadingAksi] = useState<string | null>(null);

  // Modal Bukti Struk
  const [modalGambar, setModalGambar] = useState<{ visible: boolean, url: string }>({ visible: false, url: '' });

  // Modern Alert Modal Config
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    icon: string;
    type: 'INFO' | 'CONFIRM';
    onConfirm?: () => void;
  }>({ visible: false, title: '', message: '', icon: 'bell', type: 'INFO' });

  const tampilkanAlertInfo = (title: string, message: string, icon: string) => {
    setAlertConfig({ visible: true, title, message, icon, type: 'INFO' });
  };

  const tampilkanAlertKonfirmasi = (title: string, message: string, icon: string, onConfirm: () => void) => {
    setAlertConfig({ visible: true, title, message, icon, type: 'CONFIRM', onConfirm });
  };

  const fetchAntreanSaldo = async () => {
    try {
      const { data, error } = await supabase
        .from('transaksi_saldo')
        .select(`
          *,
          users ( user_name, user_phone, role, saldo )
        `)
        .eq('status_transaksi', 'PENDING')
        .in('tipe_transaksi', ['TOPUP', 'WITHDRAWAL'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      setAntreanTransaksi(data || []);
    } catch (err: any) {
      tampilkanAlertInfo("Gagal Memuat Radar 🚨", err.message, "exclamation-triangle");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAntreanSaldo();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAntreanSaldo();
  }, []);

  // 🚀 ENGINE 1: ACC (APPROVE & EKSEKUSI SALDO)
  const prosesSetujuiMutasi = async (tx: any) => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
    try {
      setLoadingAksi(tx.id);
      const saldoSekarang = Number(tx.users?.saldo || 0);
      const nominalAksi = Number(tx.jumlah);
      let saldoBaru = saldoSekarang;

      // 1. Validasi Awal Arah Aliran Finansial
      if (tx.tipe_transaksi === 'TOPUP') {
        saldoBaru = saldoSekarang + nominalAksi;
      } else if (tx.tipe_transaksi === 'WITHDRAWAL') {
        if (saldoSekarang < nominalAksi) {
          setTimeout(() => {
            tampilkanAlertInfo("Penarikan Gagal 🚨", `Saldo user saat ini (Rp ${saldoSekarang.toLocaleString('id-ID')}) tidak mencukupi untuk melakukan WD. Harap TOLAK pengajuan ini!`, "times-circle");
          }, 400);
          setLoadingAksi(null);
          return;
        }
        saldoBaru = saldoSekarang - nominalAksi;
      }

      // 2. Optimistic UI: Langsung depak dari layar antrean admin agar responsif!
      setAntreanTransaksi(prev => prev.filter(item => item.id !== tx.id));

      // 3. Tembak Paralel ke Supabase (Amankan Mutasi Finansial)
      const [resUser, resTx] = await Promise.all([
        supabase.from('users').update({ saldo: saldoBaru }).eq('user_id', tx.user_id),
        supabase.from('transaksi_saldo').update({ 
          status_transaksi: 'BERHASIL',
          catatan_admin: tx.catatan_admin ? `${tx.catatan_admin} (Divalidasi Admin Pusat)` : 'Divalidasi Admin Pusat'
        }).eq('id', tx.id)
      ]);

      if (resUser.error) throw resUser.error;
      if (resTx.error) throw resTx.error;

      setTimeout(() => {
        tampilkanAlertInfo("Sukses 🎉", `Dana senilai Rp ${nominalAksi.toLocaleString('id-ID')} berhasil dialokasikan!`, "check-circle");
      }, 400);

    } catch (err: any) {
      // Jika database gagal, kembalikan item ke dalam antrean layar
      fetchAntreanSaldo();
      setTimeout(() => {
        tampilkanAlertInfo("Gagal Eksekusi ❌", err.message, "times-circle");
      }, 400);
    } finally {
      setLoadingAksi(null);
    }
  };

  const handleSetujui = async (tx: any) => {
    tampilkanAlertKonfirmasi(
      "Konfirmasi Persetujuan 💰", 
      `Yakin ingin menyetujui ${tx.tipe_transaksi} senilai Rp ${Number(tx.jumlah).toLocaleString('id-ID')} untuk ${tx.users?.user_name}?`,
      "money-bill-wave",
      () => prosesSetujuiMutasi(tx)
    );
  };

  // 🚀 ENGINE 2: TOLAK (REJECT TANPA EKSEKUSI SALDO)
  const prosesTolakMutasi = async (tx: any) => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
    try {
      setLoadingAksi(tx.id);

      // Optimistic UI: Langsung potong dari daftar antrean layar admin
      setAntreanTransaksi(prev => prev.filter(item => item.id !== tx.id));

      // Ubah status di database menjadi DITOLAK (Saldo user tetap utuh, tidak tersentuh)
      const { error } = await supabase.from('transaksi_saldo').update({ 
        status_transaksi: 'DITOLAK',
        catatan_admin: tx.catatan_admin ? `${tx.catatan_admin} (DITOLAK ADMIN)` : 'DITOLAK ADMIN'
      }).eq('id', tx.id);

      if (error) throw error;
      
      setTimeout(() => {
        tampilkanAlertInfo("Ditolak 🛑", "Pengajuan saldo resmi digagalkan dan dipindahkan ke riwayat penolakan.", "check-circle");
      }, 400);

    } catch (err: any) {
      fetchAntreanSaldo(); // Pulihkan data jika jaringan down
      setTimeout(() => {
        tampilkanAlertInfo("Gagal Eksekusi ❌", err.message, "times-circle");
      }, 400);
    } finally {
      setLoadingAksi(null);
    }
  };

  const handleTolak = async (tx: any) => {
    tampilkanAlertKonfirmasi(
      "Tolak Pengajuan ❌", 
      "Pengajuan ini akan digagalkan secara sepihak dan statusnya diubah menjadi DITOLAK permanen tanpa memotong/mengisi saldo.",
      "minus-circle",
      () => prosesTolakMutasi(tx)
    );
  };

  if (loading) {
    return (
      <View style={styles.centerLoading}>
        <ActivityIndicator size="large" color="#1A0F05" />
        <Text style={styles.loadingText}>Menarik antrean mutasi pusat...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerTitle: 'Verifikasi Mutasi Keuangan',
          headerTintColor: '#fff',
          headerStyle: { backgroundColor: '#1A0F05' }, 
          headerTitleStyle: { fontWeight: 'bold', fontSize: 14 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 5, marginRight: 15, paddingVertical: 4 }}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          ),
        }} 
      />
      <StatusBar barStyle="light-content" backgroundColor="#1A0F05" />

      <FlatList
        data={antreanTransaksi}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#1A0F05"]} />}
        ListEmptyComponent={() => (
          <View style={styles.emptyBox}>
            <FontAwesome5 name="check-circle" size={48} color="#D7CCC8" />
            <Text style={styles.emptyTitle}>Sirkuit Bersih!</Text>
            <Text style={styles.emptyDesc}>Tidak ada antrean Top Up maupun Penarikan Dana (Withdrawal) saat ini.</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const isTopUp = item.tipe_transaksi === 'TOPUP';
          
          return (
            <View style={styles.cardItem}>
              <View style={styles.cardHeader}>
                <View style={[styles.badgeType, { backgroundColor: isTopUp ? '#E8F5E9' : '#FFEBEE' }]}>
                  <Ionicons name={isTopUp ? 'wallet' : 'cash'} size={12} color={isTopUp ? '#2E7D32' : '#C62828'} />
                  <Text style={[styles.badgeText, { color: isTopUp ? '#2E7D32' : '#C62828' }]}>
                    {isTopUp ? 'PENGISIAN SALDO' : 'PENARIKAN DANA'}
                  </Text>
                </View>
                <Text style={styles.dateText}>
                  {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} WIB
                </Text>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.rowInfo}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.labelIdentitas}>IDENTITAS PEMOHON:</Text>
                    <Text style={styles.valName}>{item.users?.user_name || 'User Tidak Dikenal'}</Text>
                    <Text style={styles.valPhone}>{item.users?.user_phone || '-'}</Text>
                    <Text style={styles.valSaldoCurrent}>Saldo Dompet: Rp {Number(item.users?.saldo || 0).toLocaleString('id-ID')}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.labelIdentitas}>NOMINAL PENGAJUAN:</Text>
                    <Text style={[styles.valNominal, { color: isTopUp ? '#2E7D32' : '#D35400' }]}>
                      Rp {Number(item.jumlah).toLocaleString('id-ID')}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {isTopUp ? (
                  <View style={styles.detailBox}>
                    <Text style={styles.detailLabel}>Catatan Transfer: {item.catatan_admin}</Text>
                    <TouchableOpacity 
                      style={styles.btnLihatStruk} 
                      onPress={() => setModalGambar({ visible: true, url: item.bukti_transfer_url })}
                    >
                      <Ionicons name="image" size={16} color="#0288D1" style={{ marginRight: 6 }} />
                      <Text style={styles.btnLihatStrukText}>Cek Foto Bukti Transfer Warga</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={[styles.detailBox, { backgroundColor: '#FFF3E0', borderColor: '#FFE0B2' }]}>
                    <Text style={[styles.detailLabel, { color: '#E65100', fontWeight: 'bold' }]}>Tujuan Transfer Admin:</Text>
                    <Text style={styles.wdBankText}>{item.nama_bank?.toUpperCase()}</Text>
                    <Text style={styles.wdRekText}>{item.nomor_rekening}</Text>
                    <Text style={styles.wdNameText}>a/n {item.nama_pemilik_rekening?.toUpperCase()}</Text>
                  </View>
                )}
              </View>

              <View style={styles.cardFooter}>
                {loadingAksi === item.id ? (
                  <ActivityIndicator color="#1A0F05" />
                ) : (
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={[styles.btnAction, styles.btnReject]} onPress={() => handleTolak(item)}>
                      <Ionicons name="close" size={16} color="#C62828" />
                      <Text style={styles.textReject}>TOLAK</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnAction, styles.btnApprove]} onPress={() => handleSetujui(item)}>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={styles.textApprove}>SETUJUI {isTopUp ? '& ISI SALDO' : '& POTONG SALDO'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* MODAL GAMBAR STRUK */}
      <Modal visible={modalGambar.visible} transparent={true} animationType="fade" onRequestClose={() => setModalGambar({ visible: false, url: '' })}>
        <View style={styles.modalGambarBg}>
          <TouchableOpacity style={styles.btnCloseModal} onPress={() => setModalGambar({ visible: false, url: '' })}>
            <Ionicons name="close-circle" size={36} color="#fff" />
          </TouchableOpacity>
          {modalGambar.url ? (
            <Image source={{ uri: modalGambar.url }} style={styles.gambarStrukLayarPenuh} resizeMode="contain" />
          ) : (
            <Text style={{ color: '#fff' }}>Gambar tidak tersedia.</Text>
          )}
        </View>
      </Modal>

      {/* MODAL CUSTOM MODERN NOTIFICATION & CONFIRMATION */}
      <Modal visible={alertConfig.visible} transparent={true} animationType="fade" onRequestClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}>
        <View style={styles.customAlertOverlay}>
          <View style={styles.customAlertCard}>
            <View style={[
              styles.customAlertIconBg, 
              alertConfig.icon === 'times-circle' || alertConfig.icon === 'minus-circle' ? { backgroundColor: '#C62828' } : { backgroundColor: '#D35400' }
            ]}>
              <FontAwesome5 name={alertConfig.icon} size={20} color="#fff" />
            </View>
            <Text style={styles.customAlertTitle}>{alertConfig.title}</Text>
            <View style={styles.customAlertDataBody}>
              <Text style={styles.customAlertMessage}>{alertConfig.message}</Text>
            </View>
            
            <View style={styles.customAlertBtnRow}>
              {alertConfig.type === 'CONFIRM' ? (
                <>
                  <TouchableOpacity style={styles.customAlertBtnCancel} onPress={() => setAlertConfig(prev => ({ ...prev, visible: false }))}>
                    <Text style={styles.customAlertBtnCancelTxt}>BATAL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.customAlertBtnConfirm} onPress={alertConfig.onConfirm}>
                    <Text style={styles.customAlertBtnConfirmTxt}>LANJUTKAN</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={[styles.customAlertBtnConfirm, { flex: 1 }]} onPress={() => setAlertConfig(prev => ({ ...prev, visible: false }))}>
                  <Text style={styles.customAlertBtnConfirmTxt}>OK</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <View style={{ height: insets.bottom, backgroundColor: '#1A0F05' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 12, color: '#8D6E63', fontWeight: 'bold' },
  listContent: { padding: 16 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#8D6E63', marginTop: 16 },
  emptyDesc: { fontSize: 12, color: '#A1887F', textAlign: 'center', marginTop: 8, paddingHorizontal: 40, lineHeight: 18 },
  
  cardItem: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 16, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: '#F5F5F5', backgroundColor: '#FAFAFA', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  badgeType: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '900', marginLeft: 4, letterSpacing: 0.5 },
  dateText: { fontSize: 10, color: '#9E9E9E', fontWeight: 'bold' },
  
  cardBody: { padding: 16 },
  rowInfo: { flexDirection: 'row', justifyContent: 'space-between' },
  labelIdentitas: { fontSize: 9, fontWeight: 'bold', color: '#A1887F', marginBottom: 4, letterSpacing: 0.5 },
  valName: { fontSize: 14, fontWeight: '900', color: '#1A0F05' },
  valPhone: { fontSize: 11, color: '#5D4037', marginTop: 2, fontWeight: '500' },
  valSaldoCurrent: { fontSize: 10, color: '#1565C0', marginTop: 6, fontWeight: 'bold', backgroundColor: '#E3F2FD', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  valNominal: { fontSize: 18, fontWeight: '900' },
  
  divider: { height: 1, backgroundColor: '#EEEEEE', marginVertical: 14, borderStyle: 'dashed' },
  
  detailBox: { backgroundColor: '#F5F5F5', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#EEEEEE' },
  detailLabel: { fontSize: 11, color: '#616161', lineHeight: 16 },
  btnLihatStruk: { flexDirection: 'row', alignItems: 'center', marginTop: 10, backgroundColor: '#E1F5FE', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignSelf: 'flex-start' },
  btnLihatStrukText: { fontSize: 11, fontWeight: 'bold', color: '#0288D1' },
  
  wdBankText: { fontSize: 14, fontWeight: '900', color: '#D35400', marginTop: 6 },
  wdRekText: { fontSize: 22, fontWeight: '900', color: '#1A0F05', letterSpacing: 1, marginTop: 2 },
  wdNameText: { fontSize: 12, fontWeight: 'bold', color: '#5D4037', marginTop: 4 },
  
  cardFooter: { padding: 12, borderTopWidth: 1, borderColor: '#F5F5F5' },
  actionRow: { flexDirection: 'row', gap: 10 },
  btnAction: { flex: 1, flexDirection: 'row', height: 42, justifyContent: 'center', alignItems: 'center', borderRadius: 10, borderWidth: 1 },
  btnReject: { backgroundColor: '#FFEBEE', borderColor: '#FFCDD2' },
  textReject: { color: '#C62828', fontWeight: 'bold', fontSize: 12, marginLeft: 6, letterSpacing: 0.5 },
  btnApprove: { backgroundColor: '#1A0F05', borderColor: '#1A0F05' },
  textApprove: { color: '#fff', fontWeight: 'bold', fontSize: 11, marginLeft: 6, letterSpacing: 0.5 },

  modalGambarBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  btnCloseModal: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  gambarStrukLayarPenuh: { width: '100%', height: '80%' },

  customAlertOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  customAlertCard: { backgroundColor: '#FFFFFF', width: '100%', borderRadius: 24, padding: 22, borderWidth: 2, borderColor: '#1A0F05', alignItems: 'center', elevation: 10 },
  customAlertIconBg: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginBottom: 12, marginTop: -5 },
  customAlertTitle: { fontSize: 15, fontWeight: '900', color: '#111', textAlign: 'center', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.3 },
  customAlertDataBody: { width: '100%', backgroundColor: '#FFF8F4', borderRadius: 16, padding: 15, marginBottom: 20, borderWidth: 1, borderColor: '#FFCCBC' },
  customAlertMessage: { fontSize: 12, fontWeight: '700', color: '#4A3525', textAlign: 'center', lineHeight: 18 },
  customAlertBtnRow: { flexDirection: 'row', width: '100%', gap: 10 },
  customAlertBtnCancel: { flex: 1, backgroundColor: '#F5F5F5', height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  customAlertBtnCancelTxt: { color: '#616161', fontWeight: 'bold', fontSize: 12, letterSpacing: 0.5 },
  customAlertBtnConfirm: { flex: 2, backgroundColor: '#1A0F05', height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  customAlertBtnConfirmTxt: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12, letterSpacing: 0.5 }
});