# Routemate 🚗🛵 — Peer-to-Peer Ride-Sharing Platform

> **"Share the Ride, Split the Cost"**

Routemate is a modern, mobile-responsive P2P ride-sharing web application designed with a clean startup blue and white theme. It connects daily commuters traveling along shared highway corridors and city routes (e.g., Uppal to Jangaon, Hitec City to Warangal) to split fuel costs fairly, reduce traffic congestion, and save on expensive commercial taxi rates.

---

## 🌟 Key Features

### 1. Top Header & Branding
- **Branding**: Routemate logo with sleek split-route emblem and tagline *"Share the Ride, Split the Cost"*.
- **Live Corridor Status**: Shows real-time corridor indicators (e.g. `Uppal ➔ Jangaon Live`).
- **Commuter Profile & Alerts**: Quick notifications and profile shortcuts.

### 2. Smart Mode Toggle Switch
- Dual-state animated segmented pill:
  - 🔍 **"I need a Ride"** (Customer / Rider Mode)
  - ➕ **"Offer a Ride"** (Driver / Commuter Mode)

### 3. Location & Dynamic Fuel-Share Calculator
- **Inputs**: Pickup and Drop location fields with instantaneous route-swap button.
- **Popular Corridors**: Quick chips for `Uppal ➔ Jangaon (84 km)`, `Uppal ➔ Bhongir (38 km)`, `Hitec City ➔ Warangal`, and `LB Nagar ➔ Suryapet`.
- **Dynamic Fuel-Share Calculation**:
  - Distance-based calculation engine calibrated at current fuel prices (~₹105.5/L).
  - **Bike Math**: ~45 km/l mileage; 1 pillion seat split (~₹110 for 84 km corridor).
  - **Car Math**: ~16 km/l mileage; 3-4 passenger split (~₹185 per seat).
  - Real-time comparison badge showing **65%+ savings** vs commercial cabs.

### 4. Vehicle Selection Cards
- **Bike Option**: Single pillion seat, express commute, helmet provided, lowest fuel split.
- **Car Option**: Multi-seat pooling, air-conditioned comfort, luggage boot space.

### 5. Rider Mode ("Find Rides")
- Matching verified driver listings along the route.
- Driver ratings (e.g. 4.9★), employer / commuter profile, verified KYC checkmark.
- **Direct Payment Preference Badges**:
  - 🟣 **Direct UPI (GPay / PhonePe / Paytm)**
  - 🟢 **Cash on Board**
  - **0% Platform Fee** badge highlighting no middleman cuts.
- **One-Tap Seat Reservation**: Booking modal with fair price breakdown and driver UPI VPA QR pass.

### 6. Driver Mode ("Offer a Ride") — Live Dispatch Console
- **Prominent "Go Online" Master Switch**: Driver availability activation with radar beacon animation and corridor status.
- **Live Fuel-Share Calculation Display**: Recommended contribution per seat (e.g. ₹108/seat for 84 km Uppal ➔ Jangaon corridor @ 50% split).
- **Fuel Contribution Preferences**: Direct UPI, Cash on Board, or Either (Recommended).
- **Incoming Passenger Request Card**: Live request card featuring passenger rating, commuter employer, route, and prominent **"Accept Ride"** button with direct transition to active commute dashboard.
- **100% Free P2P Community Model**:
  - No monthly subscription fees and 0% commission cuts.
  - 100% direct payment to driver via UPI or Cash.

### 7. Clean Bottom Navigation
- **Rides**: Search & discover matching rides.
- **Activity**: Active seat bookings and driver posted routes.
- **Account**: Driver KYC verification, vehicle registration (RC), and direct UPI receiving VPA setup.

---

## 🚀 How to Run Locally

You can open the application in multiple ways:

### Option 1: Direct Browser Launch
Simply double click or open `index.html` in any modern web browser (Google Chrome, Edge, Safari, Firefox):
```bash
file:///C:/Users/shant/.gemini/antigravity/scratch/routemate/index.html
```

### Option 2: Local Python Server
Run the built-in HTTP server:
```bash
cd "C:\Users\shant\.gemini\antigravity\scratch\routemate"
python -m http.server 8080
```
Then visit: `http://localhost:8080`

---

## 🎨 Tech Stack
- **HTML5 & Vanilla JavaScript**: Zero-build, fast loading, light footprint.
- **Tailwind CSS (CDN)**: Modern startup blue palette (`#2563EB`, `#1D4ED8`, `#0284C7`), clean typography (`Plus Jakarta Sans`), and responsive grid.
- **Lucide Icons**: Crisp vector icons.
- **Glassmorphism & Micro-animations**: Modern tactile UI feedback with toast notifications.
