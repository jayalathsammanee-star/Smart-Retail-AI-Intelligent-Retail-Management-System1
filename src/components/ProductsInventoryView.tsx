import React, { useEffect, useState } from 'react';
import { ArrowDownUp, Edit3, Package, Plus, Search, Trash2, X } from 'lucide-react';
import { apiRequest, formatCurrency, formatShortDate } from '../lib/api';
import type {
  Category,
  InventoryPayload,
  ProductWithInventory,
  PurchaseOrderRecord,
  RoleName,
  Supplier,
} from '../types';

interface ProductsInventoryViewProps {
  userRole: RoleName;
  branches: string[];
  onInventoryMutated: () => void;
}

export const ProductsInventoryView: React.FC<ProductsInventoryViewProps> = ({
  userRole,
  branches,
  onInventoryMutated,
}) => {
  const [subTab, setSubTab] = useState<'catalog' | 'movements' | 'purchases'>('catalog');
  const [data, setData] = useState<InventoryPayload | null>(null);
  const [purchases, setPurchases] = useState<PurchaseOrderRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add / Edit Product Modal
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithInventory | null>(null);
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formCategoryId, setFormCategoryId] = useState<number>(1);
  const [formSupplierId, setFormSupplierId] = useState<number>(1);
  const [formCost, setFormCost] = useState('10.00');
  const [formPrice, setFormPrice] = useState('24.00');
  const [formStock, setFormStock] = useState('25');
  const [formMinStock, setFormMinStock] = useState('10');
  const [formBranch, setFormBranch] = useState(branches[0] || 'Flagship Downtown');
  const [formExpiry, setFormExpiry] = useState('');

  // Stock Adjustment Modal
  const [adjustTarget, setAdjustTarget] = useState<ProductWithInventory | null>(null);
  const [adjustType, setAdjustType] = useState<'IN' | 'OUT'>('IN');
  const [adjustQty, setAdjustQty] = useState('15');
  const [adjustReason, setAdjustReason] = useState('Supplier restock delivery');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, metaRes, poRes] = await Promise.all([
        apiRequest<InventoryPayload>('/api/inventory'),
        apiRequest<{ categories: Category[]; suppliers: Supplier[] }>('/api/meta'),
        apiRequest<{ purchases: PurchaseOrderRecord[] }>('/api/purchases'),
      ]);
      setData(invRes);
      setCategories(metaRes.categories);
      setSuppliers(metaRes.suppliers);
      setPurchases(poRes.purchases);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormSku(`SKU-${Math.floor(100 + Math.random() * 899)}`);
    setFormBarcode(`89012345${Math.floor(10000 + Math.random() * 89999)}`);
    setFormCategoryId(categories[0]?.id ?? 1);
    setFormSupplierId(suppliers[0]?.id ?? 1);
    setFormCost('10.00');
    setFormPrice('24.00');
    setFormStock('25');
    setFormMinStock('10');
    setFormBranch(branches[0] || 'Flagship Downtown');
    setFormExpiry('');
    setProductModalOpen(true);
  };

  const openEditModal = (prod: ProductWithInventory) => {
    setEditingProduct(prod);
    setFormName(prod.name);
    setFormSku(prod.sku);
    setFormBarcode(prod.barcode);
    setFormCategoryId(prod.categoryId);
    setFormSupplierId(prod.supplierId);
    setFormCost(String(prod.purchasePrice));
    setFormPrice(String(prod.sellingPrice));
    setFormStock(String(prod.stockQuantity));
    setFormMinStock(String(prod.minStockLevel));
    setFormBranch(prod.branch);
    setFormExpiry(prod.expiryDate || '');
    setProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingProduct) {
        await apiRequest(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: formName,
            categoryId: formCategoryId,
            purchasePrice: Number(formCost),
            sellingPrice: Number(formPrice),
            minStockLevel: Number(formMinStock),
            branch: formBranch,
            expiryDate: formExpiry || null,
          }),
        });
      } else {
        await apiRequest('/api/products', {
          method: 'POST',
          body: JSON.stringify({
            name: formName,
            sku: formSku,
            barcode: formBarcode,
            categoryId: formCategoryId,
            supplierId: formSupplierId,
            purchasePrice: Number(formCost),
            sellingPrice: Number(formPrice),
            stockQuantity: Number(formStock),
            minStockLevel: Number(formMinStock),
            branch: formBranch,
            expiryDate: formExpiry || null,
          }),
        });
      }
      setProductModalOpen(false);
      await loadData();
      onInventoryMutated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save product');
    }
  };

  const handleDeleteProduct = async (id: number) => {
    setError(null);
    try {
      await apiRequest(`/api/products/${id}`, { method: 'DELETE' });
      await loadData();
      onInventoryMutated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    setError(null);
    try {
      await apiRequest('/api/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({
          productId: adjustTarget.id,
          movementType: adjustType,
          quantity: Number(adjustQty),
          reason: adjustReason,
        }),
      });
      setAdjustTarget(null);
      await loadData();
      onInventoryMutated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stock adjustment failed');
    }
  };

  const filteredItems = (data?.items ?? []).filter((item) => {
    const matchesSearch =
      !search.trim() ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      item.barcode.includes(search.trim());
    const matchesCat = categoryFilter === 'All' || String(item.categoryId) === categoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E113A] dark:text-[#F5F3FF]">
            Products & Inventory Control
          </h1>
          <p className="text-sm text-[#5B4B7A] dark:text-[#A799C9]">
            Manage SKUs, barcodes, stock valuation, expiry dates, and stock movements
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#EFEAFF] dark:bg-[#1D1433]">
            <button
              type="button"
              onClick={() => setSubTab('catalog')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                subTab === 'catalog'
                  ? 'bg-[#6D28D9] text-white'
                  : 'text-[#5B4B7A] dark:text-[#A799C9]'
              }`}
            >
              Product Catalog
            </button>
            <button
              type="button"
              onClick={() => setSubTab('movements')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                subTab === 'movements'
                  ? 'bg-[#6D28D9] text-white'
                  : 'text-[#5B4B7A] dark:text-[#A799C9]'
              }`}
            >
              Stock Movements
            </button>
            <button
              type="button"
              onClick={() => setSubTab('purchases')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                subTab === 'purchases'
                  ? 'bg-[#6D28D9] text-white'
                  : 'text-[#5B4B7A] dark:text-[#A799C9]'
              }`}
            >
              Purchase Orders
            </button>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
            <span className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">Inventory Cost Value</span>
            <div className="mt-1 text-xl font-bold font-mono tabular-nums">
              {formatCurrency(data.summary.totalCostValuation)}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
            <span className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">Retail Stock Value</span>
            <div className="mt-1 text-xl font-bold font-mono tabular-nums text-[#6D28D9] dark:text-[#A78BFA]">
              {formatCurrency(data.summary.totalRetailValuation)}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
            <span className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">Total Units on Hand</span>
            <div className="mt-1 text-xl font-bold font-mono tabular-nums">
              {data.summary.totalUnits}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
            <span className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">Low Stock / Expiring</span>
            <div className="mt-1 text-xl font-bold font-mono tabular-nums text-[#D97706] dark:text-[#FBBF24]">
              {data.summary.lowStockCount} / {data.summary.expiringSoonCount}
            </div>
          </div>
        </div>
      )}

      {subTab === 'catalog' ? (
        <div className="p-5 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47] space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#5B4B7A] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by product name, SKU, or barcode..."
                className="w-full pl-10 pr-3.5 py-2 text-sm rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819]"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3.5 py-2 text-sm rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819]"
            >
              <option value="All">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-[#5B4B7A]">Loading products...</div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#5B4B7A]">
              No products match the current filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E9E2FA] dark:border-[#2A1F47] text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                    <th className="py-2.5 font-medium">Product</th>
                    <th className="py-2.5 font-medium">Barcode</th>
                    <th className="py-2.5 font-medium text-right">Cost / Price</th>
                    <th className="py-2.5 font-medium text-right">Stock</th>
                    <th className="py-2.5 font-medium">Expiry</th>
                    <th className="py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEAFF] dark:divide-[#2A1F47]">
                  {filteredItems.map((item) => {
                    const isLow = item.stockQuantity <= item.minStockLevel;
                    return (
                      <tr key={item.id} className="hover:bg-[#F7F5FF] dark:hover:bg-[#1E1438]">
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-3">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                referrerPolicy="no-referrer"
                                className="w-11 h-11 rounded-lg object-cover border border-[#E9E2FA] dark:border-[#2A1F47] shrink-0"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-lg bg-[#EFEAFF] dark:bg-[#24193E] flex items-center justify-center text-[#6D28D9] dark:text-[#A78BFA] shrink-0">
                                <Package className="w-5 h-5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-medium text-[#1E113A] dark:text-[#F5F3FF] truncate max-w-[230px]">
                                {item.name}
                              </div>
                              <div className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                                {item.sku} · {item.categoryName} · {item.branch}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-3 font-mono text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                          {item.barcode}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono tabular-nums">
                          <div>{formatCurrency(item.sellingPrice)}</div>
                          <div className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                            Cost {formatCurrency(item.purchasePrice)} · {item.marginPct}%
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-right font-mono tabular-nums">
                          <span
                            className={`font-semibold ${
                              isLow ? 'text-red-600 dark:text-red-400' : 'text-[#1E113A] dark:text-[#F5F3FF]'
                            }`}
                          >
                            {item.stockQuantity}
                          </span>
                          <div className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                            Min {item.minStockLevel}
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-xs font-mono text-[#5B4B7A] dark:text-[#A799C9]">
                          {item.expiryDate ? item.expiryDate : 'Non-perishable'}
                        </td>
                        <td className="py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustTarget(item);
                                setAdjustType('IN');
                                setAdjustQty('15');
                              }}
                              className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-[#E9E2FA] dark:border-[#2A1F47] hover:bg-[#EFEAFF] dark:hover:bg-[#24193E] flex items-center gap-1"
                              title="Stock In/Out"
                            >
                              <ArrowDownUp className="w-3.5 h-3.5 text-[#7C3AED]" />
                              Stock
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="p-1.5 rounded-md border border-[#E9E2FA] dark:border-[#2A1F47] hover:bg-[#EFEAFF] dark:hover:bg-[#24193E]"
                              title="Edit product"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {userRole === 'admin' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(item.id)}
                                className="p-1.5 rounded-md border border-[#E9E2FA] dark:border-[#2A1F47] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                                title="Delete product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : subTab === 'movements' ? (
        <div className="p-5 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
          <h2 className="text-base font-semibold mb-4">Stock Movement Audit Log</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E9E2FA] dark:border-[#2A1F47] text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Product</th>
                  <th className="py-2 font-medium">Type</th>
                  <th className="py-2 font-medium text-right">Delta</th>
                  <th className="py-2 font-medium text-right">New Stock</th>
                  <th className="py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEAFF] dark:divide-[#2A1F47]">
                {(data?.movements ?? []).map((m) => (
                  <tr key={m.id}>
                    <td className="py-2.5 pr-3 text-xs font-mono text-[#5B4B7A] dark:text-[#A799C9]">
                      {formatShortDate(m.createdAt)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="font-medium">{m.productName}</div>
                      <div className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">{m.sku}</div>
                    </td>
                    <td className="py-2.5 pr-3 text-xs font-mono">{m.movementType}</td>
                    <td
                      className={`py-2.5 pr-3 text-right font-mono tabular-nums font-semibold ${
                        m.quantityDelta >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {m.quantityDelta >= 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono tabular-nums">{m.newStock}</td>
                    <td className="py-2.5 text-xs text-[#5B4B7A] dark:text-[#A799C9]">{m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
          <h2 className="text-base font-semibold mb-4">Supplier Purchase Orders</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E9E2FA] dark:border-[#2A1F47] text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                  <th className="py-2 font-medium">PO Number</th>
                  <th className="py-2 font-medium">Supplier</th>
                  <th className="py-2 font-medium">Branch</th>
                  <th className="py-2 font-medium">Line Items</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEAFF] dark:divide-[#2A1F47]">
                {purchases.map((po) => (
                  <tr key={po.id}>
                    <td className="py-2.5 pr-3 font-mono text-xs font-semibold text-[#6D28D9] dark:text-[#A78BFA]">
                      <div>{po.poNumber}</div>
                      <div className="text-[#5B4B7A] dark:text-[#A799C9] font-normal">
                        {formatShortDate(po.createdAt)}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 font-medium">{po.supplierName}</td>
                    <td className="py-2.5 pr-3 text-xs">{po.branch}</td>
                    <td className="py-2.5 pr-3 text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                      {po.items.map((it) => `${it.productName} (${it.quantity})`).join(' · ')}
                    </td>
                    <td className="py-2.5 pr-3 text-xs font-medium">
                      <span
                        className={
                          po.status === 'Received'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }
                      >
                        {po.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums font-semibold">
                      {formatCurrency(po.totalCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">
                {editingProduct ? 'Edit Product Details' : 'Register New Product'}
              </h2>
              <button
                type="button"
                onClick={() => setProductModalOpen(false)}
                className="p-1 rounded-md hover:bg-[#EFEAFF] dark:hover:bg-[#24193E]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveProduct} className="space-y-3.5">
              <div>
                <label className="block text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819]"
                />
              </div>
              {!editingProduct && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-1">SKU</label>
                    <input
                      type="text"
                      required
                      value={formSku}
                      onChange={(e) => setFormSku(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-1">Barcode</label>
                    <input
                      type="text"
                      required
                      value={formBarcode}
                      onChange={(e) => setFormBarcode(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819]"
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-1">Category</label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-1">Branch</label>
                  <select
                    value={formBranch}
                    onChange={(e) => setFormBranch(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819]"
                  >
                    {branches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-1">Purchase Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formCost}
                    onChange={(e) => setFormCost(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-1">Selling Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {!editingProduct && (
                  <div>
                    <label className="block text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-1">Initial Stock</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={formStock}
                      onChange={(e) => setFormStock(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819]"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-1">Min Threshold</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819]"
                  />
                </div>
                <div className={editingProduct ? 'col-span-2' : ''}>
                  <label className="block text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-1">Expiry Date (optional)</label>
                  <input
                    type="date"
                    value={formExpiry}
                    onChange={(e) => setFormExpiry(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819]"
                  />
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white"
                >
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47] p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">Stock Adjustment</h2>
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="p-1 rounded-md hover:bg-[#EFEAFF] dark:hover:bg-[#24193E]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-4">
              {adjustTarget.name} · Current stock: {adjustTarget.stockQuantity} units
            </p>
            <form onSubmit={handleAdjustStock} className="space-y-3.5">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustType('IN')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg border ${
                    adjustType === 'IN'
                      ? 'bg-[#6D28D9] text-white border-[#6D28D9]'
                      : 'border-[#E9E2FA] dark:border-[#2A1F47]'
                  }`}
                >
                  Stock-In (+)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('OUT')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg border ${
                    adjustType === 'OUT'
                      ? 'bg-[#6D28D9] text-white border-[#6D28D9]'
                      : 'border-[#E9E2FA] dark:border-[#2A1F47]'
                  }`}
                >
                  Stock-Out (-)
                </button>
              </div>
              <div>
                <label className="block text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-1">Reason / Reference</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819]"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white"
                >
                  Apply Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
