export const MYSQL_SCHEMA_SQL = `-- Smart Retail AI — Normalized MySQL 8.0 Relational Schema
-- Phase 3 Database Architecture Specification

CREATE DATABASE IF NOT EXISTS smart_retail_ai
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE smart_retail_ai;

-- 1. Roles & Users (RBAC)
CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name ENUM('admin', 'staff') NOT NULL UNIQUE,
  description VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id INT NOT NULL,
  branch VARCHAR(80) NOT NULL DEFAULT 'Flagship Downtown',
  avatar_url VARCHAR(500) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_users_branch (branch)
);

-- 2. Categories & Suppliers
CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255) NULL
);

CREATE TABLE suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  contact_email VARCHAR(160) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  lead_time_days INT NOT NULL DEFAULT 5 CHECK (lead_time_days >= 1)
);

-- 3. Products & Inventory
CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(40) NOT NULL UNIQUE,
  barcode VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  category_id INT NOT NULL,
  supplier_id INT NOT NULL,
  purchase_price DECIMAL(10, 2) NOT NULL CHECK (purchase_price >= 0),
  selling_price DECIMAL(10, 2) NOT NULL CHECK (selling_price >= 0),
  image_url VARCHAR(500) NULL,
  expiry_date DATE NULL,
  branch VARCHAR(80) NOT NULL DEFAULT 'Flagship Downtown',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_products_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_products_barcode (barcode),
  INDEX idx_products_branch (branch)
);

CREATE TABLE inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL UNIQUE,
  stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  min_stock_level INT NOT NULL DEFAULT 10 CHECK (min_stock_level >= 0),
  reorder_point INT NOT NULL DEFAULT 15 CHECK (reorder_point >= 0),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES products(id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

-- 4. Customers
CREATE TABLE customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NULL UNIQUE,
  phone VARCHAR(40) NULL,
  branch VARCHAR(80) NOT NULL DEFAULT 'Flagship Downtown',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_customers_branch (branch)
);

-- 5. Sales & Line Items
CREATE TABLE sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(40) NOT NULL UNIQUE,
  customer_id INT NULL,
  user_id INT NOT NULL,
  branch VARCHAR(80) NOT NULL,
  subtotal DECIMAL(12, 2) NOT NULL,
  tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(12, 2) NOT NULL,
  payment_method ENUM('Card', 'Cash', 'Mobile Pay') NOT NULL DEFAULT 'Card',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sales_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_sales_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_sales_created (created_at),
  INDEX idx_sales_branch (branch)
);

CREATE TABLE sale_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL,
  unit_cost DECIMAL(10, 2) NOT NULL,
  line_total DECIMAL(12, 2) NOT NULL,
  CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id) REFERENCES sales(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_sale_items_product FOREIGN KEY (product_id) REFERENCES products(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_sale_items_product (product_id)
);

-- 6. Purchases & Stock Movements
CREATE TABLE purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_id INT NOT NULL,
  user_id INT NOT NULL,
  branch VARCHAR(80) NOT NULL,
  total_cost DECIMAL(12, 2) NOT NULL,
  status ENUM('Received', 'Pending') NOT NULL DEFAULT 'Received',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_purchases_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE purchase_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_cost DECIMAL(10, 2) NOT NULL,
  CONSTRAINT fk_purchase_items_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_purchase_items_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE stock_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  movement_type ENUM('IN', 'OUT', 'SALE', 'ADJUSTMENT') NOT NULL,
  quantity_delta INT NOT NULL,
  previous_stock INT NOT NULL,
  new_stock INT NOT NULL,
  reason VARCHAR(255) NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_movements_product FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_movements_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_movements_created (created_at)
);

-- 7. Notifications & ML Forecasts
CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  severity ENUM('critical', 'warning', 'info') NOT NULL DEFAULT 'info',
  category ENUM('low_stock', 'stockout_prediction', 'sales_milestone', 'inventory_event') NOT NULL,
  product_id INT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_product FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE SET NULL
);

CREATE TABLE forecasts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  horizon_days INT NOT NULL,
  target_date DATE NOT NULL,
  predicted_revenue DECIMAL(12, 2) NOT NULL,
  lower_bound DECIMAL(12, 2) NOT NULL,
  upper_bound DECIMAL(12, 2) NOT NULL,
  model_mae DECIMAL(10, 2) NOT NULL,
  model_rmse DECIMAL(10, 2) NOT NULL,
  model_mape DECIMAL(6, 2) NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_forecasts_target (target_date)
);
`;
