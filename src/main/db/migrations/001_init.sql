-- =====================================================================
-- Migración 001 — Esquema inicial
-- App de escuela de deportes acuáticos (reemplazo de 'software inc.xlsx')
--
-- Convenciones:
--   Dinero  -> INTEGER (pesos COP enteros, sin decimales)
--   Fechas  -> TEXT ISO 'YYYY-MM-DD'
--   Horas   -> INTEGER minutos desde medianoche (0..1439)
--   Boolean -> INTEGER 0/1 con CHECK
-- =====================================================================

-- ---------- Metadatos / configuración / trazabilidad de import ----------

CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE import_batches (
  id            INTEGER PRIMARY KEY,
  source_file   TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'running'
                CHECK (status IN ('running','completed','rolled_back','failed')),
  rows_ok       INTEGER NOT NULL DEFAULT 0,
  rows_error    INTEGER NOT NULL DEFAULT 0,
  started_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  finished_at   TEXT
);

CREATE TABLE import_errors (
  id          INTEGER PRIMARY KEY,
  batch_id    INTEGER NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  sheet       TEXT NOT NULL,
  source_row  INTEGER,
  raw_json    TEXT,
  reason      TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX ix_import_errors_batch ON import_errors(batch_id);

-- ---------- Personas (una tabla con roles) ----------

CREATE TABLE persons (
  id                   INTEGER PRIMARY KEY,
  full_name            TEXT NOT NULL,
  name_normalized      TEXT NOT NULL,
  nickname             TEXT,
  nickname_normalized  TEXT,

  is_client            INTEGER NOT NULL DEFAULT 0 CHECK (is_client IN (0,1)),
  is_professor         INTEGER NOT NULL DEFAULT 0 CHECK (is_professor IN (0,1)),
  is_supplier          INTEGER NOT NULL DEFAULT 0 CHECK (is_supplier IN (0,1)),

  passport             TEXT,
  email                TEXT,
  country              TEXT,
  country_raw          TEXT,
  birth_date           TEXT,           -- ISO o NULL si irrecuperable
  birth_date_raw       TEXT,
  check_in             TEXT,
  check_out            TEXT,
  garos                TEXT,
  taking_course        INTEGER DEFAULT 0 CHECK (taking_course IN (0,1)),
  discount_pct         REAL DEFAULT 0, -- porcentaje 0..100
  paid                 INTEGER DEFAULT 0,
  still_here           INTEGER DEFAULT 1 CHECK (still_here IN (0,1)),
  comment              TEXT,

  photo_path           TEXT,
  photo_thumb_path     TEXT,

  import_batch_id      INTEGER REFERENCES import_batches(id),
  source_sheet         TEXT,
  source_row           INTEGER,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX ix_persons_name_norm ON persons(name_normalized);
CREATE INDEX ix_persons_nick_norm ON persons(nickname_normalized);
CREATE INDEX ix_persons_roles     ON persons(is_client, is_professor, is_supplier);
CREATE UNIQUE INDEX ux_persons_passport ON persons(passport) WHERE passport IS NOT NULL AND passport <> '';
CREATE UNIQUE INDEX ux_persons_email    ON persons(email)    WHERE email    IS NOT NULL AND email    <> '';

-- ---------- Catálogo de servicios y equipos ----------

CREATE TABLE service_catalog (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  discipline      TEXT,
  season_year     INTEGER,
  hours           REAL,
  days            INTEGER DEFAULT 0,
  price           INTEGER,
  professor_pct   REAL DEFAULT 0,     -- fracción 0..1
  pay_model_json  TEXT,               -- ProfessorPayModel serializado
  is_class        INTEGER NOT NULL DEFAULT 0 CHECK (is_class IN (0,1)),
  active          INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  import_batch_id INTEGER REFERENCES import_batches(id),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX ix_service_name_norm ON service_catalog(name_normalized);

CREATE TABLE equipment (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'kite'
                  CHECK (category IN ('kite','board','efoil','sup','wing','wake','other')),
  count           INTEGER DEFAULT 1,
  price           INTEGER,
  active          INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  import_batch_id INTEGER REFERENCES import_batches(id)
);
CREATE INDEX ix_equipment_name_norm ON equipment(name_normalized);

-- ---------- Transacciones / reservas (hoja Club) ----------

CREATE TABLE transactions (
  id                     INTEGER PRIMARY KEY,
  tx_date                TEXT NOT NULL,
  start_min              INTEGER,
  end_min                INTEGER,
  service_raw            TEXT,
  service_id             INTEGER REFERENCES service_catalog(id),
  is_class               INTEGER DEFAULT 0 CHECK (is_class IN (0,1)),
  resolved_service_id    INTEGER REFERENCES service_catalog(id),
  professor_id           INTEGER REFERENCES persons(id),
  client_id              INTEGER REFERENCES persons(id),
  kite_id                INTEGER REFERENCES equipment(id),
  board_id               INTEGER REFERENCES equipment(id),
  price_snapshot         INTEGER,
  professor_pct_snapshot REAL,
  price_override         INTEGER,
  price_effective        INTEGER GENERATED ALWAYS AS (COALESCE(price_override, price_snapshot)) VIRTUAL,
  duration_min           INTEGER GENERATED ALWAYS AS (
                           CASE WHEN end_min IS NOT NULL AND start_min IS NOT NULL
                                THEN end_min - start_min END) VIRTUAL,
  professor_salary       INTEGER GENERATED ALWAYS AS (
                           CAST(COALESCE(price_override, price_snapshot) * COALESCE(professor_pct_snapshot,0) AS INTEGER)
                         ) VIRTUAL,
  comment                TEXT,
  import_batch_id        INTEGER REFERENCES import_batches(id),
  source_sheet           TEXT,
  source_row             INTEGER,
  created_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX ix_tx_date      ON transactions(tx_date);
CREATE INDEX ix_tx_professor ON transactions(professor_id, tx_date);
CREATE INDEX ix_tx_client    ON transactions(client_id, tx_date);
CREATE INDEX ix_tx_service   ON transactions(service_id);

-- ---------- Bar: productos y ventas ----------

CREATE TABLE bar_products (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  box_price       INTEGER,
  units_per_box   REAL,
  sell_price      INTEGER,
  active          INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  import_batch_id INTEGER REFERENCES import_batches(id)
);
CREATE INDEX ix_bar_products_norm ON bar_products(name_normalized);

CREATE TABLE bar_sales (
  id              INTEGER PRIMARY KEY,
  sale_date       TEXT NOT NULL,
  client_id       INTEGER REFERENCES persons(id),
  client_raw      TEXT,
  product_id      INTEGER REFERENCES bar_products(id),
  product_raw     TEXT,
  qty             REAL DEFAULT 1,
  total           INTEGER,
  paid_cash       INTEGER DEFAULT 0 CHECK (paid_cash IN (0,1)),
  already_paid    INTEGER DEFAULT 0 CHECK (already_paid IN (0,1)),
  import_batch_id INTEGER REFERENCES import_batches(id),
  source_sheet    TEXT,
  source_row      INTEGER
);
CREATE INDEX ix_bar_sales_date    ON bar_sales(sale_date);
CREATE INDEX ix_bar_sales_product ON bar_sales(product_id);

-- ---------- Gastos (hoja Outcome) ----------

CREATE TABLE expenses (
  id              INTEGER PRIMARY KEY,
  expense_date    TEXT NOT NULL,
  supply_name     TEXT,
  count           REAL DEFAULT 1,
  area_name       TEXT,
  area_person_id  INTEGER REFERENCES persons(id),
  supplier_id     INTEGER REFERENCES persons(id),
  supplier_raw    TEXT,
  amount_out      INTEGER NOT NULL,
  comment         TEXT,
  import_batch_id INTEGER REFERENCES import_batches(id),
  source_sheet    TEXT,
  source_row      INTEGER
);
CREATE INDEX ix_expenses_date     ON expenses(expense_date);
CREATE INDEX ix_expenses_supplier ON expenses(supplier_id);
CREATE INDEX ix_expenses_area     ON expenses(area_person_id);

-- ---------- Facturas de cliente ----------

CREATE TABLE client_bills (
  id             INTEGER PRIMARY KEY,
  client_id      INTEGER NOT NULL REFERENCES persons(id),
  bill_date      TEXT NOT NULL,
  lodging_days   INTEGER DEFAULT 0,
  lodging_rate   INTEGER DEFAULT 0,
  discount_pct   REAL DEFAULT 0,
  deductions     INTEGER DEFAULT 0,
  already_paid   INTEGER DEFAULT 0,
  card_surcharge INTEGER NOT NULL DEFAULT 0 CHECK (card_surcharge IN (0,1)),
  subtotal       INTEGER,
  total          INTEGER,
  net_to_pay     INTEGER,
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','paid','void')),
  pdf_path       TEXT,
  emailed_at     TEXT,
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX ix_bills_client ON client_bills(client_id, bill_date);

CREATE TABLE client_bill_items (
  id             INTEGER PRIMARY KEY,
  bill_id        INTEGER NOT NULL REFERENCES client_bills(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL CHECK (kind IN ('service','bar','lodging','deduction','other')),
  transaction_id INTEGER REFERENCES transactions(id),
  bar_sale_id    INTEGER REFERENCES bar_sales(id),
  description    TEXT NOT NULL,
  qty            REAL DEFAULT 1,
  unit_price     INTEGER,
  line_total     INTEGER
);
CREATE INDEX ix_bill_items_bill ON client_bill_items(bill_id);

-- ---------- Liquidación de profesores ----------

CREATE TABLE professor_settlements (
  id                INTEGER PRIMARY KEY,
  professor_id      INTEGER NOT NULL REFERENCES persons(id),
  period_year       INTEGER NOT NULL,
  period_month      INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  gross_salary      INTEGER,
  bar_discount      INTEGER DEFAULT 0,
  expenses_assigned INTEGER DEFAULT 0,
  net_amount        INTEGER,
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','paid')),
  pdf_path          TEXT,
  emailed_at        TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (professor_id, period_year, period_month)
);

-- ---------- Planes de pago / amortización ----------

CREATE TABLE payment_plans (
  id              INTEGER PRIMARY KEY,
  title           TEXT NOT NULL,
  person_id       INTEGER REFERENCES persons(id),
  equipment_id    INTEGER REFERENCES equipment(id),
  principal       INTEGER NOT NULL,
  start_date      TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','settled','cancelled')),
  import_batch_id INTEGER REFERENCES import_batches(id),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE payment_plan_installments (
  id        INTEGER PRIMARY KEY,
  plan_id   INTEGER NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
  paid_date TEXT NOT NULL,
  amount    INTEGER NOT NULL,
  comment   TEXT
);
CREATE INDEX ix_installments_plan ON payment_plan_installments(plan_id, paid_date);

-- ---------- Vistas para lo calculado ----------

-- Edad de las personas (excluye fechas nulas o futuras -> corrige edades negativas)
CREATE VIEW v_person_ages AS
SELECT id, full_name,
       CAST((julianday('now') - julianday(birth_date)) / 365.25 AS INTEGER) AS age
FROM persons
WHERE birth_date IS NOT NULL AND birth_date <= date('now');
