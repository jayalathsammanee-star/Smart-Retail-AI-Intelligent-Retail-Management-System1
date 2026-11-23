import React, { useEffect, useState } from 'react';
import { apiRequest, formatCurrency } from '../lib/api';
import type {
  BiAnalyticsPayload,
  Category,
  CustomerSegmentationPayload,
  InventoryPredictionItem,
  SalesForecastPayload,
} from '../types';
import {
  DonutMixChart,
  ForecastBandChart,
  HorizontalBarChart,
  RevenueAreaChart,
} from './Charts';

interface BiAnalyticsViewProps {
  branches: string[];
}

type BiPage =
  | 'overview'
  | 'profit'
  | 'products'
  | 'inventory'
  | 'customers'
  | 'forecasting';

export const BiAnalyticsView: React.FC<BiAnalyticsViewProps> = ({ branches }) => {
  const [page, setPage] = useState<BiPage>('overview');
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [branch, setBranch] = useState<string>('All');
  const [categoryId, setCategoryId] = useState<string>('All');
  const [categories, setCategories] = useState<Category[]>([]);
  const [biData, setBiData] = useState<BiAnalyticsPayload | null>(null);
  const [invMl, setInvMl] = useState<InventoryPredictionItem[]>([]);
  const [segMl, setSegMl] = useState<CustomerSegmentationPayload | null>(null);
  const [forecastMl, setForecastMl] = useState<SalesForecastPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{ categories: Category[] }>('/api/meta').then((r) => setCategories(r.categories));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      apiRequest<BiAnalyticsPayload>(
        `/api/analytics/bi?days=${days}&branch=${encodeURIComponent(branch)}&categoryId=${encodeURIComponent(categoryId)}`
      ),
      apiRequest<{ predictions: InventoryPredictionItem[] }>('/api/ml/inventory'),
      apiRequest<CustomerSegmentationPayload>('/api/ml/segmentation'),
      apiRequest<SalesForecastPayload>('/api/ml/forecast?horizon=30'),
    ])
      .then(([bi, inv, seg, fc]) => {
        if (!active) return;
        setBiData(bi);
        setInvMl(inv.predictions);
        setSegMl(seg);
        setForecastMl(fc);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [days, branch, categoryId]);

  const pages: Array<{ id: BiPage; label: string }> = [
    { id: 'overview', label: '1. Sales Overview' },
    { id: 'profit', label: '2. Revenue & Profit' },
    { id: 'products', label: '3. Product Performance' },
    { id: 'inventory', label: '4. Inventory Analysis' },
    { id: 'customers', label: '5. Customer Behavior' },
    { id: 'forecasting', label: '6. Sales Forecasting' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E113A] dark:text-[#F5F3FF]">
            Business Intelligence Hub
          </h1>
          <p className="text-sm text-[#5B4B7A] dark:text-[#A799C9]">
            Interactive multi-dimensional reporting across sales, margin, inventory, and customer cohorts
          </p>
        </div>

        {/* Global Slicers (Date, Category, Branch) */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#EFEAFF] dark:bg-[#1D1433]">
            {([7, 30, 90] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  days === d ? 'bg-[#6D28D9] text-white' : 'text-[#5B4B7A] dark:text-[#A799C9]'
                }`}
              >
                {d}D
              </button>
            ))}
          </div>

          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-white dark:bg-[#160F29]"
          >
            <option value="All">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-white dark:bg-[#160F29]"
          >
            <option value="All">All Branches</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 6 Power BI Dashboard Page Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[#E9E2FA] dark:border-[#2A1F47] pb-2">
        {pages.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPage(p.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              page === p.id
                ? 'bg-[#6D28D9] text-white'
                : 'text-[#5B4B7A] dark:text-[#A799C9] hover:bg-[#EFEAFF] dark:hover:bg-[#22173D]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading && !biData ? (
        <div className="h-64 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47] animate-pulse" />
      ) : (
        biData && (
          <div className="space-y-6">
            {/* Shared BI KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="p-4 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
                <span className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">Filtered Revenue</span>
                <div className="mt-1 text-xl font-bold font-mono tabular-nums">
                  {formatCurrency(biData.kpis.totalRevenue)}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
                <span className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">Gross Profit</span>
                <div className="mt-1 text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(biData.kpis.grossProfit)}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
                <span className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">Gross Margin</span>
                <div className="mt-1 text-xl font-bold font-mono tabular-nums text-[#6D28D9] dark:text-[#A78BFA]">
                  {biData.kpis.marginPct}%
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
                <span className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">Orders</span>
                <div className="mt-1 text-xl font-bold font-mono tabular-nums">
                  {biData.kpis.distinctOrders}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
                <span className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">Avg Order Value</span>
                <div className="mt-1 text-xl font-bold font-mono tabular-nums">
                  {formatCurrency(biData.kpis.avgOrderValue)}
                </div>
              </div>
            </div>

            {page === 'overview' && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <section className="xl:col-span-8 p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
                  <h2 className="text-sm font-semibold mb-4">Revenue & Profit Trend ({days} Days)</h2>
                  <RevenueAreaChart data={biData.trendSeries} showProfit />
                </section>
                <section className="xl:col-span-4 p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
                  <h2 className="text-sm font-semibold mb-4">Payment Tender Mix</h2>
                  <DonutMixChart
                    slices={biData.paymentMix.map((p) => ({
                      label: p.method,
                      value: p.count,
                      pct: p.pct,
                    }))}
                    centerTitle="Orders"
                    centerValue={String(biData.kpis.distinctOrders)}
                  />
                </section>
              </div>
            )}

            {page === 'profit' && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <section className="xl:col-span-6 p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
                  <h2 className="text-sm font-semibold mb-4">Profit Contribution by Category</h2>
                  <HorizontalBarChart
                    items={biData.categoryBreakdown.map((c) => ({
                      label: c.name,
                      value: c.profit,
                      subLabel: `${c.units} units`,
                    }))}
                  />
                </section>
                <section className="xl:col-span-6 p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
                  <h2 className="text-sm font-semibold mb-4">Branch Revenue vs Profit</h2>
                  <HorizontalBarChart
                    items={biData.branchBreakdown.map((b) => ({
                      label: b.name,
                      value: b.revenue,
                      subLabel: `Profit ${formatCurrency(b.profit)}`,
                    }))}
                  />
                </section>
              </div>
            )}

            {page === 'products' && (
              <section className="p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
                <h2 className="text-sm font-semibold mb-4">Product Performance Ranking</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[#E9E2FA] dark:border-[#2A1F47] text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                        <th className="py-2 font-medium">Rank</th>
                        <th className="py-2 font-medium">Product</th>
                        <th className="py-2 font-medium text-right">Units Sold</th>
                        <th className="py-2 font-medium text-right">Revenue</th>
                        <th className="py-2 font-medium text-right">Gross Profit</th>
                        <th className="py-2 font-medium text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFEAFF] dark:divide-[#2A1F47]">
                      {biData.productRankings.map((p, idx) => (
                        <tr key={p.productId}>
                          <td className="py-2.5 pr-3 font-mono text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                            #{idx + 1}
                          </td>
                          <td className="py-2.5 pr-3 font-medium">{p.name}</td>
                          <td className="py-2.5 text-right font-mono tabular-nums">{p.units}</td>
                          <td className="py-2.5 text-right font-mono tabular-nums">
                            {formatCurrency(p.revenue)}
                          </td>
                          <td className="py-2.5 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(p.profit)}
                          </td>
                          <td className="py-2.5 text-right font-mono tabular-nums">{p.marginPct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {page === 'inventory' && (
              <section className="p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
                <h2 className="text-sm font-semibold mb-4">Inventory Health & Velocity Distribution</h2>
                <HorizontalBarChart
                  items={invMl.slice(0, 8).map((item) => ({
                    label: item.name,
                    value: item.currentStock,
                    subLabel: `${item.velocityClass} · ${item.restockStatus}`,
                  }))}
                  formatValue={(v) => `${v} units`}
                />
              </section>
            )}

            {page === 'customers' && segMl && (
              <section className="p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
                <h2 className="text-sm font-semibold mb-4">Customer Cohort Revenue Share</h2>
                <DonutMixChart
                  slices={segMl.segments.map((s) => ({
                    label: s.segmentLabel,
                    value: s.customerCount,
                    pct: s.revenueSharePct,
                  }))}
                  centerTitle="Customers"
                  centerValue={String(segMl.totalCustomersAnalyzed)}
                />
              </section>
            )}

            {page === 'forecasting' && forecastMl && (
              <section className="p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
                <h2 className="text-sm font-semibold mb-4">30-Day Executive Forecast Curve</h2>
                <ForecastBandChart series={forecastMl.series} />
              </section>
            )}
          </div>
        )
      )}
    </div>
  );
};
