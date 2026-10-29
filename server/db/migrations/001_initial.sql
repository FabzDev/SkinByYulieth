CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  user_agent TEXT,
  ip TEXT
);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE,
  default_price INTEGER NOT NULL CHECK (default_price >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  updated_by INTEGER NOT NULL REFERENCES users(id)
);
CREATE INDEX idx_services_active ON services(active, name);

CREATE TABLE expense_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id)
);

CREATE TABLE clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  updated_by INTEGER NOT NULL REFERENCES users(id)
);
CREATE INDEX idx_clients_name ON clients(name COLLATE NOCASE);
CREATE INDEX idx_clients_phone ON clients(phone);

CREATE TABLE sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id INTEGER REFERENCES services(id),
  concept TEXT NOT NULL,
  client_id INTEGER REFERENCES clients(id),
  client_name TEXT,
  total_amount INTEGER NOT NULL CHECK (total_amount > 0),
  occurred_at TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
  voided_at TEXT,
  voided_by INTEGER REFERENCES users(id),
  void_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  updated_by INTEGER NOT NULL REFERENCES users(id)
);
CREATE INDEX idx_sales_occurred ON sales(occurred_at);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sales_client ON sales(client_id);

CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  occurred_at TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('cash', 'transfer')),
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'voided')),
  voided_at TEXT,
  voided_by INTEGER REFERENCES users(id),
  void_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  updated_by INTEGER NOT NULL REFERENCES users(id)
);
CREATE INDEX idx_payments_sale ON payments(sale_id);
CREATE INDEX idx_payments_occurred ON payments(occurred_at, status);

CREATE TABLE refunds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  payment_id INTEGER NOT NULL REFERENCES payments(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  occurred_at TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('cash', 'transfer')),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
  voided_at TEXT,
  voided_by INTEGER REFERENCES users(id),
  void_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  updated_by INTEGER NOT NULL REFERENCES users(id)
);
CREATE INDEX idx_refunds_sale ON refunds(sale_id);
CREATE INDEX idx_refunds_payment ON refunds(payment_id);
CREATE INDEX idx_refunds_occurred ON refunds(occurred_at, status);

CREATE TABLE expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  category_id INTEGER NOT NULL REFERENCES expense_categories(id),
  category_name TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  description TEXT,
  receipt_blob BLOB,
  receipt_filename TEXT,
  receipt_mime TEXT,
  receipt_size INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
  voided_at TEXT,
  voided_by INTEGER REFERENCES users(id),
  void_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  updated_by INTEGER NOT NULL REFERENCES users(id)
);
CREATE INDEX idx_expenses_occurred ON expenses(occurred_at, status);
CREATE INDEX idx_expenses_category ON expenses(category_id);

CREATE TABLE withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  occurred_at TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
  voided_at TEXT,
  voided_by INTEGER REFERENCES users(id),
  void_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  updated_by INTEGER NOT NULL REFERENCES users(id)
);
CREATE INDEX idx_withdrawals_occurred ON withdrawals(occurred_at, status);

CREATE TABLE other_income (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  occurred_at TEXT NOT NULL,
  concept TEXT NOT NULL,
  source_sale_id INTEGER REFERENCES sales(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
  voided_at TEXT,
  voided_by INTEGER REFERENCES users(id),
  void_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  updated_by INTEGER NOT NULL REFERENCES users(id)
);
CREATE INDEX idx_other_income_occurred ON other_income(occurred_at, status);

CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  summary TEXT NOT NULL,
  reason TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

CREATE VIEW sale_financials AS
SELECT
  s.id AS sale_id,
  (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.sale_id = s.id AND p.status = 'valid') AS paid,
  (SELECT COUNT(*) FROM payments p WHERE p.sale_id = s.id AND p.status = 'valid') AS payments_count,
  (SELECT MAX(p.occurred_at) FROM payments p WHERE p.sale_id = s.id AND p.status = 'valid') AS last_payment_at,
  (SELECT COALESCE(SUM(r.amount), 0) FROM refunds r WHERE r.sale_id = s.id AND r.status = 'active') AS refunded
FROM sales s;
