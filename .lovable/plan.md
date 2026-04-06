

# رفع خطای حذف کاربر — Foreign Key Constraints

## مشکل ریشه‌ای
هنگام حذف کاربر از سیستم احراز هویت، دیتابیس خطا می‌دهد چون جداول دیگر به `auth.users` با constraint نوع **NO ACTION** متصل هستند. یعنی اگر کاربر در جدول دیگری رکوردی داشته باشد، حذفش بلاک می‌شود.

**خطاهای فعلی:**
- `ryle.lachini@gmail.com`: بلاک توسط `team_channels.created_by` (3 رکورد)
- `aw.danandeh@gmail.com`: بلاک توسط `field_audit_trail.changed_by` (12 رکورد)

## راه‌حل
تغییر تمام foreign key های NO ACTION که به `auth.users` اشاره دارند به **SET NULL**. این باعث می‌شود هنگام حذف کاربر، ستون مربوطه NULL شود و رکورد حفظ شود (audit trail از بین نمی‌رود).

## تغییرات

### Migration: تغییر Foreign Keys به SET NULL

یک migration که تمام FK های NO ACTION زیر را DROP و با `ON DELETE SET NULL` مجدد ایجاد کند:

| جدول | ستون | FK Name |
|------|------|---------|
| team_channels | created_by | team_channels_created_by_fkey |
| field_audit_trail | changed_by | field_audit_trail_changed_by_fkey |
| communications | user_id | communications_user_id_fkey |
| estimation_learnings | created_by | estimation_learnings_created_by_fkey |
| suggestions | shown_to | suggestions_shown_to_fkey |
| command_log | user_id | command_log_user_id_fkey |
| barlists | verified_by | barlists_verified_by_fkey |
| clearance_evidence | verified_by | clearance_evidence_verified_by_fkey |
| agent_action_log | user_id | agent_action_log_user_id_fkey |
| penny_collection_queue | approved_by | penny_collection_queue_approved_by_fkey |
| loading_checklist | loaded_by | loading_checklist_loaded_by_fkey |
| pipeline_stage_order | updated_by | pipeline_stage_order_updated_by_fkey |
| bank_feed_balances | updated_by | bank_feed_balances_updated_by_fkey |
| pipeline_ai_actions | created_by | pipeline_ai_actions_created_by_fkey |
| scheduled_activities | assigned_to | scheduled_activities_assigned_to_fkey |
| scheduled_activities | created_by | scheduled_activities_created_by_fkey |
| quote_templates | created_by | quote_templates_created_by_fkey |
| employee_contracts | created_by | employee_contracts_created_by_fkey |
| salary_history | approved_by | salary_history_approved_by_fkey |
| employee_certifications | created_by | employee_certifications_created_by_fkey |

هر کدام:
```sql
ALTER TABLE public.{table} DROP CONSTRAINT {fk_name};
ALTER TABLE public.{table} ADD CONSTRAINT {fk_name}
  FOREIGN KEY ({column}) REFERENCES auth.users(id) ON DELETE SET NULL;
```

### نتیجه
- حذف هر کاربر بدون خطا انجام می‌شود
- رکوردهای تاریخی (audit trail، channels و ...) حفظ می‌شوند با مقدار NULL در ستون کاربر
- هیچ داده‌ای از بین نمی‌رود
- بعد از migration، می‌توانید هر دو کاربر را از Cloud Users حذف کنید

### جزئیات فنی
- فقط FK هایی که `ON DELETE NO ACTION` دارند تغییر می‌کنند
- FK هایی که قبلاً `CASCADE` یا `SET NULL` هستند دست‌نخورده باقی می‌مانند
- هیچ تغییری در کد اپلیکیشن لازم نیست

