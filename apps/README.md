# เตรียม PolyLoot APK / EXE

ทั้งสองเป็น **แอปออนไลน์ที่เปิดเว็บเดิม** ไม่ใช่ Next.js แบบออฟไลน์ API, ฐานข้อมูล, Auth, อีเมล และการส่งไฟล์ยังอยู่บนเซิร์ฟเวอร์ ห้ามใส่ `.env`, รหัสแอดมิน หรือกุญแจลับลงแอป

| แพลตฟอร์ม | หน้าเริ่มต้น | เทคโนโลยี |
| --- | --- | --- |
| Android APK | หน้าร้าน `/` สำหรับลูกค้า | Native Java WebView |
| Windows EXE | `/admin/` สำหรับแอดมิน | Electron sandbox |
| เว็บ | ทั้งสองฝั่ง | Next.js เดิม ไม่เปลี่ยน |

การจำกัดหน้าภายในแอปเป็นเพียง UX ไม่ใช่ระบบกำหนดสิทธิ์ API ต้องตรวจสิทธิ์แอดมินตามเดิม แอป Windows ไม่มีรหัสแอดมินฝังไว้ และต้องล็อกอินทุกครั้งที่ session หมดอายุ

หน้าเข้าสู่ระบบแอดมินมีเมนู **ตั้งค่าแอป** ให้เลือกธีมสว่าง/มืด/ตามอุปกรณ์และภาษาไทย/อังกฤษก่อนเข้าสู่ระบบได้ ค่าเก็บในเครื่องเดียวกับการตั้งค่าการแสดงผลหลังบ้าน ไม่เรียก API ที่มีสิทธิ์แอดมิน ไม่เปิดข้อมูลร้านหรือการแจ้งเตือน และไม่ล้างรหัสผ่านที่กำลังกรอก ใช้ได้ทั้งเว็บและแอป Windows ออนไลน์เดิมเมื่อเว็บถูก deploy ใหม่ ไม่ต้องสร้าง installer ใหม่สำหรับการเปลี่ยน UI นี้

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

### Release บนเครื่องนี้ (1.0.2)

Gradle daemon ในโปรเจกต์นี้กำหนด JetBrains JDK 25: ตั้ง `JAVA_HOME` ให้ชี้ไปยัง `jbr` ของ Android Studio ที่ใช้งานจริงก่อน build เพื่อไม่ต้องดาวน์โหลด toolchain ใหม่ (เช่นโฟลเดอร์ Android Studio ที่ติดตั้งอยู่ ไม่ใช่ path ของเวอร์ชันเก่าที่ถูกลบแล้ว)

สร้าง signed release ด้วยคีย์ส่วนตัวที่เก็บในเครื่อง:

```powershell
npm run android:release:local
```

เฉพาะการสร้างคีย์ release ใหม่ครั้งแรก ใช้ `npm run android:release:local -- --init-signing` ห้ามสร้างคีย์ใหม่แทนคีย์เดิมสำหรับแอปที่เผยแพร่แล้ว สคริปต์จะไม่เขียนทับคีย์หรือรหัสเดิม และตรวจลายเซ็นก่อนส่งออกไฟล์

ไฟล์แจกติดตั้ง: `.data/releases/PolyLoot-Customer-1.0.4.apk` พร้อม `.sha256` เป็น release APK ไม่ใช่ debug ต้องอนุญาตติดตั้งจากแหล่งที่มาของไฟล์บน Android และใช้อินเทอร์เน็ต

**สำรองทั้งโฟลเดอร์ `.data/android-signing/` ไว้ในที่ปลอดภัย**: มี `polyloot-release.p12` และ `credentials.json` สำหรับเซ็นเวอร์ชันถัดไป ไม่ส่งให้ลูกค้า ไม่อัปโหลด Git หรือแนบใน APK การเก็บสำเนาในเครื่องนี้เพียงแห่งเดียวไม่ใช่ backup

