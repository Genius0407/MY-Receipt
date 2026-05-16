# 架构文档 — 马来西亚发票智能识别系统

## 1. 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        浏览器 (Browser)                             │
│                                                                     │
│  React 19 + TypeScript  SPA                                         │
│  ┌──────────────────────────────────────────────────────┐           │
│  │  App.tsx (上传/列表/审核/设置)                        │           │
│  │  ├─ UploadDropzone (拖拽上传)                        │           │
│  │  ├─ ReceiptTable (列表筛选)                          │           │
│  │  ├─ ReceiptDetailPanel (三栏审校)                    │           │
│  │  ├─ FinancialEngine (数学校验)                       │           │
│  │  └─ ExportToolbar (Excel导出)                       │           │
│  └──────────────┬───────────────────────────────────────┘           │
│                 │ Supabase JS SDK                                   │
│                 │ (anon key under RLS)                              │
└─────────────────┼───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Supabase (BaaS)                                 │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐  │
│  │   Auth       │  │   Storage    │  │   Postgres                │  │
│  │  (JWT/Session)│  │ (receipts/   │  │  ├─ receipts              │  │
│  │              │  │  bucket)     │  │  ├─ receipt_items          │  │
│  └──────────────┘  └──────────────┘  │  └─ RLS policies           │  │
│                                       └───────────────────────────┘  │
│                                │                                     │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │            Edge Function: parse-receipt (Deno)               │   │
│  │                                                              │   │
│  │  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐   │   │
│  │  │ JWT     │→ │ Download │→ │  OCR     │→ │  LLM        │   │   │
│  │  │ Verify  │  │ Storage  │  │ Pipeline │  │  Parse      │   │   │
│  │  └─────────┘  └──────────┘  └──────────┘  └─────────────┘   │   │
│  │                                       │                      │   │
│  │                                       ▼                      │   │
│  │                              ┌──────────────────┐            │   │
│  │                              │ Normalize & Save │            │   │
│  │                              │ (receipts +      │            │   │
│  │                              │  receipt_items)  │            │   │
│  │                              └──────────────────┘            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                        │                                           │
│                        ▼ AI Providers                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐   │
│  │ Google   │ │ Tencent  │ │ OpenAI   │ │ Qwen VL  │ │DeepSeek│   │
│  │ Vision   │ │ OCR      │ │ GPT-4o   │ │DashScope │ │ V4     │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. 技术选型理由

| 技术 | 选型理由 |
|------|---------|
| **React 19 + TypeScript** | 组件化开发、类型安全、社区生态成熟 |
| **Vite 6** | 极速 HMR、ESM 原生支持、Tree-shaking 高效 |
| **Tailwind CSS 4** | 原子化 CSS 提升开发效率，内置暗色模式支持 |
| **Supabase** | 全托管 BaaS，集成 Auth/Storage/DB/Serverless Function，免运维 |
| **Deno (Edge Function)** | 原生 TypeScript 支持、安全沙箱、无需 Node 依赖 |
| **多 AI 供应商策略** | 避免单一供应商锁定，容错切换，燃油发票专项优化 |

### 为什么选择多 AI 供应商架构？

```
                  ┌──────────────────┐
                  │  parse-receipt   │
                  │  Edge Function   │
                  └────────┬─────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   ┌──────────┐      ┌──────────┐      ┌──────────┐
   │ OCR 模式  │      │ Vision   │      │ Smart    │
   │ (Tencent) │      │ (Qwen VL)│      │ 模式     │
   └─────┬────┘      └────┬─────┘      └────┬─────┘
         │                │                 │
         ▼                ▼                  ▼
   ┌────────────┐   ┌────────────┐   ┌──────────────┐
   │ Rules 提取  │   │ Qwen 直接  │   │ Qwen +       │
   │ + 可选      │   │ 解析图片   │   │ DeepSeek     │
   │ DeepSeek   │   │            │   │ 双重校验     │
   │ 文本修复    │   │            │   │              │
   └────────────┘   └────────────┘   └──────────────┘
```

- **Tencent OCR 模式**：精度高、速度快，适合低质量图片，输出文本后经规则引擎或 DeepSeek 修复
- **Qwen VL 模式**：直接视觉理解，一次调用提取所有字段
- **Smart 模式 (Qwen + DeepSeek)**：Qwen 做首批提取，DeepSeek 校验结构和算术，确保金额一致性

## 3. 模块职责

| 模块 | 文件 | 职责 |
|------|------|------|
| **主应用** | `src/App.tsx` | 路由、状态管理、全局布局、上传/列表/审核/设置 |
| **Gemini 服务** | `src/services/geminiService.ts` | **（原型仅用）** 调用 Google Gemini API 进行发票 OCR |
| **Supabase 客户端** | `src/lib/supabase.ts` | 初始化 Supabase JS SDK |
| **Excel 导出** | `src/lib/export.ts` | 使用 SheetJS 生成 `.xlsx` 文件 |
| **Edge Function 入口** | `supabase/functions/parse-receipt/index.ts` | JWT 校验、图片下载、多管线 AI 处理、结果写入 |
| **AI Prompt 模板** | `supabase/functions/parse-receipt/prompt.ts` | 各 AI 模型的结构化 Prompt，含马来西亚发票专项规则 |
| **CORS 配置** | `supabase/functions/parse-receipt/cors.ts` | HTTP 跨域头配置 |
| **数据库 Schema** | `docs/SUPABASE_SCHEMA.sql` | 表结构、索引、RLS 策略、触发器 |

