import React, { useEffect, useState } from 'react';
import { Check, Copy, Database, FolderTree, Layers, Workflow } from 'lucide-react';
import { apiRequest } from '../lib/api';

const FOLDER_TREE = `smart-retail-ai/
├── mobile-app/                    # React Native + Expo + TypeScript
│   ├── app.json
│   ├── src/
│   │   ├── navigation/            # AuthStack, MainTabs (Admin/Staff RBAC)
│   │   ├── screens/               # Dashboard, POS/Scanner, Inventory, ML, BI
│   │   ├── services/              # Axios JWT client, FCM push handler
│   │   └── theme/                 # Royal Purple palette + Light/Dark tokens
├── backend-api/                   # Python + FastAPI + SQLAlchemy
│   ├── app/
│   │   ├── core/                  # JWT config, bcrypt hashing, RBAC deps
│   │   ├── models/                # Normalized MySQL ORM tables
│   │   ├── routers/               # auth, products, inventory, sales, ml, bi
│   │   └── ml/                    # forecasting.py, inventory_eoq.py, rfm.py
│   └── requirements.txt
├── database/
│   └── schema.sql                 # Normalized MySQL 8.0 DDL + indexes
├── powerbi/
│   └── smart_retail_analytics.pbix# 6-page executive Power BI report
└── docs/
    └── architecture_phases.md`;

const PHASES = [
  'Phase 1: Requirements & System Architecture',
  'Phase 2: Purple Enterprise UI/UX & Mobile Setup',
  'Phase 3: Normalized MySQL Database Schema',
  'Phase 4: REST API & JWT Auth Backend',
  'Phase 5: Mobile & Responsive Workspace Shell',
  'Phase 6: Authentication & RBAC Integration',
  'Phase 7: Product, Sales & Inventory Control',
  'Phase 8: Camera Barcode Scanning & POS',
  'Phase 9: ML Models (Forecast, EOQ, K-Means, Lift)',
  'Phase 10: Real-Time AI Prediction Endpoints',
  'Phase 11: Power BI 6-View Business Analytics',
  'Phase 12: Automated Alerts & Stockout Triggers',
  'Phase 13: Verification, Security Audit & Optimization',
  'Phase 14: Deployment & Portfolio Documentation',
];

export const SystemBlueprintView: React.FC = () => {
  const [mysqlSql, setMysqlSql] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiRequest<{ mysqlSchemaSql: string }>('/api/architecture/schema')
      .then((res) => setMysqlSql(res.mysqlSchemaSql))
      .catch(() => {});
  }, []);

  const handleCopySql = () => {
    if (!mysqlSql) return;
    navigator.clipboard.writeText(mysqlSql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E113A] dark:text-[#F5F3FF]">
          Phase 1 System Architecture & Database Blueprint
        </h1>
        <p className="text-sm text-[#5B4B7A] dark:text-[#A799C9]">
          End-to-end engineering specification pairing this live interactive system with the React Native, FastAPI, MySQL, and Power BI target architecture
        </p>
      </div>

      {/* System Layers Diagram */}
      <section className="p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-[#6D28D9]" />
          <h2 className="text-base font-semibold">4-Tier Intelligent Retail Architecture</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            {
              tier: '01. Presentation Layer',
              stack: 'React Native (Expo) + TypeScript / Responsive Web',
              details: 'Role-gated POS, Expo Camera EAN-13 scanner, Light/Dark Purple UI, Power BI embed.',
            },
            {
              tier: '02. API & Auth Gateway',
              stack: 'FastAPI / Express REST + JWT + RBAC',
              details: 'scrypt/bcrypt password hashing, Bearer token verification, Pydantic/schema input validation.',
            },
            {
              tier: '03. Data & Relational Store',
              stack: 'MySQL 8.0 Normalized Schema',
              details: '13 normalized tables with FK constraints, stock movement audit trail, and indexed timestamps.',
            },
            {
              tier: '04. AI/ML & BI Engine',
              stack: 'Pandas, Scikit-learn, Power BI',
              details: 'Seasonal forecasting (MAE/RMSE/MAPE), EOQ safety stock, K-Means RFM (Silhouette), Market Basket Lift.',
            },
          ].map((node) => (
            <div
              key={node.tier}
              className="p-4 rounded-xl bg-[#F7F5FF] dark:bg-[#0D0819] border border-[#E9E2FA] dark:border-[#2A1F47]"
            >
              <div className="text-xs font-mono font-semibold text-[#6D28D9] dark:text-[#A78BFA]">
                {node.tier}
              </div>
              <div className="mt-1 text-sm font-semibold">{node.stack}</div>
              <p className="mt-1.5 text-xs text-[#5B4B7A] dark:text-[#A799C9] leading-relaxed">
                {node.details}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Monorepo Folder Structure */}
        <section className="xl:col-span-6 p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
          <div className="flex items-center gap-2 mb-3">
            <FolderTree className="w-4 h-4 text-[#6D28D9]" />
            <h2 className="text-base font-semibold">Recommended Monorepo Structure</h2>
          </div>
          <pre className="p-4 rounded-lg bg-[#1E113A] text-[#EDE9FE] text-xs font-mono overflow-x-auto leading-relaxed">
            {FOLDER_TREE}
          </pre>
        </section>

        {/* System Workflow & 14-Phase Roadmap */}
        <section className="xl:col-span-6 p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47] space-y-4">
          <div className="flex items-center gap-2">
            <Workflow className="w-4 h-4 text-[#6D28D9]" />
            <h2 className="text-base font-semibold">Core Operational Data Flow & 14-Phase Plan</h2>
          </div>
          <p className="text-xs text-[#5B4B7A] dark:text-[#A799C9] leading-relaxed">
            POS Barcode Scan → REST Validation → Atomic Sale + Inventory Deduction → Stock Movement Ledger →
            Threshold & ML Shortage Evaluator → Push/In-App Alert → Power BI & ML Re-training Pipeline.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PHASES.map((phase) => (
              <div
                key={phase}
                className="px-3 py-2 rounded-lg bg-[#F7F5FF] dark:bg-[#0D0819] border border-[#E9E2FA] dark:border-[#2A1F47] text-xs font-medium"
              >
                {phase}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Normalized MySQL DDL Schema */}
      <section className="p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#6D28D9]" />
            <h2 className="text-base font-semibold">Phase 3 Normalized MySQL 8.0 DDL (schema.sql)</h2>
          </div>
          <button
            type="button"
            onClick={handleCopySql}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] hover:bg-[#EFEAFF] dark:hover:bg-[#22173D] flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied SQL' : 'Copy MySQL DDL'}
          </button>
        </div>
        <pre className="p-4 rounded-lg bg-[#1E113A] text-[#EDE9FE] text-xs font-mono overflow-x-auto max-h-96 leading-relaxed">
          {mysqlSql || 'Loading MySQL schema...'}
        </pre>
      </section>
    </div>
  );
};
