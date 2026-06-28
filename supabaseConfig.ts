import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// URL Proyek Resmi Tuan (Prioritaskan Environment Variable jika ada)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://fzqdeztlpslhxwdicvnq.supabase.co'; 

// Kunci Anon JWT Asli milik Tuan Septian (Prioritaskan Environment Variable jika ada)
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6cWRlenRscHNsaHh3ZGljdm5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MzI3NTYsImV4cCI6MjA5NDUwODc1Nn0.3ZCCDPfawASAEU0gCZv8c3LnWNjvV9W-wulkny04CX4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});