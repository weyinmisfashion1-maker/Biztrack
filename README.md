# BizTrack

This project is packaged for Vercel deployment with a Node/Express API backend and static frontend assets.

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the local server:
   ```bash
   npm start
   ```
3. Open your browser at `http://localhost:3000`.

## Vercel Deployment

The API endpoint is served from `api/index.js` and static files are served from `public/`.

### PostgreSQL support

For persistent storage in Vercel, set a `DATABASE_URL` environment variable pointing to your PostgreSQL database:

- Example: `postgresql://user:password@host:port/database`
- Vercel environment variables can be set in the Vercel dashboard or using the Vercel CLI.

If `DATABASE_URL` is not set, the app uses local file storage in `data/db.json` for development.

## Notes

- Account details in invoice preview are styled boldly in the current frontend.
- The backend API provides endpoints for `/api/data`, `/api/sales`, `/api/expenses`, `/api/stock`, `/api/profile`, and `/api/login`.
