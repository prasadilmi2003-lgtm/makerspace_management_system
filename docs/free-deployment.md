# Deploy for free: Vercel + Supabase

You will end up with a public website and a real hosted database, both on free plans, in about 30 minutes.

| Part | Free service | What it hosts |
|---|---|---|
| Website (`frontend/`) | **Vercel** (Netlify or Cloudflare Pages work the same way) | The React app |
| Database + login (`backend/`) | **Supabase** free plan | Postgres, Auth, Realtime |

> You create the two accounts and click the buttons yourself. Nothing here needs a credit card.

---

## 0. Before you start

1. Put the latest code on GitHub (the repo already has a remote). From the repo root:
   ```bash
   git add -A && git commit -m "Prepare deployment" && git push
   ```
2. Make sure `npm run build` works locally (`npm run install:all` first if needed).

---

## 1. Create the database (Supabase)

1. Sign up at **supabase.com** and click **New project**.
2. Pick a name (e.g. `ruhuna-makerspace`), a region near your users (e.g. Singapore) and a strong **database password**. Save the password somewhere safe.
3. Wait until the project is ready. Then note two things:
   - **Project reference**: the code in the project URL, e.g. `abcdefghijklmnop` in `https://abcdefghijklmnop.supabase.co`.
   - **Settings > API**: the **Project URL** and the **anon / publishable key**. These two are safe to put in the website.
   - Never share or commit the **service_role / secret** key.

---

## 2. Load the database structure

From the repo root, in a terminal:

```bash
npm run install:all
npm run db:login                          # opens your browser to authorise the CLI
npm run db:link -- --project-ref YOUR_PROJECT_REF   # asks for the database password
npm run db:push                           # applies migrations 000-011 to the hosted database
```

Then open **Supabase Dashboard > SQL Editor**, paste the contents of
`backend/database/production_seed.sql` and click **Run**. This adds the first operational agreement
(without it nobody can finish sign-up).

---

## 3. Configure sign-in (Supabase)

Open **Authentication**:

- **URL Configuration**
  - *Site URL*: your website address (you get it in step 5, so come back and set it, e.g. `https://makerspace-ruhuna.vercel.app`).
  - *Redirect URLs*: add `https://YOUR-SITE.vercel.app/**` (the confirmation email link sends students to `/account`).
- **Providers > Email**: hosted projects require students to **confirm their email** by default, and the website already handles that (it shows "Check your email"). Keep it on for a real launch.
  - The built-in mailer on the free plan is limited (a few emails per hour). For a real student intake, add an SMTP provider under **Authentication > SMTP** (Resend, Brevo and Gmail SMTP all have free tiers).
  - For a quick demo with a few people you may turn **Confirm email** off.

---

## 4. Publish the website (Vercel)

1. Sign up at **vercel.com** with GitHub and click **Add New > Project**, then import this repository.
2. Set **Root Directory** to `frontend`. Vercel detects Vite automatically (build `npm run build`, output `dist`).
3. Under **Environment Variables** add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your anon / publishable key
4. Click **Deploy**. When it finishes you get a `https://....vercel.app` address. Go back to step 3 and put it in the Supabase URL settings.

`frontend/vercel.json` already makes direct links like `/projects` or `/admin` work after a refresh.

<details><summary>Netlify or Cloudflare Pages instead</summary>

Base directory `frontend`, build command `npm run build`, publish directory `dist`, and the same two environment variables.
`frontend/public/_redirects` already contains the single-page-app rule both of them use.
</details>

Whenever you push to GitHub, Vercel redeploys the site automatically.

---

## 5. Create the administrator account

Live databases start with **no accounts** (the demo accounts exist only on your own computer).

### Fastest: one ready-made admin account

1. Open `backend/database/production_accounts.sql`.
2. Change the **password** (and the email, name and ID if you like) in the lines marked `<== EDIT`.
3. Copy the whole file into **Supabase > SQL Editor** and click **Run**. You should see a table with one row: your email, `Superadmin`, `Active`.
4. Log in on your website with that email and password. The account is already confirmed and has already signed the agreement, so no email is needed. You land on the Operations Dashboard, and the sidebar has an **Admin Panel** link.

The script refuses to run until you replace the placeholder password, and running it twice does nothing the second time.
Afterwards, clear the SQL Editor so your password is not left in its history.

### Or: make yourself the admin from a normal sign-up

1. Open your live website, click **Join Makerspace**, register, confirm the email, and sign the agreement.
2. In **SQL Editor** run (put your email in):

```sql
update public.users set role = 'Superadmin', status = 'Active' where email = 'YOUR_EMAIL';
```

3. Log out and in again.

### Everyone else

Keyholders, students and alumni just register on the website. Then promote people in **Admin Panel > User Management** (role dropdown).

---

## 6. Detect overdue keys automatically (optional but recommended)

The Keyholder dashboard already checks for overdue keys whenever it opens. To also run it every 5 minutes,
enable the **pg_cron** extension (**Database > Extensions**) and run once in the SQL Editor:

```sql
select cron.schedule('overdue-check', '*/5 * * * *', $$select public.check_overdue_requests()$$);
```

---

## 7. Check it works

- Open the site in a private window, register a test student, and walk the flow: sign, request a bench, claim as a Keyholder, retrieve and return the key.
- In **Supabase > Table Editor** you should see the rows appear.
- If the live site shows a **"Demo view"** dropdown in the top bar, the two `VITE_` variables were missing when it was built, so it is running on fake data. Add them in Vercel (Settings > Environment Variables) and **redeploy**; the values are read at build time.

## If something goes wrong

- **`function uuid_generate_v4() does not exist` during `npm run db:push`:** fixed. The migrations now use the built-in `gen_random_uuid()`. Pull the latest code and run `npm run db:push` again. A failed push applies nothing, so it is safe to retry.
- **`Unrecognized flag` on `npm run db:link`:** keep the flag name and replace only the placeholder: `npm run db:link -- --project-ref abcdefghijklmnopqrst`.
- **Local `npm run db:start` tries to download Docker images after linking:** linking pins your local Docker images to your cloud project's versions. Delete `backend/supabase/.temp/storage-version`, `rest-version`, `gotrue-version` and `postgres-version` (keep `project-ref`) and start again.

## Good to know (free plans)

- **Supabase pauses a free project after about 7 days without activity.** Open the dashboard and click *Restore* if that happens (data is kept). Any visit that talks to the database counts as activity.
- The free database is 500 MB, which is plenty for this app.
- Free auth emails are rate limited, so use your own SMTP before a big sign-up day.
- Never put the service_role key in Vercel or in `frontend/`. Only the two `VITE_` values above belong there.
- Changing the database later: add a new file in `backend/database/migrations/` (e.g. `012_*.sql`) and run `npm run db:push`. Do not edit old migrations.
- Custom domain: both Vercel and Supabase support one, but it is not free on Supabase. The `.vercel.app` address is fine for a pilot.
