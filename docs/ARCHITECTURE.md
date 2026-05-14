# 马来西亚英文收据智能识别系统架构说明

## 1. 当前目标

项目后续采用公网部署方案：

```text
静态前端
  -> Supabase Auth
  -> Supabase Storage
  -> Supabase Edge Function
  -> Google Vision OCR
  -> OpenAI
  -> Supabase Postgres
```

前端仍按纯静态应用交付，不部署传统服务器。OCR 和 AI 需要密钥保护，因此放入 Supabase Edge Function。Supabase Edge Function 属于 Supabase 平台能力，不引入 VPS 或自维护 Node 服务。

## 2. 职责划分

| 层 | 职责 | 可见密钥 |
| --- | --- | --- |
| 静态前端 | 上传、列表、详情校对、标签、筛选、Excel 导出 | `SUPABASE_URL`、`SUPABASE_ANON_KEY` |
| Supabase Auth | 用户登录、会话、`auth.uid()` | 无 |
| Supabase Storage | 保存原始收据图片/PDF | 无 |
| Supabase Edge Function | OCR、AI 字段抽取、服务端校验、写入数据库 | `OPENAI_API_KEY`、`GOOGLE_VISION_KEY`、`SUPABASE_SERVICE_ROLE_KEY` |
| Supabase Postgres | 结构化结果、商品明细、标签、状态 | 无 |

## 3. 处理流程

1. 用户登录前端。
2. 前端把文件上传到 Supabase Storage，路径格式为 `receipts/{user_id}/{receipt_id}/original.ext`。
3. 前端创建 `receipts` 记录，状态为 `uploaded`。
4. 前端调用 Supabase Edge Function `parse-receipt`，传入 `receipt_id`。
5. Edge Function 校验用户 JWT，并确认该 `receipt_id` 属于当前用户。
6. Edge Function 从 Storage 读取文件，调用 Google Vision OCR。
7. Edge Function 将 OCR 文本发送给 OpenAI，要求返回固定 JSON。
8. Edge Function 规范化金额、日期、枚举字段，写入 `receipts` 与 `receipt_items`。
9. 前端通过 Supabase 查询结果，进入待校对状态。
10. 用户编辑字段、标签、明细后保存，状态改为 `pending_review` 或 `synced`。
11. 导出时前端从 Supabase 查询当前筛选结果，用 SheetJS 生成 `.xlsx`。

## 4. 推荐前端模块

```text
src/
  app/
    App.tsx
  components/
    UploadDropzone.tsx
    ReceiptTable.tsx
    ReceiptDetailPanel.tsx
    TagSelector.tsx
    ExportToolbar.tsx
  lib/
    supabaseClient.ts
    receiptApi.ts
    exportExcel.ts
    normalizeReceipt.ts
  types/
    receipt.ts
```

`index (2).html` 目前作为 UI 参考稿，不作为生产入口。正式开发时建议迁移为 React + Vite + Tailwind 工程。

## 5. 数据状态

| 状态 | 含义 |
| --- | --- |
| `uploaded` | 文件已上传，尚未进入 OCR |
| `processing` | Edge Function 正在 OCR/AI |
| `pending_review` | AI 抽取完成，等待人工校对 |
| `synced` | 已确认保存，可作为正式台账记录 |
| `failed` | OCR/AI 失败，可重试 |

## 6. 字段模型约定

统一使用以下字段，避免旧 demo 中 `industry/tax_sst/subsidy_info` 与 Worker 中 `category/tax/subsidy_details` 混用。

| 标准字段 | 说明 |
| --- | --- |
| `category` | 行业分类：`Grocery`、`Fuel`、`F&B`、`Retail`、`Service`、`Other` |
| `doc_type` | 单据类型：`Receipt`、`Invoice`、`Credit Note`、`Expense` |
| `tax` | 税额，包含 SST 等税项 |
| `subsidy_details` | 补贴信息，使用 JSON |
| `tags` | 用户标签数组 |

## 7. 不再采用的方案

以下方案不再作为后续主线：

- Cloudflare Worker 作为 OCR/AI 中间层。
- Google Sheets 作为数据存储。
- 前端直接持有 OpenAI 或 Google Vision Key。
- `1.html` 早期 mock 页面。

