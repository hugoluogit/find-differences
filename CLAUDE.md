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
  - `api/generate.ts` — POST endpoint
  - `lib/generateDiff.ts` — OpenAI 圖片生成
  - `lib/findDifferences.ts` — 像素對比

## Architecture
- 用戶上傳照片 → App 轉 base64 → 後端接收
- 後端呼叫 OpenAI GPT-4o (vision) + DALL-E 3 產生修改版
- 後端用 sharp + pixelmatch 對比兩張圖找出差異座標
- App 顯示雙圖並偵測點擊是否命中差異區域

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
