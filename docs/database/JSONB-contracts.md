# JSONB Contracts — VNU Edge Exam

## `exam_sessions.rules`

```json
{
  "exam_type": "TN_THPT_2025 | GDPT_2018",
  "assessment_period": "GK1 | GK2 | CK1 | CK2",
  "structure_template_id": "uuid",
  "structure": {
    "source": "QD764 | custom",
    "is_custom": false,
    "overrides": {}
  },
  "cognitive_distribution": {
    "nhan_biet": 0.4,
    "thong_hieu": 0.3,
    "van_dung": 0.3
  },
  "scoring": {
    "true_false_branch": { "1": 0.1, "2": 0.25, "3": 0.5, "4": 1.0 },
    "short_answer_normalize": ["comma_to_dot", "trim_whitespace"]
  },
  "proctoring": { "max_focus_violations": 3, "autosave_interval_sec": 3 },
  "audio": { "max_plays": 2, "seek_disabled": true }
}
```

Kiểm tra định kỳ GK/CK dùng **cùng** cấu trúc QĐ 764 từ catalog code (`packages/shared-types/src/tn-thpt-catalog.ts`), không lưu bản mặc định trong DB.

**Catalog vs DB:** `exam_structure_templates` chỉ lưu bản `source=custom`. Mỗi môn trong `rules.subjects[]` có `structureMode: default | custom`.

## `exam_structure_templates.parts` — ví dụ Toán

```json
{
  "part1_mcq": { "count": 12, "score_per_item": 0.25, "type": "mcq" },
  "part2_true_false": { "count": 4, "score_branch": {"1":0.1,"2":0.25,"3":0.5,"4":1.0}, "type": "true_false" },
  "part3_short": { "count": 6, "score_per_item": 0.5, "type": "short_answer" }
}
```

## `exam_structure_templates.cluster_layout` — Tiếng Anh

```json
{
  "clusters": [
    { "subtype": "fill_notice", "count": 6 },
    { "subtype": "fill_flyer", "count": 6 },
    { "subtype": "reorder", "count": 5 },
    { "subtype": "fill_gap", "count": 5 },
    { "subtype": "reading_8", "count": 8 },
    { "subtype": "reading_10", "count": 10 }
  ],
  "total_mcq": 40
}
```

## `exam_sessions.routing_config`

```json
{
  "mode": "fixed_combo | dynamic_subject",
  "resolve_order": ["combo_code", "subject_group", "grade_stream"],
  "combo_map": { "A00": "exam-paper-uuid" },
  "subject_map": { "MATH": "exam-paper-uuid" },
  "default_paper_id": "uuid"
}
```

## `question_clusters.passage`

```json
{
  "title": "City Life",
  "body": "Many people enjoy living in cities...",
  "images": [],
  "audio_id": "optional-media-uuid"
}
```

## QuestionType enum

`mcq` | `true_false` | `short_answer` | `essay` | `cluster_mcq`
