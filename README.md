# MY-Receipt

马来西亚英文收据智能识别与管理系统。

当前仓库包含两部分：

- 远程仓库已有的 React/Vite 前端原型。
- 新增的 Supabase 架构文档、数据库 schema、Edge Function 开发计划。

## 架构目标

公网部署版本采用：

```text
静态前端 + Supabase Auth/Storage/Postgres + Supabase Edge Function + 腾讯云 OCR + 手动审核
```

前端仍是纯静态应用，不需要自建服务器。上传图片会先进入裁剪/旋转预处理，原图和识别用裁剪图都会保留在 Supabase Storage。默认可接腾讯云 OCR 免费资源包，并在数据库中硬限制每用户每月最多 900 次 OCR 调用；超额或未配置 OCR 时自动创建待审核草稿。腾讯 OCR 后可选接 DeepSeek V4 做低成本文本修复；审核页还提供 Qwen VL 视觉重解析按钮，只有人工点击时才调用视觉大模型，并可再接 DeepSeek 做结构和金额校验。

## 本地运行

前端原型来自 AI Studio，当前可按远程项目方式运行：

```bash
npm install
npm run dev
```

本地环境变量参考 `.env.example`。上传后的解析入口统一走 Supabase Edge Function 的 `parse-receipt`。

## 验证命令

```bash
npm test
npm run lint
npm run build
```

`npm run build` 输出 `dist/`，可部署到 Vercel、Netlify、Cloudflare Pages、Supabase Hosting 或任意静态站点服务。

## 目录说明

```text
MY-Receipt/
├── src/                              # 当前 React/Vite 前端原型
├── public/
├── docs/
│   ├── ARCHITECTURE.md               # Supabase 目标架构
│   ├── DEPLOYMENT.md                 # 部署与密钥管理
│   ├── SUPABASE_SCHEMA.sql           # Supabase 表结构与 RLS
│   ├── ADD_IMAGE_PREPROCESSING.sql    # 已有线上库的裁剪字段增量 SQL
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

腾讯云 OCR 模式需要放在 Supabase Edge Function Secrets：

```text
OCR_PROVIDER=tencent
TENCENT_SECRET_ID
TENCENT_SECRET_KEY
OCR_FREE_MONTHLY_LIMIT=900
AI_REPAIR_PROVIDER=deepseek
DEEPSEEK_API_KEY
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_MONTHLY_LIMIT=500
DASHSCOPE_API_KEY
VISION_PROVIDER=qwen
QWEN_VL_MODEL=qwen3.6-plus
VISION_MONTHLY_LIMIT=100
```

`DEEPSEEK_API_KEY` 用于腾讯 OCR 文本修复，也可在 `VISION_REPAIR_PROVIDER=deepseek` 时对 Qwen VL 视觉 JSON 做结构和金额校验；默认每用户每月最多 500 次。`DASHSCOPE_API_KEY` 仅用于点击“Qwen 视觉重解析”后的图片调用；默认每用户每月最多 100 次。若后续要启用 OpenAI Vision，可额外配置 `OPENAI_API_KEY` 和 `USE_OPENAI_VISION=true`。`SUPABASE_SERVICE_ROLE_KEY` 由 Supabase Edge Runtime 内置提供。不要在 Vite、`.env.example`、React 源码或任何静态部署环境变量中配置私密 key。

详细部署与密钥说明见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 数据库

Supabase 需要：

- `receipts` 表：收据主记录。
- `receipt_items` 表：商品明细。
- 私有 Storage bucket：`receipts`。
- RLS policy：用户只能访问自己的数据。
- 上传图片路径：`original.ext` 保存原图，`processed.jpg` 保存裁剪后的识别图。

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
7. 用 ExcelJS 实现按筛选结果导出 Excel。

## 已废弃方向

后续不再采用：

- Cloudflare Worker 作为 OCR/AI 中间层。
- Google Sheets 作为主存储。
- 前端直接保存 OpenAI Key。
- 早期 `1.html` mock 页面。
