CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TYPE user_role AS ENUM ('tourist','business_owner','transport_provider','admin');
CREATE TYPE approval_status AS ENUM ('pending','approved','rejected','suspended');
CREATE TYPE booking_status AS ENUM ('pending','confirmed','cancelled','completed','rejected');
CREATE TYPE payment_status AS ENUM ('unpaid','pending','paid','failed','refunded');
CREATE TYPE listing_type AS ENUM ('destination','accommodation','restaurant','business');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL, password_hash text NOT NULL, full_name text NOT NULL, phone text,
  role user_role NOT NULL DEFAULT 'tourist', is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE municipalities (id serial PRIMARY KEY, name text UNIQUE NOT NULL);
INSERT INTO municipalities(name) VALUES ('Virac'),('San Andres'),('Baras'),('Bato'),('Caramoran'),('Gigmoto'),('Pandan'),('Panganiban'),('San Miguel'),('Viga'),('Bagamanoc');
CREATE TABLE business_categories (id serial PRIMARY KEY, name text UNIQUE NOT NULL);
CREATE TABLE destination_categories (id serial PRIMARY KEY, name text UNIQUE NOT NULL);
CREATE TABLE point_tiers (id serial PRIMARY KEY, name text UNIQUE NOT NULL, points int NOT NULL CHECK (points >= 0)); -- admin-configurable
INSERT INTO point_tiers(name,points) VALUES ('Easy',10),('Moderate',25),('Difficult',50),('Remote',100);

CREATE TABLE businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id),
  category_id int REFERENCES business_categories(id), municipality_id int REFERENCES municipalities(id),
  name text NOT NULL, description text, address text, lat numeric(9,6), lng numeric(9,6),
  phone text, hours jsonb, status approval_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id int REFERENCES destination_categories(id),
  municipality_id int NOT NULL REFERENCES municipalities(id),
  name text NOT NULL, description text, history text, address text, lat numeric(9,6), lng numeric(9,6),
  entrance_fee numeric(10,2), hours jsonb, facilities text[], safety_notes text, accessibility_notes text,
  travel_minutes_from_virac int, point_tier_id int REFERENCES point_tiers(id),
  photos text[] DEFAULT '{}', cover_photo text, is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE accommodations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('hotel','resort','inn','staycation','homestay','private')),
  amenities text[] DEFAULT '{}'
);
CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id uuid NOT NULL REFERENCES accommodations(id) ON DELETE CASCADE,
  name text NOT NULL, capacity int NOT NULL CHECK (capacity > 0),
  price_per_night numeric(10,2) NOT NULL CHECK (price_per_night >= 0),
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0), photos text[] DEFAULT '{}'
);
CREATE TABLE restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  cuisines text[] DEFAULT '{}', price_range smallint CHECK (price_range BETWEEN 1 AND 4),
  accepts_reservations boolean DEFAULT false
);
CREATE TABLE menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  item_name text NOT NULL, description text, price numeric(10,2) NOT NULL, photo text
);
CREATE TABLE transport_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL, phone text, status approval_status NOT NULL DEFAULT 'pending'
);
CREATE TABLE vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES transport_providers(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('tricycle','van','multicab','motorcycle','car','other')),
  plate_no text, capacity int NOT NULL, driver_name text, is_available boolean DEFAULT true
);
CREATE TABLE transport_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES transport_providers(id) ON DELETE CASCADE,
  origin text NOT NULL, destination text NOT NULL, fare numeric(10,2) NOT NULL CHECK (fare >= 0), est_minutes int
);
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0), method text, provider_ref text UNIQUE,
  status payment_status NOT NULL DEFAULT 'pending', paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE accommodation_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id), room_id uuid NOT NULL REFERENCES rooms(id),
  check_in date NOT NULL, check_out date NOT NULL, guests int NOT NULL CHECK (guests > 0),
  total numeric(12,2) NOT NULL, status booking_status NOT NULL DEFAULT 'pending',
  payment_id uuid REFERENCES payments(id), created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (check_out > check_in)
);
CREATE TABLE transport_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id), route_id uuid REFERENCES transport_routes(id),
  vehicle_id uuid REFERENCES vehicles(id), pickup text NOT NULL, dropoff text NOT NULL,
  pickup_at timestamptz NOT NULL, passengers int NOT NULL CHECK (passengers > 0), luggage text,
  fare numeric(10,2), status booking_status NOT NULL DEFAULT 'pending',
  payment_id uuid REFERENCES payments(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE restaurant_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id), restaurant_id uuid NOT NULL REFERENCES restaurants(id),
  reserved_at timestamptz NOT NULL, party_size int NOT NULL CHECK (party_size > 0),
  status booking_status NOT NULL DEFAULT 'pending'
);
CREATE TABLE qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), listing_type listing_type NOT NULL, listing_id uuid NOT NULL,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24),'hex'),
  points_override int CHECK (points_override >= 0), cooldown_hours int NOT NULL DEFAULT 24,
  is_active boolean NOT NULL DEFAULT true, created_at timestamptz DEFAULT now()
);
CREATE TABLE checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id), qr_code_id uuid NOT NULL REFERENCES qr_codes(id),
  points_awarded int NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_checkins_user_qr ON checkins(user_id, qr_code_id, created_at DESC);
CREATE TABLE points_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
  delta int NOT NULL, reason text NOT NULL, checkin_id uuid REFERENCES checkins(id), redemption_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_points_user ON points_transactions(user_id);
CREATE TABLE rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text,
  points_cost int NOT NULL CHECK (points_cost > 0), stock int, is_active boolean DEFAULT true
);
CREATE TABLE reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
  reward_id uuid NOT NULL REFERENCES rewards(id), claim_code text UNIQUE NOT NULL,
  claimed_at timestamptz, claimed_by uuid REFERENCES users(id), created_at timestamptz DEFAULT now()
);
CREATE TABLE itineraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL, preferences jsonb, budget numeric(12,2), share_token text UNIQUE,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE itinerary_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id uuid NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  day_no int NOT NULL, position int NOT NULL, title text, listing_type listing_type, listing_id uuid,
  start_time time, duration_min int, est_cost numeric(10,2), notes text
);
CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
  listing_type listing_type NOT NULL, listing_id uuid NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5), comment text,
  created_at timestamptz DEFAULT now(), UNIQUE (user_id, listing_type, listing_id)
);
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL, body text, read_at timestamptz, created_at timestamptz DEFAULT now()
);
CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY, actor_id uuid REFERENCES users(id), action text NOT NULL,
  entity text, entity_id text, meta jsonb, created_at timestamptz DEFAULT now()
);

-- Starter categories (editable by admins later; these are labels, not listings)
INSERT INTO business_categories(name) VALUES ('Hotels and resorts'),('Restaurants'),('Staycation houses'),('Tour operators'),('Transportation'),('Cafes'),('Souvenir shops'),('Groceries'),('Adventure and recreation'),('Other');
INSERT INTO destination_categories(name) VALUES ('Beach'),('Falls'),('Mountain'),('Church and heritage'),('Island'),('Surf spot'),('Viewpoint'),('Other');
