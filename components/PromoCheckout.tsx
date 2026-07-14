// components/PromoCheckout.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabaseClient'; 

// 🚀 DEFINISI TIPE DATA PROPS AGAR TYPESCRIPT TENANG
interface PromoCheckoutProps {
    totalBelanja: number;
    userIdPembeli: string;
    idToko: string | null;
    layananSaatIni: string;
    onPromoValid: (promo: any) => void;
}

export default function PromoCheckout({ 
    totalBelanja, 
    userIdPembeli, 
    idToko, 
    layananSaatIni, 
    onPromoValid 
}: PromoCheckoutProps) {
    const [kodeVoucher, setKodeVoucher] = useState('');
    const [loadingValidasi, setLoadingValidasi] = useState(false);
    
    // 🚀 DEFINISI STATE SEBAGAI ANY AGAR TIDAK DIANGGAP 'NEVER'
    const [promoAktif, setPromoAktif] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState('');

    const validasiVoucher = async () => {
        if (!kodeVoucher.trim()) {
            setErrorMsg('Masukkan kode voucher terlebih dahulu.');
            return;
        }

        setLoadingValidasi(true);
        setErrorMsg('');
        setPromoAktif(null);

        const kodeHurufBesar = kodeVoucher.trim().toUpperCase();

        try {
            let dataPromo = null;
            let sumberPromo = null;
            
            // 1. CEK PROMO PUSAT (PAMILO) TERLEBIH DAHULU
            const { data: promoPusat, error: errPusat } = await supabase
                .from('promosi_pamilo')
                .select('*')
                .eq('kode_voucher', kodeHurufBesar)
                .eq('status_aktif', true)
                .maybeSingle();

            if (promoPusat) {
                dataPromo = promoPusat;
                sumberPromo = 'PAMILO';
            } 
            // 2. JIKA DI PUSAT TIDAK ADA, CEK PROMO TOKO
            else if (idToko) {
                const { data: promoToko, error: errToko } = await supabase
                    .from('promosi_toko')
                    .select('*')
                    .eq('kode_promo', kodeHurufBesar)
                    .eq('id_toko_promo', idToko)
                    .maybeSingle();
                
                if (promoToko) {
                    dataPromo = promoToko;
                    sumberPromo = 'TOKO';
                }
            }

            // --- GERBANG 0: EKSISTENSI ---
            if (!dataPromo) {
                throw new Error("Kode promo tidak ditemukan atau tidak berlaku di toko ini.");
            }

            // Gerbang 1: Kadaluwarsa
            if (sumberPromo === 'PAMILO' && new Date(dataPromo.berlaku_sampai) < new Date()) {
                throw new Error("Yah, kode voucher ini sudah kedaluwarsa.");
            }

            // Gerbang 2: Kuota Global
            const kuotaMaxGlobal = sumberPromo === 'PAMILO' ? dataPromo.kuota_total : dataPromo.kuota_promo;
            const kuotaTerpakaiGlobal = sumberPromo === 'PAMILO' ? dataPromo.kuota_terpakai : 0;
            
            if (sumberPromo === 'PAMILO' && kuotaTerpakaiGlobal >= kuotaMaxGlobal) {
                throw new Error("Sangat disayangkan, kuota voucher ini sudah habis diklaim.");
            }

            // Gerbang 3: Minimal Belanja
            if (totalBelanja < dataPromo.minimal_belanja) {
                throw new Error(`Minimal belanja untuk promo ini adalah Rp ${dataPromo.minimal_belanja.toLocaleString('id-ID')}. Tambah item lagi yuk!`);
            }

            // Gerbang 4: Target Layanan
            if (sumberPromo === 'PAMILO' && dataPromo.target_layanan !== 'ALL' && dataPromo.target_layanan !== layananSaatIni) {
                 throw new Error(`Voucher ini tidak berlaku untuk layanan ${layananSaatIni}.`);
            }

            // Gerbang 5: Cek Riwayat Pribadi
            const { count: countRiwayatUser, error: errRiwayat } = await supabase.from('riwayat_pemakaian_promo')
                .select('*', { count: 'exact', head: true })
                .eq('user_id_pembeli', userIdPembeli)
                .eq('kode_dipakai', kodeHurufBesar);
            
            const maxPerUser = sumberPromo === 'PAMILO' ? dataPromo.kuota_per_user : 1; 
            
            // 🚀 MENGATASI KEMUNGKINAN COUNT NULL
            if ((countRiwayatUser || 0) >= maxPerUser) {
                 throw new Error(`Anda sudah mencapai batas pemakaian kode ini (${maxPerUser}x).`);
            }

            // --- JIKA LULUS GERBANG, HITUNG NOMINAL DISKON ---
            let nominalDiskon = 0;
            const tipeDiskon = sumberPromo === 'PAMILO' ? dataPromo.tipe_potongan : dataPromo.tipe_potongan;
            const nilaiPotongan = sumberPromo === 'PAMILO' ? dataPromo.nilai_potongan : dataPromo.nilai_potongan;

            if (tipeDiskon === 'NOMINAL') {
                nominalDiskon = nilaiPotongan;
            } else if (tipeDiskon === 'PERSENTASE') {
                nominalDiskon = (totalBelanja * nilaiPotongan) / 100;
                
                const maksPotongan = sumberPromo === 'PAMILO' ? dataPromo.maks_potongan : 0;
                if (maksPotongan > 0 && nominalDiskon > maksPotongan) {
                    nominalDiskon = maksPotongan;
                }
            }

            if (nominalDiskon >= totalBelanja) {
                nominalDiskon = totalBelanja - 1000;
            }

            const promoObj = {
                kode: kodeHurufBesar,
                sumber: sumberPromo,
                nominal: nominalDiskon,
                dataAsli: dataPromo
            };

            setPromoAktif(promoObj);
            
            if (onPromoValid) {
                onPromoValid(promoObj);
            }

            Alert.alert("Voucher Berhasil! 🎉", `Hore! Anda mendapat potongan Rp ${nominalDiskon.toLocaleString('id-ID')}`);

        // 🚀 MENJELASKAN TIPE ERROR SEBAGAI ANY
        } catch (error: any) {
            setErrorMsg(error.message);
            setPromoAktif(null);
            if (onPromoValid) onPromoValid(null); 
        } finally {
            setLoadingValidasi(false);
        }
    };

    const hapusPromo = () => {
        setPromoAktif(null);
        setKodeVoucher('');
        setErrorMsg('');
        if (onPromoValid) onPromoValid(null);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Gunakan Voucher</Text>
            
            {!promoAktif ? (
                <View style={styles.inputContainer}>
                    <Ionicons name="pricetag-outline" size={20} color="#7F8C8D" style={styles.icon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Ketik MIGOHEMAT / DISKONKILAT..."
                        value={kodeVoucher}
                        onChangeText={text => { setKodeVoucher(text.toUpperCase()); setErrorMsg(''); }}
                        autoCapitalize="characters"
                        editable={!loadingValidasi}
                    />
                    <TouchableOpacity 
                        style={[styles.btnTerapkan, (!kodeVoucher.trim() || loadingValidasi) && styles.btnTerapkanDisabled]}
                        onPress={validasiVoucher}
                        disabled={!kodeVoucher.trim() || loadingValidasi}
                    >
                        {loadingValidasi ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.btnText}>Terapkan</Text>}
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.promoAktifContainer}>
                    <View style={styles.promoAktifInfo}>
                        <Ionicons name="checkmark-circle" size={24} color="#2ECC71" />
                        <View style={{ marginLeft: 10 }}>
                            <Text style={styles.promoAktifTitle}>Voucher Terpasang</Text>
                            <Text style={styles.promoAktifDesc}>Kode <Text style={{fontWeight:'bold'}}>{promoAktif?.kode}</Text> (-Rp {promoAktif?.nominal?.toLocaleString('id-ID')})</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={hapusPromo} style={styles.btnHapusPromo}>
                        <Ionicons name="close-circle" size={24} color="#E74C3C" />
                    </TouchableOpacity>
                </View>
            )}

            {errorMsg ? (
                <Text style={styles.errorText}><Ionicons name="warning" size={12} /> {errorMsg}</Text>
            ) : null}

        </View>
    );
}

const styles = StyleSheet.create({
    container: { padding: 16, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#ECF0F1', marginBottom: 16 },
    title: { fontSize: 14, fontWeight: 'bold', color: '#2C3E50', marginBottom: 12 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#BDC3C7', borderRadius: 8, paddingHorizontal: 12 },
    icon: { marginRight: 8 },
    input: { flex: 1, height: 45, fontSize: 14, color: '#2C3E50', fontWeight: '600' },
    btnTerapkan: { backgroundColor: '#D35400', paddingHorizontal: 16, height: 35, justifyContent: 'center', borderRadius: 6 },
    btnTerapkanDisabled: { backgroundColor: '#BDC3C7' },
    btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
    
    promoAktifContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#E8F8F5', borderWidth: 1, borderColor: '#2ECC71', borderRadius: 8, padding: 12 },
    promoAktifInfo: { flexDirection: 'row', alignItems: 'center' },
    promoAktifTitle: { fontSize: 12, fontWeight: 'bold', color: '#27AE60' },
    promoAktifDesc: { fontSize: 11, color: '#2C3E50', marginTop: 2 },
    btnHapusPromo: { padding: 4 },
    
    errorText: { color: '#E74C3C', fontSize: 11, marginTop: 8, marginLeft: 4 }
});