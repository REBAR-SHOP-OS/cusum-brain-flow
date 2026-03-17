

## حذف آیکون "All Items" از سایدبار Purchasing

### تغییر
در فایل `src/components/agent/AgentHistorySidebar.tsx`، بلوک "All Items" (خطوط ۱۱۴-۱۲۸) که شامل آیکون 📋 و متن "All Items" است حذف می‌شود.

چون این دکمه `onSelectPurchasingDate?.(null)` را فراخوانی می‌کند (یعنی فیلتر تاریخ را پاک می‌کند)، باید مطمئن شویم که مقدار پیش‌فرض `activePurchasingDate` همچنان `null` باشد تا کاربر به‌صورت پیش‌فرض همه آیتم‌ها را ببیند — فقط دکمه حذف می‌شود، منطق تغییر نمی‌کند.

### فایل
- `src/components/agent/AgentHistorySidebar.tsx` — حذف خطوط ۱۱۴-۱۲۸

