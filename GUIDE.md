# Family Portal — Complete Guide
### Written for someone new to GitHub and coding

---

## HOW THE WHOLE THING WORKS (read this first)

```
Your Mac                              GitHub (public, but safe)
─────────────────────                 ──────────────────────────
src/config.json         ──build──►   dist/index.html   ──►  zerostress.in
src/photos/             (local)       dist/files/*.bin       (your website)
src/template.html       (never        (all AES-256 encrypted;
build.js, admin.js      pushed)        unreadable without
                                        the right password)
```

The site is organised as **groups** — as many as you like, each with its own
password (e.g. your two families, plus "Kerala Trip 2026"). Each group holds
**sections** (family members, or trip categories like "Flight Tickets"), and
each section holds **items** — an uploaded document, an external link, or a
YouTube video.

- **You use** `./admin.sh` day to day — drag-and-drop files, write titles and
  descriptions, add sections and groups, all from a page in your browser.
  This is the normal way to update the site — see PART 7.
- **Editing `src/config.json` by hand** still works for anything the admin
  tool doesn't cover (Step 4, and the "Advanced" note in PART 7).
- **You run** `./build.sh` (or click Publish in the admin tool, which runs it
  for you) — it asks for each group's password and produces the encrypted
  site.
- **You push** to GitHub — it goes live in ~60 seconds.
- **Nobody** — not GitHub, not Google, not Claude — can read the content
  without your passwords. Every document is encrypted individually, not just
  the list of names — so the password is the *only* way in, not a Drive link
  someone might stumble onto.

---

## PART 1 — SET UP YOUR MAC (do once)

### Step 1 — Install Node.js

1. Open your browser and go to: **https://nodejs.org**
2. Click the big green button that says **"LTS"**
3. Download the `.pkg` file and open it
4. Click through the installer (keep all defaults)
5. When done, open **Terminal** (press ⌘ Space, type "Terminal", press Enter)
6. Type this and press Enter:
   ```
   node --version
   ```
   You should see something like `v22.0.0`. If yes, Node is installed. ✅

---

## PART 2 — SET UP GITHUB (do once)

### Step 2 — Create a GitHub repository

1. Go to **https://github.com/bharath-katta** and sign in
2. Click the **"+"** button in the top-right → **"New repository"**
3. Fill in:
   - **Repository name:** `family-portal`
   - **Public** (must be Public for free GitHub Pages — content is encrypted so this is safe)
   - **Do NOT** tick "Add a README file"
4. Click **"Create repository"**
5. On the next page, copy the URL shown under "…or push an existing local repository" — it looks like:
   ```
   https://github.com/bharath-katta/family-portal.git
   ```

### Step 3 — Connect your Mac to GitHub (one-time setup)

Open **Terminal** and run these commands one by one (press Enter after each):

```bash
# Check if git is installed
git --version
```
If it shows a version number, git is installed. If not, macOS will prompt you to install it — click Install.

```bash
# Tell git your name and email (use your GitHub email)
git config --global user.name "Bharath Katta"
git config --global user.email "bharathmkatta@gmail.com"
```

---

## PART 3 — FILL IN YOUR FAMILY DATA

### Step 4 — Open config.json and fill in the real names

On your Mac, open **Finder**, go to:
```
Documents → family-portal → src → config.json
```

Right-click `config.json` → **Open With → TextEdit**

The file is a list of **groups**, each with **sections**, each with **items**.
A family group looks like this (shortened):

```json
{
  "id": "primary", "label": "Sharma Family", "layout": "people", "theme": "blue",
  "sections": [
    { "id": "primary-member-0", "label": "Dad", "avatar": null, "items": [ ... ] }
  ]
}
```

A trip group looks like this — same shape, `layout` is `"categories"` instead:

```json
{
  "id": "kerala2026", "label": "Kerala Trip 2026", "layout": "categories", "theme": "teal",
  "sections": [
    { "id": "flights", "label": "Flight Tickets", "icon": "flight", "items": [ ... ] }
  ]
}
```

**Rules when editing config.json by hand:**
- Keep the quotes `"` around every value
- Keep the commas at the end of lines (except the last item in a group)
- Don't delete the `{`, `}`, `[`, `]` brackets
- Save when done: ⌘S

In practice, you'll rarely need to hand-edit this file — adding documents,
renaming sections, and adding whole new groups is all done through
`./admin.sh` (PART 7). Hand-editing is mainly for renaming an existing
`label`, or changing a group's `theme` (one of `blue`, `coral`, `teal`).

### Step 5 — Items with nothing added yet

A section can hold items that are just placeholders — `{"kind":"pending", ...}`
— until you add the real file or link. On the site these show as greyed-out
"Not added yet" tiles. This is expected and fine to leave for later.

---

## PART 4 — BUILD THE WEBSITE

### Step 6 — Run the build script

Open **Terminal** and run:

```bash
# Navigate to the family-portal folder
cd ~/Documents/family-portal

# Run the build script
./build.sh
```

