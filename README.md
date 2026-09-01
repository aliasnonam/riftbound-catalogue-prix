# Riftbound — Catalogue & Prix

## Android

La version Android est une cible Capacitor distincte de la version web Vinext/Cloudflare. Elle embarque le catalogue et le dernier snapshot de prix présents dans `data/`, puis les conserve dans IndexedDB. Elle ne charge pas le site web distant dans une WebView : `mobile/` est un frontend Vite local copié dans l'APK.

### Ce qui fonctionne hors connexion

- le catalogue des quatre sets, la recherche et les filtres de set ;
- les derniers prix inclus dans l'APK ou déjà synchronisés ;
- la collection locale (cartes possédées/manquantes), persistée dans IndexedDB ;
- les assets déjà présents dans `public/`.

Les visuels de cartes dont l'URL est distante restent dépendants du réseau. L'application affiche toutefois le catalogue et les prix sans eux. Une synchronisation réussie garde le dernier catalogue reçu dans IndexedDB pour les ouvertures suivantes hors connexion.

### Synchroniser les prix

Le bouton **Actualiser les prix** appelle uniquement l'endpoint public en lecture du site (`/api/catalog`). Le rafraîchissement Cardmarket reste effectué côté Cloudflare/D1 : aucune clé ou secret n'est inclus dans l'APK. En cas d'absence de réseau ou d'échec, le cache local est conservé.

### Premier setup développeur

Il faut Node.js 22+, Java/JDK 21 et Android SDK pour générer l'APK sur un poste local. Après `npm ci`, le projet natif est déjà dans `android/`.

### Générer l'APK localement

```bash
npm run android:apk
```

Cette commande construit `mobile/`, synchronise Capacitor et lance Gradle. L'APK debug est alors ici :

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Autres commandes utiles :

```bash
npm run android:build  # construit seulement le frontend Android
npm run android:sync   # copie le frontend dans le projet Capacitor
npm run android:open   # ouvre le projet Android dans Android Studio
```

### Générer et télécharger l'APK depuis GitHub

Le workflow `.github/workflows/android-apk.yml` se lance à chaque push sur `main`, ou manuellement dans GitHub : **Actions** → **Android APK** → **Run workflow**. Une fois l'exécution avec coche verte terminée, ouvre-la puis télécharge l'artifact **Riftbound-Catalogue.apk**. GitHub fournit un ZIP : décompresse-le pour obtenir `app-debug.apk`.

### Installer et mettre à jour

Sur Android, ouvre l'APK téléchargée, autorise si nécessaire l'installation depuis le navigateur ou le gestionnaire de fichiers, puis installe-la. Le même `applicationId` (`com.aliasnonam.riftboundcatalogue`) et un `versionCode` stable permettent d'installer une future version par-dessus l'ancienne sans supprimer IndexedDB. N'efface pas les données de l'application dans les réglages Android.

Une APK **debug** est signée automatiquement avec une clé de développement et convient à une installation privée. Une APK **release** devra être signée avec un keystore privé, conservé hors Git et injecté plus tard avec des GitHub Secrets. Aucun Play Store n'est configuré.

---

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`
- Linux with `flock`, `curl`, and GNU `timeout`

## Sites Lifecycle

The Sites lifecycle CLI runs the locked dependency install before returning this checkout. Edit the source under `app/`, then checkpoint when a coherent milestone is ready to inspect or share. The remote Sites builder runs `npm run build` against the pushed commit. Do not repeat install or build as a normal pre-checkpoint step.

This starter does not use `wrangler.jsonc`.

`install:ci` is intentionally a single, non-retrying `npm ci`. It refuses a concurrent install for the same project, consumes a matching image-seeded npm cache with `--prefer-offline` while retaining registry fallback for a missing cache object, otherwise downloads and verifies the complete vinext tarball recorded in `package-lock.json`, limits npm to one socket, and terminates a stalled install. `build` applies a short timeout. These helpers target Linux and use GNU `timeout`; they are not native macOS scripts.

Scripts that need writable project-scoped home, npm, XDG, and temporary paths use `scripts/sites-env.sh`. The `dev` and `start` scripts honor the caller's runtime environment and keep Wrangler logs inside the checkout. The generated `.sites-runtime/` directory is disposable and ignored by Git.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Diagnostic Commands

- `npm run install:ci`: perform the one bounded lockfile install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run start`: start the built Vinext application
- `npm test`: build and verify the rendered development-preview metadata
- `npm run db:generate`: generate Drizzle migrations after schema changes

Use build commands for targeted diagnosis after a remote failure, not as part of the normal checkpoint path.

The timeout defaults can be overridden for a controlled canary with `SITES_INSTALL_TIMEOUT`, `SITES_INSTALL_KILL_AFTER`, `SITES_BUILD_TIMEOUT`, and `SITES_BUILD_KILL_AFTER`. A timeout fails the command; the helpers never retry an unchanged install or build.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
