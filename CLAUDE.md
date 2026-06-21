# Find Differences App

React Native (Expo) 找不同遊戲 App。

## Commands
- `npm start` — 啟動 Expo dev server
- `npm run ios` — 在 iOS Simulator 啟動
- `cd backend && npm run dev` — 啟動後端開發伺服器（需要 local Node.js）

## Project Structure
- `app/` — Expo Router 頁面（_layout.tsx, index.tsx, game.tsx, settings.tsx）
- `components/` — 可複用 UI 元件
- `lib/` — 共用邏輯（i18n, api, types, store）
- `backend/` — Vercel Serverless 後端
  - `api/generate.js` — POST endpoint（兩步法入口）
  - `lib/planChanges.js` — ARK Doubao vision 規劃5處修改+bounding box
  - `lib/generateDiff.js` — Seedream 依描述生成修改圖
  - `lib/findDifferences.js` — 舊版像素對比（保留備用）

## Architecture
- 用戶上傳照片 → App 轉 base64 → 後端接收
- GPT-4o vision 分析原圖，規劃5處修改位置+bounding box
- Seedream (ARK Doubao) 依具體描述生成修改圖
- GPT-4o 的 bounding box 直接作為差異座標（不需檢測）

## Language Support
- 繁體中文 (zh-TW), 簡體中文 (zh), English (en)
- i18n system: lib/i18n/
- Language can be changed in the settings page
- Uses AsyncStorage to persist preference

## Theme
- Primary: #FF6B8A (light pink)
- Background: #FFF / #FFF0F3 (light pink tint)

## Environment Variables
- EXPO_PUBLIC_API_URL — 後端 API 位址（app 端）
- MODELSLAB_API_KEY — ModelsLab API key（後端，https://modelslab.com）
- ARK_API_KEY — 火山引擎方舟 API key（Seedream 生成 + Doubao vision 規劃）
- MINIMUM_APP_VERSION — 最低支援版本，低於此版本的 App 會被強制阻擋（後端，預設 "1.0.0"）

## Force Update
- App 啟動時檢查 `GET /api/app-version` 回傳的 `minimumVersion`
- 若 `app.json` 中的 `version` 低於 `minimumVersion`，顯示全螢幕阻擋畫面
- 要強制更新時：在 Vercel 設定環境變數 `MINIMUM_APP_VERSION` 為新版號
