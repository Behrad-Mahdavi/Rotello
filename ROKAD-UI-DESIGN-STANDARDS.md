# مستند جامع استانداردها، طراحی و استایل UI (Design System & UI Guidelines)

این مستند بر اساس معماری، استایل‌ها و الگوهای پیاده‌سازی‌شده در این پروژه تدوین شده است تا بتوانید دقیقاً همین هویت بصری، استانداردها و کامپوننت‌ها را در پروژه‌های جدید و مشابه Next.js / React پیاده‌سازی کنید.

---

## فهرست مطالب
1. [فلسفه طراحی و هویت بصری](#۱-فلسفه-طراحی-و-هویت-بصری)
2. [پالت رنگی و پرسوناها (Color Tokens)](#۲-پالت-رنگی-و-پرسوناها-color-tokens)
3. [تایپوگرافی و استانداردهای زبان فارسی](#۳-تایپوگرافی-و-استانداردهای-زبان-فارسی)
4. [سیستم ابعاد، فواصل و شعاع گوشه‌ها (Radius & Spacing)](#۴-سیستم-ابعاد-فواصل-و-شعاع-گوشه‌ها)
5. [امضای بصری: سایه‌های سخت و عمق (Hard Shadows & Elevation)](#۵-امضای-بصری-سایه‌های-سخت-و-عمق)
6. [استاندارد دارک‌مود (Dark Mode System)](#۶-استاندارد-دارک‌مود-dark-mode-system)
7. [الگوهای کامپوننت‌های پایه (Core UI Components)](#۷-الگوهای-کامپوننت‌های-پایه-core-ui-components)
   - [دکمه‌ها (Buttons)](#۷۱-دکمه‌ها-buttons)
   - [کارت‌ها و پنل‌های محتوا (Cards)](#۷۲-کارت‌ها-و-پنل‌های-محتوا-cards)
   - [کارت‌های آماری (Stat Cards)](#۷۳-کارت‌های-آماری-stat-cards)
   - [فرم‌ها و اینپوت‌ها (Form Controls)](#۷۴-فرم‌ها-و-اینپوت‌ها-form-controls)
   - [نشان‌ها و بج‌های وضعیت (Badges & Chips)](#۷۵-نشان‌ها-و-بج‌های-وضعیت-badges--chips)
   - [پنجره‌های بازشو (Modals)](#۷۶-پنجره‌های-بازشو-modals)
   - [جداول داده (Data Tables)](#۷۷-جداول-داده-data-tables)
   - [منوی ناوبری و سایدبار (Sidebar & Navigation)](#۷۸-منوی-ناوبری-و-سایدبار-sidebar--navigation)
   - [نوار بالایی (Navbar / Header)](#۷۹-نوار-بالایی-navbar--header)
8. [سیستم چاپ رسمی و خروجی PDF (Print Stylesheet)](#۸-سیستم-چاپ-رسمی-و-خروجی-pdf)
9. [پیکربندی‌های آماده برای پروژه جدید (Setup & Configs)](#۹-پیکربندی‌های-آماده-برای-پروژه-جدید)
   - [Tailwind Configuration (`tailwind.config.ts`)](#۹۱-پیکربندی-tailwindconfigts)
   - [استایل‌های سراسری (`globals.css`)](#۹۲-استایل‌های-سراسری-globalscss)
   - [توابع کمکی (`lib/utils.ts`)](#۹۳-توابع-کمکی-libutilsts)
   - [بسته‌های وابستگی الزامی (Dependencies)](#۹۴-بسته‌های-وابستگی-الزامی-dependencies)

---

## ۱. فلسفه طراحی و هویت بصری

سبک طراحی این پروژه بر پایه **Modern Refined Neo-brutalism** بنا شده است. ویژگی‌های کلیدی این رویکرد:
- **مرزها و کنتراست شفاف:** استفاده از حاشیه‌های مشخص (`border: 1.5px`) به جای سایه‌های محو و مبهم.
- **سایه‌های سخت (Hard Shadows):** استفاده از سایه‌های آفست بدون بلور (`box-shadow: 2.75px 2.75px 0 #202A5A`) که حس ملموس و فیزیکی به المان‌ها می‌دهد.
- **گوشه‌های گردِ نرم:** تعادل میان بروتالیسم و راحتی بصری با استفاده از گوشه‌های مدرن (`rounded-2xl` و `rounded-3xl`).
- **جهت راست‌به‌چپ بومی (RTL-First):** طراحی دقیق برای ساختار زبان فارسی، ترازبندی راست، آیکون‌های متناسب و فونت بهینه‌شده.
- **کدهای رنگی چندگانه (Multi-Persona Color Coding):** تفکیک بخش‌ها یا دپارتمان‌ها با رنگ‌های مشخص و سازگار.

---

## ۲. پالت رنگی و پرسوناها (Color Tokens)

رنگ‌های اصلی سیستم به ۵ پرسونا / حوزه تقسیم می‌شوند که هر کدام دارای یک طیف کامل هستند:

| پرسونا / کلید | رنگ اصلی (Normal) | نقش / کاربرد | کد هگز لایت | کد هگز دارک |
|---|---|---|---|---|
| **Ecosystem** (برند اصلی) | `#59BBAF` | اکشن‌های اصلی، وضعیت موفقیت، دکمه‌های پرایمری | `#EEF8F7` | `#1F413D` |
| **Male** (بخش پسران / ثانویه) | `#202A5A` | رنگ سرمه‌ای نمادین، عناوین، بوردرها، دکمه ثانویه | `#E9EAEF` | `#0B0F1F` |
| **Female** (بخش دختران / هشدار) | `#E0195B` | تأکیدها، وضعیت‌های تاخیر یا هشدار مهم | `#FCE8EF` | `#4E0920` |
| **College** (دانشگاه / پیگیری) | `#F8A41D` | وضعیت‌های در انتظار، یادآوری‌ها و آمار مهم | `#FEF6E8` | `#57390A` |
| **Club** (باشگاه / بنفش) | `#652D90` | امکانات ویژه، نقش‌های مدیریتی، دسته‌بندی خاص | `#F0EAF4` | `#231032` |

### رنگ‌های خنثی و متون (Neutral / Ink)
- **پس‌زمینه صفحه (Light):** `#F8F9FA`
- **پس‌زمینه کارت‌ها (Light):** `#FFFFFF`
- **حاشیه‌ها (Light):** `#EAEAEA` یا `border-gray-200`
- **متن اصلی:** `#292827` (`--text-normal`)
- **متن تیره/عناوین:** `#1F1E1D` و `#0E0E0E`
- **متن کم‌رنگ / زیرعنوان:** `#71717A` یا با اوپاسیتی `text-ink-normal/60`

### رنگ‌های کمکی وضعیت (Accents)
- **سبز موفقیت:** `#009966`
- **قرمز خطا:** `#C60036`
- **بنفش تاکیدی:** `#8A38F5`

---

## ۳. تایپوگرافی و استانداردهای زبان فارسی

- **خانواده فونت:**
  ```css
  font-family: var(--font-iransans), "IRANSansX", "Vazirmatn", system-ui, sans-serif;
  ```
- **تنظیم روت HTML:**
  - دسکتاپ: `font-size: 14.5px;`
  - موبایل: `font-size: 14px;`
- **مقیاس اندازه و ارتفاع خط (Line Heights بهینه‌شده برای حروف فارسی):**
  - `text-xs`: اندازه `11.5px` / ارتفاع خط `17px`
  - `text-sm`: اندازه `13px` / ارتفاع خط `20px`
  - `text-base`: اندازه `14.5px` / ارتفاع خط `23px`
  - `text-md`: اندازه `16px` / ارتفاع خط `25px`
  - `text-lg`: اندازه `18px` / ارتفاع خط `27px`
  - `text-xl`: اندازه `21px` / ارتفاع خط `29px`
  - `text-2xl`: اندازه `25px` / ارتفاع خط `34px`
  - `text-3xl`: اندازه `30px` / ارتفاع خط `39px`
- **استاندارد اعداد و ارقام:**
  - تمامی اعداد در رابط کاربری (آمار، مبالغ، شماره‌ها، تاریخ‌ها) با تابع `toPersianDigits` به ارقام فارسی تبدیل می‌شوند.
- **تاریخ و زمان:**
  - استفاده از تقویم جلالی با پکیج `jalaali-js` و تابع `formatToJalali` (نمونه: «۲۲ اسفند ۱۴۰۳»).

---

## ۴. سیستم ابعاد، فواصل و شعاع گوشه‌ها

### مقیاس شعاع گوشه‌ها (Border Radius)
- `rounded-xs` (4px): نشانگرها و چک‌باکس‌ها
- `rounded-sm` (6px): بج‌های فشرده درون پرینت
- `rounded-md` (8px): اینپوت‌های ریز و تگ‌ها
- `rounded-xl` (12px): دکمه‌ها، اینپوت‌های فرم، آیتم‌های منو
- `rounded-2xl` (16px): کارت‌ها، کانتینرهای فیلتر، جدول‌ها
- `rounded-3xl` (20px - 24px): پنجره‌های پاپ‌آپ و مودال‌ها
- `rounded-full` / `rounded-pill` (9999px): چیپ‌ها، آواتارها، نشان‌ها

### فواصل استاندارد (Spacing System)
- حاشیه داخلی کارت‌ها: `p-4 sm:p-5 md:p-6`
- فاصله بین المان‌های سایدباری: `gap-3` یا `space-y-1`
- فاصله بین ستون‌های فرم: `gap-4 sm:gap-5`
- فاصله عمودی بخش‌های اصلی صفحه: `space-y-6 sm:space-y-8`

---

## ۵. امضای بصری: سایه‌های سخت و عمق

برخلاف سایه‌های نرم متداول (`shadow-md` یا `shadow-lg`)، در این سیستم از **Hard Shadow** با افست ثابت استفاده می‌شود:

| نام سایه | مقدار CSS | کاربرد در لایت مود | کاربرد در دارک مود |
|---|---|---|---|
| `shadow-ecosystem` | `2.75px 2.75px 0 #59BBAF` | المان‌های فعال و پرایمری | پیش‌فرض کارت‌ها در دارک‌مود |
| `shadow-male` | `2.75px 2.75px 0 #202A5A` | سایه استاندارد کارت‌ها و دکمه‌های تیره | جایگزین با `#3F50A0` |
| `shadow-female` | `2.75px 2.75px 0 #E0195B` | کارت‌ها و هشدارهای بخش دخترانه | حفظ رنگ با پس‌زمینه تیره |
| `shadow-college` | `2.75px 2.75px 0 #F8A41D` | بخش کالج و دکمه‌های پیگیری | حفظ رنگ نارنجی شفاف |
| `shadow-hard-sm` | `2px 2px 0 rgba(41,40,39,0.8)` | دکمه‌های اوت‌لاین و ریز | جایگزین با رنگ روشن |
| `shadow-hard-lg` | `4px 4px 0 #202A5A` | مودال‌ها و پنجره‌های شناور | تبدیل به `4px 4px 0 #59BBAF` |

### میکرواینترکشن‌های فیزیکی دکمه‌ها (Button States)
```css
/* حالت عادی */
transform: translate(0, 0);
box-shadow: 2.5px 2.5px 0 #1F413D;

/* حالت هاور (بلند شدن دکمه) */
&:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #1F413D;
}

/* حالت کلیک (فشرده شدن دکمه به داخل) */
&:active {
  transform: translate(1.5px, 1.5px);
  box-shadow: 1px 1px 0 #1F413D;
}
```

---

## ۶. استاندارد دارک‌مود (Dark Mode System)

دارک‌مود از استراتژی کلاسی (`darkMode: "class"`) در تگ `<html>` تبعیت می‌کند.

### نگاشت رنگ‌های دارک‌مود
- **پس‌زمینه سراسری Body:** `#0B0F17`
- **پس‌زمینه سایدبار:** `#121824`
- **پس‌زمینه کارت‌ها و مودال‌ها:** `#151C28`
- **پس‌زمینه اینپوت‌ها و هدر جداول:** `#1C2536`
- **بوردر المان‌ها:** `#242F42` یا `border-gray-800`
- **متن اصلی:** `#F1F5F9`
- **متن ثانویه / خنثی:** `#94A3B8` / `dark:text-gray-400`

### بازتاب سایه‌های سخت در محیط تیره
در تم تاریک، رنگ مشکی برای سایه دیده نمی‌شود؛ بنابراین سایه سخت کارت‌ها و دکمه‌های اصلی به **رنگ سبز درخشان برند (`#59BBAF`)** یا کدهای نئونی تغییر می‌یابد:
```css
.dark .rokad-card {
  background: #151C28;
  border-color: #242F42;
  box-shadow: 2.75px 2.75px 0 #59BBAF;
}
```

---

## ۷. الگوهای کامپوننت‌های پایه (Core UI Components)

### ۷.۱ دکمه‌ها (Buttons)

#### دکمه اصلی (Primary Button)
```html
<button className="rokad-btn-primary px-4 py-2.5 text-sm">
  <Plus className="w-4 h-4" />
  <span>ثبت تسک جدید</span>
</button>
```
- کلاس CSS اختصاصی: `.rokad-btn-primary`
- خصوصیات: بک‌گراند `#59BBAF`، بوردر `1.5px solid #438C83`، سایه سخت `2.5px 2.5px 0 #1F413D`، متن سفید با وزن 700.

#### دکمه ثانویه / سرمه‌ای (Secondary Button)
```html
<button className="rokad-btn-sec px-4 py-2.5 text-sm">
  <Bell className="w-4 h-4 text-primary" />
  <span>ارسال یادآوری</span>
</button>
```
- کلاس CSS اختصاصی: `.rokad-btn-sec`
- خصوصیات: بک‌گراند `#202A5A`، بوردر `1.5px solid #182044`، سایه سخت `2.5px 2.5px 0 #0B0F1F`، متن سفید.

#### دکمه اوت‌لاین (Outline Button)
```html
<button className="rokad-btn-outline px-3.5 py-1.5 text-xs">
  <Eye className="w-3.5 h-3.5" />
  <span>مشاهده جزییات</span>
</button>
```
- کلاس CSS اختصاصی: `.rokad-btn-outline`
- خصوصیات: بک‌گراند سفید (در دارک‌مود `#161D2A`)، بوردر `#DFDFDF`، سایه `2px 2px 0 #BDBCBC`.

---

### ۷.۲ کارت‌ها و پنل‌های محتوا (Cards)
```html
<div className="rokad-card p-5">
  <h3 className="text-base font-black text-sec dark:text-white">عنوان کارت</h3>
  <p className="text-xs text-ink-normal/70 dark:text-gray-400 mt-1">متن توضیحات کارت</p>
</div>
```
- کلاس پیش‌فرض: `.rokad-card`
- انیمیشن هاور: انتقال عمودی `translateY(-2px)` همراه با بزرگ‌تر شدن سایه سخت.

---

### ۷.۳ کارت‌های آماری (Stat Cards)
برای داشبوردها و نمایش سنجه‌های کلیدی، کارت‌ها بر اساس ۵ تم پرسونا رنگ‌بندی می‌شوند:
```tsx
<StatCard
  title="کل گزارش‌های ثبت‌شده"
  value={toPersianDigits(142)}
  subtitle="افزایش ۱۲ درصدی نسبت به ماه قبل"
  icon={FileCheck2}
  theme="ecosystem"
  trend={{ value: "+۱۲٪", isPositive: true }}
/>
```
- **ویژگی‌های ساختاری:**
  - کانتینر آیکون گرد و تمیز با رنگ تم ملایم (`bg-ecosystem-light` یا `bg-male-light`).
  - ارقام برجسته با فونت `font-black text-2xl sm:text-3xl`.
  - بج تغییرات (Trend chip) با رنگ سبز `#009966` برای صعود و قرمز `#C60036` برای افت.

---

### ۷.۴ فرم‌ها و اینپوت‌ها (Form Controls)
```html
<div className="space-y-1.5">
  <label className="block text-xs font-bold text-ink-normal/80 dark:text-gray-300">
    نام کامل
  </label>
  <div className="relative">
    <input
      type="text"
      placeholder="نام همکار را وارد کنید..."
      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-[#FAFAFA] dark:bg-[#1C2536] text-ink-normal dark:text-white text-xs sm:text-sm font-medium focus:border-primary focus:bg-white dark:focus:bg-[#1C2536] focus:outline-none transition-all"
    />
  </div>
</div>
```
- گوشه‌ها: همیشه `rounded-xl`.
- بک‌گراند اینپوت: `#FAFAFA` در لایت، `#1C2536` در دارک.
- وضعیت Focus: خط حاشیه به رنگ Primary (`#59BBAF`)، تغییر نامحسوس بک‌گراند به سفید خالص.

---

### ۷.۵ نشان‌ها و بج‌های وضعیت (Badges & Chips)
بج‌ها کپسولی و بولد هستند:
```html
<!-- بج موفقیت / اکوسیستم -->
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-xs bg-ecosystem-light dark:bg-ecosystem-darker/40 text-ecosystem-darker dark:text-ecosystem-light border border-primary/30">
  <CheckCircle2 className="w-3.5 h-3.5" />
  <span>به‌موقع</span>
</span>

<!-- بج تأخیر / هشدار دخترانه -->
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-xs bg-female-light dark:bg-female-darker/40 text-female-darker dark:text-female-light border border-female-normal/30">
  <Clock className="w-3.5 h-3.5" />
  <span>با تأخیر</span>
</span>

<!-- بج کالج / پیگیری -->
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-xs bg-college-light dark:bg-college-darker/40 text-college-darker dark:text-college-light border border-college-normal/30">
  <AlertTriangle className="w-3.5 h-3.5" />
  <span>غایب</span>
</span>
```

---

### ۷.۶ پنجره‌های بازشو (Modals)
- **ساختار لایه‌بندی:**
  - Backdrop بلورین: `bg-black/50 backdrop-blur-sm fixed inset-0 z-50`
  - بدنه مدال: `rounded-3xl border-2 border-primary/40 shadow-[4px_4px_0_#202A5A] dark:shadow-[4px_4px_0_#59BBAF]`
  - انیمیشن ورود: `animate-in fade-in zoom-in-95 duration-150`
  - قابلیت خروج با کلید Escape و کلیک روی لایه پس‌زمینه همراه با مسدود کردن اسکرول صفحه (`overflow: hidden`).

---

### ۷.۷ جداول داده (Data Tables)
- محفظه جدول: دارای `overflow-x-auto` با حداقل عرض معقول برای ستون‌ها (مثلاً `min-w-[650px]`).
- کادر جدول: کانتینر دارای `rounded-2xl border shadow-[3px_3px_0_#202A5A]`.
- ردیف سرستون (Header): بک‌گراند `#F8F9FA` در لایت، `#1C2536` در دارک با فونت بولد.
- ردیف‌های داده (Body): دارای ترنزیشن ملایم روی هاور `hover:bg-gray-50/70 dark:hover:bg-[#1C2536]/50`.

---

### ۷.۸ منوی ناوبری و سایدبار (Sidebar & Navigation)
- عرض ثابت: `w-72` (۲۸۸ پیکسل)
- بوردر مرزی: `border-l border-[#EAEAEA] dark:border-gray-800`
- هدر سایدبار: ارتفاع `h-20` با لوگو، عنوان و تگ کپسولی نقش
- گروه‌بندی لینک‌ها با عناوینی نظیر «میز کار و پروژه‌ها» و «گزارش‌ها و عملکرد»
- **استایل آیتم فعال (Active Link):**
  ```html
  <Link className="flex items-center justify-between px-4 py-2.5 rounded-xl text-[14px] font-bold bg-ecosystem-light dark:bg-ecosystem-darker/60 text-ecosystem-darker dark:text-ecosystem-light border border-primary/40 shadow-[2px_2px_0_#59BBAF]">
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-primary" />
      <span>عنوان صفحه</span>
    </div>
    <ChevronLeft className="w-3.5 h-3.5 text-primary" />
  </Link>
  ```

---

### ۷.۹ نوار بالایی (Navbar / Header)
- ارتفاع ثابت: `h-20` با چیدمان `sticky top-0 z-40 bg-white/90 dark:bg-[#0B0F17]/90 backdrop-blur-md`
- المان‌های الزامی:
  1. دکمه باز و بسته کردن سایدبار (در موبایل و دسکتاپ)
  2. نمایشگر تاریخ زنده شمسی همراه با آیکون تقویم (`formatToJalali(new Date(), { showMonthName: true, includeDayName: true })`)
  3. دکمه ثبت اکشن سریع (Quick Task)
  4. دکمه تغییر حالت تم شب/روز (سوییچ آیکون Sun / Moon با ثبت در `localStorage`)
  5. منوی آبشاری پروفایل کاربر همراه با نام، نقش و کلید خروج

---

## ۸. سیستم چاپ رسمی و خروجی PDF

برای تمام صفحاتی که نیاز به گزارش‌گیری کاغذی یا تولید PDF دارند (مانند صورت‌وضعیت‌ها، گزارش غیبت و تسک‌ها)، یک استایل اختصاصی پرینت تعریف شده است که ویژگی‌های آن به شرح زیر است:

```css
@media print {
  @page {
    size: A4 portrait;
    margin: 10mm 12mm 12mm 12mm;
  }

  /* ۱. حذف کامل تم شب و اجبار به تم سفید اداری و شفاف */
  :root, html, body, .dark, .dark body {
    color-scheme: light !important;
    background: #ffffff !important;
    color: #0F172A !important;
    font-size: 10.5pt !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* ۲. مخفی کردن منوها، دکمه‌های عملیاتی و فیلترها */
  aside, header, nav, .screen-only, .no-print {
    display: none !important;
  }

  /* ۳. آشکارسازی کانتینر مخصوص چاپ */
  .print-only {
    display: block !important;
  }

  /* ۴. جدول رسمی چاپ (بدون شکستگی ردیف در انتهای صفحه) */
  .executive-table {
    width: 100% !important;
    border-collapse: collapse !important;
    font-size: 9pt !important;
  }
  .executive-table tr {
    page-break-inside: avoid !important;
  }
  .executive-table th {
    background-color: #F1F5F9 !important;
    color: #1E293B !important;
    font-weight: 800 !important;
    border: 1px solid #E2E8F0 !important;
    border-bottom: 2px solid #CBD5E1 !important;
    padding: 8px 10px !important;
    text-align: right !important;
  }
  .executive-table td {
    border: 1px solid #E2E8F0 !important;
    padding: 7px 10px !important;
  }

  /* ۵. حذف سایه‌ها برای شفافیت حداکثری پرینتر */
  * {
    box-shadow: none !important;
    text-shadow: none !important;
    transition: none !important;
    animation: none !important;
  }
}
```

---

## ۹. پیکربندی‌های آماده برای پروژه جدید

### ۹.۱ پیکربندی `tailwind.config.ts`
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#59BBAF",
        girl: "#E0195B",
        third: "#F8A41D",
        sec: "#202A5A",
        ecosystem: {
          light: "#EEF8F7",
          "light-hover": "#E6F5F3",
          "light-active": "#CCEAE6",
          normal: "#59BBAF",
          "normal-hover": "#50A89E",
          "normal-active": "#47968C",
          dark: "#438C83",
          "dark-hover": "#357069",
          "dark-active": "#28544F",
          darker: "#1F413D",
        },
        male: {
          light: "#E9EAEF",
          "light-hover": "#DEDFE6",
          "light-active": "#BABDCC",
          normal: "#202A5A",
          "normal-hover": "#1D2651",
          "normal-active": "#1A2248",
          dark: "#182044",
          "dark-hover": "#131936",
          "dark-active": "#0E1328",
          darker: "#0B0F1F",
        },
        female: {
          light: "#FCE8EF",
          "light-hover": "#FADDE6",
          "light-active": "#F5B8CC",
          normal: "#E0195B",
          "normal-hover": "#CA1752",
          "normal-active": "#B31449",
          dark: "#A81344",
          "dark-hover": "#860F37",
          "dark-active": "#650B29",
          darker: "#4E0920",
        },
        college: {
          light: "#FEF6E8",
          "light-hover": "#FEF1DD",
          "light-active": "#FDE3B9",
          normal: "#F8A41D",
          "normal-hover": "#DF941A",
          "normal-active": "#C68317",
          dark: "#BA7B16",
          "dark-hover": "#956211",
          "dark-active": "#704A0D",
          darker: "#57390A",
        },
        club: {
          light: "#F0EAF4",
          "light-hover": "#E8E0EE",
          "light-active": "#CFBEDD",
          normal: "#652D90",
          "normal-hover": "#5B2982",
          "normal-active": "#512473",
          dark: "#4C226C",
          "dark-hover": "#3D1B56",
          "dark-active": "#2D1441",
          darker: "#231032",
        },
        ink: {
          light: "#EAEAE9",
          "light-hover": "#DFDFDF",
          "light-active": "#BDBCBC",
          normal: "#292827",
          "normal-hover": "#252423",
          "normal-active": "#21201F",
          dark: "#1F1E1D",
          darker: "#0E0E0E",
        },
        accent: {
          green: "#009966",
          red: "#C60036",
          purple: "#8A38F5",
        },
      },
      fontFamily: {
        sans: ["var(--font-iransans)", "IRANSansX", "Vazirmatn", "system-ui", "sans-serif"],
      },
      fontSize: {
        xs: ["11.5px", "17px"],
        sm: ["13px", "20px"],
        base: ["14.5px", "23px"],
        md: ["16px", "25px"],
        lg: ["18px", "27px"],
        xl: ["21px", "29px"],
        "2xl": ["25px", "34px"],
        "3xl": ["30px", "39px"],
        "4xl": ["36px", "46px"],
      },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        md: "8px",
        lg: "10px",
        xl: "12px",
        "2xl": "16px",
        "3xl": "20px",
        pill: "9999px",
        full: "9999px",
      },
      boxShadow: {
        ecosystem: "2.75px 2.75px 0 #59BBAF",
        male: "2.75px 2.75px 0 #202A5A",
        female: "2.75px 2.75px 0 #E0195B",
        college: "2.75px 2.75px 0 #F8A41D",
        club: "2.75px 2.75px 0 #652D90",
        neutral: "2.75px 2.75px 0 #292827",
        "hard-sm": "2px 2px 0 rgba(41, 40, 39, 0.8)",
        "hard-md": "3px 3px 0 rgba(41, 40, 39, 0.9)",
        "hard-lg": "4px 4px 0 #202A5A",
        "dark-ecosystem": "2.75px 2.75px 0 #59BBAF",
        "dark-hard": "3px 3px 0 #59BBAF",
      },
    },
  },
  plugins: [],
};

export default config;
```

---

### ۹.۲ استایل‌های سراسری (`globals.css`)
```css
@import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-primary: #59BBAF;
  --color-girl: #E0195B;
  --color-third: #F8A41D;
  --color-sec: #202A5A;
  --text-normal: #292827;
  --font-family: var(--font-iransans), "IRANSansX", "Vazirmatn", -apple-system, sans-serif;
}

html {
  font-size: 14px;
}

@media (min-width: 640px) {
  html {
    font-size: 14.5px;
  }
}

body {
  font-family: var(--font-family);
  background-color: #F8F9FA;
  color: var(--text-normal);
  direction: rtl;
  text-align: right;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

/* کارت برند رُکاد */
.rokad-card {
  background: #FFFFFF;
  border: 1.5px solid #EAEAEA;
  border-radius: 16px;
  box-shadow: 2.75px 2.75px 0 #202A5A;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.rokad-card:hover {
  transform: translateY(-2px);
  box-shadow: 3.5px 3.5px 0 #202A5A;
}

/* دکمه اصلی سبز */
.rokad-btn-primary {
  background-color: #59BBAF;
  color: #FFFFFF;
  font-weight: 700;
  border: 1.5px solid #438C83;
  border-radius: 12px;
  box-shadow: 2.5px 2.5px 0 #1F413D;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.rokad-btn-primary:hover {
  background-color: #50A89E;
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #1F413D;
}
.rokad-btn-primary:active {
  transform: translate(1.5px, 1.5px);
  box-shadow: 1px 1px 0 #1F413D;
}

/* دکمه ثانویه سرمه‌ای */
.rokad-btn-sec {
  background-color: #202A5A;
  color: #FFFFFF;
  font-weight: 700;
  border: 1.5px solid #182044;
  border-radius: 12px;
  box-shadow: 2.5px 2.5px 0 #0B0F1F;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.rokad-btn-sec:hover {
  background-color: #1D2651;
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #0B0F1F;
}
.rokad-btn-sec:active {
  transform: translate(1.5px, 1.5px);
  box-shadow: 1px 1px 0 #0B0F1F;
}

/* دکمه اوت‌لاین */
.rokad-btn-outline {
  background-color: #FFFFFF;
  color: #292827;
  font-weight: 600;
  border: 1.5px solid #DFDFDF;
  border-radius: 12px;
  box-shadow: 2px 2px 0 #BDBCBC;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.rokad-btn-outline:hover {
  background-color: #F8F9FA;
  border-color: #292827;
  box-shadow: 2.5px 2.5px 0 #292827;
}

/* دارک مود */
.dark {
  color-scheme: dark;
}
.dark body {
  background-color: #0B0F17;
  color: #F1F5F9;
}
.dark .rokad-card {
  background: #151C28;
  border-color: #242F42;
  box-shadow: 2.75px 2.75px 0 #59BBAF;
}
.dark .rokad-btn-sec {
  background-color: #2B3875;
  border-color: #3F50A0;
  box-shadow: 2.5px 2.5px 0 #59BBAF;
}
.dark .rokad-btn-outline {
  background-color: #161D2A;
  color: #F1F5F9;
  border-color: #2D3A50;
  box-shadow: 2px 2px 0 #0F172A;
}

/* اسکرول‌بار اختصاصی */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: #F1F1F1;
}
::-webkit-scrollbar-thumb {
  background: #C4C4C4;
  border-radius: 4px;
}
.dark ::-webkit-scrollbar-track {
  background: #111827;
}
.dark ::-webkit-scrollbar-thumb {
  background: #374151;
}
```

---

### ۹.۳ توابع کمکی (`lib/utils.ts`)
```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import jalaali from "jalaali-js";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// تبدیل اعداد به ارقام فارسی
export function toPersianDigits(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return "";
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return n.toString().replace(/\d/g, (x) => persianDigits[parseInt(x, 10)]);
}

// نام ماه‌های فارسی
export const PERSIAN_MONTH_NAMES = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
];

// نام روزهای هفته فارسی
export const PERSIAN_WEEKDAY_NAMES = [
  "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه", "شنبه"
];

// فرمت تاریخ به شمسی خوانا
export function formatToJalali(
  date: Date | string | null,
  options?: { showMonthName?: boolean; includeDayName?: boolean }
): string {
  if (!date) return "-";
  let d: Date;
  if (typeof date === "string") {
    const parts = date.split("T")[0].split("-");
    if (parts.length === 3) {
      d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else {
      d = new Date(date);
    }
  } else {
    d = date;
  }

  const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const dayStr = toPersianDigits(j.jd);
  const yearStr = toPersianDigits(j.jy);

  if (options?.showMonthName) {
    const monthName = PERSIAN_MONTH_NAMES[j.jm - 1];
    if (options.includeDayName) {
      const dayName = PERSIAN_WEEKDAY_NAMES[d.getDay()];
      return `${dayName} ${dayStr} ${monthName} ${yearStr}`;
    }
    return `${dayStr} ${monthName} ${yearStr}`;
  }

  const monthStr = toPersianDigits(j.jm.toString().padStart(2, "0"));
  return `${yearStr}/${monthStr}/${dayStr.padStart(2, "۰")}`;
}
```

---

### ۹.۴ بسته‌های وابستگی الزامی (Dependencies)
برای پیاده‌سازی این سیستم در پروژه جدید، نصب این بسته‌ها کافی است:
```bash
npm install clsx tailwind-merge lucide-react jalaali-js
```
