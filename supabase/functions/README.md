# Supabase Edge Functions

上传后解析函数放在此目录。

推荐函数：

```text
parse-receipt/
  index.ts
```

职责：

1. 校验 Supabase Auth JWT。
2. 根据 `receipt_id` 查询并确认记录属于当前用户。
3. 从 Storage 读取识别用图片：优先 `processed_file_path`，没有裁剪图时回退 `file_path` 原图。
4. 如配置 `OCR_PROVIDER=tencent`，先通过 `consume_ocr_quota` 扣减月度额度，再调用腾讯云 `GeneralBasicOCR`。
5. 每用户每月默认最多 900 次腾讯云 OCR；超额时不调用腾讯云，直接创建手动审核草稿。
6. 如配置 `AI_REPAIR_PROVIDER=deepseek`，在明细为空、金额校验失败或置信度偏低时，用 DeepSeek V4 修复 OCR 文本结构化结果。
7. 如前端传入 `mode=smart`，改用 Qwen VL 读取图片，并强制再用 DeepSeek 校验结构和金额；默认每用户每月最多 100 次 Qwen VL。
8. 如前端传入 `mode=vision`，仅做 Qwen VL 视觉重解析；可通过 `VISION_REPAIR_PROVIDER=deepseek` 再用 DeepSeek 校验结构和金额。
9. 规范化结果并写入 `receipts`、`receipt_items`。
10. 返回解析结果。

前端先快速上传原图，进入编辑页点击“智能解析”时再裁剪；裁剪后会保留两份图片：

```text
{user_id}/{receipt_id}/original.ext
{user_id}/{receipt_id}/processed-{timestamp}.ext
```

`processed-{timestamp}.ext` 是用户在解析前裁剪/旋转后的识别输入；每次智能解析保留独立路径，原图用于人工核对和审计。

腾讯云 OCR 模式需要：

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

DeepSeek V4 只接收腾讯 OCR 文本和初始 JSON，不上传图片；默认每用户每月最多 500 次。
Qwen VL 不会在普通上传时自动调用；只有审核页点击“智能解析”才会触发。智能解析固定链路是 Qwen VL 读图 + DeepSeek 校验结构和金额，但不会让 DeepSeek 重写商品名。

`SUPABASE_SERVICE_ROLE_KEY` 由 Supabase Edge Runtime 内置提供，不需要在 Dashboard 手动添加。

