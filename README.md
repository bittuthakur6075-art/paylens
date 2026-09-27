# 💳 PayLens - Payment Screenshot Data Extractor & Dashboard

A modern, responsive React web application built with **Vite, React, Tailwind CSS, Lucide Icons, and Tesseract.js / Gemini Flash Vision**, designed to automatically parse UPI & bank payment screenshots (PhonePe, Google Pay, Paytm, BHIM, CRED, Amazon Pay, Bank slips) and sync structured transaction records directly into **Google Sheets** as a live database backend.

---

## ✨ Features

- **Intuitive Upload & Auto-Extractor**:
  - Drag-and-drop receipt screenshots, browse files, or paste directly with `Ctrl + V`.
  - Built-in instant demo receipts for PhonePe, Google Pay, Paytm, CRED, and BHIM.
  - Dual OCR Engine: In-browser **Tesseract.js** (100% free, local, privacy-friendly) with optional **Google Gemini 2.5 Flash Vision** fallback for 99.9% accuracy.
  - Auto-extracts: Payment App Name, Transaction Type (Sent/Received), Sender (From), Receiver (To), Amount (₹), Date & Time, and 12-digit UPI UTR / Transaction ID.
  - Manual override & edit fields before submission.

- **Real-Time Extracted Data Table**:
  - Live synced ledger with brand badges and color-coded Sent / Received tags.
  - Search bar across sender, receiver, UTR, and app name.
  - App filter dropdown & Sent/Received filter toggles.
  - 1-click copyable UTR numbers with instant visual feedback.
  - Receipt verification modal with zoom & download.
  - Export filtered ledger to CSV with 1 click.

- **Summary Analytics Cards**:
  - Total Transactions count.
  - Total Amount Sent (₹).
  - Total Amount Received (₹).
  - Top Payment App Used.

- **Google Sheets Backend Integration**:
  - Zero-maintenance serverless backend using Google Apps Script Webhook.
  - Automatic sheet creation (`Extracted Data`) and styled header generation.
  - Handles Google Apps Script CORS redirects and network fallbacks smoothly.
  - Built-in connection tester and script viewer in the settings modal.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Add your Google Apps Script Web App URL:
```env
VITE_SHEETS_WEBHOOK_URL="https://script.google.com/macros/s/AKfycb.../exec"
VITE_GEMINI_API_KEY="" # Optional: Free key from Google AI Studio
```
*(Note: You can also configure both directly inside the dashboard UI via the "Connect Google Sheets" button without editing files!)*

### 3. Start Development Server
```bash
npm run dev
```

---

## 📊 Google Sheets Setup (4 Easy Steps)

1. Open your Google Sheet (or create one at [sheets.new](https://sheets.new)).
2. Go to **Extensions** > **Apps Script**.
3. Paste the snippet from [`GOOGLE_APPS_SCRIPT.md`](./GOOGLE_APPS_SCRIPT.md) or click **Connect Google Sheets** in the PayLens navbar.
4. Click **Deploy** > **New deployment** > Select type: **Web app** > Set **Who has access** to **Anyone** > Deploy and copy the Web App URL.

---

## 📁 File Structure

```
├── .env.example
├── GOOGLE_APPS_SCRIPT.md
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── api/
    │   └── sheets.js               # Clean Sheets API integration handler
    ├── components/
    │   ├── BackendSetupModal.jsx   # Google Apps Script guide & config modal
    │   ├── ImageModal.jsx          # Screenshot viewer modal
    │   ├── MetricsCards.jsx        # Summary analytics metric cards
    │   ├── Navbar.jsx              # Header with status & actions
    │   ├── TransactionTable.jsx    # Filterable ledger & CSV exporter
    │   └── UploadForm.jsx          # Dropzone, OCR extractor & manual input form
    ├── services/
    │   ├── ocrService.js           # Tesseract.js & Gemini Vision parser
    │   ├── sampleData.js           # Instant demo receipts & seed data
    │   └── sheetsService.js        # Webhook dispatcher & ping test
    ├── App.jsx                     # Main layout & state coordinator
    ├── index.css                   # Tailwind CSS v4 styling & dark theme
    └── main.jsx                    # React entrypoint
```
