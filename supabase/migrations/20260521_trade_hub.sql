-- ============================================================
-- NOVACTORIO — Trade Hub (player-to-player marketplace)
-- Requires: profiles table, chat_messages table
-- ============================================================

-- Add channel column to chat_messages for trade channel
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'global' CHECK (channel IN ('global', 'trade'));

-- Trade listings: what players offer for sale
CREATE TABLE IF NOT EXISTS trade_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_username TEXT NOT NULL,
  item_name TEXT NOT NULL,
  item_quantity INTEGER NOT NULL CHECK (item_quantity > 0),
  price_pln INTEGER NOT NULL CHECK (price_pln > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'reserved', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trade_listings_status_idx ON trade_listings (status);
CREATE INDEX IF NOT EXISTS trade_listings_seller_idx ON trade_listings (seller_id);

ALTER TABLE trade_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active listings" ON trade_listings FOR SELECT
  USING (status = 'active' OR seller_id = auth.uid());
CREATE POLICY "Users can create own listings" ON trade_listings FOR INSERT
  WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Sellers can update own listings" ON trade_listings FOR UPDATE
  USING (auth.uid() = seller_id);
CREATE POLICY "Sellers can delete own listings" ON trade_listings FOR DELETE
  USING (auth.uid() = seller_id);

-- Trade agreements: when buyer and seller agree on a deal
CREATE TABLE IF NOT EXISTS trade_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES trade_listings(id) ON DELETE SET NULL,
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  buyer_username TEXT NOT NULL,
  item_name TEXT NOT NULL,
  item_quantity INTEGER NOT NULL CHECK (item_quantity > 0),
  price_pln INTEGER NOT NULL CHECK (price_pln > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fee_paid', 'completed', 'disputed', 'cancelled')),
  chat_proof TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trade_agreements_seller_idx ON trade_agreements (seller_id);
CREATE INDEX IF NOT EXISTS trade_agreements_buyer_idx ON trade_agreements (buyer_id);
CREATE INDEX IF NOT EXISTS trade_agreements_status_idx ON trade_agreements (status);

ALTER TABLE trade_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties can view agreements" ON trade_agreements FOR SELECT
  USING (auth.uid() = seller_id OR auth.uid() = buyer_id);
CREATE POLICY "System can create agreements" ON trade_agreements FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Parties can update agreements" ON trade_agreements FOR UPDATE
  USING (auth.uid() = seller_id OR auth.uid() = buyer_id);

-- Trade fees: 5% fee on each agreement
CREATE TABLE IF NOT EXISTS trade_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID NOT NULL REFERENCES trade_agreements(id) ON DELETE CASCADE,
  payer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_grosz INTEGER NOT NULL CHECK (amount_grosz > 0),
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS trade_fees_payer_idx ON trade_fees (payer_id);
CREATE INDEX IF NOT EXISTS trade_fees_agreement_idx ON trade_fees (agreement_id);
CREATE INDEX IF NOT EXISTS trade_fees_status_idx ON trade_fees (status);

ALTER TABLE trade_fees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own fees" ON trade_fees FOR SELECT
  USING (auth.uid() = payer_id);
CREATE POLICY "Service role manages fees" ON trade_fees FOR INSERT
  WITH CHECK (auth.uid() = payer_id OR auth.role() = 'service_role');
CREATE POLICY "Service role updates fees" ON trade_fees FOR UPDATE
  USING (auth.role() = 'service_role');

-- Trade bans: 10 unpaid fees = ban
CREATE TABLE IF NOT EXISTS trade_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  reason TEXT NOT NULL,
  unpaid_agreements INTEGER NOT NULL DEFAULT 0,
  banned_at TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT true
);

ALTER TABLE trade_bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view bans" ON trade_bans FOR SELECT USING (true);
CREATE POLICY "Service role manages bans" ON trade_bans FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role updates bans" ON trade_bans FOR UPDATE
  USING (auth.role() = 'service_role');

-- Function: count unpaid fees for a user
CREATE OR REPLACE FUNCTION count_unpaid_fees(p_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM trade_fees
  WHERE payer_id = p_user_id
    AND status = 'pending'
    AND created_at > NOW() - INTERVAL '90 days';
  RETURN v_count;
END;
$$;

-- Function: auto-ban user if 10+ unpaid fees
CREATE OR REPLACE FUNCTION auto_ban_if_unpaid()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_unpaid INTEGER;
  v_user_id UUID;
BEGIN
  v_user_id := NEW.payer_id;
  SELECT count_unpaid_fees(v_user_id) INTO v_unpaid;
  IF v_unpaid >= 10 THEN
    INSERT INTO trade_bans (user_id, reason, unpaid_agreements, active)
    VALUES (v_user_id, 'Auto-ban: 10+ unpaid trade fees', v_unpaid, true)
    ON CONFLICT (user_id) DO UPDATE
      SET reason = 'Auto-ban: 10+ unpaid trade fees',
          unpaid_agreements = v_unpaid,
          banned_at = NOW(),
          active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trade_auto_ban ON trade_fees;
CREATE TRIGGER trade_auto_ban
  AFTER INSERT ON trade_fees
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION auto_ban_if_unpaid();
