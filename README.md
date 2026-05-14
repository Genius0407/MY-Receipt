# 马来西亚英文收据智能识别系统

公网部署版本采用：

```text
静态前端 + Supabase Auth/Storage/Postgres + Supabase Edge Function + Google Vision + OpenAI
```

前端仍是纯静态应用，不需要自建服务器。OCR 和 AI 需要保护密钥，因此放在 Supabase Edge Function 中执行。

## 当前目录

```text
malaixiya/
├── index (2).html                     # Google AI Studio 生成的 React/Tailwind UI 参考稿
├── docs/
│   ├── ARCHITECTURE.md                # 新架构说明
│   ├── DEPLOYMENT.md                  # 部署与密钥管理
│   └── SUPABASE_SCHEMA.sql            # Supabase 表结构与 RLS
├── supabase/
│   └── functions/
│       └── README.md                  # Edge Function 开发说明
├── .env.example                       # 环境变量模板
└── .gitignore
```

旧 V1.0 静态入口和 Cloudflare Worker 代码已删除，避免后续继续沿用过时架构。

## 架构说明

核心流程：

```text
用户上传收据
  -> 前端上传文件到 Supabase Storage
  -> 前端创建 receipts 记录
  -> 前端调用 Supabase Edge Function parse-receipt
  -> Edge Function 调 Google Vision OCR
  -> Edge Function 调 OpenAI 抽取结构化 JSON
  -> Edge Function 写入 Supabase Postgres
  -> 前端展示、校对、标签、筛选、导出 Excel
```

详细说明见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

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

## 后续开发路线

1. 将 `index (2).html` 的 UI 迁移为正式 React + Vite + Tailwind 工程。
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
