# 前端

這個前端使用 React、Vite 和 React Router。

## 本機開發

```bash
npm ci
npm run dev
```

本機開發時，API 預設使用 `http://localhost:3001`。正式建置使用
`VITE_API_BASE` 環境變數；目前 `frontend/.env.production` 已指向
`https://narrive-backend.onrender.com`。

## 部署到 Render

在 Render 建立 **Static Site**，使用以下設定：

| 設定 | 值 |
| --- | --- |
| Branch | `main`（或實際要部署的分支） |
| Root Directory | `frontend` |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |

在 Static Site 的 **Environment** 新增：

| Key | Value |
| --- | --- |
| `VITE_API_BASE` | `https://narrive-backend.onrender.com` |

`VITE_API_BASE` 會在建置時寫入前端；更新此值後請重新部署。若後端網址不同，
請改成後端 Render Web Service 的網址，且不要在網址末尾加 `/`。

### React Router 路徑重寫

前端使用 `BrowserRouter`。為了讓重新整理或直接開啟應用程式子路徑時仍載入
前端，在 Static Site 的 **Settings → Redirects/Rewrites** 新增規則：

| Source | Destination | Action |
| --- | --- | --- |
| `/*` | `/index.html` | `Rewrite` |

儲存設定後觸發一次部署。部署完成後可開啟 Render 提供的 `onrender.com` 網址，
並確認頁面能正常載入及連線至後端 API。

## 本機檢查

```bash
npm run build
npm run lint
```
