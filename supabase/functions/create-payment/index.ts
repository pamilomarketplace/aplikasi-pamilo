// supabase/functions/create-payment-topup/index.ts

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apiKey, content-type',
}

// @ts-ignore: Deno runtime environment handling
export default async function handleRequest(req: Request): Promise<Response> {
  // Handle preflight request CORS agar tidak diblokir oleh HP/Browser
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { order_id, gross_amount, user_id, customer_details } = await req.json()

    // Ambil Server Key dari Environment Secret Supabase
    // @ts-ignore: Deno namespace global bypass
    const MIDTRANS_SERVER_KEY = Deno.env.get('MIDTRANS_SERVER_KEY')
    if (!MIDTRANS_SERVER_KEY) {
      throw new Error("Kunci rahasia MIDTRANS_SERVER_KEY belum disetel di secret Supabase Tuan Owner.")
    }

    const tokenOtentikasi = btoa(MIDTRANS_SERVER_KEY + ":")
    const urlMidtrans = "https://app.sandbox.midtrans.com/snap/v1/transactions"
    
    const resMidtrans = await fetch(urlMidtrans, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Basic ${tokenOtentikasi}`
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: order_id,
          gross_amount: Number(gross_amount)
        },
        customer_details: {
          first_name: customer_details?.first_name || 'Warga PAMILO',
          email: customer_details?.email || 'user@pamilo.com'
        },
        custom_field1: user_id 
      })
    })

    const dataMidtrans = await resMidtrans.json()

    if (!resMidtrans.ok || dataMidtrans.error_messages) {
      throw new Error(dataMidtrans.error_messages?.[0] || "Ditolak oleh sistem Midtrans.");
    }

    return new Response(
      JSON.stringify({ redirect_url: dataMidtrans.redirect_url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    )
  }
}

// @ts-ignore: Deno server serve deployment link
Deno.serve(handleRequest)