หากติดตั้ง debug APK รุ่นเดิมอยู่ จะอัปเดตทับด้วย release ไม่ได้เพราะคีย์ต่างกัน ต้องถอน debug ก่อน (ข้อมูล/session ในแอปจะหาย) ส่วน release ครั้งถัดไปต้องใช้คีย์เดิมและเพิ่ม versionCode

Android 1.0.3 เพิ่ม Google OAuth return flow ตามหัวข้อด้านล่าง การชำระเงินยังเป็นระบบจำลอง ไม่ใช่หลักฐานว่าผ่าน end-to-end ทุกฟังก์ชันบนมือถือจริง

Android 1.0.4 (versionCode 5) แก้การกลับเข้าแอปแล้วหน้าเว็บยังจำสถานะ guest: หลังตั้ง cookie สำเร็จ แอปส่งสัญญาณคงที่ให้เว็บอ่าน session จากเซิร์ฟเวอร์ใหม่แล้วแสดงบัญชีทันที ไม่ส่ง token/ข้อมูลผู้ใช้ผ่าน JavaScript หน้าเก่าที่ยังไม่มีตัวรับสัญญาณจะโหลด document ใหม่ด้วย query แทน hash อย่างเดียว หน้าโปรไฟล์/ล็อกอินไม่รอรายการสินค้า/การตั้งค่า/แจ้งเตือน และการ resume จะตรวจ session โดยไม่ล้างฟอร์มถ้าบัญชีไม่เปลี่ยน ต้อง deploy โค้ดเว็บคู่กันและติดตั้ง APK ทับด้วย release key เดิม ไม่จำเป็นต้องถอนแอปหรือล้างข้อมูล

ลิงก์ดาวน์โหลดที่มี signed token และตัวอย่างฟรีเปิดในเบราว์เซอร์เพื่อบันทึกไฟล์ ไม่มี storage permission หรือ JavaScript/native bridge อัปโหลด avatar ผ่าน system image picker ได้ Email/reset links ยังเปิดเว็บในเบราว์เซอร์ ไม่ใช่ Android password-reset deep links หน้าแอดมินถูกบล็อกใน WebView ไม่มีแถบปุ่มโหลดใหม่/เปิดเบราว์เซอร์เหนือเว็บแล้วตั้งแต่ Android 1.0.1 แต่ยังมีระบบแจ้งเตือนพร้อมปุ่มลองใหม่เมื่อเชื่อมต่อไม่ได้ ใช้รูป Poly Loot ที่ผู้ใช้ให้เป็นไอคอน launcher พร้อม adaptive icon แล้ว ดูวิธีสร้างไอคอนใหม่ใน `apps/branding/README.md`

## Google OAuth บน Android 1.0.3

1. ปุ่ม Google ใน APK เปิด system browser ไม่ใช้ embedded WebView สำหรับล็อกอิน Google
2. แอปสร้าง PKCE verifier/state แบบสุ่ม เก็บใน app-private preferences ที่ไม่รวม backup หมดอายุ 5 นาที verifier ไม่อยู่ใน URL
3. `/auth/android/start` ส่ง S256 challenge ไป Supabase และ redirect กลับ HTTPS `/auth/android/callback?state=...`
4. ผู้ใช้กด **กลับเข้าแอป PolyLoot** เพื่อเปิด `com.polyloot.customer://oauth/callback` ด้วยรหัสใช้ครั้งเดียว ไม่ใช่ access/refresh token
5. แอปตรวจ scheme/host/path/state/อายุคำขอ และ consume pending request ก่อนแลกรหัสผ่าน HTTPS `/api/customer` เซิร์ฟเวอร์ตรวจบัญชีกับ Supabase แล้วส่ง HttpOnly session cookie กลับ WebView

ต้อง deploy เว็บที่มีสอง route นี้ก่อนใช้ APK ใหม่ ตั้ง Supabase **Site URL** เป็น `https://poly-loot-store.vercel.app` และตรวจว่า redirect กลับ `https://poly-loot-store.vercel.app/auth/android/callback?state=...` ได้ หาก Site URL ต่างจากนี้ ให้เพิ่มเฉพาะ callback ของร้านใน Redirect URLs โดยรักษา state query ไม่ใช้ wildcard ทุกโดเมน ไม่ต้องอนุญาต custom scheme ใน Supabase เพราะ Supabase redirect กลับ HTTPS ก่อน

