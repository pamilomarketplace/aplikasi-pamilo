// File: supabase/functions/handle-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0"

// Konfigurasi Supabase untuk Webhook (Menggunakan Service Role Key agar punya akses penuh)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req: Request) => {
  // 1. Inisialisasi Supabase Client
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  
  // 2. Ambil data payload dari Midtrans
  const body = await req.json();
  const { order_id, transaction_status } = body;

  console.log("Webhook diterima untuk Order ID:", order_id, "Status:", transaction_status);

  // 3. Tentukan status baru di database
  // Midtrans status: settlement (sukses), capture (sukses), expire, cancel
  let statusOrder = 'Pending';
  if (transaction_status === 'settlement' || transaction_status === 'capture') {
    statusOrder = 'Lunas';
  } else if (transaction_status === 'cancel' || transaction_status === 'expire' || transaction_status === 'deny') {
    statusOrder = 'Batal';
  }

  // 4. Update status di tabel orders
  const { error } = await supabase
    .from('orders')
    .update({ status_order: statusOrder })
    .eq('id', order_id);

  if (error) {
    console.error("Gagal update database:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  return new Response(JSON.stringify({ message: "Webhook diterima dan diproses" }), { 
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});