// app/(tabs)/profile/index.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, Alert, StatusBar } from 'react-native';
import { useRouter } from 'expo-router'; 
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useProfile } from '@/features/profile/useProfile';
import * as Clipboard from 'expo-clipboard';

export default function ProfileScreen() {
  const router = useRouter(); 
  const insets = useSafeAreaInsets();
  
  const { 
    profile, address, bankAccount, loading, error, saving, uploadingPhoto, 
    updateProfileName, uploadAvatarPhoto, executeSignOut 
  } = useProfile();
  
  const [isEditing, setIsEditing] = useState(false);
  const [inputName, setInputName] = useState('');

  useEffect(() => {
    if (profile?.user_name) setInputName(profile.user_name);
  }, [profile]);

  const handleSaveProfile = async () => {
    const sukses = await updateProfileName(inputName);
    if (sukses) setIsEditing(false);
  };

  const handleCopyReferral = async (code: string) => {
    await Clipboard.setStringAsync(code);
    Alert.alert('Berhasil Disalin!', `Kode referral "${code}" siap dibagikan ke warga Ciamis.`);
  };

  const handleLogoutPress = () => {
    Alert.alert('Keluar Dari Akun', 'Apakah Tuan Master yakin ingin keluar dari sasis PAMILO?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: async () => {
          await executeSignOut();
          router.replace('/(auth)/login' as any);
        }
      }
    ]);
  };

  if (loading && !profile) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4A3420" />
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#4A3420" />
      
      {/* HEADER UTAMA PROFILE */}
      <View style={[styles.headerBgCurved, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitlePage}>Akun Warga</Text>
        <View style={styles.avatarMainSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarWrapper}>
              {uploadingPhoto ? (
                <View style={styles.avatarPlaceholder}><ActivityIndicator size="small" color="#E28743" /></View>
              ) : profile?.user_avatar ? (
                <Image source={{ uri: `${profile.user_avatar}?t=${new Date().getTime()}` }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}><Ionicons name="person" size={40} color="#C0A995" /></View>
              )}
            </View>
            <TouchableOpacity style={styles.editPhotoBadge} activeOpacity={0.8} onPress={uploadAvatarPhoto} disabled={uploadingPhoto}>
              <Ionicons name="camera" size={12} color="#FFF" />
            </TouchableOpacity>
          </View>

          {isEditing ? (
            <View style={styles.editInputInlineRow}>
              <TextInput style={styles.inlineTextInput} value={inputName} onChangeText={setInputName} autoFocus />
              <TouchableOpacity style={styles.saveInlineBtn} onPress={handleSaveProfile} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="checkmark" size={20} color="#FFF" />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelInlineBtn} onPress={() => setIsEditing(false)}>
                <Ionicons name="close" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.nameAndBadgeWrapper}>
              <View style={styles.nameRow}>
                <Text style={styles.wargaNameText}>{profile?.user_name || 'Nama Tidak Ditemukan'}</Text>
                <TouchableOpacity style={styles.editIconBtn} onPress={() => setIsEditing(true)}>
                  <Ionicons name="pencil-sharp" size={13} color="#FFF" />
                </TouchableOpacity>
              </View>
              <View style={styles.roleBadgeContainer}>
                <Text style={styles.roleBadgeText}>{profile?.role || 'WARGA'}</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollBodyContent, { paddingBottom: insets.bottom + 90 }]} showsVerticalScrollIndicator={false}>
        {error && <View style={styles.errorBanner}><Text style={styles.errorText}>⚠️ {error}</Text></View>}

        {/* 🏪 SEKTOR MITRA TOKO UMKM (Dynamic CTA) */}
        {profile?.is_seller ? (
          <TouchableOpacity style={[styles.driverDashboardBtn, styles.sellerDashboardBtnCustom]} activeOpacity={0.8} onPress={() => router.push('/seller' as any)}>
            <View style={[styles.driverBtnIconBg, { backgroundColor: '#2ECC71' }]}><Ionicons name="storefront" size={18} color="#FFF" /></View>
            <View style={styles.driverBtnTextCol}>
              <Text style={styles.driverBtnTitle}>Masuk Dashboard Toko UMKM</Text>
              <Text style={styles.driverBtnSub}>Kelola produk, pesanan masuk, dan menu buka/tutup</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#2ECC71" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.driverDashboardBtn, { borderColor: '#2ECC71', marginBottom: 12 }]} activeOpacity={0.8} onPress={() => router.push('/register/seller' as any)}>
            <View style={[styles.driverBtnIconBg, { backgroundColor: '#2ECC71' }]}><Ionicons name="storefront" size={18} color="#FFF" /></View>
            <View style={styles.driverBtnTextCol}>
              <Text style={styles.driverBtnTitle}>Daftar Jadi Penjual / Buka Toko</Text>
              <Text style={styles.driverBtnSub}>Kembangkan usaha UMKM Anda bersama PAMILO</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#2ECC71" />
          </TouchableOpacity>
        )}

        {/* 🏍️ SEKTOR MITRA DRIVER MIGO (Dynamic CTA) */}
        {profile?.is_driver ? (
          <TouchableOpacity style={styles.driverDashboardBtn} activeOpacity={0.8} onPress={() => router.push('/driver' as any)}>
            <View style={styles.driverBtnIconBg}><Ionicons name="car-sport" size={20} color="#4A3420" /></View>
            <View style={styles.driverBtnTextCol}>
              <Text style={styles.driverBtnTitle}>Masuk Dashboard Mitra Driver</Text>
              <Text style={styles.driverBtnSub}>Aktifkan sakelar harian dan mulai sikat orderan Migo</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#E28743" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.driverDashboardBtn, { borderColor: '#E28743', marginBottom: 16 }]} activeOpacity={0.8} onPress={() => router.push('/register/driver' as any)}>
            <View style={[styles.driverBtnIconBg, { backgroundColor: '#E28743' }]}><Ionicons name="bicycle" size={20} color="#FFF" /></View>
            <View style={styles.driverBtnTextCol}>
              <Text style={styles.driverBtnTitle}>Daftar Jadi Mitra Driver</Text>
              <Text style={styles.driverBtnSub}>Bergabung dengan armada Migo, atur jam kerjamu bebas</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#E28743" />
          </TouchableOpacity>
        )}

        {/* 1. SEKTOR INFORMASI KONTAK */}
        <Text style={styles.sectionLabelTitle}>Informasi Kontak</Text>
        <View style={styles.infoMenuCard}>
          <View style={styles.infoRowItem}><Ionicons name="mail-outline" size={18} color="#7A6450" /><View style={styles.infoTextColumn}><Text style={styles.infoItemLabel}>Alamat Email</Text><Text style={styles.infoItemValue}>{profile?.user_email || '-'}</Text></View></View>
          <View style={styles.dividerLine} />
          <View style={styles.infoRowItem}><Ionicons name="call-outline" size={18} color="#7A6450" /><View style={styles.infoTextColumn}><Text style={styles.infoItemLabel}>Nomor Handphone</Text><Text style={styles.infoItemValue}>{profile?.user_phone && !profile.user_phone.startsWith('BELUM') ? profile.user_phone : '-'}</Text></View></View>
        </View>

        {/* 2. SEKTOR ALAMAT PENGIRIMAN UTAMA */}
        <Text style={styles.sectionLabelTitle}>Alamat Pengiriman Utama</Text>
        <TouchableOpacity style={styles.infoMenuCard} activeOpacity={0.7} onPress={() => router.push('/addresses' as any)} >
          <View style={[styles.infoRowItem, { justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
              <Ionicons name="location-outline" size={18} color="#7A6450" />
              <View style={styles.infoTextColumn}>
                <Text style={styles.infoItemLabel}>{address ? `ALAMAT ${address.label_alamat.toUpperCase()}` : 'STATUS ALAMAT'}</Text>
                <Text style={styles.infoItemValue} numberOfLines={3}>{address ? address.alamat_lengkap : 'Belum memasukkan data alamat tinggal.'}</Text>
                {address && <Text style={styles.coordinateSubText}>📍 Koordinat: {address.latitude}, {address.longitude}</Text>}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#C0A995" />
          </View>
        </TouchableOpacity>

        {/* 3. SEKTOR KEUANGAN & REKENING */}
        <Text style={styles.sectionLabelTitle}>Keuangan & Rekening Bank</Text>
        <View style={styles.infoMenuCard}>
          <View style={styles.infoRowItem}><Ionicons name="wallet-outline" size={18} color="#7A6450" /><View style={styles.infoTextColumn}><Text style={styles.infoItemLabel}>Saldo Dinamis PAMILO-Pay</Text><Text style={styles.infoItemValue}>Rp {Number(profile?.saldo || 0).toLocaleString('id-ID')}</Text></View></View>
          <View style={styles.dividerLine} />
          <TouchableOpacity style={[styles.infoRowItem, { justifyContent: 'space-between' }]} activeOpacity={0.7} onPress={() => router.push('/bank-accounts' as any)} >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
              <Ionicons name="card-outline" size={18} color="#7A6450" />
              <View style={styles.infoTextColumn}>
                <Text style={styles.infoItemLabel}>Rekening Penarikan Terdaftar</Text>
                {bankAccount ? (
                  <View style={{ marginTop: 2 }}><Text style={styles.infoItemValue}>{bankAccount.nama_bank.toUpperCase()} - {bankAccount.nomor_rekening}</Text><Text style={styles.accountOwnerSubText}>a.n. {bankAccount.nama_pemilik}</Text></View>
                ) : <Text style={styles.infoItemValue}>Belum mendaftarkan rekening bank.</Text>}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#C0A995" />
          </TouchableOpacity>
          <View style={styles.dividerLine} />
          <View style={styles.infoRowItem}>
            <Ionicons name="gift-outline" size={18} color="#E28743" />
            <View style={styles.infoTextColumn}>
              <Text style={[styles.infoItemLabel, { color: '#E28743', fontWeight: 'bold' }]}>Kode Referral Saya</Text>
              <Text style={[styles.infoItemValue, { letterSpacing: 0.5 }]}>{profile?.kode_referral_saya || '-'}</Text>
            </View>
            {profile?.kode_referral_saya && (
              <TouchableOpacity style={styles.miniCopyInlineBtn} activeOpacity={0.7} onPress={() => handleCopyReferral(profile.kode_referral_saya)}>
                <Ionicons name="copy-outline" size={11} color="#FFF" style={{ marginRight: 3 }} /><Text style={styles.miniCopyInlineBtnText}>Salin</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* TOMBOL LOGOUT */}
        <TouchableOpacity style={styles.logoutButtonRow} onPress={handleLogoutPress}>
          <Ionicons name="log-out" size={20} color="#E74C3C" /><Text style={styles.logoutButtonText}>Keluar Dari Akun</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FAF6F0' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF6F0' },
  headerBgCurved: { backgroundColor: '#4A3420', paddingHorizontal: 20, paddingBottom: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, elevation: 4, alignItems: 'center' },
  headerTitlePage: { color: '#C0A995', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  avatarMainSection: { alignItems: 'center', width: '100%' },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatarWrapper: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#E28743', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  editPhotoBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#E28743', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#4A3420', elevation: 3, zIndex: 10 },
  avatarImage: { width: '100%', height: '100%', resizeMode: 'cover', borderRadius: 38 },
  avatarPlaceholder: { width: '100%', height: '100%', backgroundColor: '#2B1D12', justifyContent: 'center', alignItems: 'center' },
  nameAndBadgeWrapper: { alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wargaNameText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  editIconBtn: { backgroundColor: 'rgba(255,255,255,0.15)', padding: 4, borderRadius: 6 },
  roleBadgeContainer: { backgroundColor: '#E28743', paddingVertical: 3, paddingHorizontal: 10, borderRadius: 20, marginTop: 6 },
  roleBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  editInputInlineRow: { flexDirection: 'row', alignItems: 'center', width: '90%', gap: 8 },
  inlineTextInput: { flex: 1, backgroundColor: '#FFF', height: 38, borderRadius: 8, paddingHorizontal: 12, color: '#4A3420', borderWidth: 1, borderColor: '#E28743' },
  saveInlineBtn: { backgroundColor: '#2ECC71', width: 38, height: 38, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  cancelInlineBtn: { backgroundColor: '#E74C3C', width: 38, height: 38, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  scrollBodyContent: { padding: 20 },
  
  driverDashboardBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4A3420', padding: 14, borderRadius: 16, marginBottom: 12, elevation: 3, borderWidth: 1, borderColor: '#7A6450' },
  sellerDashboardBtnCustom: { borderColor: '#5D4037', marginBottom: 12 },
  driverBtnIconBg: { backgroundColor: '#E28743', width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  driverBtnTextCol: { flex: 1, marginLeft: 12 },
  driverBtnTitle: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  driverBtnSub: { color: '#C0A995', fontSize: 10, marginTop: 2 },
  
  sectionLabelTitle: { fontSize: 11, fontWeight: 'bold', color: '#7A6450', textTransform: 'uppercase', marginBottom: 8, marginTop: 14, letterSpacing: 0.5 },
  infoMenuCard: { backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E0D0C0', paddingVertical: 6, paddingHorizontal: 14, marginBottom: 14, elevation: 1 },
  infoRowItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  infoTextColumn: { flex: 1 },
  infoItemLabel: { fontSize: 10, color: '#A1887F', fontWeight: '500' },
  infoItemValue: { fontSize: 13, fontWeight: '600', color: '#4A3420', marginTop: 2 },
  coordinateSubText: { fontSize: 10, color: '#A1887F', marginTop: 4, fontStyle: 'italic' },
  accountOwnerSubText: { fontSize: 11, color: '#7A6450', marginTop: 1, fontWeight: '500' },
  dividerLine: { height: 1, backgroundColor: '#FAF6F0' },
  logoutButtonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#FDEDEC', height: 48, borderRadius: 14, marginTop: 24, elevation: 1 },
  logoutButtonText: { color: '#E74C3C', fontSize: 13, fontWeight: 'bold' },
  errorBanner: { backgroundColor: '#FDEDEC', padding: 10, borderRadius: 10, marginBottom: 14 },
  errorText: { color: '#E74C3C', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  miniCopyInlineBtn: { backgroundColor: '#E28743', flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, elevation: 1 },
  miniCopyInlineBtnText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' }
});