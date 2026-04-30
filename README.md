# Bazaar Tracker Website

A clean, stock-market style dashboard for the Hypixel Skyblock Bazaar. Built with React, Vite, and Lightweight Charts.

## Features
- Real-time (approx 20s) price tracking
- Interactive historical charts (Line for recent, Candlesticks for hourly)
- Market margin analysis
- Search and direct product links

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```

## Coolify Deployment

This project is Coolify-ready. 

1. Create a new GitHub repository and push this code.
2. In Coolify, create a new **Application** and point it to your repository.
3. Select **Dockerfile** as the build pack.
4. Add an environment variable:
   - `VITE_API_URL`: The full URL to your Bazaar Tracker API (e.g., `https://api.bazaar.yourdomain.com/api`).
5. Coolify will automatically build and host the static site.

## API Compatibility
Requires the [Bazaar Tracker API](https://github.com/your-username/bazaar-tracker) running on the same server or accessible via the configured `VITE_API_URL`.
