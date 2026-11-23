import fs from 'fs';
import path from 'path';
import type {
  ProductWithInventory,
  StockMovementType,
  StoreSchema,
} from './types';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'retail_store.json');
const CURRENT_SEED_VERSION = 2;

export const BRANCHES = [
  'Flagship Downtown',
  'Westside Mall',
  'Northside Hub',
] as const;

function daysAgoIso(daysAgo: number, hour = 14): string {
  const dt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  dt.setUTCHours(hour, (daysAgo * 17) % 60, 0, 0);
  return dt.toISOString();
}

function daysFromNowDate(daysAhead: number): string {
  const dt = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  return dt.toISOString().slice(0, 10);
}

export function buildSeedStore(): StoreSchema {
  const roles = [
    { id: 1, name: 'admin' as const, description: 'Full system administration, cost visibility, user & ML controls' },
    { id: 2, name: 'staff' as const, description: 'POS checkout, barcode scanning, inventory lookup & stock intake' },
  ];

  const categories = [
    { id: 1, name: 'Specialty Coffee & Tea', description: 'Single-origin roasts, matcha tins, and artisan blends' },
    { id: 2, name: 'Audio & Tech', description: 'Wireless headphones, chargers, and desk accessories' },
    { id: 3, name: 'Hydration & Lifestyle', description: 'Insulated bottles, tumblers, and everyday carry' },
    { id: 4, name: 'Artisan Pantry', description: 'Plant-based milks, syrups, and craft snacks' },
    { id: 5, name: 'Accessories', description: 'Brewing tools, travel sleeves, and care kits' },
  ];

  const suppliers = [
    { id: 1, name: 'Pacific Crest Roasters', contactEmail: 'orders@pacificcrest.example', phone: '+1-206-555-0142', leadTimeDays: 4 },
    { id: 2, name: 'Verve Acoustics Ltd.', contactEmail: 'supply@verveacoustics.example', phone: '+1-415-555-0189', leadTimeDays: 7 },
    { id: 3, name: 'Aura Lifestyle Goods', contactEmail: 'b2b@auragoods.example', phone: '+1-503-555-0118', leadTimeDays: 5 },
    { id: 4, name: 'Solstice Craft Provisions', contactEmail: 'wholesale@solsticecraft.example', phone: '+1-312-555-0174', leadTimeDays: 3 },
  ];

  const products = [
    {
      id: 1,
      sku: 'COF-YIRG-340',
      barcode: '8901234500012',
      name: 'Ethiopia Yirgacheffe Whole Bean (340g)',
      categoryId: 1,
      supplierId: 1,
      purchasePrice: 11.5,
      sellingPrice: 22.0,
      imageUrl: '/src/assets/images/product_espresso_beans_1795372834438.jpg',
      expiryDate: daysFromNowDate(145),
      branch: 'Flagship Downtown',
      createdAt: daysAgoIso(110),
    },
    {
      id: 2,
      sku: 'TEC-AUD-900',
      barcode: '8901234500029',
      name: 'Verve Studio Wireless Headphones',
      categoryId: 2,
      supplierId: 2,
      purchasePrice: 82.0,
      sellingPrice: 149.0,
      imageUrl: '/src/assets/images/product_wireless_headphones_1795372834792.jpg',
      expiryDate: null,
      branch: 'Flagship Downtown',
      createdAt: daysAgoIso(110),
    },
    {
      id: 3,
      sku: 'TEA-MAT-040',
      barcode: '8901234500036',
      name: 'Ceremonial Grade Uji Matcha Tin (40g)',
      categoryId: 1,
      supplierId: 1,
      purchasePrice: 15.0,
      sellingPrice: 32.0,
      imageUrl: '/src/assets/images/product_matcha_set_1795372834427.jpg',
      expiryDate: daysFromNowDate(28),
      branch: 'Westside Mall',
      createdAt: daysAgoIso(105),
    },
    {
      id: 4,
      sku: 'HYD-AUR-650',
      barcode: '8901234500043',
      name: 'Aura Insulated Bottle — Lavender Slate',
      categoryId: 3,
      supplierId: 3,
      purchasePrice: 16.0,
      sellingPrice: 38.0,
      imageUrl: '/src/assets/images/product_smart_bottle_1795372833807.jpg',
      expiryDate: null,
      branch: 'Flagship Downtown',
      createdAt: daysAgoIso(102),
    },
    {
      id: 5,
      sku: 'PAN-OAT-100',
      barcode: '8901234500050',
      name: 'Barista Reserve Oat Milk (6-Pack)',
      categoryId: 4,
      supplierId: 4,
      purchasePrice: 12.0,
      sellingPrice: 24.5,
      imageUrl: '',
      expiryDate: daysFromNowDate(19),
      branch: 'Flagship Downtown',
      createdAt: daysAgoIso(100),
    },
    {
      id: 6,
      sku: 'TEC-USB-065',
      barcode: '8901234500067',
      name: '65W GaN Dual USB-C Fast Charger',
      categoryId: 2,
      supplierId: 2,
      purchasePrice: 18.5,
      sellingPrice: 39.0,
      imageUrl: '',
      expiryDate: null,
      branch: 'Westside Mall',
      createdAt: daysAgoIso(98),
    },
    {
      id: 7,
      sku: 'ACC-BAM-001',
      barcode: '8901234500074',
      name: 'Handcrafted Bamboo Matcha Whisk Set',
      categoryId: 5,
      supplierId: 3,
      purchasePrice: 10.0,
      sellingPrice: 26.0,
      imageUrl: '',
      expiryDate: null,
      branch: 'Westside Mall',
      createdAt: daysAgoIso(95),
    },
    {
      id: 8,
      sku: 'COF-COL-340',
      barcode: '8901234500081',
      name: 'Huila Colombia Reserve Roast (340g)',
      categoryId: 1,
      supplierId: 1,
      purchasePrice: 10.5,
      sellingPrice: 21.0,
      imageUrl: '',
      expiryDate: daysFromNowDate(180),
      branch: 'Northside Hub',
      createdAt: daysAgoIso(95),
    },
    {
      id: 9,
      sku: 'HYD-TUM-450',
      barcode: '8901234500098',
      name: 'Ceramic-Lined Travel Tumbler (450ml)',
      categoryId: 3,
      supplierId: 3,
      purchasePrice: 13.0,
      sellingPrice: 29.0,
      imageUrl: '',
      expiryDate: null,
      branch: 'Northside Hub',
      createdAt: daysAgoIso(92),
    },
    {
      id: 10,
      sku: 'PAN-VAN-250',
      barcode: '8901234500104',
      name: 'Madagascar Vanilla Bean Syrup (250ml)',
      categoryId: 4,
      supplierId: 4,
      purchasePrice: 6.5,
      sellingPrice: 15.5,
      imageUrl: '',
      expiryDate: daysFromNowDate(210),
      branch: 'Flagship Downtown',
      createdAt: daysAgoIso(92),
    },
    {
      id: 11,
      sku: 'TEC-CASE-01',
      barcode: '8901234500111',
      name: 'Molded Felt Headphone Travel Case',
      categoryId: 2,
      supplierId: 2,
      purchasePrice: 9.0,
      sellingPrice: 24.0,
      imageUrl: '',
      expiryDate: null,
      branch: 'Northside Hub',
      createdAt: daysAgoIso(90),
    },
    {
      id: 12,
      sku: 'ACC-FLT-100',
      barcode: '8901234500128',
      name: 'Unbleached Pour-Over Paper Filters (100ct)',
      categoryId: 5,
      supplierId: 3,
      purchasePrice: 3.2,
      sellingPrice: 9.5,
      imageUrl: '',
      expiryDate: null,
      branch: 'Northside Hub',
      createdAt: daysAgoIso(90),
    },
    {
      id: 13,
      sku: 'COF-CLD-500',
      barcode: '8901234500135',
      name: 'Kyoto Slow-Steep Cold Brew Concentrate (500ml)',
      categoryId: 1,
      supplierId: 1,
      purchasePrice: 8.2,
      sellingPrice: 18.0,
      imageUrl: '',
      expiryDate: daysFromNowDate(24),
      branch: 'Flagship Downtown',
      createdAt: daysAgoIso(88),
    },
    {
      id: 14,
      sku: 'PAN-CHO-085',
      barcode: '8901234500142',
      name: '72% Single-Origin Sea Salt Dark Chocolate',
      categoryId: 4,
      supplierId: 4,
      purchasePrice: 3.4,
      sellingPrice: 8.5,
      imageUrl: '',
      expiryDate: daysFromNowDate(160),
      branch: 'Westside Mall',
      createdAt: daysAgoIso(85),
    },
    {
      id: 15,
      sku: 'ACC-DRP-002',
      barcode: '8901234500159',
      name: 'Fluted Porcelain Pour-Over Dripper',
      categoryId: 5,
      supplierId: 3,
      purchasePrice: 14.0,
      sellingPrice: 34.0,
      imageUrl: '',
      expiryDate: null,
      branch: 'Flagship Downtown',
      createdAt: daysAgoIso(84),
    },
    {
      id: 16,
      sku: 'TEC-CBL-200',
      barcode: '8901234500166',
      name: 'Braided USB-C to USB-C Audio & Charge Cable (2m)',
      categoryId: 2,
      supplierId: 2,
      purchasePrice: 7.5,
      sellingPrice: 19.0,
      imageUrl: '',
      expiryDate: null,
      branch: 'Westside Mall',
      createdAt: daysAgoIso(80),
    },
    {
      id: 17,
      sku: 'HYD-CUP-590',
      barcode: '8901234500173',
      name: 'Double-Wall Iced Cold Cup with Straw (590ml)',
      categoryId: 3,
      supplierId: 3,
      purchasePrice: 11.0,
      sellingPrice: 27.0,
      imageUrl: '',
      expiryDate: null,
      branch: 'Westside Mall',
      createdAt: daysAgoIso(78),
    },
    {
      id: 18,
      sku: 'PAN-HNY-300',
      barcode: '8901234500180',
      name: 'Lavender Wildflower Raw Honey Jar (300g)',
      categoryId: 4,
      supplierId: 4,
      purchasePrice: 7.8,
      sellingPrice: 17.5,
      imageUrl: '',
      expiryDate: daysFromNowDate(290),
      branch: 'Northside Hub',
      createdAt: daysAgoIso(75),
    },
  ];

  const initialStocks: Record<number, { qty: number; min: number; reorder: number }> = {
    1: { qty: 18, min: 15, reorder: 30 },
    2: { qty: 11, min: 8, reorder: 14 },
    3: { qty: 7, min: 10, reorder: 20 },  // Low stock
    4: { qty: 42, min: 12, reorder: 22 },
    5: { qty: 9, min: 12, reorder: 24 },  // Low stock + expiring
    6: { qty: 26, min: 10, reorder: 18 },
    7: { qty: 19, min: 8, reorder: 15 },
    8: { qty: 34, min: 12, reorder: 22 },
    9: { qty: 29, min: 10, reorder: 18 },
    10: { qty: 6, min: 10, reorder: 20 }, // Low stock
    11: { qty: 22, min: 8, reorder: 14 },
    12: { qty: 58, min: 15, reorder: 30 },
    13: { qty: 8, min: 10, reorder: 22 }, // Low stock + expiring
    14: { qty: 47, min: 15, reorder: 30 },
    15: { qty: 15, min: 6, reorder: 12 },
    16: { qty: 31, min: 10, reorder: 20 },
    17: { qty: 24, min: 10, reorder: 18 },
    18: { qty: 14, min: 8, reorder: 16 },
  };

  const inventory = products.map((p, idx) => ({
    id: idx + 1,
    productId: p.id,
    stockQuantity: initialStocks[p.id].qty,
    minStockLevel: initialStocks[p.id].min,
    reorderPoint: initialStocks[p.id].reorder,
    updatedAt: daysAgoIso(1),
  }));

  const customerNames = [
    'Maya Lin', 'Daniel Ortiz', 'Priya Patel', 'Lucas Meyer', 'Hannah Kim',
    'Noah Brooks', 'Sofia Rossi', 'Ethan Grant', 'Chloe Laurent', 'Aiden Vance',
    'Zara Al-Mansoor', 'Liam O\'Connor', 'Amara Okafor', 'Owen Park', 'Elena Novak',
    'Julian Cruz', 'Nadia Hassan', 'Caleb Wright', 'Tessa Morales', 'Victor Chen',
    'Sienna Hayes', 'Marcus Bell', 'Ananya Rao', 'Freya Lindqvist', 'Mateo Silva',
    'Clara Nguyen', 'Jonas Weber', 'Kira Takahashi',
  ];

  const customers = customerNames.map((name, idx) => ({
    id: idx + 1,
    name,
    email: `${name.toLowerCase().replace(/[^a-z]/g, '.')}@retailclient.example`,
    phone: `+1-555-01${String(10 + idx).padStart(2, '0')}`,
    branch: BRANCHES[idx % BRANCHES.length],
    createdAt: daysAgoIso(95 - (idx % 25)),
  }));

  const sales: StoreSchema['sales'] = [];
  const saleItems: StoreSchema['saleItems'] = [];
  let saleIdCounter = 1;
  let saleItemIdCounter = 1;

  const prng = (seed: number) => {
    const x = Math.sin(seed * 9301 + 49297) * 233280;
    return x - Math.floor(x);
  };

  const productById = new Map(products.map((p) => [p.id, p]));
  const paymentMethods: Array<'Card' | 'Cash' | 'Mobile Pay'> = ['Card', 'Mobile Pay', 'Cash'];

  const basketAffinities: Array<[number, number[]]> = [
    [1, [5, 10, 12, 15]],
    [2, [6, 11, 16]],
    [3, [7, 4, 18]],
    [8, [5, 12, 14]],
    [4, [9, 17]],
    [13, [5, 14, 17]],
  ];

  for (let daysAgo = 89; daysAgo >= 0; daysAgo--) {
    const dt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const dow = dt.getUTCDay();
    const isWeekend = dow === 0 || dow === 5 || dow === 6;
    const trendFactor = 1 + ((89 - daysAgo) / 89) * 0.38;
    const baseTxCount = isWeekend ? 3 : 2;
    const extraTx = prng(daysAgo * 7 + 3) > (isWeekend ? 0.2 : 0.4) ? 1 : 0;
    const txToday = Math.max(1, Math.round((baseTxCount + extraTx) * (trendFactor > 1.2 ? 1.18 : 1)));

    for (let t = 0; t < txToday; t++) {
      const seed = daysAgo * 31 + t * 13 + 17;
      const custRoll = prng(seed);
      let customerId: number;
      if (custRoll < 0.45) {
        customerId = 1 + Math.floor(prng(seed + 1) * 6);
      } else if (custRoll < 0.8) {
        customerId = 7 + Math.floor(prng(seed + 2) * 11);
      } else {
        customerId = 18 + Math.floor(prng(seed + 3) * 11);
      }
      if (customerId >= 21 && daysAgo < 28) {
        customerId = 1 + (customerId % 14);
      }

      const customer = customers[customerId - 1];
      const branch = customer?.branch ?? BRANCHES[t % BRANCHES.length];

      const anchorPick = Math.floor(prng(seed + 4) * basketAffinities.length);
      const [primaryId, companions] = basketAffinities[anchorPick];
      const chosenIds = [primaryId];

      if (prng(seed + 5) < 0.68 && companions.length > 0) {
        const compId = companions[Math.floor(prng(seed + 6) * companions.length)];
        if (!chosenIds.includes(compId)) chosenIds.push(compId);
      }
      if (prng(seed + 7) < 0.32) {
        const extraId = 1 + Math.floor(prng(seed + 8) * products.length);
        if (!chosenIds.includes(extraId)) chosenIds.push(extraId);
      }

      let subtotal = 0;
      const pendingItems: StoreSchema['saleItems'] = [];
      for (const pid of chosenIds) {
        const prod = productById.get(pid)!;
        const qty = prod.sellingPrice > 60 ? 1 : 1 + (prng(seed + pid) > 0.7 ? 1 : 0);
        const lineTotal = Number((prod.sellingPrice * qty).toFixed(2));
        subtotal += lineTotal;
        pendingItems.push({
          id: saleItemIdCounter++,
          saleId: saleIdCounter,
          productId: pid,
          quantity: qty,
          unitPrice: prod.sellingPrice,
          unitCost: prod.purchasePrice,
          lineTotal,
        });
      }

      const discountAmount = prng(seed + 9) > 0.84 ? Number((subtotal * 0.05).toFixed(2)) : 0;
      const taxAmount = Number(((subtotal - discountAmount) * 0.08).toFixed(2));
      const totalAmount = Number((subtotal - discountAmount + taxAmount).toFixed(2));

      sales.push({
        id: saleIdCounter,
        invoiceNumber: `INV-${String(1000 + saleIdCounter)}`,
        customerId,
        userId: 1,
        branch,
        subtotal: Number(subtotal.toFixed(2)),
        taxAmount,
        discountAmount,
        totalAmount,
        paymentMethod: paymentMethods[Math.floor(prng(seed + 10) * paymentMethods.length)],
        createdAt: daysAgoIso(daysAgo, 9 + ((t * 3) % 11)),
      });
      saleItems.push(...pendingItems);
      saleIdCounter++;
    }
  }

  const purchases: StoreSchema['purchases'] = [
    {
      id: 1,
      supplierId: 1,
      userId: 1,
      branch: 'Flagship Downtown',
      totalCost: 820.0,
      status: 'Received',
      createdAt: daysAgoIso(24, 10),
    },
    {
      id: 2,
      supplierId: 2,
      userId: 1,
      branch: 'Westside Mall',
      totalCost: 1190.0,
      status: 'Received',
      createdAt: daysAgoIso(15, 11),
    },
    {
      id: 3,
      supplierId: 3,
      userId: 1,
      branch: 'Northside Hub',
      totalCost: 586.0,
      status: 'Received',
      createdAt: daysAgoIso(8, 9),
    },
    {
      id: 4,
      supplierId: 4,
      userId: 1,
      branch: 'Flagship Downtown',
      totalCost: 342.0,
      status: 'Pending',
      createdAt: daysAgoIso(1, 15),
    },
  ];

  const purchaseItems: StoreSchema['purchaseItems'] = [
    { id: 1, purchaseId: 1, productId: 1, quantity: 40, unitCost: 11.5 },
    { id: 2, purchaseId: 1, productId: 8, quantity: 30, unitCost: 10.5 },
    { id: 3, purchaseId: 2, productId: 2, quantity: 10, unitCost: 82.0 },
    { id: 4, purchaseId: 2, productId: 6, quantity: 20, unitCost: 18.5 },
    { id: 5, purchaseId: 3, productId: 4, quantity: 25, unitCost: 16.0 },
    { id: 6, purchaseId: 3, productId: 12, quantity: 40, unitCost: 3.2 },
    { id: 7, purchaseId: 4, productId: 5, quantity: 20, unitCost: 12.0 },
    { id: 8, purchaseId: 4, productId: 10, quantity: 16, unitCost: 6.5 },
  ];

  const stockMovements: StoreSchema['stockMovements'] = [
    {
      id: 1,
      productId: 1,
      movementType: 'IN',
      quantityDelta: 40,
      previousStock: 10,
      newStock: 50,
      reason: 'Purchase Order PO-1001 · Pacific Crest Roasters',
      userId: 1,
      createdAt: daysAgoIso(24, 10),
    },
    {
      id: 2,
      productId: 2,
      movementType: 'IN',
      quantityDelta: 10,
      previousStock: 6,
      newStock: 16,
      reason: 'Purchase Order PO-1002 · Verve Acoustics Ltd.',
      userId: 1,
      createdAt: daysAgoIso(15, 11),
    },
    {
      id: 3,
      productId: 4,
      movementType: 'IN',
      quantityDelta: 25,
      previousStock: 17,
      newStock: 42,
      reason: 'Purchase Order PO-1003 · Aura seasonal intake',
      userId: 1,
      createdAt: daysAgoIso(8, 9),
    },
    {
      id: 4,
      productId: 3,
      movementType: 'OUT',
      quantityDelta: -4,
      previousStock: 11,
      newStock: 7,
      reason: 'Tasting bar promotional sampling',
      userId: 1,
      createdAt: daysAgoIso(3, 15),
    },
    {
      id: 5,
      productId: 13,
      movementType: 'ADJUSTMENT',
      quantityDelta: -3,
      previousStock: 11,
      newStock: 8,
      reason: 'Cycle count audit adjustment',
      userId: 1,
      createdAt: daysAgoIso(2, 13),
    },
    {
      id: 6,
      productId: 14,
      movementType: 'IN',
      quantityDelta: 30,
      previousStock: 17,
      newStock: 47,
      reason: 'Solstice Craft weekend restock',
      userId: 1,
      createdAt: daysAgoIso(4, 10),
    },
  ];

  const notifications: StoreSchema['notifications'] = [
    {
      id: 1,
      title: 'Low Stock Alert: Ceremonial Grade Uji Matcha',
      message: 'Current stock (7 units) is below minimum threshold (10 units). Recommended ML reorder: 26 units.',
      severity: 'critical',
      category: 'low_stock',
      productId: 3,
      isRead: false,
      createdAt: daysAgoIso(0, 8),
    },
    {
      id: 2,
      title: 'Expiry & Stock Alert: Barista Reserve Oat Milk',
      message: 'Stock at 9 units (min 12) and batch expires in 19 days. Pending PO-1004 scheduled from Solstice Craft.',
      severity: 'warning',
      category: 'stockout_prediction',
      productId: 5,
      isRead: false,
      createdAt: daysAgoIso(0, 9),
    },
    {
      id: 3,
      title: 'Low Stock Alert: Madagascar Vanilla Bean Syrup',
      message: '6 units remaining at Flagship Downtown. Predicted stockout within 4 days.',
      severity: 'warning',
      category: 'low_stock',
      productId: 10,
      isRead: false,
      createdAt: daysAgoIso(1, 16),
    },
    {
      id: 4,
      title: 'Expiry Watch: Kyoto Slow-Steep Cold Brew',
      message: '8 units remaining (min 10) with batch expiration in 24 days.',
      severity: 'warning',
      category: 'stockout_prediction',
      productId: 13,
      isRead: false,
      createdAt: daysAgoIso(1, 12),
    },
    {
      id: 5,
      title: 'Weekend Demand Forecast Ready',
      message: 'ML time-series model detected +24% weekend revenue uplift across Specialty Coffee & Audio Tech.',
      severity: 'info',
      category: 'sales_milestone',
      productId: null,
      isRead: true,
      createdAt: daysAgoIso(2, 10),
    },
  ];

  return {
    roles,
    users: [],
    categories,
    suppliers,
    products,
    inventory,
    customers,
    sales,
    saleItems,
    purchases,
    purchaseItems,
    stockMovements,
    notifications,
    nextIds: {
      user: 1,
      product: products.length + 1,
      inventory: inventory.length + 1,
      customer: customers.length + 1,
      sale: saleIdCounter,
      saleItem: saleItemIdCounter,
      purchase: purchases.length + 1,
      purchaseItem: purchaseItems.length + 1,
      stockMovement: stockMovements.length + 1,
      notification: notifications.length + 1,
    },
    seedVersion: CURRENT_SEED_VERSION,
  };
}

