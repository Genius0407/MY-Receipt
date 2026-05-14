# Supabase Edge Functions

后续 OCR/AI 函数放在此目录。

推荐函数：

```text
parse-receipt/
  index.ts
```

职责：

1. 校验 Supabase Auth JWT。
2. 根据 `receipt_id` 查询并确认记录属于当前用户。
3. 从 Storage 读取原始文件。
4. 调用 Google Vision OCR。
5. 调用 OpenAI 抽取结构化字段。
6. 规范化结果并写入 `receipts`、`receipt_items`。
7. 返回解析结果。

需要的 secrets：

```text
OPENAI_API_KEY
GOOGLE_VISION_KEY
SUPABASE_SERVICE_ROLE_KEY
```

