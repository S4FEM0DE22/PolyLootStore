# เตรียม PolyLoot APK / EXE

ทั้งสองเป็น **แอปออนไลน์ที่เปิดเว็บเดิม** ไม่ใช่ Next.js แบบออฟไลน์ API, ฐานข้อมูล, Auth, อีเมล และการส่งไฟล์ยังอยู่บนเซิร์ฟเวอร์ ห้ามใส่ `.env`, รหัสแอดมิน หรือกุญแจลับลงแอป

| แพลตฟอร์ม | หน้าเริ่มต้น | เทคโนโลยี |
| --- | --- | --- |
| Android APK | หน้าร้าน `/` สำหรับลูกค้า | Native Java WebView |
| Windows EXE | `/admin/` สำหรับแอดมิน | Electron sandbox |
| เว็บ | ทั้งสองฝั่ง | Next.js เดิม ไม่เปลี่ยน |

การจำกัดหน้าภายในแอปเป็นเพียง UX ไม่ใช่ระบบกำหนดสิทธิ์ API ต้องตรวจสิทธิ์แอดมินตามเดิม แอป Windows ไม่มีรหัสแอดมินฝังไว้ และต้องล็อกอินทุกครั้งที่ session หมดอายุ

หน้าแอดมินบนเว็บมีปุ่มกลับหน้าร้านและโลโก้เป็นลิงก์ตามเดิม เฉพาะแอป Windows จะซ่อนปุ่มและทำให้โลโก้กดไม่ได้ โดยตรวจ display marker ใน User-Agent (ไม่ใช่กลไกกำหนดสิทธิ์) แอป Windows ยังคงบล็อกหน้าลูกค้าของโดเมนร้านทั้งในตัวแอปและการเปิดออกไปยังเบราว์เซอร์ การแยก UI นี้ต้อง deploy โค้ดเว็บที่อัปเดตแล้วและใช้ installer ใหม่ด้วย

## 1. ตั้ง URL เว็บจริง

ใส่ HTTPS origin ที่ deploy แล้วใน `apps/config.json` ช่อง `appUrl` เช่น `https://your-store.vercel.app` ไม่ใส่ `/admin`, query หรือ hash หรือใช้ PowerShell:

```powershell
$env:POLYLOOT_APP_URL = 'https://your-store.vercel.app'
npm run apps:check
```

URL ปัจจุบันคือ `https://poly-loot-store.vercel.app` ตามที่ผู้ใช้ยืนยัน `127.0.0.1` บนมือถือหมายถึงตัวมือถือ ไม่ใช่คอม ทั้งสองแอปต้องใช้อินเทอร์เน็ต เมื่อ deploy เว็บใหม่ UI ในแอปจะเปลี่ยนตาม แต่หากเปลี่ยนโดเมนต้อง build ใหม่

## 2. Windows installer

ต้องใช้ Node.js 22.12+ รันจากโฟลเดอร์หลัก:

```powershell
npm run desktop:install
npm run desktop:dev
npm run desktop:build
```

ผลลัพธ์: `apps/desktop/dist/PolyLoot-Admin-1.0.0-Setup.exe` เป็น Windows x64 NSIS installer ติดตั้งต่อผู้ใช้ รองรับ file picker และ download/export ของ Electron ลิงก์ไปเว็บอื่นต้องยืนยันก่อนเปิดเบราว์เซอร์ ปิด Node integration, เปิด context isolation และ sandbox ไม่มี preload bridge และปฏิเสธ permission requests

ไฟล์เริ่มต้น **ยังไม่มีลายเซ็นดิจิทัล** Windows อาจแสดง SmartScreen ก่อนเผยแพร่ควรตั้ง trusted code-signing certificate ผ่าน electron-builder ห้าม commit certificate/password ใช้รูป Poly Loot ADMIN ที่ผู้ใช้ให้เป็นไอคอนตัวแอปและ installer แล้ว

## 3. Android APK

ต้องมี Android Studio, SDK Platform 36, Build Tools 36.0.0 และ JDK 17+ เปิดโฟลเดอร์ `apps/android` ใน Android Studio กำหนด SDK ผ่าน `ANDROID_HOME` หรือ `apps/android/local.properties` ที่ถูก ignore (`sdk.dir=...`)

Gradle JVM ใช้ locale `en_US` เฉพาะ build เพื่อหลีกเลี่ยงปี พ.ศ. ใน ZIP timestamps บนเครื่อง locale ไทย ไม่เปลี่ยนภาษาเว็บหรือการตั้งค่าของเครื่อง

