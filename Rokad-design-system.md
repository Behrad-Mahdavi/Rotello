# سیستم طراحی رُکاد‌اسکول (RokadSchool Design System)

> مستخرج از فایل Figma: `rokadschool.ir` — صفحهٔ **Design System** (node `1:2`)
> یک سیستم طراحی چندتمي (Multi-Theme) مبتنی بر ۵ شخصیت برند: اکوسیستم، پسر، دختر، کالج و کلوپ.

---

## ۱. فلسفه برند (Brand Foundations)

رُکاد‌اسکول یک پلتفرم آموزشی فارسی‌زبان است. سیستم رنگی آن حول **پنج شخصیت (Persona)** چیده شده که هر کدام یک طیف کامل (Light → Normal → Dark → Darker) به‌همراه حالت‌های تعاملی (`:hover` / `:active`) دارند. این یعنی یک **Design Token** واحد می‌تواند در ۵ تم کاملاً متفاوت بازنمایی شود.

| نماد برند | کلید تم | معنی |
|---|---|---|
| 🌿 اکوسیستم | `Ecosystem` | رنگ اصلی/برند (Primary) |
| 🔵 پسر | `Male` | بخش پسران |
| 🌸 دختر | `Female` | بخش دختران |
| 🟠 کالج | `College` | بخش دانشگاه/کالج |
| 🟣 کلوپ | `Club` | بخش باشگاه/انجمن |
| ⚫ متن و عنوان | `text & title` | رنگ‌های خنثی (Neutral) |

---

## ۲. توکن‌های رنگی (Color Tokens)

### ۲.۱ رنگ‌های اصلی برند (Semantic Aliases)

این نام‌ها مستقیماً از استایل‌های فایل استخراج شده‌اند و معادل‌های تمی دارند:

| توکن | مقدار | معادل تمی |
|---|---|---|
| `Primary` | `#59BBAF` | Ecosystem / Normal |
| `Girl` | `#E0195B` | Female / Normal |
| `Third` | `#F8A41D` | College / Normal |
| `Sec` | `#202A5A` | Male / Normal |

### ۲.۲ طیف تم اکوسیستم (Ecosystem — برند اصلی)

| توکن | Hover | Active | Normal | Dark | Darker |
|---|---|---|---|---|---|
| Light | `#E6F5F3` | `#CCEAE6` | `#EEF8F7` | — | — |
| Normal | `#50A89E` | `#47968C` | `#59BBAF` | `#438C83` | `#1F413D` |
| Dark | `#357069` | `#28544F` | `#438C83` | — | — |
| Darker | — | — | `#1F413D` | — | — |

### ۲.۳ تم پسر (Male)

| توکن | Hover | Active | Normal | Dark | Darker |
|---|---|---|---|---|---|
| Light | `#DEDFE6` | `#BABDCC` | `#E9EAEF` | — | — |
| Normal | `#1D2651` | `#1A2248` | `#202A5A` | `#182044` | `#0B0F1F` |
| Dark | `#131936` | `#0E1328` | `#182044` | — | — |
| Darker | — | — | `#0B0F1F` | — | — |

### ۲.۴ تم دختر (Female)

| توکن | Hover | Active | Normal | Dark | Darker |
|---|---|---|---|---|---|
| Light | `#FADDE6` | `#F5B8CC` | `#FCE8EF` | — | — |
| Normal | `#CA1752` | `#B31449` | `#E0195B` | `#A81344` | `#4E0920` |
| Dark | `#860F37` | `#650B29` | `#A81344` | — | — |
| Darker | — | — | `#4E0920` | — | — |

### ۲.۵ تم کالج (College)

| توکن | Hover | Active | Normal | Dark | Darker |
|---|---|---|---|---|---|
| Light | `#FEF1DD` | `#FDE3B9` | `#FEF6E8` | — | — |
| Normal | `#DF941A` | `#C68317` | `#F8A41D` | `#BA7B16` | `#57390A` |
| Dark | `#956211` | `#704A0D` | `#BA7B16` | — | — |
| Darker | — | — | `#57390A` | — | — |

### ۲.۶ تم کلوپ (Club)

| توکن | Hover | Active | Normal | Dark | Darker |
|---|---|---|---|---|---|
| Light | `#E8E0EE` | `#CFBEDD` | `#F0EAF4` | — | — |
| Normal | `#5B2982` | `#512473` | `#652D90` | `#4C226C` | `#231032` |
| Dark | `#3D1B56` | `#2D1441` | `#4C226C` | — | — |
| Darker | — | — | `#231032` | — | — |

