import React, { useEffect, useState } from 'react';
import { ArrowUpRight, AlertTriangle, Database, Package, ShoppingCart, Users } from 'lucide-react';
import { apiRequest, formatCurrency, formatShortDate } from '../lib/api';
import type { AppSection, DashboardPayload } from '../types';
import { RevenueAreaChart } from './Charts';

interface DashboardViewProps {
  branches: string[];
  onNavigate: (section: AppSection) => void;
  refreshSignal: number;
  onDataMutated: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  branches,
  onNavigate,
  refreshSignal,
  onDataMutated,
}) => {
  const [branch, setBranch] = useState<string>('All');
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [sampleNotice, setSampleNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLoadSampleBatch = async () => {
    setSeeding(true);
    setSampleNotice(null);
    try {
      const res = await apiRequest<{
        addedSales: number;
        addedCustomers: number;
        totalSales: number;
      }>('/api/sample-data/populate', { method: 'POST' });
      setSampleNotice(
        `Added ${res.addedSales} sample sales and ${res.addedCustomers} customers (total sales: ${res.totalSales}).`
      );
      onDataMutated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sample batch');
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    apiRequest<DashboardPayload>(`/api/dashboard?branch=${encodeURIComponent(branch)}`)
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [branch, refreshSignal]);

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]" />
          ))}
        </div>
        <div className="h-72 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Workspace Header & Branch Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E113A] dark:text-[#F5F3FF]">
            Executive Retail Overview
          </h1>
          <p className="text-sm text-[#5B4B7A] dark:text-[#A799C9]">
            Live sales performance, stock thresholds, and multi-branch throughput
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#EFEAFF] dark:bg-[#1D1433]">
            {['All', ...branches].map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBranch(b)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  branch === b
                    ? 'bg-[#6D28D9] text-white'
                    : 'text-[#5B4B7A] dark:text-[#A799C9] hover:text-[#1E113A] dark:hover:text-white'
                }`}
              >
                {b === 'All' ? 'All Branches' : b.split(' ')[0]}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={seeding}
            onClick={handleLoadSampleBatch}
            className="px-3.5 py-2 text-xs font-medium rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-white dark:bg-[#160F29] hover:bg-[#F3EEFF] dark:hover:bg-[#22173D] flex items-center gap-1.5 whitespace-nowrap disabled:opacity-60"
          >
            <Database className="w-3.5 h-3.5 text-[#6D28D9] dark:text-[#A78BFA]" />
            {seeding ? 'Adding Sample Data...' : 'Add Sample Data'}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('pos')}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white transition-colors whitespace-nowrap"
          >
            New POS Sale
          </button>
        </div>
      </div>

      {sampleNotice && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
          {sampleNotice}
        </div>
      )}

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
          <div className="flex items-center justify-between text-xs text-[#5B4B7A] dark:text-[#A799C9]">
            <span>Total Revenue</span>
            <ArrowUpRight className="w-4 h-4 text-[#10B981]" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#1E113A] dark:text-[#F5F3FF]">
            {formatCurrency(data.kpis.totalRevenue)}
          </div>
          <p className="mt-1 text-xs text-[#059669] dark:text-[#34D399] font-mono tabular-nums">
            Gross Profit: {formatCurrency(data.kpis.totalProfit)}
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
          <div className="flex items-center justify-between text-xs text-[#5B4B7A] dark:text-[#A799C9]">
            <span>Completed Sales</span>
            <ShoppingCart className="w-4 h-4 text-[#7C3AED]" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#1E113A] dark:text-[#F5F3FF]">
            {data.kpis.totalSalesCount}
          </div>
          <p className="mt-1 text-xs text-[#5B4B7A] dark:text-[#A799C9] font-mono tabular-nums">
            Avg Ticket:{' '}
            {formatCurrency(
              data.kpis.totalSalesCount > 0 ? data.kpis.totalRevenue / data.kpis.totalSalesCount : 0
            )}
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
          <div className="flex items-center justify-between text-xs text-[#5B4B7A] dark:text-[#A799C9]">
            <span>Active Products</span>
            <Package className="w-4 h-4 text-[#7C3AED]" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#1E113A] dark:text-[#F5F3FF]">
            {data.kpis.totalProducts}
          </div>
          <p className="mt-1 text-xs text-[#5B4B7A] dark:text-[#A799C9] font-mono tabular-nums">
            Retail Value: {formatCurrency(data.kpis.inventoryRetailValue)}
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
          <div className="flex items-center justify-between text-xs text-[#5B4B7A] dark:text-[#A799C9]">
            <span>Customers & Alerts</span>
            <Users className="w-4 h-4 text-[#7C3AED]" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#1E113A] dark:text-[#F5F3FF]">
            {data.kpis.totalCustomers}
          </div>
          <p
            className={`mt-1 text-xs font-medium ${
              data.kpis.lowStockCount > 0
                ? 'text-[#D97706] dark:text-[#FBBF24]'
                : 'text-[#059669] dark:text-[#34D399]'
            }`}
          >
            {data.kpis.lowStockCount} low-stock SKUs requiring attention
          </p>
        </div>
      </div>

      {/* Main Chart + Low Stock Watchlist */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-8 p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-[#1E113A] dark:text-[#F5F3FF]">
                21-Day Sales Revenue Trajectory
              </h2>
              <p className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                Hover bars to inspect daily revenue and order volume
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('ml')}
              className="text-xs font-medium text-[#6D28D9] dark:text-[#A78BFA] hover:underline whitespace-nowrap"
            >
              Open ML Forecast →
            </button>
          </div>
          <RevenueAreaChart data={data.salesChart} />
        </section>

        <section className="xl:col-span-4 p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47] flex flex-col">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#1E113A] dark:text-[#F5F3FF]">
              Low Stock Watchlist
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs font-medium text-[#6D28D9] dark:text-[#A78BFA] hover:underline"
            >
              Restock →
            </button>
          </div>

          {data.lowStockProducts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-[#5B4B7A] dark:text-[#A799C9] text-center py-8">
              All products are above minimum stock levels.
            </div>
          ) : (
            <div className="divide-y divide-[#EFEAFF] dark:divide-[#2A1F47]">
              {data.lowStockProducts.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1E113A] dark:text-[#F5F3FF] truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                      {item.sku} · Min {item.minStockLevel}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-red-600 dark:text-red-400 tabular-nums">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {item.stockQuantity} left
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Best Sellers & Recent Transactions */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-6 p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#1E113A] dark:text-[#F5F3FF]">
              Best-Selling Products
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('bi')}
              className="text-xs font-medium text-[#6D28D9] dark:text-[#A78BFA] hover:underline"
            >
              BI Breakdown →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E9E2FA] dark:border-[#2A1F47] text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                  <th className="py-2 font-medium">Product</th>
                  <th className="py-2 font-medium text-right">Units</th>
                  <th className="py-2 font-medium text-right">Stock</th>
                  <th className="py-2 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEAFF] dark:divide-[#2A1F47]">
                {data.bestSellingProducts.map((prod) => (
                  <tr key={prod.productId} className="hover:bg-[#F7F5FF] dark:hover:bg-[#1E1438]">
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-[#1E113A] dark:text-[#F5F3FF] truncate max-w-[220px]">
                        {prod.name}
                      </div>
                      <div className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                        {prod.sku} · {prod.categoryName}
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums">{prod.unitsSold}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">{prod.stockQuantity}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums font-semibold">
                      {formatCurrency(prod.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="xl:col-span-6 p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#1E113A] dark:text-[#F5F3FF]">
              Recent Transactions
            </h2>
            <span className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">Latest 8 invoices</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E9E2FA] dark:border-[#2A1F47] text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                  <th className="py-2 font-medium">Invoice</th>
                  <th className="py-2 font-medium">Customer</th>
                  <th className="py-2 font-medium">Method</th>
                  <th className="py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEAFF] dark:divide-[#2A1F47]">
                {data.recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#F7F5FF] dark:hover:bg-[#1E1438]">
                    <td className="py-2.5 pr-2">
                      <div className="font-mono text-xs font-semibold text-[#6D28D9] dark:text-[#A78BFA]">
                        {tx.invoiceNumber}
                      </div>
                      <div className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                        {formatShortDate(tx.createdAt)}
                      </div>
                    </td>
                    <td className="py-2.5 pr-2">
                      <div className="text-[#1E113A] dark:text-[#F5F3FF] truncate max-w-[140px]">
                        {tx.customerName}
                      </div>
                      <div className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">{tx.branch}</div>
                    </td>
                    <td className="py-2.5 text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                      {tx.paymentMethod}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums font-semibold">
                      {formatCurrency(tx.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