ใช้ Gradle wrapper 9.1.0 ที่อยู่ในโปรเจกต์ หากต้องสร้าง wrapper ใหม่ ให้ตั้ง URL แล้วรันด้วย Gradle 9.1.0 จาก `apps/android`:

```powershell
gradle wrapper --gradle-version 9.1.0 --distribution-type bin
```

สร้าง APK สำหรับทดสอบจากโฟลเดอร์หลัก:

```powershell
npm run android:debug
```

ไฟล์: `apps/android/app/build/outputs/apk/debug/app-debug.apk` รองรับ Android 8.0+ เป็น **debug APK สำหรับทดสอบเท่านั้น** ไม่ใช้เผยแพร่จริง

สำหรับ release ให้สร้างและสำรอง keystore ของคุณด้วย Android Studio เมนู **Generate Signed App Bundle or APK** หรือใช้ environment variables (ห้าม commit ค่าจริง):

```powershell
$env:POLYLOOT_KEYSTORE = 'C:/secure/polyloot-release.jks'
$env:POLYLOOT_STORE_PASSWORD = '<secret>'
$env:POLYLOOT_KEY_ALIAS = 'polyloot'
$env:POLYLOOT_KEY_PASSWORD = '<secret>'
npm run android:release
```

ไฟล์: `apps/android/app/build/outputs/apk/release/app-release.apk` เพิ่ม `versionCode` และ `versionName` ใน `app/build.gradle` เมื่ออัปเดต และใช้ signing key เดิม รัน Gradle release ตรง ๆ โดยไม่มี keystore อาจได้ APK unsigned แต่คำสั่ง root จะตรวจและป้องกันกรณีนี้

ลิงก์ดาวน์โหลดที่มี signed token และตัวอย่างฟรีเปิดในเบราว์เซอร์เพื่อบันทึกไฟล์ ไม่มี storage permission หรือ JavaScript/native bridge อัปโหลด avatar ผ่าน system image picker ได้ Email/reset/OAuth links เปิดเว็บในเบราว์เซอร์ การกลับเข้าแอปผ่าน deep link ยังไม่ได้ทำ **Google login จะได้ session ในเบราว์เซอร์ ไม่ได้ส่ง session กลับเข้าแอป ให้ใช้ email/password ในแอปจนกว่าจะทำ OAuth deep link** หน้าแอดมินถูกบล็อกใน WebView ไม่มีแถบปุ่มโหลดใหม่/เปิดเบราว์เซอร์เหนือเว็บแล้วตั้งแต่ Android 1.0.1 แต่ยังมีระบบแจ้งเตือนพร้อมปุ่มลองใหม่เมื่อเชื่อมต่อไม่ได้ ใช้รูป Poly Loot ที่ผู้ใช้ให้เป็นไอคอน launcher พร้อม adaptive icon แล้ว ดูวิธีสร้างไอคอนใหม่ใน `apps/branding/README.md`

## Checklist ก่อนเผยแพร่ (build ผ่านไม่ได้หมายถึงทดสอบครบ)

- ยืนยัน URL จริงและการตรวจสิทธิ์แอดมินที่ API
- บนมือถือ: สมัครสมาชิก, login/logout, ตะกร้า, จำลองชำระเงิน, ประวัติ, คลัง, ดาวน์โหลด, email/reset links, ปุ่ม Back, คีย์บอร์ด, หมุนจอ, offline/retry
- บน Windows: login/logout, สินค้า/upload, คำสั่งซื้อ, ลูกค้า, support, notification, CSV/JSON import/export, ย่อขยายหน้าต่าง, external navigation, offline/retry
- ทดสอบบนอุปกรณ์จริง ยังไม่มีการยืนยันผล end-to-end ในแอป native จากการเตรียมนี้
- การชำระเงินเดิมยังเป็นระบบจำลอง แอปไม่ได้เพิ่มการรับเงินจริง
- เตรียม branding, privacy policy, release signing, versioning และเงื่อนไขการเผยแพร่ก่อนแจกจ่าย

เอกสารอ้างอิง: [Android WebView](https://developer.android.com/develop/ui/views/layout/webapps/webview), [AGP 9.0 compatibility](https://developer.android.com/build/releases/agp-9-0-0-release-notes), [Electron security](https://www.electronjs.org/docs/latest/tutorial/security)