### ۲.۷ رنگ‌های خنثی / متن (Text & Title)

| توکن | Hover | Active | Light | Normal | Dark | Darker |
|---|---|---|---|---|---|---|
| text & title | `#DFDFDF` | `#BDBCBC` | `#EAEAE9` | `#292827` | `#1F1E1D` | `#0E0E0E` |

### ۲.۸ رنگ‌های کمکی (Accents)

از لایه‌های حاشیه/لوگو استخراج شدند:

| نام | مقدار | کاربرد |
|---|---|---|
| Green Accent | `#009966` | حاشیه/تأکید ثانویه |
| Red Accent | `#C60036` | حاشیه/تأکید ثانویه |
| Purple Accent | `#8A38F5` | حاشیه لوگو |

---

## ۳. تایپوگرافی (Typography)

فونت برند: **IRANSansX** (وزن Regular / ۴۰۰). مقیاس نوع با نام `D4` و نسب خطی ۱.۵× تعریف شده است.

| توکن | اندازه | ارتفاع خط (Line Height) | وزن | فونت |
|---|---|---|---|---|
| `text-xs` | 10px | 15px | 400 | IRANSansX |
| `text-sm` | 13px | 19.5px | 400 | IRANSansX |
| `text-base` | 16px | 24px | 400 | IRANSansX |
| `text-md` | 20px | 30px | 400 | IRANSansX |
| `text-lg` | 25px | 37.5px | 400 | IRANSansX |
| `text-xl` | 39px | 58.5px | 400 | IRANSansX |
| `text-2xl` | 49px | 73.5px | 400 | IRANSansX |
| `text-3xl` | 61px | 91.5px | 400 | IRANSansX |

> نکته: تمام استایل‌های متن با وزن **Regular (400)** تعریف شده‌اند؛ برای تاکید از اندازه یا رنگ استفاده کنید. جهت متن RTL است (فارسی).

---

## ۴. فاصله‌گذاری (Spacing Scale)

مقیاس پیشنهادی مبتنی بر گام ۴px (استاندارد برای رابط‌های فارسی):

| توکن | مقدار |
|---|---|
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-12` | 48px |
| `space-16` | 64px |

---

## ۵. شعاع گوشه (Border Radius)

مقادیر مشاهده‌شده در فایل (گرد شدن کارت‌ها، دکمه‌ها و تصاویر):

| توکن | مقدار | کاربرد |
|---|---|---|
| `radius-xs` | 5px | دکمه‌های کوچک / تگ |
| `radius-sm` | 8px | ورودی‌ها / کارت‌های کوچک |
| `radius-md` | 12px | کارت‌های استاندارد |
| `radius-lg` | 17px | تصاویر / بج‌ها |
| `radius-xl` | 24px | عنوان‌ها / هدر |
| `radius-2xl` | 34px | کامponent‌های بزرگ |
| `radius-pill` | 40px | پیل/دایره کامل (لوگو، آواتار) |

---

## ۶. سایه‌ها (Elevation / Shadow)

در فایل یک افکت سایه سخت (Hard Shadow) با آفست `2.75px 2.75px` و بدون Blur، به رنگ هر تم تعریف شده است — امضای بصری برند رُکاد:

| توکن | مقدار |
|---|---|
| `shadow-ecosystem` | `2.75px 2.75px 0 #59BBAF` |
| `shadow-male` | `2.75px 2.75px 0 #202A5A` |
| `shadow-female` | `2.75px 2.75px 0 #E0195B` |
| `shadow-college` | `2.75px 2.75px 0 #F8A41D` |
| `shadow-club` | `2.75px 2.75px 0 #652D90` |
| `shadow-neutral` | `2.75px 2.75px 0 #292827` |

---

## ۷. حاشیه‌ها (Border)

ضخامت‌های مشاهده‌شده: **۱px**، **۱.۵px**، **۳px**.

| توکن | مقدار | رنگ |
|---|---|---|
| `border-thin` | 1px | `#EAEAEA` (خنثی) |
| `border-mid` | 1.5px | رنگ تم (Ecosystem/Male/Female/College/Club/Neutral) |
| `border-bold` | 3px | `#59BBAF` (برند) یا رنگ تم |

---

## ۸. کامپوننت‌ها (Components)

از صفحه Design System استخراج شد:

