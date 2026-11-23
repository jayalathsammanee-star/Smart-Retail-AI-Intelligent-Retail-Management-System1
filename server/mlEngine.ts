import type {
  Customer,
  InventoryRecord,
  Product,
  Sale,
  SaleItem,
  Supplier,
} from './types';

export interface ForecastPoint {
  date: string;
  actualRevenue: number | null;
  predictedRevenue: number;
  lowerBound: number;
  upperBound: number;
  isFuture: boolean;
}

export interface SeasonalPattern {
  dayName: string;
  index: number;
  avgRevenue: number;
}

export interface SalesForecastResponse {
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
  seasonalPatterns: SeasonalPattern[];
  series: ForecastPoint[];
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

export interface CustomerClusterPoint {
  customerId: number;
  name: string;
  branch: string;
  recencyDays: number;
  frequency: number;
  monetary: number;
  clusterId: number;
  segmentLabel: string;
}

export interface CustomerSegmentSummary {
  clusterId: number;
  segmentLabel: string;
  customerCount: number;
  avgRecencyDays: number;
  avgFrequency: number;
  avgMonetary: number;
  revenueSharePct: number;
}

export interface CustomerSegmentationResponse {
  silhouetteScore: number;
  clusterCount: number;
  totalCustomersAnalyzed: number;
  segments: CustomerSegmentSummary[];
  customers: CustomerClusterPoint[];
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

function toDayKey(isoDate: string): string {
  return isoDate.slice(0, 10);
}

function addDays(dayKey: string, days: number): string {
  const dt = new Date(`${dayKey}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * OLS Linear Trend + Multiplicative 7-Day Seasonal Decomposition
 * Evaluated via 14-day walk-forward holdout validation (MAE, RMSE, MAPE).
 */
export function runSalesForecast(sales: Sale[], horizonDays: number): SalesForecastResponse {
  const safeHorizon = [7, 30, 90].includes(horizonDays) ? horizonDays : 30;
  const dailyMap = new Map<string, number>();

  for (const sale of sales) {
    const key = toDayKey(sale.createdAt);
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + sale.totalAmount);
  }

  const sortedDays = Array.from(dailyMap.keys()).sort();
  if (sortedDays.length < 7) {
    return {
      horizonDays: safeHorizon,
      projectedTotalRevenue: 0,
      projectedAvgDailyRevenue: 0,
      trendSlopePerDay: 0,
      growthPctOverHorizon: 0,
      metrics: { mae: 0, rmse: 0, mape: 0, validationWindowDays: 0, trainingSampleDays: sortedDays.length },
      seasonalPatterns: [],
      series: [],
    };
  }

  // Fill contiguous daily calendar from first sale day to latest sale day
  const startDay = sortedDays[0];
  const endDay = sortedDays[sortedDays.length - 1];
  const timeline: Array<{ date: string; revenue: number; dow: number }> = [];
  let cursor = startDay;
  while (cursor <= endDay) {
    const dow = new Date(`${cursor}T00:00:00Z`).getUTCDay();
    timeline.push({
      date: cursor,
      revenue: Number((dailyMap.get(cursor) ?? 0).toFixed(2)),
      dow,
    });
    cursor = addDays(cursor, 1);
  }

  const n = timeline.length;
  const valWindow = Math.min(14, Math.max(5, Math.floor(n * 0.2)));
  const trainLen = n - valWindow;

  const fitModel = (sample: Array<{ date: string; revenue: number; dow: number }>) => {
    const m = sample.length;
    let sumX = 0;
    let sumY = 0;
    let sumXX = 0;
    let sumXY = 0;
    for (let i = 0; i < m; i++) {
      const y = sample[i].revenue;
      sumX += i;
      sumY += y;
      sumXX += i * i;
      sumXY += i * y;
    }
    const denom = m * sumXX - sumX * sumX;
    const slope = denom !== 0 ? (m * sumXY - sumX * sumY) / denom : 0;
    const intercept = (sumY - slope * sumX) / m;

    // Multiplicative Day-of-Week seasonal indices around the fitted trend
    const dowRatios: number[][] = Array.from({ length: 7 }, () => []);
    for (let i = 0; i < m; i++) {
      const trendVal = Math.max(1, intercept + slope * i);
      dowRatios[sample[i].dow].push(sample[i].revenue / trendVal);
    }

    const rawIndices = dowRatios.map((arr) =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 1
    );
    const avgIdx = rawIndices.reduce((a, b) => a + b, 0) / 7 || 1;
    const seasonalIndices = rawIndices.map((v) => Math.max(0.55, Math.min(1.65, v / avgIdx)));

    // Residual standard error for confidence intervals
    let sqErrSum = 0;
    for (let i = 0; i < m; i++) {
      const pred = Math.max(0, (intercept + slope * i) * seasonalIndices[sample[i].dow]);
      const err = sample[i].revenue - pred;
      sqErrSum += err * err;
    }
    const residualStd = Math.sqrt(sqErrSum / Math.max(1, m - 2));

    return { slope, intercept, seasonalIndices, residualStd };
  };

  // 1) Out-of-sample walk-forward validation on holdout window
  const trainSlice = timeline.slice(0, trainLen);
  const valModel = fitModel(trainSlice);
  let absErrSum = 0;
  let sqErrSum = 0;
  let pctErrSum = 0;
  let pctCount = 0;

  for (let i = trainLen; i < n; i++) {
    const pred = Math.max(0, (valModel.intercept + valModel.slope * i) * valModel.seasonalIndices[timeline[i].dow]);
    const actual = timeline[i].revenue;
    const absErr = Math.abs(actual - pred);
    absErrSum += absErr;
    sqErrSum += (actual - pred) ** 2;
    if (actual > 1) {
      pctErrSum += absErr / actual;
      pctCount++;
    }
  }

  const mae = Number((absErrSum / valWindow).toFixed(2));
  const rmse = Number(Math.sqrt(sqErrSum / valWindow).toFixed(2));
  const mape = Number(((pctCount > 0 ? pctErrSum / pctCount : 0) * 100).toFixed(2));

  // 2) Refit on full historical dataset for future horizon forecasting
  const fullModel = fitModel(timeline);
  const series: ForecastPoint[] = [];

  // Include last 30 historical days in chart for clean visual comparison
  const histStartIdx = Math.max(0, n - 30);
  for (let i = histStartIdx; i < n; i++) {
    const pred = Math.max(0, (fullModel.intercept + fullModel.slope * i) * fullModel.seasonalIndices[timeline[i].dow]);
    series.push({
      date: timeline[i].date,
      actualRevenue: timeline[i].revenue,
      predictedRevenue: Number(pred.toFixed(2)),
      lowerBound: Number(Math.max(0, pred - 1.28 * fullModel.residualStd).toFixed(2)),
      upperBound: Number((pred + 1.28 * fullModel.residualStd).toFixed(2)),
      isFuture: false,
    });
  }

  let projectedTotalRevenue = 0;
  for (let h = 1; h <= safeHorizon; h++) {
    const idx = n - 1 + h;
    const date = addDays(endDay, h);
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    const pred = Math.max(0, (fullModel.intercept + fullModel.slope * idx) * fullModel.seasonalIndices[dow]);
    // Uncertainty widens gently with sqrt(horizon)
    const band = 1.64 * fullModel.residualStd * (1 + Math.sqrt(h) * 0.08);
    projectedTotalRevenue += pred;
    series.push({
      date,
      actualRevenue: null,
      predictedRevenue: Number(pred.toFixed(2)),
      lowerBound: Number(Math.max(0, pred - band).toFixed(2)),
      upperBound: Number((pred + band).toFixed(2)),
      isFuture: true,
    });
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dowTotals = Array(7).fill(0);
  const dowCounts = Array(7).fill(0);
  for (const pt of timeline) {
    dowTotals[pt.dow] += pt.revenue;
    dowCounts[pt.dow]++;
  }

  const seasonalPatterns: SeasonalPattern[] = dayNames.map((dayName, idx) => ({
    dayName,
    index: Number(fullModel.seasonalIndices[idx].toFixed(2)),
    avgRevenue: Number((dowCounts[idx] > 0 ? dowTotals[idx] / dowCounts[idx] : 0).toFixed(2)),
  }));

  const recentWindow = timeline.slice(-Math.min(safeHorizon, timeline.length));
  const recentAvg = recentWindow.reduce((s, d) => s + d.revenue, 0) / Math.max(1, recentWindow.length);
  const projectedAvg = projectedTotalRevenue / safeHorizon;
  const growthPct = recentAvg > 0 ? ((projectedAvg - recentAvg) / recentAvg) * 100 : 0;

  return {
    horizonDays: safeHorizon,
    projectedTotalRevenue: Number(projectedTotalRevenue.toFixed(2)),
    projectedAvgDailyRevenue: Number(projectedAvg.toFixed(2)),
    trendSlopePerDay: Number(fullModel.slope.toFixed(2)),
    growthPctOverHorizon: Number(growthPct.toFixed(1)),
    metrics: {
      mae,
      rmse,
      mape,
      validationWindowDays: valWindow,
      trainingSampleDays: trainLen,
    },
    seasonalPatterns,
    series,
  };
}

/**
 * Inventory Demand Velocity, Days-to-Stockout, Safety Stock, and EOQ Reorder Model
 */
export function runInventoryPredictions(
  products: Product[],
  inventory: InventoryRecord[],
  suppliers: Supplier[],
  sales: Sale[],
  saleItems: SaleItem[]
): InventoryPredictionItem[] {
  const nowMs = Date.now();
  const windowDays = 30;
  const cutoffMs = nowMs - windowDays * 24 * 60 * 60 * 1000;

  const saleDayMap = new Map<number, string>();
  const recentSaleIds = new Set<number>();
  for (const s of sales) {
    if (new Date(s.createdAt).getTime() >= cutoffMs) {
      recentSaleIds.add(s.id);
      saleDayMap.set(s.id, toDayKey(s.createdAt));
    }
  }

  // Daily demand per product over 30-day window
  const productDailySales = new Map<number, Map<string, number>>();
  for (const item of saleItems) {
    if (!recentSaleIds.has(item.saleId)) continue;
    const dayKey = saleDayMap.get(item.saleId);
    if (!dayKey) continue;
    if (!productDailySales.has(item.productId)) {
      productDailySales.set(item.productId, new Map());
    }
    const dayMap = productDailySales.get(item.productId)!;
    dayMap.set(dayKey, (dayMap.get(dayKey) ?? 0) + item.quantity);
  }

  const invByProduct = new Map(inventory.map((inv) => [inv.productId, inv]));
  const supById = new Map(suppliers.map((sup) => [sup.id, sup]));

  const predictions: InventoryPredictionItem[] = products.map((product) => {
    const inv = invByProduct.get(product.id);
    const sup = supById.get(product.supplierId);
    const currentStock = inv?.stockQuantity ?? 0;
    const minStockLevel = inv?.minStockLevel ?? 10;
    const leadTimeDays = sup?.leadTimeDays ?? 5;

    const dayMap = productDailySales.get(product.id) ?? new Map<string, number>();
    let totalQty = 0;
    const dailyCounts: number[] = [];
    for (let d = 0; d < windowDays; d++) {
      const dt = new Date(nowMs - d * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const q = dayMap.get(dt) ?? 0;
      totalQty += q;
      dailyCounts.push(q);
    }

    const dailyVelocity = totalQty / windowDays;
    const variance =
      dailyCounts.reduce((acc, q) => acc + (q - dailyVelocity) ** 2, 0) / windowDays;
    const demandStdDev = Math.sqrt(variance);

    const daysUntilStockout =
      dailyVelocity > 0.02 ? Number((currentStock / dailyVelocity).toFixed(1)) : null;

    let predictedOutOfStockDate: string | null = null;
    if (daysUntilStockout !== null) {
      const outDt = new Date(nowMs + Math.ceil(daysUntilStockout) * 24 * 60 * 60 * 1000);
      predictedOutOfStockDate = outDt.toISOString().slice(0, 10);
    }

    // Safety stock for 95% service level (z = 1.65)
    const safetyStock = Math.max(
      minStockLevel,
      Math.ceil(1.65 * demandStdDev * Math.sqrt(leadTimeDays))
    );

    // EOQ-inspired 21-day target coverage + safety stock
    const targetStock = Math.ceil(dailyVelocity * (21 + leadTimeDays)) + safetyStock;
    const recommendedReorderQty = Math.max(0, targetStock - currentStock);

    let velocityClass: InventoryPredictionItem['velocityClass'] = 'Steady';
    if (dailyVelocity >= 1.5) velocityClass = 'Fast-Moving';
    else if (dailyVelocity < 0.45) velocityClass = 'Slow-Moving';

    let restockStatus: InventoryPredictionItem['restockStatus'] = 'Healthy';
    if (
      currentStock <= minStockLevel ||
      (daysUntilStockout !== null && daysUntilStockout <= leadTimeDays + 2)
    ) {
      restockStatus = 'Urgent Restock';
    } else if (
      currentStock <= safetyStock + Math.ceil(dailyVelocity * leadTimeDays) ||
      (daysUntilStockout !== null && daysUntilStockout <= leadTimeDays + 9)
    ) {
      restockStatus = 'Reorder Soon';
    }

    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      branch: product.branch,
      currentStock,
      minStockLevel,
      dailyVelocity: Number(dailyVelocity.toFixed(2)),
      demandStdDev: Number(demandStdDev.toFixed(2)),
      daysUntilStockout,
      predictedOutOfStockDate,
      safetyStock,
      recommendedReorderQty,
      velocityClass,
      restockStatus,
      leadTimeDays,
    };
  });

  return predictions.sort((a, b) => {
    const priority = { 'Urgent Restock': 0, 'Reorder Soon': 1, Healthy: 2 };
    if (priority[a.restockStatus] !== priority[b.restockStatus]) {
      return priority[a.restockStatus] - priority[b.restockStatus];
    }
    return (a.daysUntilStockout ?? 999) - (b.daysUntilStockout ?? 999);
  });
}

/**
 * K-Means Customer Segmentation (RFM) + Real Silhouette Score
 */
export function runCustomerSegmentation(
  customers: Customer[],
  sales: Sale[]
): CustomerSegmentationResponse {
  const nowMs = Date.now();
  const rfmRaw = customers
    .map((cust) => {
      const custSales = sales.filter((s) => s.customerId === cust.id);
      if (custSales.length === 0) return null;
      const latestMs = Math.max(...custSales.map((s) => new Date(s.createdAt).getTime()));
      const recencyDays = Math.max(0, Math.round((nowMs - latestMs) / (24 * 60 * 60 * 1000)));
      const frequency = custSales.length;
      const monetary = Number(
        custSales.reduce((sum, s) => sum + s.totalAmount, 0).toFixed(2)
      );
      return {
        customerId: cust.id,
        name: cust.name,
        branch: cust.branch,
        recencyDays,
        frequency,
        monetary,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  if (rfmRaw.length < 4) {
    return {
      silhouetteScore: 0,
      clusterCount: 0,
      totalCustomersAnalyzed: rfmRaw.length,
      segments: [],
      customers: [],
    };
  }

  // Feature vectors: invert recency so higher = better across all 3 dims
  const features = rfmRaw.map((r) => [-r.recencyDays, r.frequency, r.monetary]);
  const dims = 3;
  const means = Array(dims).fill(0);
  const stds = Array(dims).fill(1);

  for (let d = 0; d < dims; d++) {
    const col = features.map((f) => f[d]);
    const mean = col.reduce((a, b) => a + b, 0) / col.length;
    const variance = col.reduce((a, b) => a + (b - mean) ** 2, 0) / col.length;
    means[d] = mean;
    stds[d] = Math.sqrt(variance) || 1;
  }

  const vectors = features.map((f) => f.map((val, d) => (val - means[d]) / stds[d]));
  const k = Math.min(4, vectors.length);

  // Deterministic quantile-seeded centroids sorted by composite RFM score
  const rankedIndices = vectors
    .map((v, idx) => ({ idx, score: v[0] + v[1] + v[2] }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.idx);

  let centroids = Array.from({ length: k }, (_, c) => {
    const pick = rankedIndices[Math.min(rankedIndices.length - 1, Math.floor((c / k) * rankedIndices.length))];
    return [...vectors[pick]];
  });

  const dist = (a: number[], b: number[]) =>
    Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));

  let assignments = new Array(vectors.length).fill(0);
  for (let iter = 0; iter < 25; iter++) {
    let changed = false;
    for (let i = 0; i < vectors.length; i++) {
      let bestC = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const dVal = dist(vectors[i], centroids[c]);
        if (dVal < bestD) {
          bestD = dVal;
          bestC = c;
        }
      }
      if (assignments[i] !== bestC) {
        assignments[i] = bestC;
        changed = true;
      }
    }
    if (!changed) break;

    const sums = Array.from({ length: k }, () => Array(dims).fill(0));
    const counts = Array(k).fill(0);
    for (let i = 0; i < vectors.length; i++) {
      const c = assignments[i];
      counts[c]++;
      for (let d = 0; d < dims; d++) {
        sums[c][d] += vectors[i][d];
      }
    }
    centroids = centroids.map((oldC, c) =>
      counts[c] > 0 ? sums[c].map((s) => s / counts[c]) : oldC
    );
  }

  // Real Silhouette Score calculation
  let silhouetteSum = 0;
  for (let i = 0; i < vectors.length; i++) {
    const ownCluster = assignments[i];
    let intraSum = 0;
    let intraCount = 0;
    const interSums = new Map<number, { sum: number; count: number }>();

    for (let j = 0; j < vectors.length; j++) {
      if (i === j) continue;
      const dVal = dist(vectors[i], vectors[j]);
      const otherCluster = assignments[j];
      if (otherCluster === ownCluster) {
        intraSum += dVal;
        intraCount++;
      } else {
        const cur = interSums.get(otherCluster) ?? { sum: 0, count: 0 };
        cur.sum += dVal;
        cur.count++;
        interSums.set(otherCluster, cur);
      }
    }

    const a = intraCount > 0 ? intraSum / intraCount : 0;
    let b = Infinity;
    for (const entry of interSums.values()) {
      const avg = entry.sum / entry.count;
      if (avg < b) b = avg;
    }
    if (!Number.isFinite(b) || (a === 0 && b === 0)) {
      silhouetteSum += 0;
    } else {
      silhouetteSum += (b - a) / Math.max(a, b);
    }
  }
  const silhouetteScore = Number((silhouetteSum / vectors.length).toFixed(3));

  // Rank clusters by average monetary + frequency to assign meaningful business labels
  const totalRevenue = rfmRaw.reduce((s, r) => s + r.monetary, 0) || 1;
  const rawClusterStats = Array.from({ length: k }, (_, c) => {
    const members = rfmRaw.filter((_, idx) => assignments[idx] === c);
    const count = members.length;
    const avgRecencyDays = count ? members.reduce((s, m) => s + m.recencyDays, 0) / count : 0;
    const avgFrequency = count ? members.reduce((s, m) => s + m.frequency, 0) / count : 0;
    const avgMonetary = count ? members.reduce((s, m) => s + m.monetary, 0) / count : 0;
    const revenueSum = members.reduce((s, m) => s + m.monetary, 0);
    return {
      clusterId: c,
      count,
      avgRecencyDays,
      avgFrequency,
      avgMonetary,
      revenueSum,
      score: avgMonetary * 0.6 + avgFrequency * 35 - avgRecencyDays * 1.5,
    };
  })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.score - a.score);

  const labelPool = ['VIP Champions', 'Loyal Regulars', 'Growth Potential', 'At-Risk / Dormant'];
  const labelByCluster = new Map<number, string>();
  rawClusterStats.forEach((stat, rankIdx) => {
    labelByCluster.set(stat.clusterId, labelPool[rankIdx] ?? `Segment ${rankIdx + 1}`);
  });

  const segments: CustomerSegmentSummary[] = rawClusterStats.map((stat) => ({
    clusterId: stat.clusterId,
    segmentLabel: labelByCluster.get(stat.clusterId) ?? 'Segment',
    customerCount: stat.count,
    avgRecencyDays: Number(stat.avgRecencyDays.toFixed(1)),
    avgFrequency: Number(stat.avgFrequency.toFixed(1)),
    avgMonetary: Number(stat.avgMonetary.toFixed(2)),
    revenueSharePct: Number(((stat.revenueSum / totalRevenue) * 100).toFixed(1)),
  }));

  const labeledCustomers: CustomerClusterPoint[] = rfmRaw.map((cust, idx) => ({
    ...cust,
    clusterId: assignments[idx],
    segmentLabel: labelByCluster.get(assignments[idx]) ?? 'Segment',
  }));

  return {
    silhouetteScore,
    clusterCount: segments.length,
    totalCustomersAnalyzed: rfmRaw.length,
    segments,
    customers: labeledCustomers.sort((a, b) => b.monetary - a.monetary),
  };
}

/**
 * Market Basket Product Association Rules (Support, Confidence, Lift)
 */
export function runMarketBasketAnalysis(
  sales: Sale[],
  saleItems: SaleItem[],
  products: Product[]
): ProductAssociationRule[] {
  const totalTx = sales.length;
  if (totalTx === 0) return [];

  const productNames = new Map(products.map((p) => [p.id, p.name]));
  const itemsBySale = new Map<number, number[]>();
  const itemSupportCount = new Map<number, number>();

  for (const item of saleItems) {
    if (!itemsBySale.has(item.saleId)) {
      itemsBySale.set(item.saleId, []);
    }
    const list = itemsBySale.get(item.saleId)!;
    if (!list.includes(item.productId)) {
      list.push(item.productId);
      itemSupportCount.set(item.productId, (itemSupportCount.get(item.productId) ?? 0) + 1);
    }
  }

  const pairCounts = new Map<string, number>();
  for (const prodIds of itemsBySale.values()) {
    if (prodIds.length < 2) continue;
    const sorted = [...prodIds].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const key1 = `${sorted[i]}->${sorted[j]}`;
        const key2 = `${sorted[j]}->${sorted[i]}`;
        pairCounts.set(key1, (pairCounts.get(key1) ?? 0) + 1);
        pairCounts.set(key2, (pairCounts.get(key2) ?? 0) + 1);
      }
    }
  }

  const rules: ProductAssociationRule[] = [];
  for (const [key, pairCount] of pairCounts.entries()) {
    if (pairCount < 2) continue;
    const [aStr, bStr] = key.split('->');
    const aId = Number(aStr);
    const bId = Number(bStr);
    const countA = itemSupportCount.get(aId) ?? 1;
    const countB = itemSupportCount.get(bId) ?? 1;

    const support = pairCount / totalTx;
    const confidence = pairCount / countA;
    const supportB = countB / totalTx;
    const lift = supportB > 0 ? confidence / supportB : 1;

    if (lift >= 1.05) {
      rules.push({
        antecedentId: aId,
        antecedentName: productNames.get(aId) ?? `SKU #${aId}`,
        consequentId: bId,
        consequentName: productNames.get(bId) ?? `SKU #${bId}`,
        coOccurrenceCount: pairCount,
        supportPct: Number((support * 100).toFixed(1)),
        confidencePct: Number((confidence * 100).toFixed(1)),
        lift: Number(lift.toFixed(2)),
      });
    }
  }

  return rules
    .sort((a, b) => b.lift - a.lift || b.confidencePct - a.confidencePct)
    .slice(0, 12);
}
