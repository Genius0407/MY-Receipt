# ResitMY OCR — 马来西亚发票智能识别与管理系统

> **ResitMY**（Resit = 马来语"收据"）是一款面向马来西亚市场的**英文/马来文发票智能识别与费用管理系统**，支持自动 OCR 识别、多 AI 引擎结构化提取、人工校对审核和 Excel 导出。

## 功能亮点

- **多引擎 OCR/AI 管线**：支持 Google Gemini、OpenAI GPT-4o-mini、Qwen VL、Tencent OCR + DeepSeek 修复等多种组合方案
- **马来西亚发票专项优化**：自动识别 SST 税号、公司注册号（SSM）、BUDI MADANI 燃油补贴明细、MYR 货币与 dd/MM/yyyy 日期格式
- **三语界面**：中文 / English / Melayu 完整支持
- **Supabase 后端全托管**：Auth 认证、Storage 存储、Postgres 数据库、Edge Function AI 处理，无需自建服务器
- **智能审核工作台**：三栏式审校面板（原图 + SKU 编辑 + 财务数学引擎），自动校验金额一致性
- **Excel 导出**：支持筛选结果导出 XLSX
- **深色模式** & **主题色**：Indigo / Emerald / Rose 三种品牌色

## 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| **前端框架** | React 19 + TypeScript | UI 组件与状态管理 |
| **构建工具** | Vite 6 | 开发服务器与生产构建 |
| **样式** | Tailwind CSS 4 | 原子化 CSS 工具库 |
| **动画** | motion (Framer Motion) | 界面过渡动画 |
| **图标** | lucide-react | SVG 图标库 |
| **AI/OCR** | Google Gemini API (`@google/genai`) | 原型阶段发票识别 |
| **后端** | Supabase | BaaS — Auth / Storage / Postgres / Edge Functions |
| **Edge Function 运行时** | Deno | 服务端 OCR/AI 处理 |
| **OCR 供应商** | Google Vision AI, Tencent OCR | 图片文字识别 |
| **LLM 供应商** | OpenAI (GPT-4o-mini), Alibaba Qwen VL (qwen3.6-plus), DeepSeek (deepseek-v4-flash) | 结构化字段提取与修复 |
| **表格导出** | SheetJS (xlsx) | Excel 文件生成 |
| **CSS 工具** | clsx + tailwind-merge | 条件样式合并 |

## 系统要求

- Node.js >= 18
- npm >= 9
- Supabase 项目（免费套餐可用）
- 至少一个 AI/OCR 服务的 API Key

## 快速开始

### 1. 克隆与安装

```bash
git clone <repo-url>
cd malaixiya
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

编辑 `.env` 填入必要参数：

```env
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
GEMINI_API_KEY="your-gemini-key"
```

> **安全提醒**：`GEMINI_API_KEY` 仅用于前端原型快速验证。生产环境必须将 AI 调用迁移至 Supabase Edge Function，详见 [部署文档](docs/deployment.md)。

### 3. 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:3000`。

### 4. 生产构建

```bash
npm run build
```

构建产物输出至 `dist/` 目录。

### 5. Supabase 数据库初始化

在 Supabase SQL Editor 中执行 `docs/SUPABASE_SCHEMA.sql` 创建表和 RLS 策略。

## 项目结构

```
MY-Receipt/
├── src/                          # React 前端源码
│   ├── App.tsx                   # 主应用组件（含上传、列表、审校面板）
│   ├── main.tsx                  # 入口
│   ├── index.css                 # Tailwind CSS 入口
│   ├── lib/
│   │   ├── supabase.ts           # Supabase 客户端
│   │   └── export.ts             # Excel 导出工具
│   └── services/
│       └── geminiService.ts      # Gemini AI 原型服务
├── supabase/functions/
│   ├── README.md                 # Edge Function 开发说明
│   └── parse-receipt/            # OCR/AI 处理函数（在 supabase-receipt-platform 分支）
│       ├── index.ts              # 主处理逻辑
│       ├── prompt.ts             # AI Prompt 模板
│       └── cors.ts               # CORS 配置
├── docs/
│   ├── architecture.md           # 架构文档
│   ├── api.md                    # API 文档
│   ├── deployment.md             # 部署与密钥管理
│   ├── development.md            # 开发者指南
│   └── SUPABASE_SCHEMA.sql       # 数据库 Schema
├── 发票示例/                     # 测试用发票图片
├── index.html                    # HTML 入口
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 马来西亚发票合规说明

本系统针对马来西亚发票做了以下本地化适配：

| 特性 | 说明 |
|------|------|
| **SST 税号** | 格式如 `B16-1903-32100036`，支持 SST-02 注册号提取与存储 |
| **公司注册号 (SSM)** | 格式如 `1280055-D`，`519537-X` 等 |
| **货币** | 默认 MYR (RM)，支持切换 SGD / USD / CNY |
| **日期格式** | 默认 dd/MM/yyyy，统一输出为 ISO YYYY-MM-DD |
| **三语识别** | 英文 (EN)、马来文 (MS)、中文 (ZH) 混合发票 |
| **燃油补贴** | 支持 Shell BUDI MADANI RON95 补贴发票，含 `subsidy_details` 结构 |
| **支付方式** | 识别 Touch 'n Go、MyKasih、信用卡、现金等本地支付方式 |
| **服务费** | 马来西亚餐饮业常见的 10% service charge 单独提取 |

## FAQ

### Q: 为什么前端中出现了 `GEMINI_API_KEY`？
A: 当前原型阶段为快速验证使用了前端直调 Gemini。**生产部署前必须移除**，迁移至 Supabase Edge Function。参见 [AUDIT_REPORT.md](AUDIT_REPORT.md) 中 S-02 问题。

### Q: 如何更换 OCR 供应商？
A: 修改 `.env` 中的 `OCR_PROVIDER` 变量：
- 留空或不设置 → 使用规则解析（无 AI 调用）
- `tencent` → Tencent OCR + 可选 DeepSeek 文本修复
- 设置 `USE_OPENAI_VISION=true` → OpenAI Vision
- 设置 `VISION_PROVIDER=qwen` → Qwen VL

### Q: 发票图片支持哪些格式？
A: JPEG、PNG、PDF（通过 Supabase Storage 上传）。

### Q: 识别准确率如何？
A: 视图片质量而定。Qwen VL + DeepSeek polish 组合在清晰图片上可达 95%+ 准确率。低质量图片建议使用 Tencent OCR（较高精度）后接 DeepSeek 修复。

## 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交改动 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 开发约定

- commit 使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式（`feat:`、`fix:`、`docs:`、`chore:`）
- TypeScript 类型严格（已启用 `tsc --noEmit`）
- 新增 AI 提示词（prompt）请更新 `supabase/functions/parse-receipt/prompt.ts`
- 新增发票字段需同步更新 schema、normalize 逻辑和导出模板

## 许可证

MIT