### ۸.۱ سیستم لوگو (Logo System)
یک **Component Set** کامل با متغیرهای ترکیبی:
- شخصیت: `Ecosystem` · `Male` · `Female` · `College` · `Club` · `text & title`
- نوع لوگو: `type` (تایپ‌فیس) · `Logo-EN` · `Logo` · `Logo-FA`
- ابعاد استاندارد: ۱۲۰×۱۵۷ (یا ۱۲۰×۹۳ برای نسخه تایپ)

### ۸.۲ پترن‌ها (Patterns)
کامپوننت `Pattern` برای بافت‌های تزیینی صفحات.

### ۸.۳ پیش‌نمایش رنگ (Color Preview)
کامپوننت‌های `Color=<Persona>, Opacity=Bold|Light` برای نمایش زندهٔ تم‌ها در مستندات و صفحات فرود.

### ۸.۴ دکمهٔ اصلی (Primary)
مجموعه‌های `Prymary` / `Primery` برای دکمه‌ها و المان‌های برند‌محور.

---

## ۹. متغیرهای CSS آماده (CSS Variables)

```css
:root {
  /* Brand aliases */
  --color-primary: #59BBAF;
  --color-girl:    #E0195B;
  --color-third:   #F8A41D;
  --color-sec:     #202A5A;

  /* Ecosystem */
  --ecosystem-light:        #EEF8F7;
  --ecosystem-light-hover:  #E6F5F3;
  --ecosystem-light-active: #CCEAE6;
  --ecosystem-normal:        #59BBAF;
  --ecosystem-normal-hover:  #50A89E;
  --ecosystem-normal-active: #47968C;
  --ecosystem-dark:        #438C83;
  --ecosystem-dark-hover:  #357069;
  --ecosystem-dark-active: #28544F;
  --ecosystem-darker:      #1F413D;

  /* Male */
  --male-light:        #E9EAEF;
  --male-light-hover:  #DEDFE6;
  --male-light-active: #BABDCC;
  --male-normal:        #202A5A;
  --male-normal-hover:  #1D2651;
  --male-normal-active: #1A2248;
  --male-dark:        #182044;
  --male-dark-hover:  #131936;
  --male-dark-active: #0E1328;
  --male-darker:      #0B0F1F;

  /* Female */
  --female-light:        #FCE8EF;
  --female-light-hover:  #FADDE6;
  --female-light-active: #F5B8CC;
  --female-normal:        #E0195B;
  --female-normal-hover:  #CA1752;
  --female-normal-active: #B31449;
  --female-dark:        #A81344;
  --female-dark-hover:  #860F37;
  --female-dark-active: #650B29;
  --female-darker:      #4E0920;

  /* College */
  --college-light:        #FEF6E8;
  --college-light-hover:  #FEF1DD;
  --college-light-active: #FDE3B9;
  --college-normal:        #F8A41D;
  --college-normal-hover:  #DF941A;
  --college-normal-active: #C68317;
  --college-dark:        #BA7B16;
  --college-dark-hover:  #956211;
  --college-dark-active: #704A0D;
  --college-darker:      #57390A;

  /* Club */
  --club-light:        #F0EAF4;
  --club-light-hover:  #E8E0EE;
  --club-light-active: #CFBEDD;
  --club-normal:        #652D90;
  --club-normal-hover:  #5B2982;
  --club-normal-active: #512473;
  --club-dark:        #4C226C;
  --club-dark-hover:  #3D1B56;
  --club-dark-active: #2D1441;
  --club-darker:      #231032;

  /* Text & title (neutral) */
  --text-light:        #EAEAE9;
  --text-light-hover:  #DFDFDF;
  --text-light-active: #BDBCBC;
  --text-normal:        #292827;
  --text-normal-hover:  #252423;
  --text-normal-active: #21201F;
  --text-dark:        #1F1E1D;
  --text-darker:      #0E0E0E;

  /* Accents */
  --accent-green:  #009966;
  --accent-red:    #C60036;
  --accent-purple: #8A38F5;

  /* Typography */
  --font-family: "IRANSansX", sans-serif;
  --font-weight: 400;
  --text-xs: 10px;  --leading-xs: 15px;
  --text-sm: 13px;  --leading-sm: 19.5px;
  --text-base: 16px; --leading-base: 24px;
  --text-md: 20px;  --leading-md: 30px;
  --text-lg: 25px;  --leading-lg: 37.5px;
  --text-xl: 39px;  --leading-xl: 58.5px;
  --text-2xl: 49px; --leading-2xl: 73.5px;
  --text-3xl: 61px; --leading-3xl: 91.5px;

  /* Radius */
  --radius-xs: 5px;  --radius-sm: 8px;  --radius-md: 12px;
  --radius-lg: 17px; --radius-xl: 24px; --radius-2xl: 34px;
  --radius-pill: 40px;

  /* Spacing */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-6: 24px; --space-8: 32px; --space-12: 48px; --space-16: 64px;

  /* Border */
  --border-thin: 1px solid var(--text-light);
  --border-mid: 1.5px solid var(--color-primary);
  --border-bold: 3px solid var(--color-primary);

  /* Brand hard shadow */
  --shadow-ecosystem: 2.75px 2.75px 0 #59BBAF;
  --shadow-male:      2.75px 2.75px 0 #202A5A;
  --shadow-female:    2.75px 2.75px 0 #E0195B;
  --shadow-college:   2.75px 2.75px 0 #F8A41D;
  --shadow-club:      2.75px 2.75px 0 #652D90;
  --shadow-neutral:   2.75px 2.75px 0 #292827;
}
```

