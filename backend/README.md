# 後端部署到 Render

在 Render 建立 **Web Service**，使用以下設定：

| 設定 | 值 |
| --- | --- |
| Root Directory | `backend` |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Pre-Deploy Command | `npm run render:prepare` |

Render 環境變數至少需要設定：

| Key | 說明 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 連線字串 |
| `JWT_SECRET` | 請自行產生並設定長且隨機的值 |

`npm run render:prepare` 會執行 `prisma migrate deploy`，建立/更新資料庫遷移，
並建立或更新共用訪客帳號。部署後可用 `narrive-guest` /
`narrive-demo-2026` 登入；這是公開共用帳號，訪客的遊戲紀錄和案件報告會共用。

若目前 Render 方案沒有 **Pre-Deploy Command** 欄位，部署後在該 Web Service 的
Shell 執行一次 `npm run render:prepare`。之後新增資料庫 migration 時，也要在部署
前執行同一個指令。
