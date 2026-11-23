# Smart Retail AI – Intelligent Retail Management System

A full-stack retail management application that combines point-of-sale operations, inventory management, sales analytics, and machine-learning-based business insights in one dashboard.

## Overview

Smart Retail AI is designed to help retail teams monitor store performance, manage products and stock, process sales, and make more informed operational decisions using data-driven insights.

The project includes a React and TypeScript frontend, an Express and TypeScript backend, a local JSON-based data store, and custom TypeScript analytics/ML routines.

## Key Features

### 1. Dashboard
- Retail performance overview and key business indicators
- Sales and revenue summaries
- Branch-level information and operational alerts

### 2. Point of Sale (POS)
- Checkout workflow
- Barcode-based product lookup
- Sales recording and payment-method tracking

### 3. Product & Inventory Management
- Product catalogue with SKU and barcode information
- Stock quantity and minimum-stock-level tracking
- Inventory adjustments and stock movement records
- Supplier and purchase-order information

### 4. Customer Management
- Customer records and contact information
- Customer purchase history data for analytics

### 5. AI / Machine Learning Studio
The application provides data-driven analysis through custom TypeScript algorithms:
- **Sales forecasting:** linear trend modelling with a 7-day seasonal pattern, including forecast confidence ranges and validation metrics (MAE, RMSE, and MAPE).
- **Inventory prediction:** estimates stock movement and days until stockout, then calculates suggested reorder quantities.
- **Customer segmentation:** groups customers using recency, frequency, and monetary (RFM) features.
- **Market basket analysis:** identifies products that are commonly purchased together and reports association measures such as support, confidence, and lift.

### 6. Business Intelligence
- KPI summaries
- Revenue trends
- Category and branch breakdowns
- Payment-method mix
- Product performance rankings

### 7. Authentication & Roles
- Initial administrator account setup
- User registration and login
- Admin and staff roles
- Protected API routes and session tokens
- Profile management and password-reset flow

### 8. Notifications
- Low-stock and inventory-related alerts
- Notification read/unread management

## Technology Stack

| Area | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS 4 |
| Backend | Node.js, Express, TypeScript |
| Data storage | Local JSON file (`data/retail_store.json`) |
| Analytics / ML | Custom TypeScript algorithms |
| Charts & icons | Project chart components, Lucide React |
| Motion | Motion |

## Project Structure

```text
smart-retail-ai/
├── server/
│   ├── mlEngine.ts          # Forecasting, inventory prediction,
│   │                        # customer segmentation and basket analysis
│   ├── mysqlSchema.ts       # MySQL schema definition / architecture reference
│   ├── store.ts             # Seed data and JSON store operations
│   └── types.ts             # Backend TypeScript types
├── src/
│   ├── components/          # Dashboard, POS, inventory, BI, ML and other views
│   ├── lib/
│   │   └── api.ts           # Frontend API helper
│   ├── App.tsx
│   ├── main.tsx
│   └── types.ts
├── server.ts                # Express API and Vite integration
├── index.html
├── package.json
└── README.md
```

## Getting Started

### Prerequisites
- Node.js (a current LTS version is recommended)
- npm

### 1. Clone the repository

```bash
git clone https://github.com/jayalathsammanee-star/smart-retail-ai.git
cd smart-retail-ai
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the application

```bash
npm run dev
```

The Express server starts on:

```text
http://localhost:3000
```

The server also serves the Vite frontend during development.

### 4. Create your administrator account

On the first launch, open the application in your browser and follow the initial administrator setup flow. Once an administrator has been created, the initial admin-claim flow is locked.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the Express server with the Vite development middleware |
| `npm start` | Starts the application server |
| `npm run build` | Builds the frontend for production |
| `npm run preview` | Runs the Vite production preview |
| `npm run lint` | Runs the TypeScript compiler check (`tsc --noEmit`) |

## API Overview

The backend exposes REST API endpoints, including:

| Feature | Example endpoints |
|---|---|
| Health check | `GET /api/health` |
| Authentication | `/api/auth/*` |
| Dashboard | `GET /api/dashboard` |
| Products | `GET /api/products` |
| Inventory | `GET /api/inventory` |
| Sales | `GET /api/sales`, `POST /api/sales` |
| Customers | `GET /api/customers` |
| Machine learning | `/api/ml/forecast`, `/api/ml/inventory`, `/api/ml/segmentation`, `/api/ml/associations` |
| BI analytics | `GET /api/analytics/bi` |
| Notifications | `GET /api/notifications` |
| Purchases | `GET /api/purchases` |

Most operational endpoints require authentication.

## Data Storage & Database Note

The current running application stores its operational data in a local JSON file at:

```text
data/retail_store.json
```

The backend also contains a MySQL schema definition in `server/mysqlSchema.ts`, exposed through an architecture endpoint. This schema is an architectural reference; the current application code uses the JSON store and does not establish a live MySQL connection.

For a production deployment, configure a persistent database, secure secrets, backups, and suitable authentication/session management before using real business data.


## Screenshots


```markdown
![Dashboard](screenshots/image2.jpeg)
![Inventory Management](screenshots/image3.jpeg)
![ML Studio](screenshots/image5.jpeg)
```



## Future Improvements

- Connect the application to a production-ready MySQL database.
- Integrate a hosted machine-learning service or a trained model pipeline where needed.
- Add automated tests and API documentation.
- Add deployment configuration and production security hardening.

👩‍💻 Developer
Sammani Jayalath

BSc (Hons) Computer Science Undergraduate

GitHub: https://github.com/jayalathsammanee-star