---

## ۱۰. پیکربندی Tailwind (Tailwind Theme Extension)

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#59BBAF', girl: '#E0195B', third: '#F8A41D', sec: '#202A5A',
        ecosystem: { light:'#EEF8F7', normal:'#59BBAF', dark:'#438C83', darker:'#1F413D' },
        male:      { light:'#E9EAEF', normal:'#202A5A', dark:'#182044', darker:'#0B0F1F' },
        female:    { light:'#FCE8EF', normal:'#E0195B', dark:'#A81344', darker:'#4E0920' },
        college:   { light:'#FEF6E8', normal:'#F8A41D', dark:'#BA7B16', darker:'#57390A' },
        club:      { light:'#F0EAF4', normal:'#652D90', dark:'#4C226C', darker:'#231032' },
        ink:       { light:'#EAEAE9', normal:'#292827', dark:'#1F1E1D', darker:'#0E0E0E' },
      },
      fontFamily: { sans: ['IRANSansX','sans-serif'] },
      fontSize: {
        xs:['10px','15px'], sm:['13px','19.5px'], base:['16px','24px'],
        md:['20px','30px'], lg:['25px','37.5px'], xl:['39px','58.5px'],
        '2xl':['49px','73.5px'], '3xl':['61px','91.5px'],
      },
      borderRadius: {
        xs:'5px', sm:'8px', md:'12px', lg:'17px', xl:'24px', '2xl':'34px', pill:'40px',
      },
      boxShadow: {
        ecosystem:'2.75px 2.75px 0 #59BBAF', male:'2.75px 2.75px 0 #202A5A',
        female:'2.75px 2.75px 0 #E0195B', college:'2.75px 2.75px 0 #F8A41D',
        club:'2.75px 2.75px 0 #652D90', neutral:'2.75px 2.75px 0 #292827',
      },
    },
  },
}
```

---

## ۱۱. راهنمای استفاده (Usage Rules)

1. **همیشه از توکن استفاده کنید، نه از هگز سخت.** برای تغییر تم کل سایت، فقط متغیرها را عوض کنید.
2. **انتخاب تم بر اساس بخش:** اکوسیستم = عمومی/برند، پسر/دختر = محتوای جنسیت‌محور، کالج = دانشگاهی، کلوپ = انجمن‌ها.
3. **حروف فارسی RTL** هستند؛ جهت متن را با `dir="rtl"` تنظیم کنید.
4. **سایه سخت برند** فقط برای المان‌های تاکیدی (دکمه اصلی، کارت ویژه) به کار رود؛ برای عمق معمولی از حاشیه استفاده کنید.
5. **دسترسی‌پذیری:** کنتراست متن `text-normal (#292827)` روی `text-light (#EAEAE9)` یا سفید استاندارد است؛ برای متن روی رنگ‌های Normal از سفید (#FFFFFF) استفاده کنید.

---

## ۱۲. منابع استخراج

- فایل Figma: `rokadschool.ir` (key `cblkXUCIFtCkDmNOLq9dHz`)
- صفحه: `Design System` — node `1:2`
- استایل‌های رنگی استخراج‌شده: ۶۵ توکن (۵ تم × ۴ سطح × ۳ حالت + متن)
- استایل‌های متنی: ۸ توکن (مقیاس D4)
- کامپوننت‌ست‌ها: Logo، Pattern، Primary، Color Preview
