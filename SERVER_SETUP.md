# دليل إعداد ملف Excel على الخادم

## 📋 تحضير ملف Excel

### 1. إنشاء ملف البيانات
قم بإنشاء ملف Excel جديد (.xlsx أو .xls) بالتنسيق التالي:

| كود المنتج | اسم المنتج | كمية المنتج |
|------------|------------|-------------|
| 1234567890123 | شامبو هيد أند شولدرز 400مل | 50 |
| 9876543210987 | معجون أسنان كولجيت 75مل | 75 |
| 1111222233334 | صابون لوكس 90جم | 30 |

### 2. قواعد مهمة:
- **الصف الأول**: يجب أن يحتوي على عناوين الأعمدة
- **العمود الأول**: أكواد الباركود (أرقام فقط)
- **العمود الثاني**: أسماء المنتجات (نص)
- **العمود الثالث**: الكميات (أرقام)
- **لا تترك خلايا فارغة** في البيانات الأساسية

## 🌐 رفع الملف على الخادم

### الطريقة الأولى: الاستضافة العادية
1. ارفع ملف Excel إلى مجلد على موقعك
2. تأكد من أن الملف قابل للوصول عبر URL
3. مثال: `https://yoursite.com/data/products.xlsx`

### الطريقة الثانية: GitHub (مجاني)
```bash
# خطوات الرفع على GitHub:
1. أنشئ مستودع جديد على GitHub
2. ارفع ملف Excel
3. اذهب للملف واضغط "Raw"
4. انسخ الرابط الناتج
```
**مثال رابط GitHub**: 
`https://raw.githubusercontent.com/username/repo/main/products.xlsx`

### الطريقة الثالثة: Google Drive
```bash
# خطوات الرفع على Google Drive:
1. ارفع الملف على Google Drive
2. اضغط بالزر الأيمن > مشاركة
3. غير الإعدادات إلى "أي شخص لديه الرابط"
4. احصل على رابط التحميل المباشر
```
**تحويل رابط Google Drive**:
- الرابط العادي: `https://drive.google.com/file/d/FILE_ID/view`
- رابط التحميل: `https://drive.google.com/uc?export=download&id=FILE_ID`

### الطريقة الرابعة: Dropbox
```bash
# خطوات الرفع على Dropbox:
1. ارفع الملف على Dropbox
2. احصل على رابط المشاركة
3. غير "dl=0" إلى "dl=1" في نهاية الرابط
```

## ⚙️ إعداد الخادم للـ CORS

### Apache (.htaccess):
```apache
# إضافة للملف .htaccess
Header always set Access-Control-Allow-Origin "*"
Header always set Access-Control-Allow-Methods "GET, POST, OPTIONS"
Header always set Access-Control-Allow-Headers "Content-Type, Authorization"

# السماح بتحميل ملفات Excel
<FilesMatch "\.(xlsx|xls)$">
    Header set Access-Control-Allow-Origin "*"
</FilesMatch>
```

### Nginx:
```nginx
# إضافة لملف التكوين
location ~* \.(xlsx|xls)$ {
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS';
    add_header Access-Control-Allow-Headers 'Content-Type';
}
```

### PHP (في حالة استخدام سكريبت PHP):
```php
<?php
// إضافة في بداية ملف PHP
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// تحديد نوع المحتوى
header("Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

// قراءة وإرسال الملف
readfile('path/to/your/products.xlsx');
?>
```

## 🔒 الأمان والحماية

### 1. حماية الملف:
```apache
# منع الوصول المباشر للملف إلا من التطبيق
<FilesMatch "products\.xlsx$">
    Header set Access-Control-Allow-Origin "https://yourdomain.com"
</FilesMatch>
```

### 2. استخدام Token للأمان:
```javascript
// في التطبيق
const response = await fetch(url + '?token=your_secret_token');
```

### 3. تشفير اسم الملف:
```bash
# بدلاً من products.xlsx استخدم
data_2023_encrypted_abc123.xlsx
```

## 📊 تحديث البيانات

### تحديث يدوي:
1. عدل ملف Excel على جهازك
2. ارفعه مرة أخرى ليحل محل القديم
3. استخدم زر "تحديث البيانات" في التطبيق

### تحديث تلقائي (متقدم):
```php
<?php
// سكريبت لتحديث الملف تلقائياً من قاعدة بيانات
$data = fetch_products_from_database();
create_excel_file($data, 'products.xlsx');
?>
```

## 🚀 أمثلة عملية

### مثال 1: استضافة عادية
```
الموقع: https://mystore.com
مسار الملف: /public_html/data/products.xlsx
الرابط: https://mystore.com/data/products.xlsx
```

### مثال 2: CDN
```
الخدمة: CloudFlare أو AWS CloudFront
الرابط: https://cdn.mystore.com/data/products.xlsx
```

### مثال 3: GitHub Pages
```
المستودع: github.com/username/inventory
الرابط: https://username.github.io/inventory/products.xlsx
```

## ⚠️ مشاكل شائعة وحلولها

### مشكلة: "خطأ CORS"
**الحل**: تأكد من إضافة CORS Headers للخادم

### مشكلة: "الملف غير موجود"
**الحل**: تحقق من صحة الرابط والمسار

### مشكلة: "فشل في التحميل"
**الحل**: تأكد من أن الملف يدعم HTTPS

### مشكلة: "بيانات فارغة"
**الحل**: تحقق من تنسيق ملف Excel والأعمدة

## 📝 قالب Excel جاهز

استخدم الملف المرفق `sample_products.xlsx` كقالب:
- يحتوي على 15 منتج نموذجي
- التنسيق صحيح ومجرب
- يمكنك تعديل البيانات مباشرة

---

**نصيحة**: ابدأ بملف صغير (5-10 منتجات) للتجربة، ثم أضف باقي المنتجات تدريجياً.

**للدعم**: راجع ملف README.md الرئيسي أو قسم استكشاف الأخطاء.
