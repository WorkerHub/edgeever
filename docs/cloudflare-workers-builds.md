# Cloudflare Workers Builds

EdgeEver uses Cloudflare Workers Builds for routine deployments. Connect each EdgeEver Worker to the `main` branch of its repository once; every later push, including a GitHub **Sync fork**, then builds, migrates, and deploys that instance automatically.

The same deployment commands are used for the official instances and every fork. Local `bun run deploy` remains the first-installation and emergency-recovery path.

## Connect an Instance

First create the instance resources and perform its first deployment as described in the [manual deployment guide](manual-deploy.md). Then use the setup command:

```sh
bun run deploy:builds:setup
```

It reads the fork's `origin` remote plus `.env.local`, then idempotently creates or updates the repository connection, production trigger, build commands, build cache, watch paths, and Build Variables/Secrets. On its first successful run it also starts a build of `main`, verifying the complete automated path. Rerun it whenever an instance setting changes; later runs update configuration without starting another build.

### One-time Cloudflare authorization

Cloudflare requires two account-level authorizations that cannot be safely automated by a repository script:

1. Install and authorize the **Cloudflare Workers & Pages** GitHub App for the fork. An Agent can open the Cloudflare dashboard and complete this browser consent; a user only needs to approve the GitHub authorization.
2. Ensure the Worker has a Workers Builds **build token** with permission to deploy Workers and apply D1 migrations. If the setup command reports that it cannot choose a token, open **Worker** -> **Settings** -> **Builds** -> **API token**, create/select the token, then set its UUID as `EDGE_EVER_BUILDS_BUILD_TOKEN_UUID` in `.env.local` and rerun the command.

The setup API call requires a **User API Token**, not an **Account API Token**. Workers Builds Configuration API accepts user-scoped tokens only. Create it at [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) under **My Profile** -> **API Tokens** (not **Manage Account** -> **Account API Tokens**). Do not use a prebuilt template, including `Edit Cloudflare Workers`: none includes Workers Builds Configuration.

![Redacted Cloudflare User API Token permissions](assets/cloudflare-workers-builds-user-token.svg)

1. Select **Create Token**, scroll to the bottom, and select **Create Custom Token**.
2. Name it, for example `edgeever automated deployment`.
3. Add **Account** -> **Workers Builds Configuration** -> **Edit**, then select **Add more**.
4. Add **Account** -> **Workers Scripts** -> **Read**.
5. Under **Account Resources**, leave **Include / All accounts** or restrict it to the account for this instance; set a suitable expiry.
6. Select **Continue to summary** and verify that the summary contains exactly `Workers Builds Configuration: Edit, Workers Scripts: Read`, then select **Create Token**.
7. Cloudflare shows the token value once. Save it locally as `EDGE_EVER_BUILDS_API_TOKEN=<token>` in `.env.local`; never commit, screenshot, or share it.

This token is used only by `bun run deploy:builds:setup` and is never uploaded to the Worker or Cloudflare Builds. You may instead reuse `CLOUDFLARE_API_TOKEN` only if it is a User API Token with the same permissions.

## Monorepo Build Isolation

The Worker trigger already ignores changes limited to `apps/site/*`, `apps/mobile/*`, `apps/extension/*`, `docs/*`, README files, and `.github/*`. Thus a website-only change does not deploy the EdgeEver Worker.

For a Git-integrated Cloudflare Pages project, set `EDGE_EVER_PAGES_PROJECT_NAME` and rerun `bun run deploy:builds:setup`. The command configures Pages Build watch paths to `apps/site/*`, `bun.lock`, and `package.json`, so product-only changes do not rebuild the website. This optional step requires the User API Token to additionally have **Account** -> **Cloudflare Pages** -> **Edit**. Without automation, set the same paths in **Pages project** -> **Settings** -> **Build** -> **Build watch paths**.

Cloudflare cannot set Build watch paths on a **Direct Upload** Pages project. In that case, keep the filter in the deploy workflow instead. This repository's `.github/workflows/deploy-site.yml` already runs only for website/docs/shared-build-input changes, so application-only changes do not deploy the official site.

### Manual fallback

If the command cannot be used, configure the Worker in the Cloudflare dashboard:

1. Go to **Workers & Pages** and open the EdgeEver Worker.
2. Open **Settings** -> **Builds** -> **Connect**.
3. Authorize GitHub, select the instance repository, and choose the `main` production branch.
4. Configure the following commands:

   ```text
   Build command: bun install --frozen-lockfile && bun run build:cloudflare
   Deploy command: bun run deploy:cloudflare-builds
   ```

5. Add the instance values from `.env.local` under **Settings** -> **Builds** -> **Build variables and secrets**. Use a secret for `EDGE_EVER_AUTH_PASSWORD_HASH`.

The Worker selected in the dashboard must be the one named by `EDGE_EVER_WORKER_NAME`. The deployment command creates a temporary Wrangler configuration from these variables, so do not commit a D1 ID, R2 bucket name, route, or password hash.

## Required Build Variables

Copy the applicable `EDGE_EVER_*` values from the initial deployment's `.env.local` file:

```text
EDGE_EVER_WORKER_NAME
EDGE_EVER_WORKERS_DEV
EDGE_EVER_D1_DATABASE_NAME
EDGE_EVER_D1_DATABASE_ID
EDGE_EVER_R2_BUCKET_NAME
EDGE_EVER_R2_PREVIEW_BUCKET_NAME
EDGE_EVER_AUTH_USERNAME
EDGE_EVER_AUTH_PASSWORD_HASH          # Build Secret
EDGE_EVER_SESSION_TTL_DAYS
EDGE_EVER_DEMO_MODE                   # optional
EDGE_EVER_DEMO_RESET_CRON             # optional
EDGE_EVER_CUSTOM_DOMAIN               # optional
EDGE_EVER_ROUTE_PATTERN               # optional
```

For a multi-instance configuration, set `EDGE_EVER_INSTANCE` and the matching scoped variables such as `EDGE_EVER_PROD_D1_DATABASE_ID` instead. The same resolution rules apply in local deployment and Workers Builds.

Workers Builds needs an API token that can deploy Workers, update R2 bindings, and apply D1 migrations. If the automatically created Builds token does not have D1 edit permission, select or create a token with that permission before enabling automated deployments.

## What Runs on Every Push

```text
bun install --frozen-lockfile
-> bun run typecheck
-> bun run build
-> bun run db:migrate:remote
-> wrangler deploy
```

`wrangler d1 migrations apply` records completed SQL migrations in D1. Thus, every instance receives only newly added migration files before the matching Worker version is published.

## Updating a Fork

1. On GitHub, use **Sync fork** to merge upstream changes into the fork's `main` branch.
2. Cloudflare Workers Builds detects the push and runs the sequence above.
3. Inspect the build log in the Worker **Deployments** tab if the build fails.

No GitHub Actions secrets or local redeployment are needed after the initial Workers Builds connection.

## Limits

On the Workers Free plan, Workers Builds includes 3,000 build minutes per month and permits one concurrent build per account. See [Cloudflare Workers Builds limits and pricing](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/) for current limits.