## 4. 数据流详解

### 4.1 上传 → 识别 → 审校 → 导出

```
[用户上传图片]
      │
      ▼
┌─────────────┐
│ ① 文件上传   │──── to Supabase Storage ──► receipts/{user_id}/{id}/
│ 到客户端列表 │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ ② 创建记录   │──── to Supabase Postgres ──► receipts (status: uploaded)
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│ ③ 调用 Edge      │──── POST /parse-receipt { receipt_id }
│ Function         │
└──────┬───────────┘
       │
       ▼ (在 Edge Function 内)
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│ ④ JWT 校验   │────► ⑤ 下载图片    │────► ⑥ OCR 管线   │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │ ⑦ AI 结构提取  │
                                          └──────┬───────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │ ⑧ 标准化写入  │
                                          │ receipts +    │
                                          │ receipt_items │
                                          └──────┬───────┘
                                                 │
                          ┌───────────────────────┘
                          ▼
┌────────────────┐     ┌──────────────┐
│ ⑨ 前端查询结果  │◄────│ Supabase     │
│ (等待人工审校)   │     │ Postgres     │
└──────┬─────────┘     └──────────────┘
       │
       ▼
┌────────────────┐
│ ⑩ 三栏审校面板  │──── 商户信息 / SKU 编辑 / 财务校验
└──────┬─────────┘
       │
       ▼
┌────────────────┐     ┌──────────────┐
│ ⑪ 确认保存      │────► status: synced
└──────┬─────────┘
       │
       ▼
┌────────────────┐
│ ⑫ Excel 导出   │──── 筛选结果 → .xlsx
└────────────────┘
```

### 4.2 AI 管线选择逻辑

```
parse-receipt Edge Function 根据 env 配置选择管线：

parseMode 参数:
  "ocr" (默认)   → 根据 OCR_PROVIDER 选择
  "vision"       → 使用 VISION_PROVIDER（当前仅支持 qwen）
  "smart"        → Qwen VL + DeepSeek 双重校验
  "repair"       → 使用已有 OCR 文本 + DeepSeek 修复

OCR_PROVIDER:
  "tencent"      → Tencent OCR API → 规则引擎提取 → 可选 DeepSeek 修复
  未设置         → 规则引擎直接解析文件名（手动回退）

USE_OPENAI_VISION=true → OpenAI GPT-4o-mini 直接解析图片
```

## 5. 数据模型

### receipts 表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `user_id` | UUID | 用户 ID（关联 auth.users） |
| `status` | text | uploaded / processing / pending_review / synced / failed |
| `merchant_name` | text | 商户名称 |
| `company_reg_no` | text | 公司注册号（SSM） |
| `invoice_no` | text | 发票号码 |
| `category` | text | Grocery / Fuel / F&B / Retail / Service / Other |
| `doc_type` | text | Receipt / Invoice / Credit Note / Expense |
| `subtotal` | numeric(10,2) | 小计 |
| `tax` | numeric(10,2) | 税额（含 SST） |
| `service_charge` | numeric(10,2) | 服务费 |
| `grand_total` | numeric(10,2) | 总计 |
| `subsidy_details` | jsonb | 燃油补贴明细 |
| `tags` | text[] | 用户标签 |
| `confidence_score` | numeric(4,3) | 置信度 |
| `raw_ocr` | text | OCR 原始文本 |
| `raw_ai` | jsonb | AI 原始 JSON 结果 |

### receipt_items 表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `receipt_id` | UUID | 外键→receipts |
| `name` | text | 商品名称 |
| `qty` | numeric(12,3) | 数量 |
| `unit_price` | numeric(10,2) | 单价 |
| `line_total` | numeric(10,2) | 行金额 |
| `sort_order` | integer | 排序 |

## 6. 状态流转

```
uploaded ──► processing ──► pending_review ──► synced
                │                              ▲
                ▼                              │
              failed ──────── (retry) ──────────┘
```

- **uploaded**: 文件已上传 Storage，记录已创建
- **processing**: Edge Function 正在执行 OCR/AI 管线
- **pending_review**: AI 提取完成，等待用户人工审核和确认
- **synced**: 用户确认完毕，数据已同步
- **failed**: 管线执行失败，用户可点击重试

## 7. 不再采用的方案

| 技术 | 原因 |
|------|------|
| Cloudflare Worker | 复用 Supabase 平台能力即可，无需额外维护 |
| Google Sheets | 无法支持行级安全和结构化查询 |
| 前端直持 AI Key | 安全风险，密钥暴露 |