The script will, for **each group** in your config:
1. Ask you to type a password for that group (you won't see the letters — this is normal security behaviour)
2. Ask you to confirm that password
3. Encrypt that group and move to the next one

At the end it writes `dist/index.html` plus anything under `dist/files/`.

**Choose strong passwords** — a meaningful phrase works well (e.g. `SunsetFamily2025!`).
**Write your passwords down** and store them safely — they cannot be recovered.
Changing a password later is just running the build again and typing a new
one — you never need the old one.

### Step 7 — Test it locally

Documents are fetched separately from the page now, so double-clicking
`index.html` directly (a `file://` link) will show the welcome screen and
unlock fine, but any file you open will fail to load. Serve it properly instead:

```bash
cd ~/Documents/family-portal/dist
python3 -m http.server 8080
```

Then open **http://localhost:8080** in your browser.

1. You should see one card per group (however many you've configured)
2. Click a group, enter its password — verify it works
3. Open a section and confirm items load — the "Not added yet" tiles are expected for anything you haven't filled in
4. Press Ctrl+C in Terminal when you're done testing

---

## PART 5 — PUBLISH TO GITHUB

### Step 8 — Push to GitHub (first time)

Open **Terminal**:

```bash
# Go to the project folder
cd ~/Documents/family-portal

# Initialise git (only needed first time)
git init

# Set the main branch name
git branch -M main

# Connect to your GitHub repo
git remote add origin https://github.com/bharath-katta/family-portal.git

# Add the files to commit
git add dist/
git add src/template.html src/admin.html
git add build.js admin.js admin.sh migrate-config.js
git add lib/
git add .gitignore
git add .github/

# Create your first commit
git commit -m "Initial family portal"

# Push to GitHub (it will ask for your GitHub username and password)
git push -u origin main
```

**Note on GitHub password:** GitHub no longer accepts your account password here.
You need a Personal Access Token instead:
1. Go to: https://github.com/settings/tokens?type=beta (fine-grained — safer than the classic kind)
2. Click **Generate new token**, name it "family-portal"
3. Under **Repository access** → "Only select repositories" → choose `family-portal`
4. Under **Permissions** → set **Contents** to **Read and write**, and
   **Workflows** to **Read and write** (needed because this project's
   `.github/workflows/deploy.yml` is part of what gets pushed — a token
   without this scope gets rejected specifically on that file)
5. Set an expiry, click **Generate token**, and copy it immediately — it's
   only shown once
6. Use this token as the "password" when Terminal asks (username is your
   GitHub username, e.g. `bharath-katta`)

Once you've entered it successfully, macOS Keychain remembers it (if you ran
`git config --global credential.helper osxkeychain`), so you won't be asked
again until the token expires.

### Step 9 — Enable GitHub Pages

1. Go to: **https://github.com/bharath-katta/family-portal**
2. Click **Settings** (top menu)
3. Click **Pages** (left sidebar)
4. Under **Source** → select **"GitHub Actions"**
5. It will use the workflow file already in your project
6. Wait ~2 minutes
7. Your site is now live at: **https://bharath-katta.github.io/family-portal/**

Test it — open that URL and verify everything works.

---

## PART 6 — CONNECT YOUR DOMAIN (zerostress.in)

### Step 10 — Add your domain in GitHub

1. In your repo → **Settings → Pages**
2. Under **Custom domain** → type: `zerostress.in`
3. Click **Save**
4. GitHub will create a `CNAME` file in your repo automatically

### Step 11 — Update DNS in Wix

1. Log in to Wix → go to **Domains**
2. Find `zerostress.in` → click **Manage**
3. Click **DNS Records** (or "Advanced DNS Settings")
4. **Delete** any existing **A records** pointing to Wix servers
5. **Add** these 4 new **A records**:

   | Type | Host/Name | Value           | TTL  |
   |------|-----------|-----------------|------|
   | A    | @         | 185.199.108.153 | 3600 |
   | A    | @         | 185.199.109.153 | 3600 |
   | A    | @         | 185.199.110.153 | 3600 |
   | A    | @         | 185.199.111.153 | 3600 |

6. Also add this **CNAME record** (for `www.zerostress.in`):

   | Type  | Host/Name | Value                               | TTL  |
   |-------|-----------|-------------------------------------|------|
   | CNAME | www       | bharath-katta.github.io             | 3600 |

7. Save changes
8. Wait 30–60 minutes for DNS to update worldwide

After DNS updates, HTTPS (the padlock icon) will auto-provision within 24 hours via Let's Encrypt.

### Step 12 — Cancel Wix hosting (keep the domain!)

In Wix:
- Cancel your **website/hosting plan** — this stops the monthly charge
- **Do NOT cancel the domain registration** — keep paying the annual domain fee
- Your domain zerostress.in will now point to GitHub instead of Wix

---

## PART 7 — UPDATING CONTENT (do whenever you want to change something)

### The easy way — the admin tool

This is how you'll do almost everything, day to day:

```bash
cd ~/Documents/family-portal
./admin.sh
```

This prints a link and opens it in your browser automatically. Keep the
Terminal window open — it's part of the tool, not just a launcher.

- **Tabs at the top** — one per group (family or trip)
- **"+ Add member/category"** — add a new section within that group
- **Rename / Delete** on a section — exactly what it says
- **"+ Add item to ..."** — expand this under any section to:
  - **Choose File…** or drag a file onto the dashed box — uploads and
    encrypts a document (any format: PDF, image, CSV, whatever)
  - **Add link** — for a booking confirmation or any external URL
  - **Add YouTube** — paste a video URL; it fetches and encrypts the
    thumbnail so it can preview on the site without ever calling Google
  - Fill in **Title** and **Icon** first, and optionally a short
    **description** (shown as two lines under the title on the site)
- Every uploaded file has its own **Replace** button — use this for things
  like a renewed health insurance PDF; the old one is deleted, the new one
  takes its place, same position in the list
- **+ New group** (top-right) — for something entirely new (like a future
  "Kerala Trip 2027"). Choose people-layout or category-layout, and a theme.

None of this needs a password — files get their own random encryption key
automatically. A group's password is only needed for the last step:

### Publish

Click **"🚀 Publish to zerostress.in"** at the bottom of the admin page, then
switch to the Terminal window running `./admin.sh` — that's where each
group's password prompt will appear (same as running `./build.sh` directly).
Type each one, and it builds, commits, and pushes automatically.

### Advanced — editing config.json by hand

A few things aren't exposed in the admin tool yet: renaming a group's
`label`, or changing its `theme`. For these, edit `src/config.json` directly
(see Step 4), then run either `./build.sh` or `./admin.sh` → Publish to apply
the change.

### How to change a password

Click Publish (or run `./build.sh`) — each group's password prompt lets you
type a **new** password right there; you don't need the old one. The old
password stops working the moment the new build is pushed.

---

## PART 8 — THE EVERYDAY UPDATE COMMAND

Adding or replacing documents:

```bash
cd ~/Documents/family-portal
./admin.sh
```
…then use the browser page it opens, and click **Publish** when ready.

If you've only hand-edited `config.json` and want to skip the admin UI:

```bash
cd ~/Documents/family-portal
./build.sh
git add dist && git commit -m "Update portal" && git push
```

Either way, changes go live in ~60 seconds.

---

## SECURITY SUMMARY

| What someone could do              | What they'd see                          |
|------------------------------------|------------------------------------------|
| Visit zerostress.in                | Welcome page with one card per group     |
| Enter wrong password               | "Incorrect password" — nothing revealed, 3 tries then a 30s lockout |
| Try to guess sub-page URLs         | No sub-pages exist — single HTML file    |
| View the GitHub source code        | AES-256 encrypted gibberish — catalog *and* every document individually |
| Download a file from dist/files/   | Unreadable ciphertext — its own random key lives only inside the encrypted catalog |
| Search Google for the site         | Not indexed — invisible to search engines |
| Try to brute-force the password    | PBKDF2 with 600,000 iterations — very slow |
| Sit idle for 5 minutes             | Automatically logged out                 |

---

## QUICK REFERENCE — USEFUL COMMANDS

```bash
# Go to your project folder
cd ~/Documents/family-portal

# Day-to-day: add/replace documents, add sections/groups, then Publish
./admin.sh

# Build (encrypt) the site by hand, e.g. after editing config.json directly
./build.sh

# Push to GitHub (after building by hand — admin.sh's Publish does this for you)
git add dist && git commit -m "Update portal" && git push

# One-time: convert an old-style config.json to the groups[] format
node migrate-config.js

# Check git status
git status

# Check if site deployed (after push, visit):
# https://zerostress.in
```

---

## IF SOMETHING GOES WRONG

**"node: command not found"**
→ Node.js is not installed. Go to nodejs.org and install the LTS version.

**"Permission denied" when running ./build.sh**
→ Run: `chmod +x build.sh` then try again.

**"src/config.json not found"**
→ You're not in the right folder. Run: `cd ~/Documents/family-portal` first.

**Password prompt doesn't show characters**
→ This is normal — it's intentional so no one sees your password over your shoulder.

**Site not updating after push**
→ Wait 2 minutes, then hard-refresh (⌘ Shift R in Safari/Chrome).

**"Incorrect password" on the live site but it worked locally**
→ Run `./build.sh` again and push again — the previous push may have had an issue.

**HTTPS padlock not showing**
→ Wait up to 24 hours after the DNS change. GitHub provisions HTTPS automatically.

**"refusing to allow a Personal Access Token to create or update workflow ... without `workflow` scope"**
→ Your token is missing a permission. Go to github.com/settings/tokens, open
the token, add **Workflows: Read and write**, save, and push again.

**"remote: Invalid username or token. Password authentication is not supported"**
→ Your token expired, was revoked, or was never set. Create a new one
(see Step 8's note) and use it as the password on your next `git push`.

**A file won't open on the live site, but works when I double-click index.html locally**
→ Documents load over the network now, which doesn't work from a
`file://` link. Always test locally with `python3 -m http.server` (Step 7)
— this isn't a sign anything is broken.

**admin.sh says "port already in use" or the browser tab looks stuck**
→ Another copy is probably still running from before. Find the old
Terminal window and press Ctrl+C, or close it, then run `./admin.sh` again.
