# Family Portal — Complete Guide
### Written for someone new to GitHub and coding

---

## HOW THE WHOLE THING WORKS (read this first)

```
Your Mac                          GitHub (public, but safe)
─────────────────────             ──────────────────────────
src/config.json      ──build──►  dist/index.html  ──►  zerostress.in
src/photos/          (local)      (AES-256 encrypted;    (your website)
src/template.html    (never       unreadable without
build.js             pushed)      the password)
```

- **You edit** `src/config.json` to change names, links, photos.
- **You run** `./build.sh` — it asks for both passwords and produces one encrypted file.
- **You push** that one file to GitHub — it goes live in ~60 seconds.
- **Nobody** — not GitHub, not Google, not Claude — can read the content without your passwords.

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
Documents → claude_personal → family-portal → src → config.json
```

Right-click `config.json` → **Open With → TextEdit**

You will see all the family member names (Rohan Mehta, Priya Mehta, etc.). Replace each placeholder name with your real family member's name.

**Example — changing a name:**
Before:
```
"name": "Rohan Mehta",
```
After:
```
"name": "Dad",
```
or
```
"name": "Rajesh Kumar",
```

**Rules when editing config.json:**
- Keep the quotes `"` around every value
- Keep the commas at the end of lines (except the last item in a group)
- Don't delete the `{`, `}`, `[`, `]` brackets
- Save when done: ⌘S

You can also change the family group names:
```
"familyName": "Primary",   ← change to e.g. "Sharma Family"
```
```
"familyName": "Secondary", ← change to e.g. "Nair Family"
```

### Step 5 — Leave document links as PASTE_LINK_HERE for now

You will fill in the Google Drive links later (Step 9). For now, leave them.
When you open a person's documents page, buttons with no link will show "Not linked yet" and will be greyed out — this is expected.

---

## PART 4 — BUILD THE WEBSITE

### Step 6 — Run the build script

Open **Terminal** and run:

```bash
# Navigate to the family-portal folder
cd ~/Documents/claude_personal/family-portal

# Run the build script
./build.sh
```

