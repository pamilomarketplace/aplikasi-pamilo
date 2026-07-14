# Aturan Refactoring PAMILO
1. Screen (app/): Hanya UI, tidak boleh ada database/service call.
2. Hook (hooks/): State & UI Logic saja.
3. Service (services/): Business logic, validasi, dan akses ke Repository/Supabase.
4. Repository (repositories/): Hanya CRUD (Insert, Select, Update, Delete).
5. Types (types/): Definisi interface terpusat.

