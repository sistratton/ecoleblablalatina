# École Blabla Latina - Website

Static website for École Blabla Latina, a language school in Pézenas, France.

## Local Development

**Preview the site locally:**

```bash
npm install
npm run build
python3 -m http.server 8080
```

Then open http://localhost:8080 in your browser.

**Add a new blog post:**

1. Create a new `.md` file in `content/blog/` (copy an existing one as a template)
2. Fill in the frontmatter (title, date, slug, excerpt, image, etc.) and write content in French, then add `---EN---` and the English version below
3. Run `npm run build` to generate the HTML
4. Commit and push — the site updates automatically

## Setup: Contact Form

Before the contact form will work, you need a Web3Forms access key:

1. Go to https://web3forms.com
2. Enter `ecole.blabla.latina@gmail.com` and submit
3. Check your email for the access key
4. In `index.html`, find `YOUR_ACCESS_KEY_HERE` and replace it with your key

## Deployment Guide: Cloudflare Pages (Free Tier)

This guide walks you through deploying the site to Cloudflare Pages so it automatically rebuilds every time a pull request is merged into `main`.

### Step 1: Create a Cloudflare Account

1. Go to https://dash.cloudflare.com/sign-up
2. Create a free account with your email address
3. Verify your email

### Step 2: Connect Your GitHub Repository

1. Log in to the Cloudflare dashboard at https://dash.cloudflare.com
2. In the left sidebar, click **Workers & Pages**
3. Click **Create** then select the **Pages** tab
4. Click **Connect to Git**
5. Select **GitHub** as your git provider
6. You will be redirected to GitHub to authorise Cloudflare Pages — click **Authorize Cloudflare Pages**
7. Choose whether to give access to **All repositories** or **Only select repositories** (select `ecoleblablalatina` if choosing the latter)
8. Click **Install & Authorize**
9. Back in the Cloudflare dashboard, select the **ecoleblablalatina** repository
10. Click **Begin setup**

### Step 3: Configure Build Settings

On the "Set up builds and deployments" page, enter the following:

| Setting | Value |
|---------|-------|
| **Project name** | `ecoleblablalatina` (or your preferred subdomain) |
| **Production branch** | `main` |
| **Framework preset** | None |
| **Build command** | `node build.js` |
| **Build output directory** | `/` (just a forward slash) |

Under **Environment variables**, add:

| Variable | Value |
|----------|-------|
| `NODE_VERSION` | `18` |

> Cloudflare Pages automatically runs `npm install` before the build command when a `package.json` is present, so you do not need to include it in the build command.

Click **Save and Deploy**.

### Step 4: Wait for First Deployment

Cloudflare will now:
1. Clone your repository
2. Run `npm install` (installs `marked` and `gray-matter`)
3. Run `node build.js` (generates blog HTML pages, injects blog cards into index.html, generates sitemap)
4. Deploy the site

This takes about 1-2 minutes. Once complete, your site will be live at:

```
https://ecoleblablalatina.pages.dev
```

(The exact URL depends on the project name you chose.)

### Step 5: Automatic Deployments

From now on, **every time a pull request is merged into `main`**, Cloudflare Pages will automatically:
- Detect the new push to `main`
- Run the build
- Deploy the updated site

**Preview deployments:** Cloudflare Pages also creates a preview deployment for every pull request, giving you a unique URL to test changes before merging. These appear as status checks on the PR in GitHub.

### Step 6 (Optional): Add a Custom Domain

If you own a domain (e.g. `blablalatina.fr`):

1. In the Cloudflare dashboard, go to **Workers & Pages** > your project
2. Click the **Custom domains** tab
3. Click **Set up a custom domain**
4. Enter your domain name (e.g. `blablalatina.fr`)
5. Cloudflare will guide you through updating your DNS records:
   - If your domain is already on Cloudflare DNS: it will add a CNAME record automatically
   - If your domain is elsewhere: add a CNAME record pointing to `ecoleblablalatina.pages.dev`
6. SSL/HTTPS is enabled automatically — no configuration needed

After setting up a custom domain, update these files to use the new URL:
- `build.js` — change the `SITE_URL` constant at the top
- `index.html` — update the `<link rel="canonical">` and `og:url` meta tags
- `robots.txt` — update the Sitemap URL
- Then run `npm run build` to regenerate all blog pages and the sitemap with the new URL

## Protecting the `main` Branch

To ensure only code owners can merge into `main` (and no one can push directly), set up branch protection rules on GitHub.

### Step 1: Add a CODEOWNERS File

Create a file at `.github/CODEOWNERS` in your repository:

```
# All files require approval from the code owner
* @your-github-username
```

Replace `@your-github-username` with your actual GitHub username. This means every pull request must be approved by you before it can be merged.

### Step 2: Configure Branch Protection Rules

1. Go to your repository on GitHub: `https://github.com/YOUR-USERNAME/ecoleblablalatina`
2. Click **Settings** (you need admin access)
3. In the left sidebar, click **Branches** (under "Code and automation")
4. Under "Branch protection rules", click **Add branch protection rule**
5. In **Branch name pattern**, type: `main`
6. Enable these settings:

| Setting | Enable |
|---------|--------|
| **Require a pull request before merging** | Yes |
| **Require approvals** (set to 1) | Yes |
| **Dismiss stale pull request approvals when new commits are pushed** | Yes |
| **Require review from Code Owners** | Yes |
| **Require status checks to pass before merging** | Yes (select "Cloudflare Pages" once it appears after your first deployment) |
| **Require branches to be up to date before merging** | Yes |
| **Do not allow bypassing the above settings** | Yes (even admins must follow the rules) |

7. Click **Create** (or **Save changes**)

### What This Achieves

- **No direct pushes to `main`**: All changes must go through a pull request
- **Code owner approval required**: Only the person(s) listed in CODEOWNERS can approve PRs
- **Cloudflare preview on every PR**: Each PR gets a preview deployment URL so you can verify changes before merging
- **Auto-deploy on merge**: Once a PR is approved and merged, Cloudflare Pages automatically deploys the updated site

### Workflow After Setup

The day-to-day workflow becomes:

1. Create a new branch: `git checkout -b my-new-change`
2. Make your changes (e.g. add a blog post in `content/blog/`)
3. Commit and push: `git push -u origin my-new-change`
4. Open a pull request on GitHub
5. Cloudflare Pages builds a preview — check the preview URL on the PR
6. Code owner reviews and approves
7. Merge the PR into `main`
8. Cloudflare Pages automatically deploys to production