The script will:
1. Ask you to type a password for the Primary family (you won't see the letters — this is normal security behaviour)
2. Ask you to confirm that password
3. Ask you to type a password for the Secondary family
4. Ask you to confirm that password
5. Encrypt everything and create `dist/index.html`

**Choose strong passwords** — a meaningful phrase works well (e.g. `SunsetFamily2025!`).
**Write your passwords down** and store them safely — they cannot be recovered.

### Step 7 — Test it locally

1. Open Finder → `Documents/claude_personal/family-portal/dist/`
2. Double-click `index.html`
3. It will open in your browser
4. You should see the beautiful welcome screen with two family buttons
5. Click a family button, enter the password — verify it works
6. Check a person's page — the "Not linked yet" buttons are expected

---

## PART 5 — PUBLISH TO GITHUB

### Step 8 — Push to GitHub (first time)

Open **Terminal**:

```bash
# Go to the project folder
cd ~/Documents/claude_personal/family-portal

# Initialise git (only needed first time)
git init

# Set the main branch name
git branch -M main

# Connect to your GitHub repo
git remote add origin https://github.com/bharath-katta/family-portal.git

# Add the files to commit
git add dist/index.html
git add src/template.html
git add build.js
git add build.sh
git add .gitignore
git add .github/

# Create your first commit
git commit -m "Initial family portal"

# Push to GitHub (it will ask for your GitHub username and password)
git push -u origin main
```

**Note on GitHub password:** GitHub no longer accepts your account password here.
You need a Personal Access Token instead:
1. Go to: https://github.com/settings/tokens/new
2. Give it a name like "family-portal"
3. Tick **"repo"** under scopes
4. Click Generate token
5. Copy the token (looks like `ghp_xxxxxxxxxxxx`)
6. Use this token as the "password" when Terminal asks

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

### How to add Google Drive document links

1. Upload a document to **Google Drive**
2. Right-click it → **Share**
3. Under "General access" → change to **"Anyone with the link"** → **Viewer**
4. Click **Copy link**
5. Open `src/config.json` in TextEdit
6. Find the person and the document you want to link
7. Replace `PASTE_LINK_HERE` with the link you copied

Example:
```
Before: "url": "PASTE_LINK_HERE"
After:  "url": "https://drive.google.com/file/d/1AbCdEfGh/view"
```

8. Save the file (⌘S)
9. Run `./build.sh` again in Terminal
10. Push to GitHub (Step 8, skip the `git init` and `git remote add` lines this time):
    ```bash
    cd ~/Documents/claude_personal/family-portal
    git add dist/index.html
    git commit -m "Add document links"
    git push
    ```

### How to add a person's photo

1. Get a photo of the person (JPG or PNG)
2. Rename it to something simple like `dad.jpg` or `mum.png`
3. Copy it into: `Documents/claude_personal/family-portal/src/photos/`
4. Open `src/config.json`
5. Find the person and change their `"photo"` line:
   ```
   Before: "photo": null,
   After:  "photo": "dad.jpg",
   ```
6. Save, run `./build.sh`, and push (same steps as above)

The build script automatically converts your photo to a format that gets embedded into the encrypted file — so photos are protected behind the password too.

### How to change a family member's name

1. Open `src/config.json`
2. Find `"name": "Rohan Mehta"` (or whichever name you want to change)
3. Replace it with the real name
4. Save, run `./build.sh`, push

### How to change a family group name (e.g. "Primary" → "Sharma Family")

1. Open `src/config.json`
2. Find `"familyName": "Primary"`
3. Change it to `"familyName": "Sharma Family"`
4. Also update the welcome screen label if you want — it's the same value
5. Save, run `./build.sh`, push
6. The welcome screen button will now say "Sharma Family" instead of "Primary Family"

### How to add a new document type (e.g. "Voter ID")

In `src/config.json`, find a person's documents list and add a new entry:
```json
{ "name": "Voter ID", "icon": "🗳️", "url": "PASTE_LINK_HERE" }
```
Copy that line for every family member you want to add it to.

### How to change a password

Run `./build.sh` — it always asks for new passwords. Just enter different ones.
The old password immediately stops working once you push the new build.

---

## PART 8 — THE EVERYDAY UPDATE COMMAND

Once everything is set up, every future update is just 3 commands in Terminal:

```bash
cd ~/Documents/claude_personal/family-portal
./build.sh
git add dist/index.html && git commit -m "Update portal" && git push
```

That's it. Changes go live in ~60 seconds.

---

## SECURITY SUMMARY

| What someone could do              | What they'd see                          |
|------------------------------------|------------------------------------------|
| Visit zerostress.in                | Beautiful welcome page with two buttons  |
| Enter wrong password               | "Incorrect password" — nothing revealed  |
| Try to guess sub-page URLs         | No sub-pages exist — single HTML file    |
| View the GitHub source code        | AES-256 encrypted gibberish              |
| Search Google for the site         | Not indexed — invisible to search engines |
| Try to brute-force the password    | PBKDF2 with 600,000 iterations — very slow |
| Find a Google Drive link           | Impossible without unlocking the portal  |

---

## QUICK REFERENCE — USEFUL COMMANDS

```bash
# Go to your project folder
cd ~/Documents/claude_personal/family-portal

# Build (encrypt) the site
./build.sh

# Push to GitHub (after building)
git add dist/index.html && git commit -m "Update portal" && git push

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
→ You're not in the right folder. Run: `cd ~/Documents/claude_personal/family-portal` first.

**Password prompt doesn't show characters**
→ This is normal — it's intentional so no one sees your password over your shoulder.

**Site not updating after push**
→ Wait 2 minutes, then hard-refresh (⌘ Shift R in Safari/Chrome).

**"Incorrect password" on the live site but it worked locally**
→ Run `./build.sh` again and push again — the previous push may have had an issue.

**HTTPS padlock not showing**
→ Wait up to 24 hours after the DNS change. GitHub provisions HTTPS automatically.
