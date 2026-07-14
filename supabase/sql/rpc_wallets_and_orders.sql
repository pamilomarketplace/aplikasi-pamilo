-- RPCs for wallet and order lifecycle
-- Deploy these to your Supabase DB (psql or SQL editor)

-- 1) Wallet credit: atomically credit user's saldo and mark transaksi_saldo as SUKSES
CREATE OR REPLACE FUNCTION public.wallet_credit(p_transaksi_id uuid)
RETURNS TABLE(id uuid, user_id uuid, jumlah numeric, status_transaksi text) AS $$
DECLARE
  tx RECORD;
BEGIN
  -- Lock the transaction row to avoid race conditions
  SELECT * INTO tx FROM public.transaksi_saldo WHERE id = p_transaksi_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaksi_saldo not found: %', p_transaksi_id;
  END IF;

  IF COALESCE(tx.status_transaksi, '') <> 'PENDING' THEN
    RAISE EXCEPTION 'transaksi already processed or not pending: %', COALESCE(tx.status_transaksi, 'NULL');
  END IF;

  -- Credit user balance
  UPDATE public.users
  SET saldo = COALESCE(saldo, 0) + tx.jumlah
  WHERE user_id = tx.user_id;

  -- Mark transaksi as succeeded
  UPDATE public.transaksi_saldo
  SET status_transaksi = 'SUKSES'
  WHERE id = p_transaksi_id;

  RETURN QUERY SELECT id, user_id, jumlah, status_transaksi FROM public.transaksi_saldo WHERE id = p_transaksi_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2) Wallet debit: atomically debit user's saldo and mark transaksi_saldo as SUKSES
CREATE OR REPLACE FUNCTION public.wallet_debit(p_transaksi_id uuid)
RETURNS TABLE(id uuid, user_id uuid, jumlah numeric, status_transaksi text) AS $$
DECLARE
  tx RECORD;
  cur_saldo numeric;
BEGIN
  SELECT * INTO tx FROM public.transaksi_saldo WHERE id = p_transaksi_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaksi_saldo not found: %', p_transaksi_id;
  END IF;

  IF COALESCE(tx.status_transaksi, '') <> 'PENDING' THEN
    RAISE EXCEPTION 'transaksi already processed or not pending: %', COALESCE(tx.status_transaksi, 'NULL');
  END IF;

  SELECT COALESCE(saldo,0) INTO cur_saldo FROM public.users WHERE user_id = tx.user_id;
  IF cur_saldo < tx.jumlah THEN
    RAISE EXCEPTION 'insufficient balance';
  END IF;

  UPDATE public.users
  SET saldo = COALESCE(saldo, 0) - tx.jumlah
  WHERE user_id = tx.user_id;

  UPDATE public.transaksi_saldo
  SET status_transaksi = 'SUKSES'
  WHERE id = p_transaksi_id;

  RETURN QUERY SELECT id, user_id, jumlah, status_transaksi FROM public.transaksi_saldo WHERE id = p_transaksi_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3) Wallet reject: mark transaksi_saldo as DITOLAK and append admin note (no balance mutation)
CREATE OR REPLACE FUNCTION public.wallet_reject(p_transaksi_id uuid, p_catatan_admin text)
RETURNS TABLE(id uuid, user_id uuid, jumlah numeric, status_transaksi text, catatan_admin text) AS $$
DECLARE
  tx RECORD;
BEGIN
  SELECT * INTO tx FROM public.transaksi_saldo WHERE id = p_transaksi_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaksi_saldo not found: %', p_transaksi_id;
  END IF;

  IF COALESCE(tx.status_transaksi, '') <> 'PENDING' THEN
    RAISE EXCEPTION 'transaksi already processed or not pending: %', COALESCE(tx.status_transaksi, 'NULL');
  END IF;

  UPDATE public.transaksi_saldo
  SET status_transaksi = 'DITOLAK', catatan_admin = COALESCE(catatan_admin, '') || '\n' || COALESCE(p_catatan_admin, '')
  WHERE id = p_transaksi_id;

  RETURN QUERY SELECT id, user_id, jumlah, status_transaksi, catatan_admin FROM public.transaksi_saldo WHERE id = p_transaksi_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4b) Wallet refund: credit user's saldo and insert a transaksi_saldo row marked SUKSES
CREATE OR REPLACE FUNCTION public.wallet_refund(p_user_id uuid, p_amount numeric, p_note text DEFAULT NULL)
RETURNS TABLE(id uuid, user_id uuid, jumlah numeric, status_transaksi text) AS $$
DECLARE
  new_id uuid;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  -- create ledger entry
  INSERT INTO public.transaksi_saldo(user_id, tipe_transaksi, jumlah, status_transaksi, catatan_admin)
  VALUES (p_user_id, 'REFUND', p_amount, 'SUKSES', COALESCE(p_note, 'Refund'))
  RETURNING id INTO new_id;

  -- credit user
  UPDATE public.users SET saldo = COALESCE(saldo,0) + p_amount WHERE user_id = p_user_id;

  RETURN QUERY SELECT id, user_id, jumlah, status_transaksi FROM public.transaksi_saldo WHERE id = new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Order assign/update status helper: updates status_order on either orders or migo_orders
