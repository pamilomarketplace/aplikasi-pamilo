import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const paketData = await req.json();
    const orderBaru = paketData.record; 

    // Filter: Hanya proses orderan yang berstatus MENCARI_DRIVER
    if (orderBaru.status_order !== 'MENCARI_DRIVER') {
      return new Response("Diabaikan: Bukan status mencari driver", { status: 200 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const clientSupabase = createClient(supabaseUrl, supabaseAnonKey);

    // KALIBRASI SAKRAL: Menarik kolom push_token (sesuai database HP Driver Tuan)
    const { data: listDriver, error: errorDriver } = await clientSupabase
      .from('drivers')
      .select('push_token')
      .eq('status_driver', 'ONLINE') // Hanya tembak driver yang sedang ONLINE / SIAP ANTAR
      .not('push_token', 'is', null);

    if (errorDriver || !listDriver || listDriver.length === 0) {
      return new Response("Tidak ada token driver aktif ditemukan", { status: 200 });
    }

    // Ekstrak token ke dalam array bersih
    const daftarToken = listDriver.map(d => d.push_token);

    // Strukturkan muatan payload untuk menjebol Android Lock Screen
    const pesanNotifExpo = daftarToken.map(token => ({
      to: token,
      title: "📢 TUGAS MUATAN MASUK, MITRA DRIVER!",
      body: `💵 Ongkir: Rp ${(orderBaru.biaya_ongkir || orderBaru.total_pembayaran || 0).toLocaleString('id-ID')} | Tujuan: ${orderBaru.alamat_pengiriman || orderBaru.alamat_antar || 'Kecamatan Ciamis'}`,
      sound: "migo.mp3", 
      priority: "high",  
      channelId: "channel-orderan-pamilo", // Match dengan id channel native di HP driver Tuan
      data: { 
        orderId: orderBaru.id, 
        tipe: "ORDERAN_BARU",
        asal_tabel: paketData.table 
      }
    }));

    // Tembakkan ke satelit server Expo Push API
    const responExpo = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pesanNotifExpo),
    });

    const hasilRespon = await responExpo.json();
    return new Response(JSON.stringify(hasilRespon), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
})