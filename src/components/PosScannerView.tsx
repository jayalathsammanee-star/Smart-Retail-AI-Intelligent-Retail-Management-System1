import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Minus, Plus, ScanBarcode, ShoppingBag, Trash2 } from 'lucide-react';
import { apiRequest, formatCurrency } from '../lib/api';
import type { CustomerRecord, ProductWithInventory } from '../types';

interface PosScannerViewProps {
  branches: string[];
  onSaleCompleted: () => void;
}

interface CartItem {
  product: ProductWithInventory;
  quantity: number;
}

export const PosScannerView: React.FC<PosScannerViewProps> = ({
  branches,
  onSaleCompleted,
}) => {
  const [products, setProducts] = useState<ProductWithInventory[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [branch, setBranch] = useState<string>(branches[0] || 'Flagship Downtown');
  const [paymentMethod, setPaymentMethod] = useState<'Card' | 'Mobile Pay' | 'Cash'>('Card');
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastInvoice, setLastInvoice] = useState<{ invoiceNumber: string; totalAmount: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Camera Scanner state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraNotice, setCameraNotice] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  const loadPosData = async () => {
    try {
      const [prodRes, custRes] = await Promise.all([
        apiRequest<{ products: ProductWithInventory[] }>('/api/products'),
        apiRequest<{ customers: CustomerRecord[] }>('/api/customers'),
      ]);
      setProducts(prodRes.products);
      setCustomers(custRes.customers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load POS catalog');
    }
  };

  useEffect(() => {
    loadPosData();
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (scanLoopRef.current) {
      window.cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const addProductToCart = (product: ProductWithInventory) => {
    setError(null);
    setLastInvoice(null);
    if (product.stockQuantity <= 0) {
      setError(`${product.name} is currently out of stock.`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stockQuantity) {
          setError(`Max available stock (${product.stockQuantity}) reached for ${product.name}.`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setScanMessage(`Scanned: ${product.name} (${product.barcode})`);
  };

  const handleBarcodeLookup = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const res = await apiRequest<{ product: ProductWithInventory }>(
        `/api/products/barcode/${encodeURIComponent(trimmed)}`
      );
      addProductToCart(res.product);
      setBarcodeInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Barcode not found');
    }
  };

  const startCamera = async () => {
    setCameraNotice(null);
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraNotice('Camera access is unavailable in this browser. Use manual barcode entry below.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);

      const BarcodeDetectorCtor = (window as unknown as {
        BarcodeDetector?: new (opts: { formats: string[] }) => {
          detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
        };
      }).BarcodeDetector;

      if (!BarcodeDetectorCtor) {
        setCameraNotice(
          'Live camera preview active. Native BarcodeDetector API is not enabled in this browser—type or tap a quick-scan SKU below.'
        );
        return;
      }

      const detector = new BarcodeDetectorCtor({
        formats: ['ean_13', 'ean_8', 'upc_a', 'code_128', 'qr_code'],
      });

      let lastCode = '';
      let lastTick = 0;

      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        const now = Date.now();
        if (videoRef.current.readyState >= 2 && now - lastTick > 900) {
          lastTick = now;
          try {
            const detected = await detector.detect(videoRef.current);
            if (detected.length > 0 && detected[0].rawValue !== lastCode) {
              lastCode = detected[0].rawValue;
              await handleBarcodeLookup(lastCode);
            }
          } catch {
            // Ignore frame decode error
          }
        }
        scanLoopRef.current = window.requestAnimationFrame(tick);
      };
      scanLoopRef.current = window.requestAnimationFrame(tick);
    } catch {
      setCameraNotice('Camera permission denied or no camera device detected. Use manual barcode lookup.');
    }
  };

  const updateCartQty = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          if (nextQty > item.product.stockQuantity) {
            setError(`Available stock limit (${item.product.stockQuantity}) reached.`);
            return item;
          }
          return { ...item, quantity: nextQty };
        })
        .filter((x): x is CartItem => x !== null)
    );
  };

  const subtotal = cart.reduce((s, i) => s + i.product.sellingPrice * i.quantity, 0);
  const discountAmount = (subtotal * discountPct) / 100;
  const taxAmount = (subtotal - discountAmount) * 0.08;
  const grandTotal = subtotal - discountAmount + taxAmount;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiRequest<{ sale: { invoiceNumber: string; totalAmount: number } }>('/api/sales', {
        method: 'POST',
        body: JSON.stringify({
          items: cart.map((c) => ({ productId: c.product.id, quantity: c.quantity })),
          customerId: selectedCustomerId ? Number(selectedCustomerId) : null,
          branch,
          discountPct,
          paymentMethod,
        }),
      });
      setLastInvoice(res.sale);
      setCart([]);
      setDiscountPct(0);
      setScanMessage(null);
      await loadPosData();
      onSaleCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E113A] dark:text-[#F5F3FF]">
            POS Terminal & Barcode Scanner
          </h1>
          <p className="text-sm text-[#5B4B7A] dark:text-[#A799C9]">
            Scan EAN-13 barcodes via camera or instant lookup to bill and update stock automatically
          </p>
        </div>
        <button
          type="button"
          onClick={() => (cameraActive ? stopCamera() : startCamera())}
          className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap ${
            cameraActive
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-[#6D28D9] hover:bg-[#5B21B6] text-white'
          }`}
        >
          <Camera className="w-4 h-4" />
          {cameraActive ? 'Stop Camera' : 'Activate Camera Scanner'}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {lastInvoice && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                Sale Completed · {lastInvoice.invoiceNumber}
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Inventory quantities and stock movement ledger updated automatically.
              </p>
            </div>
          </div>
          <span className="font-mono font-bold text-base text-emerald-800 dark:text-emerald-200 tabular-nums">
            {formatCurrency(lastInvoice.totalAmount)}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: Scanner + Quick Catalog */}
        <section className="xl:col-span-7 space-y-5">
          {cameraActive && (
            <div className="p-4 rounded-xl bg-black border border-[#4C1D95] relative overflow-hidden">
              <video ref={videoRef} className="w-full max-h-60 object-cover rounded-lg" muted playsInline />
              <div className="mt-2 text-xs text-[#DDD6FE]">
                Align barcode within frame · Automatic detection enabled
              </div>
            </div>
          )}

          {cameraNotice && (
            <div className="p-3 rounded-lg bg-[#F3EEFF] dark:bg-[#22173D] border border-[#DDD6FE] dark:border-[#3B1F6E] text-xs text-[#4C1D95] dark:text-[#DDD6FE]">
              {cameraNotice}
            </div>
          )}

          <div className="p-5 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleBarcodeLookup(barcodeInput);
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <ScanBarcode className="w-4 h-4 text-[#7C3AED] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Enter barcode or SKU (e.g. 8901234500012)"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs font-semibold whitespace-nowrap"
              >
                Scan / Add
              </button>
            </form>

            {scanMessage && (
              <p className="mt-2 text-xs font-medium text-[#059669] dark:text-[#34D399]">
                {scanMessage}
              </p>
            )}
          </div>

          <div className="p-5 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
            <h2 className="text-sm font-semibold text-[#1E113A] dark:text-[#F5F3FF] mb-3">
              Tap Product to Scan into Cart
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {products.map((prod) => (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => addProductToCart(prod)}
                  disabled={prod.stockQuantity <= 0}
                  className="p-3 rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] hover:border-[#7C3AED] dark:hover:border-[#8B5CF6] text-left transition-colors disabled:opacity-50 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#1E113A] dark:text-[#F5F3FF] truncate">
                      {prod.name}
                    </div>
                    <div className="text-xs font-mono text-[#5B4B7A] dark:text-[#A799C9]">
                      {prod.barcode} · Stock {prod.stockQuantity}
                    </div>
                  </div>
                  <span className="font-mono font-semibold text-sm text-[#6D28D9] dark:text-[#A78BFA] tabular-nums shrink-0">
                    {formatCurrency(prod.sellingPrice)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Right: Active Checkout Basket */}
        <section className="xl:col-span-5 p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#E9E2FA] dark:border-[#2A1F47]">
              <h2 className="text-base font-semibold text-[#1E113A] dark:text-[#F5F3FF] flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[#7C3AED]" />
                Current Transaction
              </h2>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#5B4B7A] dark:text-[#A799C9]">
                Cart is empty. Scan a barcode or select a product from the left catalog.
              </div>
            ) : (
              <div className="divide-y divide-[#EFEAFF] dark:divide-[#2A1F47] my-2">
                {cart.map((item) => (
                  <div key={item.product.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#1E113A] dark:text-[#F5F3FF] truncate">
                        {item.product.name}
                      </p>
                      <p className="text-xs font-mono text-[#5B4B7A] dark:text-[#A799C9] tabular-nums">
                        {formatCurrency(item.product.sellingPrice)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.product.id, -1)}
                        className="p-1.5 rounded-md border border-[#E9E2FA] dark:border-[#2A1F47] hover:bg-[#F3EEFF] dark:hover:bg-[#22173D]"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center font-mono text-sm tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.product.id, 1)}
                        className="p-1.5 rounded-md border border-[#E9E2FA] dark:border-[#2A1F47] hover:bg-[#F3EEFF] dark:hover:bg-[#22173D]"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.product.id, -item.quantity)}
                        className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-[#E9E2FA] dark:border-[#2A1F47] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-1">
                  Customer
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819]"
                >
                  <option value="">Walk-in Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-1">
                  Branch
                </label>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819]"
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
                <label className="block text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as 'Card' | 'Mobile Pay' | 'Cash')}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819]"
                >
                  <option value="Card">Card</option>
                  <option value="Mobile Pay">Mobile Pay</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-1">
                  Discount (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={discountPct}
                  onChange={(e) => setDiscountPct(Math.min(50, Math.max(0, Number(e.target.value) || 0)))}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819]"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-xs pt-2 border-t border-[#EFEAFF] dark:border-[#2A1F47]">
              <div className="flex justify-between text-[#5B4B7A] dark:text-[#A799C9]">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Discount ({discountPct}%)</span>
                  <span className="font-mono tabular-nums">-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#5B4B7A] dark:text-[#A799C9]">
                <span>Sales Tax (8%)</span>
                <span className="font-mono tabular-nums">{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-[#1E113A] dark:text-[#F5F3FF] pt-1">
                <span>Total Due</span>
                <span className="font-mono tabular-nums">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={cart.length === 0 || submitting}
              onClick={handleCheckout}
              className="w-full py-3 px-4 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {submitting ? 'Completing Sale...' : 'Complete Checkout & Update Stock'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
