# Stockifyy CRM — Setup Guide

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to finish provisioning

## 2. Run the Database Schema

1. In your Supabase dashboard → **SQL Editor**
2. Open the file `supabase/schema.sql` from this project
3. Paste the entire contents and click **Run**

This creates:
- `profiles` table (linked to auth users, stores name + role)
- `customers` table (subscriptions, payment info)
- `comments` table (Finance/Admin notes on customers)
- `payment-screenshots` storage bucket
- Row Level Security policies for all tables
- Trigger to auto-create a profile on user signup

## 3. Configure Environment Variables

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Fill in your Supabase project values (found in **Settings → API**):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## 4. Create Your First User (Admin)

1. In Supabase dashboard → **Authentication → Users → Add user**
2. Enter an email and password
3. After creating, note the user's **UUID**
4. In **SQL Editor**, run:
   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE id = 'PASTE-UUID-HERE';
   ```
   (New users default to `support` role — this promotes them to `admin`)

## 5. Create Additional Team Members

Repeat step 4 for each team member. Set roles accordingly:

| Role | Access |
|------|--------|
| `admin` | Full access — view, add, edit, delete, comments |
| `finance` | View, edit, add comments — no delete |
| `support` | Add, view, edit — no delete, no comments |

## 6. Run the App

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to login.

## 7. Storage (Payment Screenshots)

The `payment-screenshots` bucket is created by the schema and set to **private** (signed URLs only). Screenshots are uploaded and stored securely — only authenticated users can view them.

---

## File Structure

```
src/
├── app/
│   ├── login/           # Login page
│   ├── dashboard/
│   │   ├── page.tsx         # Dashboard with metrics + charts
│   │   ├── customers/       # Customer management
│   │   ├── payments/        # Payment ledger
│   │   └── team/            # Team management (admin only)
│   └── auth/callback/   # Supabase auth callback
├── components/
│   ├── Sidebar.tsx
│   ├── TopBar.tsx
│   ├── CustomerModal.tsx    # Add/edit form
│   ├── CustomerDetail.tsx   # View + comments
│   ├── ConfirmDialog.tsx
│   └── Toast.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts   # Browser client
│   │   └── server.ts   # Server client (RSC/middleware)
│   ├── types.ts
│   └── utils.ts
└── middleware.ts        # Auth guard — redirects unauthenticated users
```
