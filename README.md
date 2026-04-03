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

The app can work in two modes:

- local mode: activities are stored in browser `localStorage`
- Google Sheets mode: activities are read and written through a Google Apps Script web app

To enable Google Sheets:

1. Create a standalone Apps Script project at https://script.new.
2. Copy the code from [google-apps-script/Code.gs](google-apps-script/Code.gs) into the script editor.
3. Verify the target sheet name in `SHEET_NAME`. If your tab is named differently, update that constant.
4. Deploy the script as `Deploy -> New deployment -> Web app`.
5. Set access to `Anyone`.
6. Copy the deployment URL and place it into `.env.local` or `.env.production` as `VITE_SHEETS_API_URL=...`.
7. Run `npm run dev` locally or rebuild the app for GitHub Pages.