class RetailStore {
  private data: StoreSchema;

  constructor() {
    this.data = this.loadOrSeed();
  }

  private loadOrSeed(): StoreSchema {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as StoreSchema;
        if (parsed && Array.isArray(parsed.products) && Array.isArray(parsed.sales)) {
          if ((parsed.seedVersion ?? 1) < CURRENT_SEED_VERSION) {
            const refreshed = buildSeedStore();
            refreshed.users = Array.isArray(parsed.users) ? parsed.users : [];
            refreshed.nextIds.user = Math.max(
              refreshed.nextIds.user,
              ...refreshed.users.map((u) => u.id + 1),
              1
            );
            this.save(refreshed);
            return refreshed;
          }
          return parsed;
        }
      }
    } catch {
      // Fall back to fresh seed
    }
    const seeded = buildSeedStore();
    this.save(seeded);
    return seeded;
  }

  private save(snapshot: StoreSchema = this.data): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpPath = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    fs.renameSync(tmpPath, STORE_PATH);
  }

  public nextId(key: string): number {
    const val = this.data.nextIds[key] ?? 1;
    this.data.nextIds[key] = val + 1;
    return val;
  }

  public getSnapshot(): StoreSchema {
    return this.data;
  }

  public commit(): void {
    this.save();
  }

  public appendSampleBatch(userId: number): {
    addedSales: number;
    addedCustomers: number;
    totalSales: number;
    totalProducts: number;
  } {
    const extraCustomerNames = [
      'Avery Brooks', 'Nora Delgado', 'Julian Park', 'Camila Santos', 'Theo Sterling',
    ];
    let addedCustomers = 0;
    for (const name of extraCustomerNames) {
      const email = `${name.toLowerCase().replace(/[^a-z]/g, '.')}@retailclient.example`;
      if (!this.data.customers.some((c) => c.email === email)) {
        this.data.customers.push({
          id: this.nextId('customer'),
          name,
          email,
          phone: `+1-555-02${String(this.data.customers.length).padStart(2, '0')}`,
          branch: BRANCHES[this.data.customers.length % BRANCHES.length],
          createdAt: new Date().toISOString(),
        });
        addedCustomers++;
      }
    }

    const products = this.data.products;
    const customers = this.data.customers;
    const paymentMethods: Array<'Card' | 'Cash' | 'Mobile Pay'> = ['Card', 'Mobile Pay', 'Cash'];
    let addedSales = 0;

    for (let i = 0; i < 12; i++) {
      const cust = customers[(this.data.sales.length + i) % customers.length];
      const p1 = products[(i * 3) % products.length];
      const p2 = products[(i * 3 + 4) % products.length];
      const itemsToUse = p1.id === p2.id ? [p1] : [p1, p2];

      const saleId = this.nextId('sale');
      let subtotal = 0;
      for (const prod of itemsToUse) {
        const qty = prod.sellingPrice > 60 ? 1 : 2;
        const lineTotal = Number((prod.sellingPrice * qty).toFixed(2));
        subtotal += lineTotal;
        this.data.saleItems.push({
          id: this.nextId('saleItem'),
          saleId,
          productId: prod.id,
          quantity: qty,
          unitPrice: prod.sellingPrice,
          unitCost: prod.purchasePrice,
          lineTotal,
        });
      }

      const taxAmount = Number((subtotal * 0.08).toFixed(2));
      const totalAmount = Number((subtotal + taxAmount).toFixed(2));
      const daysBack = i % 7;

      this.data.sales.push({
        id: saleId,
        invoiceNumber: `INV-${String(1000 + saleId)}`,
        customerId: cust.id,
        userId,
        branch: cust.branch,
        subtotal: Number(subtotal.toFixed(2)),
        taxAmount,
        discountAmount: 0,
        totalAmount,
        paymentMethod: paymentMethods[i % paymentMethods.length],
        createdAt: daysAgoIso(daysBack, 11 + (i % 7)),
      });
      addedSales++;
    }

    this.data.notifications.unshift({
      id: this.nextId('notification'),
      title: 'Sample Transaction Batch Loaded',
      message: `Added ${addedSales} sample POS sales and ${addedCustomers} customer profiles for analytics testing.`,
      severity: 'info',
      category: 'sales_milestone',
      productId: null,
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    this.commit();
    return {
      addedSales,
      addedCustomers,
      totalSales: this.data.sales.length,
      totalProducts: this.data.products.length,
    };
  }

  public getProductsWithInventory(): ProductWithInventory[] {
    const catMap = new Map(this.data.categories.map((c) => [c.id, c.name]));
    const supMap = new Map(this.data.suppliers.map((s) => [s.id, s]));
    const invMap = new Map(this.data.inventory.map((i) => [i.productId, i]));

    return this.data.products.map((p) => {
      const inv = invMap.get(p.id);
      const sup = supMap.get(p.supplierId);
      const stockQuantity = inv?.stockQuantity ?? 0;
      const minStockLevel = inv?.minStockLevel ?? 10;
      const reorderPoint = inv?.reorderPoint ?? 15;
      const marginPct =
        p.sellingPrice > 0
          ? Number((((p.sellingPrice - p.purchasePrice) / p.sellingPrice) * 100).toFixed(1))
          : 0;

      return {
        ...p,
        categoryName: catMap.get(p.categoryId) ?? 'General',
        supplierName: sup?.name ?? 'Direct Supplier',
        leadTimeDays: sup?.leadTimeDays ?? 5,
        stockQuantity,
        minStockLevel,
        reorderPoint,
        valuationCost: Number((stockQuantity * p.purchasePrice).toFixed(2)),
        valuationRetail: Number((stockQuantity * p.sellingPrice).toFixed(2)),
        marginPct,
      };
    });
  }

  public adjustInventory(params: {
    productId: number;
    delta: number;
    movementType: StockMovementType;
    reason: string;
    userId: number;
  }): { previousStock: number; newStock: number } {
    let inv = this.data.inventory.find((i) => i.productId === params.productId);
    if (!inv) {
      inv = {
        id: this.nextId('inventory'),
        productId: params.productId,
        stockQuantity: 0,
        minStockLevel: 10,
        reorderPoint: 15,
        updatedAt: new Date().toISOString(),
      };
      this.data.inventory.push(inv);
    }

    const previousStock = inv.stockQuantity;
    const newStock = previousStock + params.delta;
    if (newStock < 0) {
      throw new Error(`Insufficient stock for product #${params.productId} (available: ${previousStock})`);
    }

    inv.stockQuantity = newStock;
    inv.updatedAt = new Date().toISOString();

    this.data.stockMovements.unshift({
      id: this.nextId('stockMovement'),
      productId: params.productId,
      movementType: params.movementType,
      quantityDelta: params.delta,
      previousStock,
      newStock,
      reason: params.reason,
      userId: params.userId,
      createdAt: new Date().toISOString(),
    });

    const product = this.data.products.find((p) => p.id === params.productId);
    if (product && newStock <= inv.minStockLevel && params.delta < 0) {
      const existingUnread = this.data.notifications.find(
        (n) => n.productId === product.id && n.category === 'low_stock' && !n.isRead
      );
      if (!existingUnread) {
        this.data.notifications.unshift({
          id: this.nextId('notification'),
          title: `Low Stock Alert: ${product.name}`,
          message: `Stock dropped to ${newStock} units (minimum threshold: ${inv.minStockLevel}). Restock recommended.`,
          severity: newStock <= Math.floor(inv.minStockLevel / 2) ? 'critical' : 'warning',
          category: 'low_stock',
          productId: product.id,
          isRead: false,
          createdAt: new Date().toISOString(),
        });
      }
    }

    return { previousStock, newStock };
  }
}

export const store = new RetailStore();
