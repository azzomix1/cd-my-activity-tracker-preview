# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Google Sheets integration

## Access policy foundation

The application now has a shared access policy layer in [src/auth/accessPolicy.js](src/auth/accessPolicy.js).

It currently defines:

- roles: `anonymous`, `employee`, `admin`
- shared actions/capabilities for future auth integration
- shared visibility helpers for `public` and `private` events

Current UI behavior is unchanged, but public/private filtering is no longer hardcoded in scattered components. This is the first step toward staged authorization: next iterations can connect real session state and API-side enforcement to the same policy model.

## Session foundation

The application now also has a frontend session provider in [src/auth/sessionContext.jsx](src/auth/sessionContext.jsx).

It introduces non-blocking session states for future integration:

- `loading`
- `anonymous`
- `authenticated`

At this stage, session state does not change the UI and does not enforce access on the frontend. It only establishes a stable runtime contract so the next backend/database step can plug real auth into the app without rewriting the component tree.

## GitHub Pages preview

The repository now includes a separate preview workflow at [.github/workflows/deploy-pages-preview.yml](.github/workflows/deploy-pages-preview.yml).

This workflow is designed for a true parallel preview site in a separate repository.

Recommended setup:

- production stays in the current repository via [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml)
- preview is published from this repository into a second public repository, for example `your-org/activity-tracker-preview`
- the preview repository serves GitHub Pages from its `gh-pages` branch

Required repository configuration in the current repository:

- repository secret `PREVIEW_PAGES_TOKEN` with a classic PAT or fine-grained token that can push to the preview repository

How to use it:

- create a dedicated preview repository on GitHub
- in the preview repository, enable GitHub Pages from branch `gh-pages` and folder `/ (root)`
- in this repository, set `PREVIEW_PAGES_TOKEN`
- push the testing build to the `pages-preview` branch, or run the workflow manually
- by default the workflow targets `owner/current-repo-name-preview`; on manual run you can override the target repo through the `preview_repository` input
- preview builds set `VITE_RELEASE_CHANNEL=preview` for future environment-specific behavior

Benefits of this approach:

- production and preview have different URLs and do not overwrite each other
- employees can test the preview build safely before anything lands in `main`
- the workflow does not affect the repository's main GitHub Pages configuration

Notes:

- `GITHUB_TOKEN` is not enough for deploying into another repository; use `PREVIEW_PAGES_TOKEN`
- because the app uses relative asset paths in Vite, the preview repository can be either `user.github.io/repo-name` or a custom domain
