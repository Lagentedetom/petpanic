-- ============================================
-- PetPanic - Supabase Schema
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Enums
CREATE TYPE pet_species AS ENUM ('perro', 'gato', 'otro');
CREATE TYPE alert_status AS ENUM ('active', 'resolved');
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted');

-- 3. Tables

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT 'Invitado',
  first_name TEXT,
  last_name TEXT,
  photo_url TEXT DEFAULT '',
  friend_code TEXT UNIQUE NOT NULL DEFAULT upper(substr(md5(random()::text), 1, 8)),
  primary_zone_id UUID,
  last_location GEOGRAPHY(POINT, 4326),
  last_location_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_profiles_friend_code ON profiles(friend_code);
CREATE INDEX idx_profiles_last_location ON profiles USING GIST(last_location);

CREATE TABLE pets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species pet_species NOT NULL DEFAULT 'perro',
  breed TEXT DEFAULT '',
  color TEXT DEFAULT '',
  traits TEXT DEFAULT '',
  contact_info TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  is_lost BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_pets_owner ON pets(owner_id);

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pet_name TEXT NOT NULL,
  pet_photo TEXT DEFAULT '',
  pet_breed TEXT DEFAULT '',
  pet_color TEXT DEFAULT '',
  pet_traits TEXT DEFAULT '',
  owner_contact TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  status alert_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_location ON alerts USING GIST(location);
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);

CREATE TABLE alert_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_alert_messages_alert ON alert_messages(alert_id, created_at ASC);

CREATE TABLE walking_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  radius INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_walking_zones_location ON walking_zones USING GIST(location);

CREATE TABLE zone_members (
  zone_id UUID NOT NULL REFERENCES walking_zones(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (zone_id, user_id)
);

CREATE TABLE zone_presence (
  zone_id UUID NOT NULL REFERENCES walking_zones(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_photo TEXT DEFAULT '',
  pet_names TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (zone_id, user_id)
);
CREATE INDEX idx_zone_presence_zone ON zone_presence(zone_id);

CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status friendship_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
CREATE INDEX idx_friendships_requester ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id);

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_push_subs_user ON push_subscriptions(user_id);

-- 4. PostGIS Functions

CREATE OR REPLACE FUNCTION nearby_alerts(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 2
)
RETURNS SETOF alerts AS $$
BEGIN
  RETURN QUERY
  SELECT a.*
  FROM alerts a
  WHERE a.status = 'active'
    AND ST_DWithin(
      a.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_km * 1000
    )
  ORDER BY a.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION nearby_push_subscribers(
  alert_lat DOUBLE PRECISION,
  alert_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 5,
  exclude_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  sub_user_id UUID,
  endpoint TEXT,
  p256dh TEXT,
  sub_auth TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, ps.endpoint, ps.p256dh, ps.auth
  FROM profiles p
  JOIN push_subscriptions ps ON ps.user_id = p.id
  WHERE p.id <> COALESCE(exclude_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND p.last_location IS NOT NULL
    AND p.last_location_at > now() - INTERVAL '24 hours'
    AND ST_DWithin(
      p.last_location,
      ST_SetSRID(ST_MakePoint(alert_lng, alert_lat), 4326)::geography,
      radius_km * 1000
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 5. Auto-create profile on signup

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name, first_name, last_name, photo_url, friend_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      'Invitado'
    ),
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    upper(substr(md5(random()::text), 1, 8))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 6. Row Level Security

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE walking_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Pets
CREATE POLICY "pets_select" ON pets FOR SELECT USING (true);
CREATE POLICY "pets_insert" ON pets FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "pets_update" ON pets FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "pets_delete" ON pets FOR DELETE USING (auth.uid() = owner_id);

-- Alerts
CREATE POLICY "alerts_select" ON alerts FOR SELECT USING (true);
CREATE POLICY "alerts_insert" ON alerts FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "alerts_update" ON alerts FOR UPDATE USING (auth.uid() = owner_id);

-- Alert Messages
CREATE POLICY "messages_select" ON alert_messages FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "messages_insert" ON alert_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Walking Zones
CREATE POLICY "zones_select" ON walking_zones FOR SELECT USING (true);
CREATE POLICY "zones_insert" ON walking_zones FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "zones_delete" ON walking_zones FOR DELETE USING (auth.uid() = creator_id);

-- Zone Members
CREATE POLICY "zone_members_select" ON zone_members FOR SELECT USING (true);
CREATE POLICY "zone_members_insert" ON zone_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Zone Presence
CREATE POLICY "presence_select" ON zone_presence FOR SELECT USING (true);
CREATE POLICY "presence_all" ON zone_presence FOR ALL USING (auth.uid() = user_id);

-- Friendships
CREATE POLICY "friendships_select" ON friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "friendships_insert" ON friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "friendships_update" ON friendships FOR UPDATE
  USING (auth.uid() = addressee_id);
CREATE POLICY "friendships_delete" ON friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Push Subscriptions
CREATE POLICY "push_subs_all" ON push_subscriptions FOR ALL USING (auth.uid() = user_id);

-- 7. Enable Realtime (run in SQL editor)
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE pets;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE alert_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE walking_zones;
ALTER PUBLICATION supabase_realtime ADD TABLE zone_members;
ALTER PUBLICATION supabase_realtime ADD TABLE zone_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE friendships;