CREATE OR REPLACE FUNCTION public.order_assign_driver(p_order_id uuid, p_status text, p_actor_id uuid)
RETURNS TABLE(table_name text, id uuid, status_order text) AS $$
DECLARE
  updated_row RECORD;
BEGIN
  -- Try updating migo_orders if the row exists
  IF EXISTS (SELECT 1 FROM public.migo_orders WHERE id = p_order_id) THEN
    UPDATE public.migo_orders SET status_order = p_status WHERE id = p_order_id RETURNING 'migo_orders' AS table_name, id, status_order INTO updated_row;
    RETURN QUERY SELECT updated_row.table_name, updated_row.id, updated_row.status_order;
    RETURN;
  END IF;

  -- Fallback to orders
  IF EXISTS (SELECT 1 FROM public.orders WHERE id = p_order_id) THEN
    UPDATE public.orders SET status_order = p_status WHERE id = p_order_id RETURNING 'orders' AS table_name, id, status_order INTO updated_row;
    RETURN QUERY SELECT updated_row.table_name, updated_row.id, updated_row.status_order;
    RETURN;
  END IF;

  RAISE EXCEPTION 'order not found: %', p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5) Order finish: mark order as SELESAI and return updated row
CREATE OR REPLACE FUNCTION public.order_finish(p_order_id uuid, p_actor_id uuid)
RETURNS TABLE(table_name text, id uuid, status_order text) AS $$
DECLARE
  updated_row RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM public.migo_orders WHERE id = p_order_id) THEN
    UPDATE public.migo_orders SET status_order = 'SELESAI' WHERE id = p_order_id RETURNING 'migo_orders' AS table_name, id, status_order INTO updated_row;
    RETURN QUERY SELECT updated_row.table_name, updated_row.id, updated_row.status_order;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.orders WHERE id = p_order_id) THEN
    UPDATE public.orders SET status_order = 'SELESAI' WHERE id = p_order_id RETURNING 'orders' AS table_name, id, status_order INTO updated_row;
    RETURN QUERY SELECT updated_row.table_name, updated_row.id, updated_row.status_order;
    RETURN;
  END IF;

  RAISE EXCEPTION 'order not found: %', p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5b) Order settle: run financial settlement when an order is completed by a seller
CREATE OR REPLACE FUNCTION public.order_settle(p_order_id uuid, p_actor_id uuid)
RETURNS TABLE(table_name text, id uuid, status_order text) AS $$
DECLARE
  ord RECORD;
  commission numeric;
  buyer_saldo numeric;
  seller_saldo numeric;
  tx_buyer_id uuid;
  tx_seller_id uuid;