การทดสอบ mock/JVM ไม่ใช่การยืนยัน Google provider end-to-end ต้องให้เจ้าของบัญชีล็อกอินและยืนยัน consent จริงก่อนทำเครื่องหมายผ่าน ดู `BUILD_VERIFICATION.md` และ `NATIVE_ACCEPTANCE.md` บัญชีเดโมถูกปฏิเสธใน production

## Windows release ที่ต้องมีลายเซ็น

`npm run desktop:build` เป็น build สำหรับทดสอบ และอาจ unsigned **ห้ามเรียกว่า signed public release** ส่วนคำสั่งสำหรับแจกจ่ายแบบเซ็นใช้:

```powershell
# ตั้งผ่าน environment/CI secrets ไม่บันทึกรหัสผ่านลงไฟล์หรือ Git
# POLYLOOT_WINDOWS_PUBLISHER = ชื่อ publisher ตรงกับ CN ของใบรับรอง
# POLYLOOT_WINDOWS_CERT_SHA1 = thumbprint ของ CA-issued cert ใน Windows store/HSM
# หรือใช้ CSC_LINK/WIN_CSC_LINK และ CSC_KEY_PASSWORD/WIN_CSC_KEY_PASSWORD
npm run desktop:release -- --check
npm run desktop:release
```

คำสั่งนี้ต้องมีใบรับรองก่อนจึงเริ่ม build เปิด `forceCodeSigning` และ SHA-256/RFC3161 timestamp ใช้ `apps/desktop/dist-signed/` แยกจาก build ทดสอบ ตรวจ Authenticode ของ installer และ app EXE ว่า Windows เชื่อถือ มี timestamp และ publisher ตรงกันก่อนคัดลอกไป `.data/releases/` พร้อม checksum ใบรับรอง self-signed ไม่ถือเป็น public-release signing

ณ 2026-09-28 ผู้ใช้ยืนยันว่า **ยังไม่มีใบรับรอง/บัญชีเซ็น** จึงยังสร้าง EXE ที่มี trusted signature ไม่ได้ ไม่มีการซื้อใบรับรองหรือปิด SmartScreen การเซ็นด้วย CA แม้สำเร็จแล้วก็ไม่รับประกันว่าแอปใหม่จะไม่มี SmartScreen warning เพราะยังขึ้นกับ reputation อ่าน [Microsoft SmartScreen](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation) และ [code-signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options) ก่อนเลือกบริการ รวมถึงข้อจำกัดภูมิภาคของ Artifact Signing

## Checklist ก่อนเผยแพร่ (build ผ่านไม่ได้หมายถึงทดสอบครบ)

- ยืนยัน URL จริงและการตรวจสิทธิ์แอดมินที่ API
- บนมือถือ: สมัครสมาชิก, login/logout, ตะกร้า, จำลองชำระเงิน, ประวัติ, คลัง, ดาวน์โหลด, email/reset links, ปุ่ม Back, คีย์บอร์ด, หมุนจอ, offline/retry
- บน Windows: login/logout, สินค้า/upload, คำสั่งซื้อ, ลูกค้า, support, notification, CSV/JSON import/export, ย่อขยายหน้าต่าง, external navigation, offline/retry
- ทดสอบบนอุปกรณ์จริง ยังไม่มีการยืนยันผล end-to-end ในแอป native จากการเตรียมนี้
- การชำระเงินเดิมยังเป็นระบบจำลอง แอปไม่ได้เพิ่มการรับเงินจริง
- เตรียม branding, privacy policy, release signing, versioning และเงื่อนไขการเผยแพร่ก่อนแจกจ่าย

เอกสารอ้างอิง: [Android WebView](https://developer.android.com/develop/ui/views/layout/webapps/webview), [AGP 9.0 compatibility](https://developer.android.com/build/releases/agp-9-0-0-release-notes), [Electron security](https://www.electronjs.org/docs/latest/tutorial/security)
