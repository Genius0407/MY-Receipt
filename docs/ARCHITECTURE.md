# 马来西亚英文收据智能识别系统架构说明

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
| 静态前端 | 上传、裁剪/旋转、列表、详情校对、标签、筛选、Excel 导出 | `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` |
| Supabase Auth | 用户登录、会话、`auth.uid()` | 无 |
| Supabase Storage | 保存原始收据图片和裁剪后的识别图 | 无 |
| Supabase Edge Function | OCR、字段抽取、服务端校验、写入数据库 | `TENCENT_SECRET_ID`、`TENCENT_SECRET_KEY`、可选 `OPENAI_API_KEY`、内置 `SUPABASE_SERVICE_ROLE_KEY` |
| Supabase Postgres | 结构化结果、商品明细、标签、状态 | 无 |

## 3. 处理流程

1. 用户登录前端。
2. 前端让用户裁剪/旋转票据区域。
3. 前端把原图上传到 `receipts/{user_id}/{receipt_id}/original.ext`，把裁剪图上传到 `receipts/{user_id}/{receipt_id}/processed.jpg`。
4. 前端创建 `receipts` 记录，状态为 `uploaded`，并保存 `processed_file_path` 与 `image_processing`。
5. 前端调用 Supabase Edge Function `parse-receipt`，传入 `receipt_id`。
6. Edge Function 校验用户 JWT，并确认该 `receipt_id` 属于当前用户。
7. Edge Function 优先从 Storage 读取 `processed_file_path`，没有裁剪图时读取原图。
8. Edge Function 通过 `consume_ocr_quota` 扣减腾讯云 OCR 月度额度，额度内调用 `GeneralBasicOCR`。
9. Edge Function 用 OCR 文本规则抽取字段；后续可接视觉大模型做高精度重解析。
10. Edge Function 规范化金额、日期、枚举字段，写入 `receipts` 与 `receipt_items`。
11. 前端通过 Supabase 查询结果，进入待校对状态。
12. 用户编辑字段、标签、明细后保存，状态改为 `pending_review` 或 `synced`。
13. 导出时前端从 Supabase 查询当前筛选结果，用 ExcelJS 生成 `.xlsx`。

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
    imagePreprocess.ts
    supabaseClient.ts
    receiptApi.ts
    exportExcel.ts
    normalizeReceipt.ts
  types/
    receipt.ts
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

## 6. 字段模型约定

统一使用以下字段，避免旧 demo 中 `industry/tax_sst/subsidy_info` 与 Worker 中 `category/tax/subsidy_details` 混用。

| 标准字段 | 说明 |
| --- | --- |
| `category` | 行业分类：`Grocery`、`Fuel`、`F&B`、`Retail`、`Service`、`Other` |
| `doc_type` | 单据类型：`Receipt`、`Invoice`、`Credit Note`、`Expense` |
| `tax` | 税额，包含 SST 等税项 |
| `subsidy_details` | 补贴信息，使用 JSON |
| `tags` | 用户标签数组 |
| `processed_file_path` | 裁剪/旋转后的识别图路径 |
| `image_processing` | 上传前裁剪参数与输出尺寸 |

## 7. 不再采用的方案

以下方案不再作为后续主线：

- Cloudflare Worker 作为 OCR/AI 中间层。
- Google Sheets 作为数据存储。
- Google Vision 作为默认 OCR。
- 前端直接持有腾讯云、OpenAI 或 service role key。
- `1.html` 早期 mock 页面。

