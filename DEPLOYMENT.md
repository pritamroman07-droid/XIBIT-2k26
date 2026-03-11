# Deployment Guide

## 1. Push Changes to GitHub
I have already committed the necessary changes (start scripts, vercel config). 
Ensure your code is pushed to your GitHub repository:
```bash
git push origin main
```

## 2. Backend Deployment (Render)

1.  Log in to [Render Dashboard](https://dashboard.render.com/).
2.  Click **New +** -> **Web Service**.
3.  Connect your GitHub repository.
4.  Reflect the following settings:
    *   **Name**: `speakharvest-backend` (or similar)
    *   **Root Directory**: `backend` (Important!)
    *   **Runtime**: Node
    *   **Build Command**: `npm install`
    *   **Start Command**: `npm start`
5.  **Environment Variables** (Scroll down to "Advanced" or "Environment"):
    *   Key: `MONGO_URI`
    *   Value: `your_mongodb_connection_string` (Use a MongoDB Atlas URI, not localhost)
    *   Key: `CLOUDINARY_CLOUD_NAME`
    *   Key: `CLOUDINARY_API_KEY`
    *   Key: `CLOUDINARY_API_SECRET`
    *   Values: Your Cloudinary Dashboard API details (Required for photo uploads)
6.  Click **Create Web Service**.
7.  Copy the provided URL (e.g., `https://speakharvest-backend.onrender.com`). You will need this for the frontend.

## 3. Frontend Deployment (Vercel)

1.  Log in to [Vercel Dashboard](https://vercel.com/dashboard).
2.  Click **Add New...** -> **Project**.
3.  Import your GitHub repository.
4.  **Configure Project**:
    *   **Framework Preset**: Vite (should be auto-detected).
    *   **Root Directory**: Click "Edit" and select `frontend`.
5.  **Environment Variables**:
    *   Key: `GEMINI_API_KEY`
    *   Value: `your_gemini_api_key_here`
    *   *(Optional)* Key: `VITE_API_URL` (If you updated your API client to use an env var instead of hardcoded localhost. If your code currently points to `http://localhost:5000`, you **updating the code** first - see below).
6.  Click **Deploy**.

## Important Code Change Required!

Your frontend `api.ts` (or similar) currently likely points to `http://localhost:5000`. You need to ensure it points to your deployed Render Backend URL in production.

**Action Required**:
Check `frontend/src/api.ts` (or `constants.ts`) and ensure the base URL uses an environment variable, like:
```typescript
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
```
Then in Vercel, add `VITE_API_URL` with your Render Backend URL.
