# MY-Receipt

马来西亚英文收据智能识别与管理系统。

当前仓库包含两部分：

- 远程仓库已有的 React/Vite 前端原型。
- 新增的 Supabase 架构文档、数据库 schema、Edge Function 开发计划。

## 架构目标

公网部署版本采用：

```text
静态前端 + Supabase Auth/Storage/Postgres + Supabase Edge Function + Google Vision + OpenAI
```

前端仍是纯静态应用，不需要自建服务器。OCR 和 AI 需要保护密钥，因此最终生产路径放在 Supabase Edge Function 中执行。

## 本地运行

前端原型来自 AI Studio，当前可按远程项目方式运行：

```bash
npm install
npm run dev
```

本地环境变量参考 `.env.example`。当前原型可能仍使用 `GEMINI_API_KEY`，后续需要按计划迁移到 Supabase Edge Function 的 `parse-receipt`。

## 目录说明

```text
MY-Receipt/
├── src/                              # 当前 React/Vite 前端原型
├── public/
├── docs/
│   ├── ARCHITECTURE.md               # Supabase 目标架构
│   ├── DEPLOYMENT.md                 # 部署与密钥管理
│   ├── SUPABASE_SCHEMA.sql           # Supabase 表结构与 RLS
│   └── superpowers/plans/            # 详细开发计划
├── supabase/functions/README.md      # Edge Function 开发说明
├── index (2).html                    # Google AI Studio 生成的 UI 参考稿
├── package.json
└── .env.example
```

## 密钥放置

前端只允许出现：

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

以下密钥只能放在 Supabase Edge Function Secrets：

```text
OPENAI_API_KEY
GOOGLE_VISION_KEY
SUPABASE_SERVICE_ROLE_KEY
```

详细部署与密钥说明见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 数据库

Supabase 需要：

- `receipts` 表：收据主记录。
- `receipt_items` 表：商品明细。
- 私有 Storage bucket：`receipts`。
- RLS policy：用户只能访问自己的数据。

SQL 参考：[docs/SUPABASE_SCHEMA.sql](docs/SUPABASE_SCHEMA.sql)。

## 开发计划

详细执行计划见：

[docs/superpowers/plans/2026-05-14-supabase-receipt-platform.md](docs/superpowers/plans/2026-05-14-supabase-receipt-platform.md)

主线：

1. 梳理并保留当前 React/Vite UI 中可复用的页面和组件。
2. 接入 Supabase Auth。
3. 接入 Supabase Storage 上传。
4. 创建 Supabase 表和 RLS。
5. 实现 `parse-receipt` Edge Function。
6. 前端接入 Supabase 列表、详情编辑、标签、筛选。
7. 用 SheetJS 实现按筛选结果导出 Excel。

## 已废弃方向

后续不再采用：

- Cloudflare Worker 作为 OCR/AI 中间层。
- Google Sheets 作为主存储。
- 前端直接保存 OpenAI 或 Google Vision Key。
- 早期 `1.html` mock 页面。
