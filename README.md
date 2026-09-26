# Won More - Interactive B2B2C Scratch & Win SaaS (Version 1 MVP)

"Won More" is a zero-server-maintenance B2B2C Scratch & Win SaaS platform engineered for retail shops, cafes, and online stores. It empowers merchants to increase in-store engagement, capture phone numbers and leads, and grow their social media presence (Instagram follows and Google Maps reviews).

---

## 🎨 Tech Stack & Architecture

- **Frontend**: React 18, Vite, TypeScript
- **Styling & Design System**: Tailwind CSS
  - **Sidebar & Navigation Background**: Dark Teal (`#0F4C5C`)
  - **Primary Action Buttons**: Vibrant Coral (`#F26419`)
  - **Background**: Very light slate/gray (`#F8FAFC`)
  - **Cards & Containers**: Crisp white with soft shadows and `rounded-xl`
  - **Trend Indicators**: Emerald pills (`bg-emerald-50 text-emerald-700`)
- **Backend & Database**: Supabase (Postgres)
  - Project ID: `spxbplkjwqnhmefdujbw`
  - Tables: `shops`, `campaigns`, `rewards`, `leads`
  - Server-side RPCs: `play_scratch`, `set_next_prize`, `clear_next_prize`, `replenish_prize_queue`
- **Asset Storage & Hosting**: Cloudflare Pages (`public/_redirects` SPA configured) + Cloudflare R2 / CDN image support
- **Audio & Haptics**: Native Web Audio API synthesis (tactile scratch friction sound & victory fanfare) + `navigator.vibrate(20)` mobile haptic feedback.

---

## 🔑 Key Features & Workflows

### Workflow 1: Super Admin ("God Mode") (`/admin-portal`)
- Access protected via access key (Default: `WM_ADMIN_2026`).
- **Manual Merchant Onboarding**: Input Shop Name, Username/Slug (e.g. `urban-roast`), Email, WhatsApp Number, Plan Tier, and Duration.
- **Auto-Generates Secure 6-Digit PIN** for the merchant.
- **WhatsApp Onboarding Template Generator**: One-click copy formatted message with login link, email, PIN, and live branded campaign URL.
- **Live Subscription Management**: Toggle shop status (`pending`, `active`, `suspended`) and extend subscriptions (+30d, +90d, +1y) upon WhatsApp payment clearance.

### Workflow 2: Merchant Portal (`/merchant-login`, `/merchant/dashboard`)
- Authenticate with Merchant Email + Admin-provided PIN.
- **Top Stats Row**: 4 KPI cards with SVG sparklines and growth indicators (Total Leads, Prizes Claimed, Scratch Cards Played, Winners Announced).
- **Active Campaign Overview**: Live/Paused toggle, visitor/winner counts, and scannable QR code.
- **Printable A5 Counter Standee Generator**: High-resolution table tent layout with shop branding, instructions, and 1-click browser printing (`window.print()`).
- **Prize Pool & Queue Controller**:
  - Live preview of the **Next 10 Upcoming Prizes** (`#1 Next Player`, `#2`, ... `#10`).
  - **"⚡ Pin as Next Prize"**: Manually force the very next customer to win a designated prize (e.g., Grand Prize or VIP gift). Auto-resets after being claimed.
  - **"Reshuffle Queue"**: Re-randomize upcoming sequence while strictly preserving configured probability percentages.
- **Campaign Builder**: Customize title, slug, logo URL, required fields (Name, Phone, Email), and social action links.
- **Reward Configuration**: Add/edit prizes with real-time strict **100% probability enforcement**.
- **Leads & Winners Management**: Filter by status, toggle claimed state, and one-click **Export to CSV**.

### Workflow 3: Customer Experience (`/:shopSlug/:campaignSlug` or `https://:shopSlug.wonmore.com/:campaignSlug`)
- **Step 1 (Data Capture)**: Modern mobile form capturing customer name and WhatsApp number.
- **Step 2 (Social Action Verification)**: Required actions (Instagram follow, Google Maps review) open destination link and trigger a **mandatory 3-second psychological verification timer**. "Submit & Scratch" remains visually disabled until complete.
- **Step 3 (HTML5 Canvas Scratch Foil)**:
  - Textured gold scratch foil.
  - Tactile physical scratch audio via Web Audio API.
  - Mobile haptic buzzing (`navigator.vibrate(20)`).
  - **50% Auto-Reveal Threshold**: Once 50% of the canvas is scratched, triggers smooth fade-out, victory fanfare, and particle confetti explosion.
  - Backend probability resolution via Supabase RPC.
- **Step 4 (Prize Claim)**: Displays won prize and unique redemption code (e.g. `#COFFEE-7821`).
- **WhatsApp `wa.me` Redirection**: "Claim on WhatsApp" button opens WhatsApp pre-filled with:
  `"Hello! I just scratched and won [Reward Name] on Won More! My redemption code is [Redemption Code]. Name: [Customer Name]."`

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Start local development server
npm run dev

# 3. Build for production (Cloudflare Pages)
npm run build
```

---

## 🧪 Demo Credentials

- **Super Admin Portal**: `/admin-portal`
  - Access Code: `WM_ADMIN_2026`
- **Demo Merchant Account**: `/merchant-login` (Has "Fill Demo" shortcut button)
  - Email: `merchant@urbanroast.com`
  - PIN: `123456`
- **Customer Live Play Route**:
  - `http://localhost:5173/urban-roast/grand-opening`