BEGIN
  -- Try orders table first
  IF EXISTS (SELECT 1 FROM public.orders WHERE id = p_order_id) THEN
    SELECT * INTO ord FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;

    commission := COALESCE(ord.total_pembayaran,0) * 0.10; -- 10% commission, adjust as needed

    IF upper(coalesce(ord.metode_pembayaran,'TUNAI')) IN ('SALDO','PAMILO_PAY','NONTUNAI') THEN
      -- Ensure buyer has enough balance
      SELECT COALESCE(saldo,0) INTO buyer_saldo FROM public.users WHERE user_id = ord.pembeli_id FOR UPDATE;
      IF buyer_saldo < ord.total_pembayaran THEN
        RAISE EXCEPTION 'insufficient buyer balance';
      END IF;

      -- debit buyer and create ledger
      INSERT INTO public.transaksi_saldo(user_id, tipe_transaksi, jumlah, status_transaksi, catatan_admin)
      VALUES (ord.pembeli_id, 'DEBET', ord.total_pembayaran, 'SUKSES', concat('Settlement order ', ord.id))
      RETURNING id INTO tx_buyer_id;

      UPDATE public.users SET saldo = COALESCE(saldo,0) - ord.total_pembayaran WHERE user_id = ord.pembeli_id;

      -- credit seller (minus commission)
      INSERT INTO public.transaksi_saldo(user_id, tipe_transaksi, jumlah, status_transaksi, catatan_admin)
      VALUES (ord.penjual_id, 'CREDIT', ord.total_pembayaran - commission, 'SUKSES', concat('Settlement payout order ', ord.id))
      RETURNING id INTO tx_seller_id;

      UPDATE public.users SET saldo = COALESCE(saldo,0) + (ord.total_pembayaran - commission) WHERE user_id = ord.penjual_id;
    END IF;

    -- mark items and order as finished
    UPDATE public.order_items SET status_item = 'SELESAI' WHERE order_id = p_order_id;
    UPDATE public.orders SET status_order = 'SELESAI' WHERE id = p_order_id RETURNING 'orders' AS table_name, id, status_order INTO ord;

    RETURN QUERY SELECT ord.table_name, ord.id, ord.status_order;
    RETURN;
  END IF;

  -- Try migo_orders
  IF EXISTS (SELECT 1 FROM public.migo_orders WHERE id = p_order_id) THEN
    SELECT * INTO ord FROM public.migo_orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'migo order not found'; END IF;

    commission := COALESCE(ord.total_pembayaran,0) * 0.10;

    IF upper(coalesce(ord.metode_pembayaran,'TUNAI')) IN ('SALDO','PAMILO_PAY','NONTUNAI') THEN
      SELECT COALESCE(saldo,0) INTO buyer_saldo FROM public.users WHERE user_id = ord.pembeli_id FOR UPDATE;
      IF buyer_saldo < ord.total_pembayaran THEN
        RAISE EXCEPTION 'insufficient buyer balance';
      END IF;

      INSERT INTO public.transaksi_saldo(user_id, tipe_transaksi, jumlah, status_transaksi, catatan_admin)
      VALUES (ord.pembeli_id, 'DEBET', ord.total_pembayaran, 'SUKSES', concat('Settlement migo_order ', ord.id))
      RETURNING id INTO tx_buyer_id;

      UPDATE public.users SET saldo = COALESCE(saldo,0) - ord.total_pembayaran WHERE user_id = ord.pembeli_id;

      INSERT INTO public.transaksi_saldo(user_id, tipe_transaksi, jumlah, status_transaksi, catatan_admin)
      VALUES (ord.penjual_id, 'CREDIT', ord.total_pembayaran - commission, 'SUKSES', concat('Settlement payout migo_order ', ord.id))
      RETURNING id INTO tx_seller_id;

      UPDATE public.users SET saldo = COALESCE(saldo,0) + (ord.total_pembayaran - commission) WHERE user_id = ord.penjual_id;
    END IF;

    UPDATE public.migo_orders SET status_order = 'SELESAI' WHERE id = p_order_id RETURNING 'migo_orders' AS table_name, id, status_order INTO ord;
    RETURN QUERY SELECT ord.table_name, ord.id, ord.status_order;
    RETURN;
  END IF;

  RAISE EXCEPTION 'order not found: %', p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6) Order cancel: mark order as DIBATALKAN and try to clear assigned driver/kurir
CREATE OR REPLACE FUNCTION public.order_cancel(p_order_id uuid, p_actor_id uuid, p_reason text)
RETURNS TABLE(table_name text, id uuid, status_order text) AS $$
DECLARE
  updated_row RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM public.migo_orders WHERE id = p_order_id) THEN
    -- try to clear driver_id if column exists
    PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='migo_orders' AND column_name='driver_id';
    IF FOUND THEN
      UPDATE public.migo_orders SET status_order = 'DIBATALKAN', driver_id = NULL WHERE id = p_order_id RETURNING 'migo_orders' AS table_name, id, status_order INTO updated_row;
    ELSE
      UPDATE public.migo_orders SET status_order = 'DIBATALKAN' WHERE id = p_order_id RETURNING 'migo_orders' AS table_name, id, status_order INTO updated_row;
    END IF;
    RETURN QUERY SELECT updated_row.table_name, updated_row.id, updated_row.status_order;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.orders WHERE id = p_order_id) THEN
    PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='kurir_id';
    IF FOUND THEN
      UPDATE public.orders SET status_order = 'DIBATALKAN', kurir_id = NULL WHERE id = p_order_id RETURNING 'orders' AS table_name, id, status_order INTO updated_row;
    ELSE
      UPDATE public.orders SET status_order = 'DIBATALKAN' WHERE id = p_order_id RETURNING 'orders' AS table_name, id, status_order INTO updated_row;
    END IF;

    -- also mark related order_items as DIBATALKAN
    UPDATE public.order_items SET status_item = 'DIBATALKAN' WHERE order_id = p_order_id;

    RETURN QUERY SELECT updated_row.table_name, updated_row.id, updated_row.status_order;
    RETURN;
  END IF;

  RAISE EXCEPTION 'order not found: %', p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notes:
-- - These functions use SECURITY DEFINER so they must be created by a privileged role (the DB owner).
-- - Adjust status strings and column names if your schema differs. Test in Supabase SQL editor first.
-- - For full accounting (driver commissions, refunds), expand `order_finish` to call wallet RPCs server-side when appropriate.
