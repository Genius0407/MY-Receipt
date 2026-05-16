# ResitAI 马来西亚收据审核系统架构说明

## 1. 当前目标

项目后续采用公网部署方案：

```text
静态前端
  -> Supabase Auth
  -> Supabase Storage
  -> Supabase Edge Function
  -> 腾讯云 OCR / 可选视觉大模型
  -> Supabase Postgres
```

前端仍按纯静态应用交付，不部署传统服务器。OCR、视觉大模型和 service role 都需要密钥保护，因此放入 Supabase Edge Function。Supabase Edge Function 属于 Supabase 平台能力，不引入 VPS 或自维护 Node 服务。

## 2. 职责划分

| 层 | 职责 | 可见密钥 |
| --- | --- | --- |
| 静态前端 | 批量上传、解析前裁剪/旋转、列表、详情校对、标签、筛选、Excel 导出 | `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` |
| Supabase Auth | 用户登录、会话、`auth.uid()` | 无 |
| Supabase Storage | 保存原始收据图片和裁剪后的识别图 | 无 |
| Supabase Edge Function | OCR、字段抽取、服务端校验、写入数据库 | `TENCENT_SECRET_ID`、`TENCENT_SECRET_KEY`、可选 `OPENAI_API_KEY`、内置 `SUPABASE_SERVICE_ROLE_KEY` |
| Supabase Postgres | 结构化结果、商品明细、标签、状态 | 无 |

## 3. 处理流程

1. 用户登录前端。
2. 前端批量上传原图到 `receipts/{user_id}/{receipt_id}/original.ext`。
3. 前端创建 `receipts` 记录，状态为 `uploaded`，并立即在列表展示待解析卡片。
4. 用户打开单据编辑页，点击“智能解析”。
5. 前端弹出裁剪/旋转框；用户可裁剪后解析，也可直接解析原图。
6. 如用户裁剪，前端上传 `receipts/{user_id}/{receipt_id}/processed-{timestamp}.ext`，并保存 `processed_file_path` 与 `image_processing`。
7. 前端调用 Supabase Edge Function `parse-receipt`，传入 `receipt_id` 与 `mode=smart`。
8. Edge Function 校验用户 JWT，并确认该 `receipt_id` 属于当前用户。
9. Edge Function 优先从 Storage 读取 `processed_file_path`，没有裁剪图时读取原图。
10. `mode=smart` 使用 Qwen VL 读取图片，再用 DeepSeek 校验结构、字段和金额。
11. Edge Function 规范化金额、日期、枚举字段，写入 `receipts`、`receipt_items`、`processing_stage`、`warnings` 与 duplicate 信息。
12. 前端刷新结果，进入待校对状态，并展示 processing panel 与 warning panel。
13. 用户编辑字段、标签、明细后保存，状态改为 `pending_review` 或 `synced`。
14. 删除默认进入 rejected receipts，恢复或永久删除由用户明确选择。
15. 导出时前端从 Supabase 查询当前筛选结果，用 ExcelJS 生成 `.xlsx`；`Receipts` 一张发票一行，`Items` 一条明细一行。

## 4. 推荐前端模块

```text
src/
  app/
    App.tsx
  components/
    UploadDropzone.tsx
    ReceiptTable.tsx
    ReceiptDetailPanel.tsx
    ProcessingPanel.tsx
    WarningPanel.tsx
    DeletedReceiptList.tsx
    DuplicateDialog.tsx
    FieldConfigPanel.tsx
    CustomDocTypeInput.tsx
    TagSelector.tsx
    ExportToolbar.tsx
  lib/
    imagePreprocess.ts
    supabaseClient.ts
    receiptApi.ts
    exportExcel.ts
    normalizeReceipt.ts
    warningRules.ts
    duplicateDetection.ts
    fieldConfig.ts
    documentTypes.ts
  types/
    receipt.ts
    warning.ts
    fieldConfig.ts
    documentType.ts
```

生产入口是 React + Vite 应用。早期 AI Studio HTML 参考稿已从主线移除，后续 UI 迭代直接在组件内完成。

## 5. 数据状态

| 状态 | 含义 |
| --- | --- |
| `uploaded` | 文件已上传，尚未进入 OCR |
| `processing` | Edge Function 正在 OCR/AI |
| `pending_review` | AI 抽取完成，等待人工校对 |
| `synced` | 已确认保存，可作为正式台账记录 |
| `failed` | OCR/AI 失败，可重试 |

处理阶段由 `processing_stage` 细分：

| 阶段 | 含义 |
| --- | --- |
| `uploaded` | 文件已入库 |
| `ocr_scanning` | OCR 或视觉读取中 |
| `ai_extracting` | AI 结构化字段抽取中 |
| `generating_preview` | 正在整理可审核结果 |
| `ready_for_review` | 可人工审核 |
| `ocr_failed` | OCR/AI 失败 |

## 6. 字段模型约定

统一使用以下字段，避免旧 demo 中 `industry/tax_sst/subsidy_info` 与 Worker 中 `category/tax/subsidy_details` 混用。

| 标准字段 | 说明 |
| --- | --- |
| `category` | 行业分类：`Grocery`、`Fuel`、`F&B`、`Retail`、`Service`、`Other` |
| `doc_type` | 单据类型：`Receipt`、`Invoice`、`Credit Note`、`Expense`、`E-invoice` |
| `custom_doc_type` | 自定义单据类型标签 |
| `tax` | 税额，包含 SST 等税项 |
| `subsidy_details` | 补贴信息，使用 JSON |
| `extra_fields` | E-invoice 或专属票据扩展字段 |
| `warnings` | warning panel 使用的结构化异常数组 |
| `deleted_at/deleted_reason/deleted_note` | rejected receipts / soft delete |
| `file_hash/duplicate_of/duplicate_score` | duplicate detection |
| `tags` | 用户标签数组 |
| `processed_file_path` | 解析前裁剪/旋转后的识别图路径 |
| `image_processing` | 解析前裁剪参数与输出尺寸 |

不同票据类型的字段展示策略见 [RECEIPT_FIELD_DISPLAY_STRATEGY.md](./RECEIPT_FIELD_DISPLAY_STRATEGY.md)。

## 7. 不再采用的方案

以下方案不再作为后续主线：

- Cloudflare Worker 作为 OCR/AI 中间层。
- Google Sheets 作为数据存储。
- Google Vision 作为默认 OCR。
- 前端直接持有腾讯云、OpenAI 或 service role key。
- `1.html` 早期 mock 页面。

