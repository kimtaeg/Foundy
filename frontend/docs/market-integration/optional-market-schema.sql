-- DRAFT / NOT EXECUTED. Optional extension design, not a migration.
-- MVP can use a versioned static manifest + existing stores.address_codes/api_cache.
-- Adopt only after deciding server-managed releases / cross-device preferences.
-- Adapt to the real backend models, migration naming and access controls first.

CREATE TABLE market_data_releases (
  id                    text PRIMARY KEY, -- immutable release identifier
  population_date       date NOT NULL,
  timezone              text NOT NULL DEFAULT 'Asia/Seoul'
                        CHECK (timezone = 'Asia/Seoul'),
  metric                text NOT NULL DEFAULT 'living_population'
                        CHECK (metric = 'living_population'),
  grid_size_m           integer NOT NULL DEFAULT 250 CHECK (grid_size_m > 0),
  aggregation_version   text NOT NULL,
  boundary_version      text NOT NULL, -- verified boundary artifact version/hash
  roads_version         text NOT NULL, -- verified road artifact version/hash
  roads_observed_on     date,          -- NULL if upstream date is not verified
  manifest_url          text NOT NULL,
  manifest_sha256       text NOT NULL CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  sources               jsonb NOT NULL CHECK (jsonb_typeof(sources) = 'array'),
  quality               jsonb NOT NULL CHECK (jsonb_typeof(quality) = 'object'),
  built_at              timestamptz NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manifest_sha256)
);
-- Contents are append-only by application contract. Public asset URLs contain no credentials.
-- Full JSON-schema and file hash/date consistency are validated by the publishing job.
-- 'current' is chosen by a release pointer/manifest deployment, not max(date) alone.

CREATE TABLE store_market_preferences (
  store_id              uuid PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  -- Exploration point. Updating this row MUST NOT update the registered store address.
  center_lat            double precision NOT NULL CHECK (center_lat BETWEEN -90 AND 90),
  center_lng            double precision NOT NULL CHECK (center_lng BETWEEN -180 AND 180),
  radius_m              integer NOT NULL DEFAULT 500
                        CHECK (radius_m BETWEEN 250 AND 2000 AND radius_m % 250 = 0),
  population_category   text NOT NULL DEFAULT 'type',
  population_group      text NOT NULL DEFAULT 'all',
  selected_hour         smallint CHECK (selected_hour BETWEEN 0 AND 23), -- NULL = observed-hour average
  show_population       boolean NOT NULL DEFAULT true,
  shop_category         text NOT NULL DEFAULT 'all'
                        CHECK (shop_category IN ('all', '카페', '음식점')),
  -- Current UI comparison item only; not a claim about surrounding shop prices.
  target_item           text NOT NULL DEFAULT '아메리카노'
                        CHECK (target_item = '아메리카노'),
  target_price_krw       integer CHECK (target_price_krw >= 0),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT market_population_filter_valid CHECK (
    (population_category = 'type' AND population_group IN ('all', 'local', 'fornLong', 'fornTemp'))
    OR (population_category = 'sex' AND population_group IN ('male', 'female'))
    OR (population_category = 'age' AND population_group IN ('a00', 'a10', 'a20', 'a30', 'a40', 'a50', 'a60', 'a70'))
  )
);
-- Backend checks authenticated ownership via stores.user_id for every read/write.
-- updated_at follows existing application-managed policy (no trigger implied).
-- No grants, RLS policies, INSERT data, migration execution, or current-schema ALTER included.
