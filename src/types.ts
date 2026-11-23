export type RoleName = 'admin' | 'staff';

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  role: RoleName;
  branch: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Category {
  id: number;
  name: string;
  description: string;
}

export interface Supplier {
  id: number;
  name: string;
  contactEmail: string;
  phone: string;
  leadTimeDays: number;
}

export interface ProductWithInventory {
  id: number;
  sku: string;
  barcode: string;
  name: string;
  categoryId: number;
  supplierId: number;
  purchasePrice: number;
  sellingPrice: number;
  imageUrl?: string;
  expiryDate?: string | null;
  branch: string;
  createdAt: string;
  categoryName: string;
  supplierName: string;
  leadTimeDays: number;
  stockQuantity: number;
  minStockLevel: number;
  reorderPoint: number;
  valuationCost: number;
  valuationRetail: number;
  marginPct: number;
}

export interface DashboardPayload {
  kpis: {
    totalRevenue: number;
    totalProfit: number;
    totalSalesCount: number;
    totalProducts: number;
    totalCustomers: number;
    lowStockCount: number;
    inventoryRetailValue: number;
    unreadNotifications: number;
  };
  salesChart: Array<{ date: string; revenue: number; orders: number }>;
  bestSellingProducts: Array<{
    productId: number;
    name: string;
    sku: string;
    categoryName: string;
    stockQuantity: number;
    unitsSold: number;
    revenue: number;
  }>;
  lowStockProducts: ProductWithInventory[];
  recentTransactions: Array<{
    id: number;
    invoiceNumber: string;
    customerName: string;
    branch: string;
    totalAmount: number;
    paymentMethod: string;
    createdAt: string;
  }>;
}

export interface InventoryPayload {
  summary: {
    totalCostValuation: number;
    totalRetailValuation: number;
    lowStockCount: number;
    expiringSoonCount: number;
    totalUnits: number;
  };
  items: ProductWithInventory[];
  movements: Array<{
    id: number;
    productId: number;
    productName: string;
    sku: string;
    movementType: 'IN' | 'OUT' | 'SALE' | 'ADJUSTMENT';
    quantityDelta: number;
    previousStock: number;
    newStock: number;
    reason: string;
    userName: string;
    createdAt: string;
  }>;
}

export interface SalesForecastPayload {
  horizonDays: number;
  projectedTotalRevenue: number;
  projectedAvgDailyRevenue: number;
  trendSlopePerDay: number;
  growthPctOverHorizon: number;
  metrics: {
    mae: number;
    rmse: number;
    mape: number;
    validationWindowDays: number;
    trainingSampleDays: number;
  };
  seasonalPatterns: Array<{
    dayName: string;
    index: number;
    avgRevenue: number;
  }>;
  series: Array<{
    date: string;
    actualRevenue: number | null;
    predictedRevenue: number;
    lowerBound: number;
    upperBound: number;
    isFuture: boolean;
  }>;
}

export interface InventoryPredictionItem {
  productId: number;
  sku: string;
  name: string;
  branch: string;
  currentStock: number;
  minStockLevel: number;
  dailyVelocity: number;
  demandStdDev: number;
  daysUntilStockout: number | null;
  predictedOutOfStockDate: string | null;
  safetyStock: number;
  recommendedReorderQty: number;
  velocityClass: 'Fast-Moving' | 'Steady' | 'Slow-Moving';
  restockStatus: 'Urgent Restock' | 'Reorder Soon' | 'Healthy';
  leadTimeDays: number;
}

export interface CustomerSegmentationPayload {
  silhouetteScore: number;
  clusterCount: number;
  totalCustomersAnalyzed: number;
  segments: Array<{
    clusterId: number;
    segmentLabel: string;
    customerCount: number;
    avgRecencyDays: number;
    avgFrequency: number;
    avgMonetary: number;
    revenueSharePct: number;
  }>;
  customers: Array<{
    customerId: number;
    name: string;
    branch: string;
    recencyDays: number;
    frequency: number;
    monetary: number;
    clusterId: number;
    segmentLabel: string;
  }>;
}

export interface ProductAssociationRule {
  antecedentId: number;
  antecedentName: string;
  consequentId: number;
  consequentName: string;
  coOccurrenceCount: number;
  supportPct: number;
  confidencePct: number;
  lift: number;
}

export interface BiAnalyticsPayload {
  kpis: {
    totalRevenue: number;
    grossProfit: number;
    marginPct: number;
    distinctOrders: number;
    avgOrderValue: number;
  };
  categoryBreakdown: Array<{ name: string; revenue: number; profit: number; units: number }>;
  branchBreakdown: Array<{ name: string; revenue: number; profit: number; orders: number }>;
  trendSeries: Array<{ date: string; revenue: number; profit: number }>;
  paymentMix: Array<{ method: string; count: number; pct: number }>;
  productRankings: Array<{
    productId: number;
    name: string;
    sku: string;
    revenue: number;
    profit: number;
    units: number;
    marginPct: number;
  }>;
}

export interface CustomerRecord {
  id: number;
  name: string;
  email: string;
  phone: string;
  branch: string;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
  lastPurchaseAt: string | null;
}

export interface NotificationRecord {
  id: number;
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'low_stock' | 'stockout_prediction' | 'sales_milestone' | 'inventory_event';
  productId?: number | null;
  isRead: boolean;
  createdAt: string;
}

export interface SampleStats {
  products: number;
  customers: number;
  sales: number;
  purchases: number;
  suppliers: number;
}

export interface PurchaseOrderRecord {
  id: number;
  poNumber: string;
  supplierId: number;
  supplierName: string;
  branch: string;
  totalCost: number;
  status: 'Received' | 'Pending';
  createdAt: string;
  items: Array<{
    id: number;
    productId: number;
    productName: string;
    quantity: number;
    unitCost: number;
  }>;
}

export type AppSection =
  | 'dashboard'
  | 'pos'
  | 'inventory'
  | 'ml'
  | 'bi'
  | 'customers'
  | 'architecture';
