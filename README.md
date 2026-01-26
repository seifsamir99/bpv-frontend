# BPV Manager Frontend

A colorful, Lovable-style frontend for managing Bank Payment Vouchers (BPV) that syncs with Google Sheets.

## Features

- Create, view, edit, and delete BPV vouchers
- Table and Card views (toggle between them)
- Slide-out panel for editing
- Auto-save with visual indicator
- PDF export and print functionality
- PDC/CDC type indicator with color coding
- Responsive design

## Setup

### 1. Install Dependencies

```bash
cd bpv-frontend
npm install
```

### 2. Configure Environment (Optional)

Copy `.env.example` to `.env` and update if needed:

```bash
cp .env.example .env
```

For local development with the backend proxy, no changes are needed.

### 3. Start the Backend API

In a separate terminal:

```bash
cd execution
python api.py
```

The API will start on `http://localhost:5000`

### 4. Start the Frontend

```bash
npm run dev
```

The frontend will start on `http://localhost:3000`

## Deployment to Vercel

### 1. Build the Frontend

```bash
npm run build
```

### 2. Deploy to Vercel

```bash
npx vercel
```

Or connect your GitHub repo to Vercel for automatic deployments.

### 3. Set Environment Variable

In Vercel dashboard, set:
- `VITE_API_URL` = your deployed backend URL (e.g., `https://your-api.railway.app/api`)

## Tech Stack

- React 18 + Vite
- TailwindCSS
- Axios
- React Icons

## Color Scheme (Lovable-style)

- **PDC (Post-Dated Cheque)**: Blue (#3b82f6)
- **CDC (Current-Dated Cheque)**: Orange (#f97316)
- **Success/Save**: Green (#10b981)
- **Delete/Warning**: Pink (#ec4899)
- **Secondary**: Purple (#8b5cf6)
