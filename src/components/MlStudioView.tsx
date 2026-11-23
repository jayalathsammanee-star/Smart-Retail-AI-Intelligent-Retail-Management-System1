import React, { useEffect, useState } from 'react';
import { BrainCircuit, Layers, RefreshCw, TrendingUp, Users } from 'lucide-react';
import { apiRequest, formatCurrency } from '../lib/api';
import type {
  CustomerSegmentationPayload,
  InventoryPredictionItem,
  ProductAssociationRule,
  SalesForecastPayload,
} from '../types';
import { ClusterScatterChart, ForecastBandChart, HorizontalBarChart } from './Charts';

interface MlStudioViewProps {
  onInventoryMutated: () => void;
}

export const MlStudioView: React.FC<MlStudioViewProps> = ({ onInventoryMutated }) => {
  const [activeTab, setActiveTab] = useState<'forecast' | 'inventory' | 'segmentation' | 'basket'>('forecast');
  const [horizon, setHorizon] = useState<7 | 30 | 90>(30);
  const [forecast, setForecast] = useState<SalesForecastPayload | null>(null);
  const [invPredictions, setInvPredictions] = useState<InventoryPredictionItem[]>([]);
  const [segmentation, setSegmentation] = useState<CustomerSegmentationPayload | null>(null);
  const [associations, setAssociations] = useState<ProductAssociationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [restockingId, setRestockingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadAllModels = async (h: 7 | 30 | 90) => {
    setLoading(true);
    try {
      const [fRes, iRes, sRes, aRes] = await Promise.all([
        apiRequest<SalesForecastPayload>(`/api/ml/forecast?horizon=${h}`),
        apiRequest<{ predictions: InventoryPredictionItem[] }>('/api/ml/inventory'),
        apiRequest<CustomerSegmentationPayload>('/api/ml/segmentation'),
        apiRequest<{ rules: ProductAssociationRule[] }>('/api/ml/associations'),
      ]);
      setForecast(fRes);
      setInvPredictions(iRes.predictions);
      setSegmentation(sRes);
      setAssociations(aRes.rules);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllModels(horizon);
  }, [horizon]);

  const handleApplyReorder = async (item: InventoryPredictionItem) => {
    if (item.recommendedReorderQty <= 0) return;
    setRestockingId(item.productId);
    setNotice(null);
    try {
      await apiRequest('/api/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({
          productId: item.productId,
          movementType: 'IN',
          quantity: item.recommendedReorderQty,
          reason: `ML EOQ Reorder (${item.recommendedReorderQty} units)`,
        }),
      });
      setNotice(`Restocked +${item.recommendedReorderQty} units for ${item.name}.`);
      await loadAllModels(horizon);
      onInventoryMutated();
    } finally {
      setRestockingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E113A] dark:text-[#F5F3FF]">
            AI & Machine Learning Studio
          </h1>
          <p className="text-sm text-[#5B4B7A] dark:text-[#A799C9]">
            Live statistical & ML models trained directly on store transaction history
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadAllModels(horizon)}
          className="px-4 py-2 text-xs font-semibold rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-white dark:bg-[#160F29] hover:bg-[#F3EEFF] dark:hover:bg-[#22173D] flex items-center gap-2 whitespace-nowrap self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Recompute Models
        </button>
      </div>

      {/* Segmented Navigation */}
      <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#EFEAFF] dark:bg-[#1D1433] w-fit">
        {[
          { id: 'forecast', label: 'Sales Forecasting', icon: TrendingUp },
          { id: 'inventory', label: 'Inventory Demand ML', icon: Layers },
          { id: 'segmentation', label: 'Customer Clustering', icon: Users },
          { id: 'basket', label: 'Product Associations', icon: BrainCircuit },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3.5 py-2 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#6D28D9] text-white'
                  : 'text-[#5B4B7A] dark:text-[#A799C9] hover:text-[#1E113A] dark:hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {notice && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {/* TAB 1: Sales Forecasting */}
      {activeTab === 'forecast' && forecast && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
            <div>
              <h2 className="text-base font-semibold">Time-Series Revenue Forecast</h2>
              <p className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                OLS Linear Trend + Multiplicative 7-Day Seasonality · Holdout Validation ({forecast.metrics.validationWindowDays} days)
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#EFEAFF] dark:bg-[#22173D]">
              {([7, 30, 90] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHorizon(h)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    horizon === h
                      ? 'bg-[#6D28D9] text-white'
                      : 'text-[#5B4B7A] dark:text-[#A799C9]'
                  }`}
                >
                  {h} Days
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
              <span className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                Predicted {forecast.horizonDays}d Revenue
              </span>
              <div className="mt-1 text-xl font-bold font-mono tabular-nums text-[#6D28D9] dark:text-[#A78BFA]">
                {formatCurrency(forecast.projectedTotalRevenue)}
              </div>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                {forecast.growthPctOverHorizon >= 0 ? '+' : ''}
                {forecast.growthPctOverHorizon}% vs recent avg
              </span>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
              <span className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">Daily Trend Slope</span>
              <div className="mt-1 text-xl font-bold font-mono tabular-nums">
                {forecast.trendSlopePerDay >= 0 ? '+' : ''}
                {formatCurrency(forecast.trendSlopePerDay)}/d
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
              <span className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">Validation MAE</span>
              <div className="mt-1 text-xl font-bold font-mono tabular-nums">
                {formatCurrency(forecast.metrics.mae)}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
              <span className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">Validation RMSE</span>
              <div className="mt-1 text-xl font-bold font-mono tabular-nums">
                {formatCurrency(forecast.metrics.rmse)}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
              <span className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">Validation MAPE</span>
              <div className="mt-1 text-xl font-bold font-mono tabular-nums">
                {forecast.metrics.mape}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <section className="xl:col-span-8 p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
              <h3 className="text-sm font-semibold mb-4">
                Actual vs Predicted Sales ({forecast.horizonDays}-Day Horizon)
              </h3>
              <ForecastBandChart series={forecast.series} />
            </section>

            <section className="xl:col-span-4 p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
              <h3 className="text-sm font-semibold mb-1">Seasonal Day-of-Week Pattern</h3>
              <p className="text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-4">
                Multiplicative demand index relative to 1.00 baseline
              </p>
              <HorizontalBarChart
                items={forecast.seasonalPatterns.map((s) => ({
                  label: s.dayName,
                  value: s.avgRevenue,
                  subLabel: `${s.index}x`,
                }))}
              />
            </section>
          </div>
        </div>
      )}

      {/* TAB 2: Inventory Demand Prediction */}
      {activeTab === 'inventory' && (
        <div className="p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
          <div className="mb-4">
            <h2 className="text-base font-semibold">ML Stockout & EOQ Reorder Engine</h2>
            <p className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">
              30-day rolling demand velocity, 95% service-level safety stock, and supplier lead-time predictions
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E9E2FA] dark:border-[#2A1F47] text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                  <th className="py-2.5 font-medium">Product</th>
                  <th className="py-2.5 font-medium">Movement</th>
                  <th className="py-2.5 font-medium text-right">Stock</th>
                  <th className="py-2.5 font-medium text-right">Daily Demand</th>
                  <th className="py-2.5 font-medium text-right">Days Left</th>
                  <th className="py-2.5 font-medium text-right">Safety Stock</th>
                  <th className="py-2.5 font-medium text-right">Reorder Qty</th>
                  <th className="py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEAFF] dark:divide-[#2A1F47]">
                {invPredictions.map((item) => (
                  <tr key={item.productId} className="hover:bg-[#F7F5FF] dark:hover:bg-[#1E1438]">
                    <td className="py-3 pr-3">
                      <div className="font-medium text-[#1E113A] dark:text-[#F5F3FF]">
                        {item.name}
                      </div>
                      <div className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                        {item.sku} · Lead {item.leadTimeDays}d · {item.restockStatus}
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-xs">{item.velocityClass}</td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums">{item.currentStock}</td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums">
                      {item.dailyVelocity}/d
                    </td>
                    <td
                      className={`py-3 pr-3 text-right font-mono tabular-nums font-semibold ${
                        item.daysUntilStockout !== null && item.daysUntilStockout <= 7
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-[#1E113A] dark:text-[#F5F3FF]'
                      }`}
                    >
                      {item.daysUntilStockout !== null ? `${item.daysUntilStockout}d` : '—'}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums">{item.safetyStock}</td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums font-semibold text-[#6D28D9] dark:text-[#A78BFA]">
                      {item.recommendedReorderQty > 0 ? `+${item.recommendedReorderQty}` : '0'}
                    </td>
                    <td className="py-3 text-right">
                      {item.recommendedReorderQty > 0 ? (
                        <button
                          type="button"
                          disabled={restockingId === item.productId}
                          onClick={() => handleApplyReorder(item)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-[#6D28D9] hover:bg-[#5B21B6] text-white disabled:opacity-50 whitespace-nowrap"
                        >
                          {restockingId === item.productId ? 'Restocking...' : 'Apply Reorder'}
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">Optimal</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Customer Segmentation */}
      {activeTab === 'segmentation' && segmentation && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
              <span className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                K-Means Silhouette Score
              </span>
              <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#6D28D9] dark:text-[#A78BFA]">
                {segmentation.silhouetteScore}
              </div>
              <span className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                Range -1.0 to +1.0 (Z-scored RFM)
              </span>
            </div>
            <div className="p-5 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
              <span className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">Clusters Discovered</span>
              <div className="mt-1 text-2xl font-bold font-mono tabular-nums">
                {segmentation.clusterCount}
              </div>
            </div>
            <div className="p-5 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
              <span className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">Customers Analyzed</span>
              <div className="mt-1 text-2xl font-bold font-mono tabular-nums">
                {segmentation.totalCustomersAnalyzed}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <section className="xl:col-span-6 p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
              <h3 className="text-sm font-semibold mb-3">RFM Cluster Distribution</h3>
              <ClusterScatterChart customers={segmentation.customers} />
            </section>

            <section className="xl:col-span-6 p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
              <h3 className="text-sm font-semibold mb-3">Segment Centroids & Revenue Share</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#E9E2FA] dark:border-[#2A1F47] text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                      <th className="py-2 font-medium">Segment</th>
                      <th className="py-2 font-medium text-right">Count</th>
                      <th className="py-2 font-medium text-right">Avg Orders</th>
                      <th className="py-2 font-medium text-right">Avg Spend</th>
                      <th className="py-2 font-medium text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFEAFF] dark:divide-[#2A1F47]">
                    {segmentation.segments.map((seg) => (
                      <tr key={seg.clusterId}>
                        <td className="py-2.5 pr-3 font-medium">{seg.segmentLabel}</td>
                        <td className="py-2.5 text-right font-mono tabular-nums">{seg.customerCount}</td>
                        <td className="py-2.5 text-right font-mono tabular-nums">{seg.avgFrequency}</td>
                        <td className="py-2.5 text-right font-mono tabular-nums">
                          {formatCurrency(seg.avgMonetary)}
                        </td>
                        <td className="py-2.5 text-right font-mono tabular-nums text-[#6D28D9] dark:text-[#A78BFA]">
                          {seg.revenueSharePct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* TAB 4: Market Basket Product Associations */}
      {activeTab === 'basket' && (
        <div className="p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Market Basket Association Rules</h2>
            <p className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">
              Co-purchased product pairs ranked by Lift (&gt; 1.0 indicates positive cross-sell affinity)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E9E2FA] dark:border-[#2A1F47] text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                  <th className="py-2 font-medium">If Customer Buys (Antecedent)</th>
                  <th className="py-2 font-medium">Likely Also Buys (Consequent)</th>
                  <th className="py-2 font-medium text-right">Pair Count</th>
                  <th className="py-2 font-medium text-right">Support</th>
                  <th className="py-2 font-medium text-right">Confidence</th>
                  <th className="py-2 font-medium text-right">Lift</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEAFF] dark:divide-[#2A1F47]">
                {associations.map((rule, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 pr-3 font-medium">{rule.antecedentName}</td>
                    <td className="py-2.5 pr-3 text-[#6D28D9] dark:text-[#A78BFA] font-medium">
                      {rule.consequentName}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums">{rule.coOccurrenceCount}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">{rule.supportPct}%</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">{rule.confidencePct}%</td>
                    <td className="py-2.5 text-right font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      {rule.lift}x
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
