
# بهبود خروجی YAML ایجنت Architect (Empire) برای جلوگیری از تغییرات ناخواسته

## مشکل

وقتی ایجنت Architect (که در اسکرین‌شات با نام YAML نمایش داده شده) یک باگ UI مثل "remove Office from sidebar" را دریافت می‌کند، خروجی PLANNER YAML آن فاقد یک constraint الزام‌آور است که به Lovable (ابزار کد) بگوید:
- **فقط** همین مشکل مشخص را برطرف کن
- **هیچ چیز دیگری** در UI یا کارکرد اپ تغییر نده

همچنین بلاک "📋 Lovable Command" که در RESOLVER mode تولید می‌شود نیز این اخطار را ندارد.

## راه‌حل — فقط `supabase/functions/ai-agent/index.ts`

### تغییر ۱: اضافه کردن فیلد `surgical_constraint` به YAML schema (خط 2295-2306)

در قسمت Output YAML only، یک فیلد اجباری جدید اضافه می‌شود:

```yaml
# قبل:
- Output YAML only (fenced in ```yaml):
  task_type: <UI_LAYOUT|...>
  scope: <module or page>
  schema_unknown: true
  unknowns: [...]
  plan_steps: ...
  success_criteria: ...
  rollback: ...

# بعد:
- Output YAML only (fenced in ```yaml):
  task_type: <UI_LAYOUT|...>
  scope: <module or page>
  schema_unknown: true
  unknowns: [...]
  surgical_constraint: |
    ⚠️ SURGICAL EXECUTION LAW — MANDATORY:
    Under NO circumstances may this fix alter any other part of the application.
    ONLY the exact issue reported below may be changed.
    Any side-effect on UI layout, navigation, data logic, styles, or other components is FORBIDDEN.
    Reported issue: <one-line exact description of the user's reported problem>
  plan_steps: ...
  success_criteria: ...
  rollback: ...
```

این فیلد **الزام‌آور** است و مقدار آن باید شامل توضیح دقیق مشکل گزارش‌شده باشد.

### تغییر ۲: اضافه کردن constraint به Lovable Command (خط 2354-2363)

در قالب Lovable Command، یک هدر اجباری اضافه می‌شود:

```
# قبل:
📋 Lovable Command (copy & paste into Lovable chat):
───────────────────────────────────────────────────
[Clear, actionable instruction...]
───────────────────────────────────────────────────

# بعد:
📋 Lovable Command (copy & paste into Lovable chat):
───────────────────────────────────────────────────
🔒 SURGICAL EXECUTION LAW — NON-NEGOTIABLE:
Do NOT change any other part of the application beyond what is described below.
Do NOT modify the overall UI, navigation structure, layout, styling, or any unrelated logic.
ONLY fix the exact reported issue described in this prompt. Nothing more.

[Clear, actionable instruction...]
───────────────────────────────────────────────────
```

### تغییر ۳: اضافه کردن SURGICAL FENCE rule به HARD CONSTRAINTS (خط 2288)

در بخش HARD CONSTRAINTS مود PLANNER، یک قانون جدید اضافه می‌شود:

```
- SURGICAL FENCE (MANDATORY): The plan MUST include surgical_constraint field in YAML.
  This field defines what MUST NOT change. Any plan_step that could affect UI components,
  navigation, or logic beyond the exact reported issue is FORBIDDEN and must be removed.
```

## خلاصه فایل‌های تغییر یافته

| فایل | تغییر |
|---|---|
| `supabase/functions/ai-agent/index.ts` | ۳ افزودنی به system prompt ایجنت empire |

هیچ تغییری در دیتابیس، UI، یا edge function دیگری اعمال نمی‌شود.
