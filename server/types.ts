export type RoleName = 'admin' | 'staff';

export interface Role {
  id: number;
  name: RoleName;
  description: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  roleId: number;
  role: RoleName;
  branch: string;
  avatarUrl?: string;
  createdAt: string;
}

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

export interface Product {
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
}

export interface InventoryRecord {
  id: number;
  productId: number;
  stockQuantity: number;
  minStockLevel: number;
  reorderPoint: number;
  updatedAt: string;
}

export interface ProductWithInventory extends Product {
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

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  branch: string;
  createdAt: string;
}

export interface Sale {
  id: number;
  invoiceNumber: string;
  customerId: number | null;
  userId: number;
  branch: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: 'Card' | 'Cash' | 'Mobile Pay';
  createdAt: string;
}

export interface SaleItem {
  id: number;
  saleId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  lineTotal: number;
}

export interface Purchase {
  id: number;
  supplierId: number;
  userId: number;
  branch: string;
  totalCost: number;
  status: 'Received' | 'Pending';
  createdAt: string;
}

export interface PurchaseItem {
  id: number;
  purchaseId: number;
  productId: number;
  quantity: number;
  unitCost: number;
}

export type StockMovementType = 'IN' | 'OUT' | 'SALE' | 'ADJUSTMENT';

export interface StockMovement {
  id: number;
  productId: number;
  movementType: StockMovementType;
  quantityDelta: number;
  previousStock: number;
  newStock: number;
  reason: string;
  userId: number;
  createdAt: string;
}

export type NotificationSeverity = 'critical' | 'warning' | 'info';
export type NotificationCategory = 'low_stock' | 'stockout_prediction' | 'sales_milestone' | 'inventory_event';

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  severity: NotificationSeverity;
  category: NotificationCategory;
  productId?: number | null;
  isRead: boolean;
  createdAt: string;
}

export interface StoreSchema {
  roles: Role[];
  users: User[];
  categories: Category[];
  suppliers: Supplier[];
  products: Product[];
  inventory: InventoryRecord[];
  customers: Customer[];
  sales: Sale[];
  saleItems: SaleItem[];
  purchases: Purchase[];
  purchaseItems: PurchaseItem[];
  stockMovements: StockMovement[];
  notifications: NotificationItem[];
  nextIds: Record<string, number>;
  seedVersion?: number;
}
