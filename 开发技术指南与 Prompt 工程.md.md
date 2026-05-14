# 开发技术指南与 Prompt 工程

## 1. 技术栈

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 前端 | React + Vite + Tailwind | 静态部署，复用 `index (2).html` 的 UI 方向 |
| Auth | Supabase Auth | 用户身份与 RLS 基础 |
| 存储 | Supabase Storage | 保存原始收据图片/PDF |
| 数据库 | Supabase Postgres | 保存结构化结果、明细、标签、状态 |
| OCR/AI | Supabase Edge Function | 保护 Google/OpenAI 密钥 |
| OCR | Google Vision API | 识别英文、马来文、中文混合文本 |
| AI | OpenAI GPT-4o-mini 或后续模型 | 抽取结构化 JSON |
| 导出 | SheetJS | 浏览器端生成 `.xlsx` |

## 2. 前端模块

| 模块 | 职责 |
| --- | --- |
| `UploadDropzone` | 文件选择、拖拽、大小/类型校验 |
| `ReceiptList` | 列表、搜索、状态筛选、单据类型筛选、标签筛选 |
| `ReceiptDetailPanel` | 原图预览、字段编辑、商品明细编辑、金额校验 |
| `TagSelector` | 预设标签选择：Business、Personal、Tax Deductible、Pending |
| `ExportToolbar` | 当前筛选结果或已选记录导出 Excel |
| `receiptApi` | 封装 Supabase 查询、上传、调用 Edge Function |
| `normalizeReceipt` | 前端展示前的数据兼容和校验 |

## 3. 标准字段

前端、数据库、AI Prompt 统一使用：

```json
{
  "merchant_name": "",
  "company_reg_no": null,
  "address": null,
  "phone": null,
  "invoice_no": "",
  "date": "",
  "time": null,
  "items": [],
  "subtotal": 0.0,
  "discount": 0.0,
  "tax": 0.0,
  "service_charge": 0.0,
  "rounding": 0.0,
  "grand_total": 0.0,
  "payment_method": null,
  "change": 0.0,
  "subsidy_details": null,
  "doc_type": "Receipt",
  "category": "Other",
  "tags": [],
  "confidence_score": 0.0
}
```

旧字段映射：

| 旧字段 | 新字段 |
| --- | --- |
| `industry` | `category` |
| `tax_sst` | `tax` |
| `subsidy_info` | `subsidy_details` |

## 4. Edge Function 职责

`parse-receipt`：

1. 校验用户 JWT。
2. 读取 `receipt_id`。
3. 查询 `receipts`，确认 `user_id = auth.uid()`。
4. 从 Supabase Storage 下载原始文件。
5. 调用 Google Vision OCR。
6. 调用 OpenAI，要求返回 JSON。
7. 服务端校验金额、日期、枚举字段。
8. 写回 `receipts` 和 `receipt_items`。
9. 失败时写入 `status = failed` 和 `error_message`。

## 5. Prompt 基线

System Prompt：

```text
You are a specialized parser for Malaysian English receipts and invoices.
Extract structured fields from OCR text.
Return ONLY a valid JSON object, no markdown and no explanation.

Rules:
- Monetary values must be numbers without currency symbols.
- Dates must be YYYY-MM-DD. If year is 2 digits, assume 20xx.
- Times must be HH:MM in 24-hour format.
- category must be one of: Grocery, Fuel, F&B, Retail, Service, Other.
- doc_type must be one of: Receipt, Invoice, Credit Note, Expense.
- If a string/object field is missing, use null.
- If a numeric field is missing, use 0.00.
- items must be an array of { name, qty, unit, unit_price, line_total }.
- Include confidence_score from 0.0 to 1.0.
```

Few-shot 示例保留三类：

- 99 Speedmart：便利店、MyKasih、舍入。
- Apple Leaf/Shell：加油、Budi Madani RON95 补贴。
- Haidilao：中英混合、服务费、SST。

## 6. 安全规则

- 前端只使用 Supabase anon/publishable key。
- OpenAI、Google Vision、Supabase service role key 只进入 Edge Function Secrets。
- 业务表必须开启 RLS。
- Storage bucket 默认私有。
- Edge Function 不接受匿名 OCR/AI 调用。
- 不在日志中输出密钥、完整图片 base64 或用户敏感数据。

## 7. 开发顺序

1. 建 React + Vite + Tailwind 工程。
2. 迁移 `index (2).html` UI。
3. 接 Supabase Auth。
4. 跑通 `docs/SUPABASE_SCHEMA.sql`。
5. 实现 Storage 上传和列表查询。
6. 实现 `parse-receipt` Edge Function。
7. 接入详情编辑、标签、金额校验。
8. 实现 Excel 导出。
9. 用真实 50 张收据做字段级验收。

