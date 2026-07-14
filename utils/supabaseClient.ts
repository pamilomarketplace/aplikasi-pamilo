// utils/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage'; // KUNCI UTAMA: Penyimpanan permanen HP

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://fzqdeztlpslhxwdicvnq.supabase.co'; 
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6cWRlenRscHNsaHh3ZGljdm5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MzI3NTYsImV4cCI6MjA5NDUwODc1Nn0.3ZCCDPfawASAEU0gCZv8c3LnWNjvV9W-wulkny04CX4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,          // Memaksa Supabase menyimpan token login di hardisk HP
    autoRefreshToken: true,        // Otomatis memperbarui token biar warga tidak log out sendiri setiap minggu
    persistSession: true,          // Mengunci sesi agar awet bertahun-tahun selama tidak klik tombol Log Out
    detectSessionInUrl: false,
  },
});