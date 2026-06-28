import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apiKey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    console.log("🛰️ Sinyal Keuangan Masuk:", JSON.stringify(body))

    // 🌟 DETEKSI JENIS SINYAL (SNAP ATAU IRIS DISBURSEMENT)
    const orderId = body.order_id // Digunakan oleh Snap
    const referenceNo = body.reference_no // Digunakan oleh Iris Payouts

    // ====================================================================
    // JALUR A: OTOMATISASI WEBHOOK TOP UP (MIDTRANS SNAP)
    // ====================================================================
    if (orderId && orderId.startsWith('TRX-PML-')) {
      const statusTransaksi = body.transaction_status
      const tipePembayaran = body.payment_type

      const { data: trx, error: errTrx } = await supabaseAdmin
        .from('topup_transactions')
        .select('user_id, nominal, status_pembayaran')
        .eq('order_id', orderId)
        .maybeSingle()

      if (!errTrx && trx && trx.status_pembayaran === 'PENDING') {
        if (statusTransaksi === 'settlement' || statusTransaksi === 'capture') {
          
          await supabaseAdmin
            .from('topup_transactions')
            .update({ status_pembayaran: 'SUCCESS', metode_pembayaran: tipePembayaran, updated_at: new Date().toISOString() })
            .eq('order_id', orderId)

          const { data: balance } = await supabaseAdmin
            .from('balances')
            .select('amount')
            .eq('user_id', trx.user_id)
            .maybeSingle()

          const saldoAwal = balance ? balance.amount : 0
          await supabaseAdmin
            .from('balances')
            .update({ amount: saldoAwal + parseFloat(trx.nominal), updated_at: new Date().toISOString() })
            .eq('user_id', trx.user_id)

          await supabaseAdmin.from('mutasi_saldo_user').insert([{
            user_id: trx.user_id,
            tipe_transaksi: 'TOPUP',
            nominal: parseFloat(trx.nominal),
            keterangan: `Top Up Berhasil via Midtrans (${tipePembayaran.toUpperCase()})`
          }])

          console.log(`✅ Saldo Top Up Berhasil Disuntikkan: ${trx.user_id}`)
        }
        else if (['expire', 'cancel', 'deny'].includes(statusTransaksi)) {
          await supabaseAdmin
            .from('topup_transactions')
            .update({ status_pembayaran: 'FAILED', updated_at: new Date().toISOString() })
            .eq('order_id', orderId)
        }
      }
    }

    // ====================================================================
    // JALUR B: LILIS SUNTIKAN - WEBHOOK PENCAIRAN DANA (MIDTRANS IRIS DISBURSEMENT)
    // ====================================================================
    else if (referenceNo) {
      const statusPencairanIris = body.status // 'success' atau 'failure'
      const alasanGagal = body.reject_reason || 'Gangguan sirkuit bank tujuan'

      // Panggil fungsi PostgreSQL rpc yang sudah kita daftarkan di SQL Editor tadi
      const { error: errRpc } = await supabaseAdmin.rpc('proses_webhook_pencairan_sah', {
        p_reference_no: referenceNo,
        p_status: statusPencairanIris,
        p_reject_reason: alasanGagal
      })

      if (errRpc) throw errRpc
      console.log(`🛰️ Webhook Payouts Iris Berhasil Diproses untuk Ref: ${referenceNo}`)
    }

    return new Response(JSON.stringify({ status: "success", message: "Sinyal PAMILO diproses mulus" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Error sirkuit luar"
    console.error("💥 Sirkuit Edge Function Korsleting:", errMsg)
    return new Response(JSON.stringify({ error: errMsg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})