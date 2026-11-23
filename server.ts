import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import {
  runCustomerSegmentation,
  runInventoryPredictions,
  runMarketBasketAnalysis,
  runSalesForecast,
} from './server/mlEngine';
import { MYSQL_SCHEMA_SQL } from './server/mysqlSchema';
import { BRANCHES, store } from './server/store';
import type { PublicUser, RoleName, User } from './server/types';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

interface AuthenticatedRequest extends Request {
  authUser?: PublicUser;
}

interface ResetChallenge {
  code: string;
  expiresAt: number;
}

const passwordResetChallenges = new Map<string, ResetChallenge>();

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    branch: user.branch,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { hash: derived, salt: actualSalt };
}

function verifyPassword(password: string, expectedHash: string, salt: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHash, 'hex');
  if (derived.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derived, expectedBuf);
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function signToken(user: PublicUser): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: user.id,
      role: user.role,
      email: user.email,
      exp: Date.now() + TOKEN_TTL_MS,
    })
  );
  const data = `${header}.${payload}`;
  const sig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${data}.${sig}`;
}

function verifyToken(token: string): { sub: number; role: RoleName; exp: number } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const data = `${header}.${payload}`;
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(base64UrlDecode(payload)) as {
      sub: number;
      role: RoleName;
      exp: number;
    };
    if (!decoded || typeof decoded.sub !== 'number' || Date.now() > decoded.exp) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Invalid or expired session token' });
    return;
  }
  const user = store.getSnapshot().users.find((u) => u.id === decoded.sub);
  if (!user) {
    res.status(401).json({ error: 'Account not found' });
    return;
  }
  req.authUser = toPublicUser(user);
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser || req.authUser.role !== 'admin') {
    res.status(403).json({ error: 'Administrator privileges required' });
    return;
  }
  next();
}

function parsePositiveNumber(val: unknown): number | null {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health Check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'smart-retail-ai-api' });
  });

  // Auth Bootstrap Status
  app.get('/api/auth/bootstrap-status', (_req, res) => {
    const snap = store.getSnapshot();
    const hasAdmin = snap.users.some((u) => u.role === 'admin');
    res.json({
      needsAdminSetup: !hasAdmin,
      branches: BRANCHES,
      userCount: snap.users.length,
      sampleStats: {
        products: snap.products.length,
        customers: snap.customers.length,
        sales: snap.sales.length,
        purchases: snap.purchases.length,
        suppliers: snap.suppliers.length,
      },
    });
  });

  // First-Run Admin Claim (locks automatically once first Admin is created)
  app.post('/api/auth/claim-admin', (req, res) => {
    const snap = store.getSnapshot();
    if (snap.users.some((u) => u.role === 'admin')) {
      res.status(403).json({ error: 'Admin account already claimed. Please sign in.' });
      return;
    }

    const name = String(req.body?.name ?? '').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const branch = BRANCHES.includes(req.body?.branch) ? req.body.branch : BRANCHES[0];

    if (name.length < 2 || !isValidEmail(email) || password.length < 6) {
      res.status(400).json({ error: 'Provide a valid name, email, and password (6+ chars).' });
      return;
    }

    if (snap.users.some((u) => u.email === email)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const { hash, salt } = hashPassword(password);
    const adminUser: User = {
      id: store.nextId('user'),
      name,
      email,
      passwordHash: hash,
      passwordSalt: salt,
      roleId: 1,
      role: 'admin',
      branch,
      avatarUrl: '/src/assets/images/avatar_admin_manager_1795372833714.jpg',
      createdAt: new Date().toISOString(),
    };

    snap.users.push(adminUser);
    store.commit();

    const publicUser = toPublicUser(adminUser);
    const token = signToken(publicUser);
    res.status(201).json({ token, user: publicUser });
  });

  // Register (creates Staff account, or Admin only if none exists yet)
  app.post('/api/auth/register', (req, res) => {
    const snap = store.getSnapshot();
    const name = String(req.body?.name ?? '').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const branch = BRANCHES.includes(req.body?.branch) ? req.body.branch : BRANCHES[0];

    if (name.length < 2 || !isValidEmail(email) || password.length < 6) {
      res.status(400).json({ error: 'Name, valid email, and password (min 6 characters) are required.' });
      return;
    }

    if (snap.users.some((u) => u.email === email)) {
      res.status(409).json({ error: 'Email is already registered.' });
      return;
    }

    const hasAdmin = snap.users.some((u) => u.role === 'admin');
    const role: RoleName = !hasAdmin ? 'admin' : 'staff';
    const { hash, salt } = hashPassword(password);

    const newUser: User = {
      id: store.nextId('user'),
      name,
      email,
      passwordHash: hash,
      passwordSalt: salt,
      roleId: role === 'admin' ? 1 : 2,
      role,
      branch,
      avatarUrl: role === 'admin' ? '/src/assets/images/avatar_admin_manager_1795372833714.jpg' : undefined,
      createdAt: new Date().toISOString(),
    };

    snap.users.push(newUser);
    store.commit();

    const publicUser = toPublicUser(newUser);
    const token = signToken(publicUser);
    res.status(201).json({ token, user: publicUser });
  });

  // Login
  app.post('/api/auth/login', (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const user = store.getSnapshot().users.find((u) => u.email === email);

    if (!user || !verifyPassword(password, user.passwordHash, user.passwordSalt)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const publicUser = toPublicUser(user);
    const token = signToken(publicUser);
    res.json({ token, user: publicUser });
  });

  // Forgot Password - Request Verification Code
  app.post('/api/auth/request-reset', (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const user = store.getSnapshot().users.find((u) => u.email === email);
    if (!user) {
      res.status(404).json({ error: 'No account found with that email address.' });
      return;
    }
    const code = String(crypto.randomInt(100000, 999999));
    passwordResetChallenges.set(email, {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    // Return preview verification code for local sandbox evaluation without paid SMTP
    res.json({
      message: 'Verification code generated (valid 10 minutes).',
      previewCode: code,
    });
  });

  // Reset Password
  app.post('/api/auth/reset-password', (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const code = String(req.body?.code ?? '').trim();
    const newPassword = String(req.body?.newPassword ?? '');

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }

    const challenge = passwordResetChallenges.get(email);
    if (!challenge || challenge.expiresAt < Date.now() || challenge.code !== code) {
      res.status(400).json({ error: 'Invalid or expired verification code.' });
      return;
    }

    const snap = store.getSnapshot();
    const user = snap.users.find((u) => u.email === email);
    if (!user) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    const { hash, salt } = hashPassword(newPassword);
    user.passwordHash = hash;
    user.passwordSalt = salt;
    passwordResetChallenges.delete(email);
    store.commit();

    res.json({ message: 'Password updated. You may now sign in.' });
  });

  // Current Authenticated Profile
  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.authUser });
  });

  // Update Own Profile
  app.patch('/api/auth/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    const name = String(req.body?.name ?? '').trim();
    const branch = BRANCHES.includes(req.body?.branch) ? req.body.branch : undefined;
    const snap = store.getSnapshot();
    const user = snap.users.find((u) => u.id === req.authUser!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (name.length >= 2) user.name = name;
    if (branch) user.branch = branch;
    store.commit();
    res.json({ user: toPublicUser(user) });
  });

  // User Management (Admin only)
  app.get('/api/users', requireAuth, requireAdmin, (_req, res) => {
    res.json({ users: store.getSnapshot().users.map(toPublicUser) });
  });

  app.patch('/api/users/:id/role', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const targetId = Number(req.params.id);
    const nextRole = req.body?.role === 'admin' ? 'admin' : req.body?.role === 'staff' ? 'staff' : null;
    if (!nextRole) {
      res.status(400).json({ error: 'Role must be admin or staff.' });
      return;
    }
    const snap = store.getSnapshot();
    const target = snap.users.find((u) => u.id === targetId);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (target.id === req.authUser!.id && nextRole !== 'admin') {
      res.status(400).json({ error: 'Cannot downgrade your own admin account.' });
      return;
    }
    target.role = nextRole;
    target.roleId = nextRole === 'admin' ? 1 : 2;
    store.commit();
    res.json({ user: toPublicUser(target) });
  });

  // Dashboard Overview
  app.get('/api/dashboard', requireAuth, (req, res) => {
    const branchFilter = typeof req.query.branch === 'string' && req.query.branch !== 'All' ? req.query.branch : null;
    const snap = store.getSnapshot();
    const products = store.getProductsWithInventory().filter((p) => !branchFilter || p.branch === branchFilter);
    const filteredSales = snap.sales.filter((s) => !branchFilter || s.branch === branchFilter);
    const saleIdSet = new Set(filteredSales.map((s) => s.id));
    const filteredItems = snap.saleItems.filter((item) => saleIdSet.has(item.saleId));

    const totalRevenue = Number(filteredSales.reduce((sum, s) => sum + s.totalAmount, 0).toFixed(2));
    const totalProfit = Number(
      filteredItems.reduce((sum, item) => sum + (item.unitPrice - item.unitCost) * item.quantity, 0).toFixed(2)
    );
    const totalSalesCount = filteredSales.length;
    const totalProducts = products.length;
    const totalCustomers = snap.customers.filter((c) => !branchFilter || c.branch === branchFilter).length;
    const lowStockProducts = products.filter((p) => p.stockQuantity <= p.minStockLevel);
    const inventoryRetailValue = Number(products.reduce((s, p) => s + p.valuationRetail, 0).toFixed(2));

    // Daily sales performance over last 21 days
    const dailyTotals = new Map<string, { revenue: number; orders: number }>();
    for (let d = 20; d >= 0; d--) {
      const key = new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      dailyTotals.set(key, { revenue: 0, orders: 0 });
    }
    for (const s of filteredSales) {
      const key = s.createdAt.slice(0, 10);
      const entry = dailyTotals.get(key);
      if (entry) {
        entry.revenue = Number((entry.revenue + s.totalAmount).toFixed(2));
        entry.orders += 1;
      }
    }
    const salesChart = Array.from(dailyTotals.entries()).map(([date, vals]) => ({
      date,
      revenue: vals.revenue,
      orders: vals.orders,
    }));

    // Best selling products
    const productStats = new Map<number, { unitsSold: number; revenue: number }>();
    for (const item of filteredItems) {
      const cur = productStats.get(item.productId) ?? { unitsSold: 0, revenue: 0 };
      cur.unitsSold += item.quantity;
      cur.revenue += item.lineTotal;
      productStats.set(item.productId, cur);
    }

    const allProductsMap = new Map(store.getProductsWithInventory().map((p) => [p.id, p]));
    const bestSellingProducts = Array.from(productStats.entries())
      .map(([productId, stats]) => {
        const prod = allProductsMap.get(productId);
        return {
          productId,
          name: prod?.name ?? `Product #${productId}`,
          sku: prod?.sku ?? '',
          categoryName: prod?.categoryName ?? 'General',
          stockQuantity: prod?.stockQuantity ?? 0,
          unitsSold: stats.unitsSold,
          revenue: Number(stats.revenue.toFixed(2)),
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    const custMap = new Map(snap.customers.map((c) => [c.id, c.name]));
    const recentTransactions = [...filteredSales]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8)
      .map((s) => ({
        ...s,
        customerName: s.customerId ? custMap.get(s.customerId) ?? 'Walk-in Customer' : 'Walk-in Customer',
      }));

    const unreadNotifications = snap.notifications.filter((n) => !n.isRead).length;

    res.json({
      kpis: {
        totalRevenue,
        totalProfit,
        totalSalesCount,
        totalProducts,
        totalCustomers,
        lowStockCount: lowStockProducts.length,
        inventoryRetailValue,
        unreadNotifications,
      },
      salesChart,
      bestSellingProducts,
      lowStockProducts,
      recentTransactions,
    });
  });

  // Categories & Suppliers Metadata
  app.get('/api/meta', requireAuth, (_req, res) => {
    const snap = store.getSnapshot();
    res.json({
      categories: snap.categories,
      suppliers: snap.suppliers,
      branches: BRANCHES,
    });
  });

  // Products CRUD + Barcode Lookup
  app.get('/api/products', requireAuth, (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
    const branch = typeof req.query.branch === 'string' && req.query.branch !== 'All' ? req.query.branch : null;

    let items = store.getProductsWithInventory();
    if (search) {
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.sku.toLowerCase().includes(search) ||
          p.barcode.includes(search) ||
          p.categoryName.toLowerCase().includes(search)
      );
    }
    if (categoryId) items = items.filter((p) => p.categoryId === categoryId);
    if (branch) items = items.filter((p) => p.branch === branch);

    res.json({ products: items });
  });

  app.get('/api/products/barcode/:barcode', requireAuth, (req, res) => {
    const barcode = String(req.params.barcode ?? '').trim();
    const product = store.getProductsWithInventory().find((p) => p.barcode === barcode || p.sku.toLowerCase() === barcode.toLowerCase());
    if (!product) {
      res.status(404).json({ error: `No product matched barcode "${barcode}".` });
      return;
    }
    res.json({ product });
  });

  app.post('/api/products', requireAuth, (req: AuthenticatedRequest, res) => {
    const snap = store.getSnapshot();
    const name = String(req.body?.name ?? '').trim();
    const sku = String(req.body?.sku ?? '').trim().toUpperCase();
    const barcode = String(req.body?.barcode ?? '').trim();
    const categoryId = Number(req.body?.categoryId);
    const supplierId = Number(req.body?.supplierId) || 1;
    const purchasePrice = parsePositiveNumber(req.body?.purchasePrice);
    const sellingPrice = parsePositiveNumber(req.body?.sellingPrice);
    const stockQuantity = parsePositiveNumber(req.body?.stockQuantity ?? 0);
    const minStockLevel = parsePositiveNumber(req.body?.minStockLevel ?? 10);
    const branch = BRANCHES.includes(req.body?.branch) ? req.body.branch : BRANCHES[0];
    const expiryDate = req.body?.expiryDate ? String(req.body.expiryDate).slice(0, 10) : null;

    if (!name || !sku || !barcode || purchasePrice === null || sellingPrice === null || stockQuantity === null || minStockLevel === null) {
      res.status(400).json({ error: 'All required product fields must contain valid values.' });
      return;
    }
    if (snap.products.some((p) => p.barcode === barcode || p.sku === sku)) {
      res.status(409).json({ error: 'A product with this SKU or barcode already exists.' });
      return;
    }

    const newProductId = store.nextId('product');
    snap.products.push({
      id: newProductId,
      sku,
      barcode,
      name,
      categoryId: snap.categories.some((c) => c.id === categoryId) ? categoryId : snap.categories[0].id,
      supplierId: snap.suppliers.some((s) => s.id === supplierId) ? supplierId : snap.suppliers[0].id,
      purchasePrice,
      sellingPrice,
      imageUrl: '',
      expiryDate,
      branch,
      createdAt: new Date().toISOString(),
    });

    snap.inventory.push({
      id: store.nextId('inventory'),
      productId: newProductId,
      stockQuantity,
      minStockLevel,
      reorderPoint: Math.max(minStockLevel + 5, Math.round(minStockLevel * 1.8)),
      updatedAt: new Date().toISOString(),
    });

    if (stockQuantity > 0) {
      snap.stockMovements.unshift({
        id: store.nextId('stockMovement'),
        productId: newProductId,
        movementType: 'IN',
        quantityDelta: stockQuantity,
        previousStock: 0,
        newStock: stockQuantity,
        reason: 'Initial SKU registration stock',
        userId: req.authUser!.id,
        createdAt: new Date().toISOString(),
      });
    }

    store.commit();
    const created = store.getProductsWithInventory().find((p) => p.id === newProductId);
    res.status(201).json({ product: created });
  });

  app.put('/api/products/:id', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const snap = store.getSnapshot();
    const product = snap.products.find((p) => p.id === id);
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const name = String(req.body?.name ?? product.name).trim();
    const purchasePrice = parsePositiveNumber(req.body?.purchasePrice ?? product.purchasePrice);
    const sellingPrice = parsePositiveNumber(req.body?.sellingPrice ?? product.sellingPrice);
    const minStockLevel = parsePositiveNumber(req.body?.minStockLevel);
    const categoryId = Number(req.body?.categoryId ?? product.categoryId);

    if (!name || purchasePrice === null || sellingPrice === null) {
      res.status(400).json({ error: 'Invalid product pricing or name.' });
      return;
    }

    product.name = name;
    product.purchasePrice = purchasePrice;
    product.sellingPrice = sellingPrice;
    if (snap.categories.some((c) => c.id === categoryId)) {
      product.categoryId = categoryId;
    }
    if (BRANCHES.includes(req.body?.branch)) {
      product.branch = req.body.branch;
    }
    if (req.body?.expiryDate !== undefined) {
      product.expiryDate = req.body.expiryDate ? String(req.body.expiryDate).slice(0, 10) : null;
    }
    if (minStockLevel !== null) {
      const inv = snap.inventory.find((i) => i.productId === id);
      if (inv) {
        inv.minStockLevel = minStockLevel;
        inv.updatedAt = new Date().toISOString();
      }
    }

    store.commit();
    const updated = store.getProductsWithInventory().find((p) => p.id === id);
    res.json({ product: updated });
  });

  app.delete('/api/products/:id', requireAuth, requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const snap = store.getSnapshot();
    const idx = snap.products.findIndex((p) => p.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    snap.products.splice(idx, 1);
    snap.inventory = snap.inventory.filter((i) => i.productId !== id);
    store.commit();
    res.json({ deletedId: id });
  });

  // Inventory & Stock Movements
  app.get('/api/inventory', requireAuth, (_req, res) => {
    const snap = store.getSnapshot();
    const products = store.getProductsWithInventory();
    const prodMap = new Map(products.map((p) => [p.id, p]));
    const userMap = new Map(snap.users.map((u) => [u.id, u.name]));

    const totalCostValuation = Number(products.reduce((s, p) => s + p.valuationCost, 0).toFixed(2));
    const totalRetailValuation = Number(products.reduce((s, p) => s + p.valuationRetail, 0).toFixed(2));
    const lowStockCount = products.filter((p) => p.stockQuantity <= p.minStockLevel).length;
    const expiringSoonCount = products.filter((p) => {
      if (!p.expiryDate) return false;
      const diffDays = (new Date(p.expiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      return diffDays <= 30;
    }).length;

    const movements = snap.stockMovements.slice(0, 60).map((m) => ({
      ...m,
      productName: prodMap.get(m.productId)?.name ?? `SKU #${m.productId}`,
      sku: prodMap.get(m.productId)?.sku ?? '',
      userName: userMap.get(m.userId) ?? 'System',
    }));

    res.json({
      summary: {
        totalCostValuation,
        totalRetailValuation,
        lowStockCount,
        expiringSoonCount,
        totalUnits: products.reduce((s, p) => s + p.stockQuantity, 0),
      },
      items: products,
      movements,
    });
  });

  app.post('/api/inventory/adjust', requireAuth, (req: AuthenticatedRequest, res) => {
    const productId = Number(req.body?.productId);
    const type = req.body?.movementType === 'OUT' ? 'OUT' : req.body?.movementType === 'ADJUSTMENT' ? 'ADJUSTMENT' : 'IN';
    const quantity = Number(req.body?.quantity);
    const reason = String(req.body?.reason ?? '').trim() || `Manual stock ${type.toLowerCase()}`;

    if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity === 0) {
      res.status(400).json({ error: 'Provide a valid product ID and non-zero integer quantity.' });
      return;
    }

    const delta = type === 'OUT' ? -Math.abs(quantity) : type === 'IN' ? Math.abs(quantity) : quantity;

    try {
      const result = store.adjustInventory({
        productId,
        delta,
        movementType: type,
        reason,
        userId: req.authUser!.id,
      });
      store.commit();
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Stock update failed.' });
    }
  });

  // Sales & POS Checkout
  app.get('/api/sales', requireAuth, (_req, res) => {
    const snap = store.getSnapshot();
    const custMap = new Map(snap.customers.map((c) => [c.id, c.name]));
    const prodMap = new Map(snap.products.map((p) => [p.id, p.name]));

    const salesWithItems = [...snap.sales]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50)
      .map((s) => ({
        ...s,
        customerName: s.customerId ? custMap.get(s.customerId) ?? 'Walk-in Customer' : 'Walk-in Customer',
        items: snap.saleItems
          .filter((si) => si.saleId === s.id)
          .map((si) => ({ ...si, productName: prodMap.get(si.productId) ?? `SKU #${si.productId}` })),
      }));

    res.json({ sales: salesWithItems });
  });

  app.post('/api/sales', requireAuth, (req: AuthenticatedRequest, res) => {
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const customerId = req.body?.customerId ? Number(req.body.customerId) : null;
    const branch = BRANCHES.includes(req.body?.branch) ? req.body.branch : req.authUser!.branch;
    const discountPct = Math.min(50, Math.max(0, Number(req.body?.discountPct ?? 0) || 0));
    const paymentMethod = ['Card', 'Cash', 'Mobile Pay'].includes(req.body?.paymentMethod)
      ? req.body.paymentMethod
      : 'Card';

    if (rawItems.length === 0) {
      res.status(400).json({ error: 'Cart must contain at least one product.' });
      return;
    }

    const snap = store.getSnapshot();
    const prodMap = new Map(snap.products.map((p) => [p.id, p]));
    const invMap = new Map(snap.inventory.map((i) => [i.productId, i]));

    // Validate stock availability before mutating
    const normalizedItems: Array<{ productId: number; quantity: number }> = [];
    for (const entry of rawItems) {
      const productId = Number(entry?.productId);
      const quantity = Number(entry?.quantity);
      if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity <= 0) {
        res.status(400).json({ error: 'Invalid cart item quantity.' });
        return;
      }
      const prod = prodMap.get(productId);
      const inv = invMap.get(productId);
      if (!prod || !inv) {
        res.status(404).json({ error: `Product #${productId} not found.` });
        return;
      }
      if (inv.stockQuantity < quantity) {
        res.status(400).json({ error: `Insufficient stock for ${prod.name} (available: ${inv.stockQuantity}).` });
        return;
      }
      normalizedItems.push({ productId, quantity });
    }

    let subtotal = 0;
    const saleId = store.nextId('sale');
    const invoiceNumber = `INV-${String(1000 + saleId)}`;

    for (const item of normalizedItems) {
      const prod = prodMap.get(item.productId)!;
      const lineTotal = Number((prod.sellingPrice * item.quantity).toFixed(2));
      subtotal += lineTotal;

      snap.saleItems.push({
        id: store.nextId('saleItem'),
        saleId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: prod.sellingPrice,
        unitCost: prod.purchasePrice,
        lineTotal,
      });

      store.adjustInventory({
        productId: item.productId,
        delta: -item.quantity,
        movementType: 'SALE',
        reason: `POS Sale ${invoiceNumber}`,
        userId: req.authUser!.id,
      });
    }

    const discountAmount = Number(((subtotal * discountPct) / 100).toFixed(2));
    const taxAmount = Number(((subtotal - discountAmount) * 0.08).toFixed(2));
    const totalAmount = Number((subtotal - discountAmount + taxAmount).toFixed(2));

    const newSale = {
      id: saleId,
      invoiceNumber,
      customerId,
      userId: req.authUser!.id,
      branch,
      subtotal: Number(subtotal.toFixed(2)),
      taxAmount,
      discountAmount,
      totalAmount,
      paymentMethod,
      createdAt: new Date().toISOString(),
    };

    snap.sales.push(newSale);
    store.commit();

    res.status(201).json({ sale: newSale });
  });

  // Customers
  app.get('/api/customers', requireAuth, (_req, res) => {
    const snap = store.getSnapshot();
    const enriched = snap.customers.map((c) => {
      const custSales = snap.sales.filter((s) => s.customerId === c.id);
      const totalSpent = Number(custSales.reduce((s, tx) => s + tx.totalAmount, 0).toFixed(2));
      const lastPurchaseAt = custSales.length
        ? custSales.map((s) => s.createdAt).sort().reverse()[0]
        : null;
      return {
        ...c,
        orderCount: custSales.length,
        totalSpent,
        lastPurchaseAt,
      };
    });
    res.json({ customers: enriched });
  });

  app.post('/api/customers', requireAuth, (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const phone = String(req.body?.phone ?? '').trim();
    const branch = BRANCHES.includes(req.body?.branch) ? req.body.branch : BRANCHES[0];

    if (name.length < 2 || (email && !isValidEmail(email))) {
      res.status(400).json({ error: 'Provide a valid customer name and email.' });
      return;
    }

    const snap = store.getSnapshot();
    const customer = {
      id: store.nextId('customer'),
      name,
      email,
      phone,
      branch,
      createdAt: new Date().toISOString(),
    };
    snap.customers.push(customer);
    store.commit();
    res.status(201).json({ customer });
  });

  // Machine Learning & AI Endpoints
  app.get('/api/ml/forecast', requireAuth, (req, res) => {
    const horizon = Number(req.query.horizon) || 30;
    const snap = store.getSnapshot();
    res.json(runSalesForecast(snap.sales, horizon));
  });

  app.get('/api/ml/inventory', requireAuth, (_req, res) => {
    const snap = store.getSnapshot();
    const predictions = runInventoryPredictions(
      snap.products,
      snap.inventory,
      snap.suppliers,
      snap.sales,
      snap.saleItems
    );
    res.json({ predictions });
  });

  app.get('/api/ml/segmentation', requireAuth, (_req, res) => {
    const snap = store.getSnapshot();
    res.json(runCustomerSegmentation(snap.customers, snap.sales));
  });

  app.get('/api/ml/associations', requireAuth, (_req, res) => {
    const snap = store.getSnapshot();
    res.json({
      rules: runMarketBasketAnalysis(snap.sales, snap.saleItems, snap.products),
    });
  });

  // Power BI-Style Multi-Dimensional Analytics API
  app.get('/api/analytics/bi', requireAuth, (req, res) => {
    const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const branch = typeof req.query.branch === 'string' && req.query.branch !== 'All' ? req.query.branch : null;
    const categoryId = req.query.categoryId && req.query.categoryId !== 'All' ? Number(req.query.categoryId) : null;

    const snap = store.getSnapshot();
    const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
    const prodMap = new Map(snap.products.map((p) => [p.id, p]));
    const catMap = new Map(snap.categories.map((c) => [c.id, c.name]));

    const filteredSales = snap.sales.filter(
      (s) => new Date(s.createdAt).getTime() >= cutoffMs && (!branch || s.branch === branch)
    );
    const saleMap = new Map(filteredSales.map((s) => [s.id, s]));

    const filteredItems = snap.saleItems.filter((item) => {
      if (!saleMap.has(item.saleId)) return false;
      if (categoryId) {
        const prod = prodMap.get(item.productId);
        if (!prod || prod.categoryId !== categoryId) return false;
      }
      return true;
    });

    const totalRevenue = Number(filteredItems.reduce((s, i) => s + i.lineTotal, 0).toFixed(2));
    const totalCogs = Number(filteredItems.reduce((s, i) => s + i.unitCost * i.quantity, 0).toFixed(2));
    const grossProfit = Number((totalRevenue - totalCogs).toFixed(2));
    const marginPct = totalRevenue > 0 ? Number(((grossProfit / totalRevenue) * 100).toFixed(1)) : 0;
    const distinctOrders = new Set(filteredItems.map((i) => i.saleId)).size;
    const avgOrderValue = distinctOrders > 0 ? Number((totalRevenue / distinctOrders).toFixed(2)) : 0;

    // Revenue & Profit by Category
    const byCategoryMap = new Map<string, { revenue: number; profit: number; units: number }>();
    for (const item of filteredItems) {
      const prod = prodMap.get(item.productId);
      const catName = prod ? catMap.get(prod.categoryId) ?? 'Other' : 'Other';
      const cur = byCategoryMap.get(catName) ?? { revenue: 0, profit: 0, units: 0 };
      cur.revenue += item.lineTotal;
      cur.profit += (item.unitPrice - item.unitCost) * item.quantity;
      cur.units += item.quantity;
      byCategoryMap.set(catName, cur);
    }
    const categoryBreakdown = Array.from(byCategoryMap.entries())
      .map(([name, vals]) => ({
        name,
        revenue: Number(vals.revenue.toFixed(2)),
        profit: Number(vals.profit.toFixed(2)),
        units: vals.units,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Revenue by Branch
    const byBranchMap = new Map<string, { revenue: number; profit: number; orders: Set<number> }>();
    for (const item of filteredItems) {
      const sale = saleMap.get(item.saleId)!;
      const cur = byBranchMap.get(sale.branch) ?? { revenue: 0, profit: 0, orders: new Set() };
      cur.revenue += item.lineTotal;
      cur.profit += (item.unitPrice - item.unitCost) * item.quantity;
      cur.orders.add(sale.id);
      byBranchMap.set(sale.branch, cur);
    }
    const branchBreakdown = Array.from(byBranchMap.entries()).map(([name, vals]) => ({
      name,
      revenue: Number(vals.revenue.toFixed(2)),
      profit: Number(vals.profit.toFixed(2)),
      orders: vals.orders.size,
    }));

    // Daily Trend
    const dailyMap = new Map<string, { revenue: number; profit: number }>();
    for (const item of filteredItems) {
      const sale = saleMap.get(item.saleId)!;
      const day = sale.createdAt.slice(0, 10);
      const cur = dailyMap.get(day) ?? { revenue: 0, profit: 0 };
      cur.revenue += item.lineTotal;
      cur.profit += (item.unitPrice - item.unitCost) * item.quantity;
      dailyMap.set(day, cur);
    }
    const trendSeries = Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, vals]) => ({
        date,
        revenue: Number(vals.revenue.toFixed(2)),
        profit: Number(vals.profit.toFixed(2)),
      }));

    // Payment Method Mix
    const paymentMixMap = new Map<string, number>();
    const activeSaleIds = new Set(filteredItems.map((i) => i.saleId));
    for (const sid of activeSaleIds) {
      const s = saleMap.get(sid)!;
      paymentMixMap.set(s.paymentMethod, (paymentMixMap.get(s.paymentMethod) ?? 0) + 1);
    }
    const paymentMix = Array.from(paymentMixMap.entries()).map(([method, count]) => ({
      method,
      count,
      pct: activeSaleIds.size > 0 ? Number(((count / activeSaleIds.size) * 100).toFixed(1)) : 0,
    }));

    // Product Rankings
    const prodRankMap = new Map<number, { revenue: number; profit: number; units: number }>();
    for (const item of filteredItems) {
      const cur = prodRankMap.get(item.productId) ?? { revenue: 0, profit: 0, units: 0 };
      cur.revenue += item.lineTotal;
      cur.profit += (item.unitPrice - item.unitCost) * item.quantity;
      cur.units += item.quantity;
      prodRankMap.set(item.productId, cur);
    }
    const productRankings = Array.from(prodRankMap.entries())
      .map(([productId, vals]) => {
        const prod = prodMap.get(productId);
        return {
          productId,
          name: prod?.name ?? `SKU #${productId}`,
          sku: prod?.sku ?? '',
          revenue: Number(vals.revenue.toFixed(2)),
          profit: Number(vals.profit.toFixed(2)),
          units: vals.units,
          marginPct: vals.revenue > 0 ? Number(((vals.profit / vals.revenue) * 100).toFixed(1)) : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    res.json({
      kpis: {
        totalRevenue,
        grossProfit,
        marginPct,
        distinctOrders,
        avgOrderValue,
      },
      categoryBreakdown,
      branchBreakdown,
      trendSeries,
      paymentMix,
      productRankings,
    });
  });

  // Notifications
  app.get('/api/notifications', requireAuth, (_req, res) => {
    const snap = store.getSnapshot();
    res.json({ notifications: snap.notifications });
  });

  app.patch('/api/notifications/:id/read', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const snap = store.getSnapshot();
    const note = snap.notifications.find((n) => n.id === id);
    if (!note) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    note.isRead = true;
    store.commit();
    res.json({ notification: note });
  });

  app.post('/api/notifications/mark-all-read', requireAuth, (_req, res) => {
    const snap = store.getSnapshot();
    for (const n of snap.notifications) {
      n.isRead = true;
    }
    store.commit();
    res.json({ ok: true });
  });

  // Supplier Purchase Orders
  app.get('/api/purchases', requireAuth, (_req, res) => {
    const snap = store.getSnapshot();
    const supMap = new Map(snap.suppliers.map((s) => [s.id, s.name]));
    const prodMap = new Map(snap.products.map((p) => [p.id, p.name]));

    const orders = [...snap.purchases]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((po) => ({
        ...po,
        poNumber: `PO-${1000 + po.id}`,
        supplierName: supMap.get(po.supplierId) ?? `Supplier #${po.supplierId}`,
        items: snap.purchaseItems
          .filter((pi) => pi.purchaseId === po.id)
          .map((pi) => ({
            ...pi,
            productName: prodMap.get(pi.productId) ?? `SKU #${pi.productId}`,
          })),
      }));

    res.json({ purchases: orders });
  });

  // Append Extra Sample Batch on Demand
  app.post('/api/sample-data/populate', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = store.appendSampleBatch(req.authUser!.id);
    res.json(result);
  });

  // Phase 1 & 3 Architecture Schema Endpoint
  app.get('/api/architecture/schema', requireAuth, (_req, res) => {
    res.json({ mysqlSchemaSql: MYSQL_SCHEMA_SQL });
  });

  // Mount Vite Dev Middleware or Static Production Build
  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(process.cwd(), 'dist');

  if (isProd && fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Retail AI server running on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start Smart Retail AI server:', err);
  process.exit(1);
});
