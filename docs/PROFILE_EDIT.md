# Profile — tahrirlash (passenger & driver)

> Mobil ilovaning **Profile tab**'ida foydalanuvchi o'z ma'lumotlarini tahrir qilishi, avatar yuklashi, sessiyalarni boshqarishi va hisobni o'chirishi mumkin. Umumiy passenger dizayni — `MOBILE_DESIGN.md §8`. Bu fayl faqat **edit profil API kontrakti va UX detallarini** yig'adi.

---

## 0. Tezkor jadval

| Maqsad | Method | Path | Body / Form | Kim |
|---|---|---|---|---|
| Profilimni olish | `GET` | `/api/me` | — | Auth |
| Ism/familiya yangilash | `PATCH` | `/api/me` | `{ firstName?, lastName?, avatarUrl? }` | Auth |
| Avatar yuklash | `POST` | `/api/me/avatar` | multipart `avatar` (jpg/png) | Auth |
| Sessiyalar ro'yxati | `GET` | `/api/auth/sessions` | — | Auth |
| Sessiyani o'chirish | `DELETE` | `/api/auth/sessions/:id` | — | Auth |
| Chiqish (joriy sessiya) | `POST` | `/api/auth/logout` | `{ sessionId }` | Auth |
| O'chirish OTP so'rash | `POST` | `/api/me/deletion/request` | — | Auth |
| Hisobni o'chirish | `DELETE` | `/api/me` | `{ otpCode, reason? }` | Auth |
| Driver preferensiyalar | `PATCH` | `/api/driver/profile` | `{ smokingAllowed?, acAvailable?, musicAllowed?, petsAllowed?, bio? }` | DRIVER |

> ❌ **YO'Q (kelajak):** telefon raqamni o'zgartirish, email qo'shish, parol/PIN, ikki bosqichli autentifikatsiya.

---

## 1. `GET /api/me` — profilimni olish

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "u0000000-...",
    "phone": "+998901234567",
    "firstName": "Aziza",
    "lastName": "Karimova",
    "role": "USER",
    "registeredApp": "PASSENGER",
    "avatarUrl": "https://cdn.example.com/avatars/9f3b1c20.jpg",
    "referralCode": "SHZ4Q2",
    "balance": null,
    "createdAt": "2026-05-01T08:12:33.000Z"
  }
}
```

**Maydonlar:**
- `phone` — **o'qish uchun**, hozircha o'zgartirib bo'lmaydi
- `role` — USER / DRIVER / ADMIN
- `balance` — faqat DRIVER uchun raqam, passenger uchun `null`
- `referralCode` — referal banner uchun

---

## 2. `PATCH /api/me` — ism/familiya

**Body (kamida 1 ta maydon):**
```json
{
  "firstName": "Aziza",
  "lastName": "Karimova"
}
```

**Avatar URL'ni tozalash:**
```json
{ "avatarUrl": null }
```

> **Diqqat:** `avatarUrl` ni shu endpoint orqali `string` qilib yangilamang — to'g'ri yuklash uchun `/api/me/avatar` (multipart) ishlating. `null` qilib o'chirish mumkin.

**Validatsiya:**
- `firstName`, `lastName` — 1–50 belgi (trim)
- Hech bo'lmaganda 1 ta maydon yuborilishi shart (`400 VALIDATION_ERROR`)

**Response:** Yangilangan `User` obyekti (xuddi `GET /api/me`).

**Xatoliklar:**
| HTTP / kod | Sabab |
|---|---|
| `400 VALIDATION_ERROR` | Bo'sh body yoki noto'g'ri format |
| `401 UNAUTHORIZED` | Token muddati o'tgan |

---

## 3. `POST /api/me/avatar` — avatar yuklash

**Content-Type:** `multipart/form-data`
**Field:** `avatar` — fayl (jpg/png/webp)

**Dart misoli:**
```dart
final formData = FormData.fromMap({
  "avatar": await MultipartFile.fromFile(
    file.path,
    filename: "avatar.jpg",
    contentType: MediaType("image", "jpeg"),
  ),
});
final response = await dio.post("/api/me/avatar", data: formData);
```

**Backend xulq-atvori:**
1. R2 (S3-compatible) ga yuklaydi, prefix `avatars/`
2. Eski avatar URL bo'lsa — R2'dan **avto-o'chiradi**
3. `User.avatarUrl` ni yangi URL bilan yangilaydi

**Response:** Yangilangan `User` obyekti (yangi `avatarUrl` bilan).

**Mobil UX:**
- Manba tanlash: kamera / gallereya (`image_picker` package)
- Crop (ixtiyoriy): `image_cropper` — 1:1 nisbat
- Compress: max 1MB (R2 storage tejash uchun)
- Upload progress: Dio `onSendProgress`
- Muvaffaqiyat → cache invalidate (`CachedNetworkImage`'da `cacheKey` yangi URL)

**Xatoliklar:**
| HTTP / kod | Sabab |
|---|---|
| `400 AVATAR_REQUIRED` | Fayl yuborilmagan |
| `413 PAYLOAD_TOO_LARGE` | Fayl 5MB'dan katta (multer limit) |
| `415 UNSUPPORTED_MEDIA_TYPE` | jpg/png/webp emas |
| `502 UPLOAD_FAILED` | R2 xatosi |

---

## 4. Sessiyalar — `/api/auth/sessions`

### 4.1 Ro'yxatni olish

**`GET /api/auth/sessions`**

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "sess0000-...",
      "deviceName": "iPhone 15 Pro",
      "deviceId": "abc-device-id",
      "lastActiveAt": "2026-05-24T13:30:00.000Z",
      "expiresAt": "2026-06-23T13:30:00.000Z",
      "createdAt": "2026-05-01T09:00:00.000Z",
      "current": true
    },
    {
      "id": "sess0001-...",
      "deviceName": "Samsung Galaxy S24",
      "deviceId": "xyz-device-id",
      "lastActiveAt": "2026-05-20T18:00:00.000Z",
      "expiresAt": "2026-06-19T18:00:00.000Z",
      "createdAt": "2026-04-15T12:00:00.000Z",
      "current": false
    }
  ]
}
```

### 4.2 Sessiyani o'chirish (boshqa qurilmadan chiqarish)

**`DELETE /api/auth/sessions/:id`**

**UX:** Foydalanuvchi sessiyalar ro'yxatida o'ng tomondagi 🗑 tugmani bossa — confirm dialog → DELETE.

Joriy sessiyani o'chirsa — `POST /api/auth/logout` ishlatish maslahat (refresh token ham tozalanadi).

---

## 5. Hisobni o'chirish (2 qadam, OTP bilan)

> **Sabab:** Token o'g'irlangan bo'lsa, hujumchi hisobni o'chira olmasligi uchun **SMS tasdiqlash** majburiy (Variant B).

### 5.1 Qadam 1 — OTP so'rash

**`POST /api/me/deletion/request`**

Body bo'sh — server `req.user.phone` orqali aniqlaydi.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Tasdiqlash kodi SMS orqali yuborildi",
    "phone": "+998901234567",
    "expiresInSeconds": 120,
    "cooldownSeconds": 60
  }
}
```

**Cheklov:**
- 3 marta/soat (`429 OTP_HOURLY_LIMIT`)
- 60 soniya cooldown (`429 OTP_COOLDOWN`)
- Admin hisobni shu yo'l bilan o'chirish — `403 ADMIN_DELETE_FORBIDDEN`

### 5.2 Qadam 2 — tasdiqlash + o'chirish

**`DELETE /api/me`**

**Body:**
```json
{
  "otpCode": "4729",
  "reason": "Boshqa ilovaga o'tdim"
}
```

`reason` ixtiyoriy (max 500 belgi) — keyinchalik retention analytics uchun.

**Backend nima qiladi:**
1. OTP tekshiradi (3 noto'g'ri urinish → `401 DELETE_OTP_LOCKED`)
2. **Soft-delete:** `isActive = false`, PII anonymize qiladi (`firstName: "O'chirilgan"`, phone hash)
3. Barcha **active sessions** — o'chiradi (refresh tokens revoke)
4. Faol `OPEN/ACCEPTED/ARRIVED` orderlarni **bekor qiladi**
5. Avatar R2'dan o'chiriladi
6. Driver bo'lsa — `DriverProfile.status = BLOCKED` (financial trail saqlanadi)

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Hisob o'chirildi",
    "deletedAt": "2026-05-24T13:35:00.000Z"
  }
}
```

**Keyingi qadam (mobil):**
- Local storage to'liq tozalanadi (`SharedPreferences.clear()`)
- Auth ekraniga (`A0` splash) push qilinadi
- Toast: "Hisobingiz o'chirildi"

**Xatoliklar:**
| HTTP / kod | Sabab | UX |
|---|---|---|
| `400 VALIDATION_ERROR` | OTP formati noto'g'ri | Inline |
| `401 DELETE_OTP_NOT_FOUND` | OTP so'ralmagan yoki muddati o'tgan | "Qaytadan kod so'rang" |
| `401 DELETE_OTP_INVALID` | Kod noto'g'ri ({N} urinish qoldi) | Inline + countdown |
| `401 DELETE_OTP_LOCKED` | 3 noto'g'ri urinish | "Yangi kod so'rang" + qayta yuborish tugmasi |
| `429 OTP_COOLDOWN` | 60s ichida qayta urinish | Disabled timer |

---

## 6. Driver-only — `/api/driver/profile`

**Faqat `role=DRIVER`** uchun. Driver app'da "Mening profilim" sahifasi.

### 6.1 `GET /api/driver/profile`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "dp00000-...",
    "status": "ACTIVE",
    "smokingAllowed": false,
    "acAvailable": true,
    "musicAllowed": true,
    "petsAllowed": false,
    "bio": "Toza mashina, har kuni Toshkent–Samarqand qatnov.",
    "avgRating": 4.87,
    "totalRatings": 142
  }
}
```

### 6.2 `PATCH /api/driver/profile`

**Body (kamida 1 ta maydon):**
```json
{
  "smokingAllowed": true,
  "acAvailable": true,
  "musicAllowed": true,
  "petsAllowed": false,
  "bio": "Yangi tavsif..."
}
```

**Validatsiya:**
- 4 ta boolean maydon — ixtiyoriy
- `bio` — max 500 belgi (trim), `null` qabul qilinadi (tozalash)

**Yo'q (faqat ADMIN o'zgartirishi mumkin):**
- `status` (ACTIVE/SUSPENDED/BLOCKED)
- `avgRating`, `totalRatings` (rating tizimi avto-yangilaydi)
- `suspendedUntil`

---

## 7. Mobil Profile tab — to'liq layout

```
┌──────────────────────────────────┐
│  Profilim                        │
│                                  │
│  ┌────────────────────────────┐  │
│  │   ⭕ Avatar (tap → upload) │  │
│  │   Aziza Karimova           │  │
│  │   +998 90 123 45 67        │  │
│  │   ⭐ 4.92 (passenger rating)│ │  ← kelajak
│  └────────────────────────────┘  │
│                                  │
│  ─── Hisob ───                   │
│  📝 Ism va familiya         ▸    │  → PATCH /api/me
│  📷 Avatar o'zgartirish     ▸    │  → POST /api/me/avatar
│                                  │
│  ─── Xavfsizlik ───              │
│  📱 Sessiyalar (3)          ▸    │  → GET /api/auth/sessions
│  🚪 Chiqish                 ▸    │  → POST /api/auth/logout
│                                  │
│  ─── Sozlamalar ───              │
│  🌐 Til (O'zbekcha)         ▸    │  lokal
│  🌓 Mavzu (Auto)            ▸    │  lokal
│  🔔 Bildirishnomalar        ▸    │  lokal + push permissions
│                                  │
│  ─── Boshqalar ───               │
│  🎁 Do'st taklif qilish     ▸    │  share referralCode
│  ⓘ Ilova haqida             ▸    │  version, links
│  📜 Foydalanish shartlari   ▸    │  URL
│  🔒 Maxfiylik siyosati      ▸    │  URL
│                                  │
│  ⚠️  Hisobni o'chirish      ▸    │  qizil matn → 2-qadam OTP
└──────────────────────────────────┘
```

### 7.1 Ism o'zgartirish UX

```
┌──────────────────────────┐
│ ←  Ism va familiya       │
│                          │
│ Ism                      │
│ ┌──────────────────────┐ │
│ │ Aziza                │ │
│ └──────────────────────┘ │
│                          │
│ Familiya                 │
│ ┌──────────────────────┐ │
│ │ Karimova             │ │
│ └──────────────────────┘ │
│                          │
│ Telefon raqam            │
│ ┌──────────────────────┐ │
│ │ +998 90 123 45 67 🔒 │ │  ← read-only, o'zgartirib bo'lmaydi
│ └──────────────────────┘ │
│                          │
│ [    Saqlash       ]    │
└──────────────────────────┘
```

**Validatsiya (frontend):**
- Ism / familiya — bo'sh bo'lmasligi, max 50 belgi
- O'zgartirish bo'lmasa — "Saqlash" disabled

### 7.2 Avatar upload UX

Tap avatar / "Avatar o'zgartirish" → ActionSheet:
```
┌──────────────────────────┐
│ 📷 Kameradan suratga ol  │
│ 🖼  Gallereyadan tanlash │
│ 🗑  Avatarni o'chirish   │  ← agar mavjud bo'lsa
│                          │
│ Bekor qilish             │
└──────────────────────────┘
```

**Flow:**
1. Kamera/gallereya → fayl
2. Crop UI (1:1) → blob
3. POST `/api/me/avatar` (FormData)
4. Progress bar (0–100%)
5. Success → yangi avatar darhol ko'rinadi (`User` cache yangilanadi)

**Avatarni o'chirish:** `PATCH /api/me { "avatarUrl": null }` — backend eski R2 faylni avto-o'chiradi.

### 7.3 Hisobni o'chirish UX (Play Market 2024 talab)

**Bosqich 1 — ogohlantirish:**
```
┌──────────────────────────────┐
│ Hisobni o'chirishni xohlaysiz?│
│                              │
│ Quyidagilar yo'qoladi:       │
│ • Sayohatlar tarixi          │
│ • Saqlangan manzillar        │
│ • Reytingingiz               │
│ • Referal bonuslar           │
│                              │
│ Faol buyurtmalar avto-bekor  │
│ qilinadi.                    │
│                              │
│ [ Bekor qilish ]             │
│ [ Davom etish ]              │
└──────────────────────────────┘
```

**Bosqich 2 — OTP so'rash:**
- POST `/api/me/deletion/request`
- "+998 90 123 45 67 raqamiga SMS yuborildi" matn + 60s countdown ("Qayta yuborish")

**Bosqich 3 — kod kiritish + sabab:**
```
┌──────────────────────────────┐
│ Tasdiqlash kodi              │
│ ┌──────────────────────────┐ │
│ │  _  _  _  _              │ │
│ └──────────────────────────┘ │
│                              │
│ Sabab (ixtiyoriy)            │
│ ┌──────────────────────────┐ │
│ │ Boshqa ilovaga o'tdim    │ │
│ └──────────────────────────┘ │
│                              │
│ [  Hisobni o'chirish  ]      │  qizil tugma
└──────────────────────────────┘
```

- DELETE `/api/me` → success → `SharedPreferences.clear()` → Splash ekraniga

---

## 8. Validatsiya checklist (mobil-side)

```dart
bool canSubmitNameChange(String first, String last) {
  return first.trim().isNotEmpty &&
         first.trim().length <= 50 &&
         last.trim().isNotEmpty &&
         last.trim().length <= 50 &&
         (first.trim() != currentUser.firstName || last.trim() != currentUser.lastName);
}

bool canUploadAvatar(File f) {
  return f.lengthSync() <= 5 * 1024 * 1024 &&
         ['jpg', 'jpeg', 'png', 'webp'].contains(f.extension);
}

bool canSubmitDeletion(String otp) {
  return RegExp(r'^\d{4,8}$').hasMatch(otp);
}
```

---

## 9. Edge cases

| Holat | Yechim |
|---|---|
| Foydalanuvchi avatar yuklash paytida internetni uzdi | Toast retry, eski avatar saqlanib qoladi |
| Avatar yuklandi, lekin response keldi 502 | UX retry — backend transactional, eski URL hali ham faol |
| Ism o'zgartirildi, lekin server 500 berdi | Local optimistic update yo'q — server javobini kutish |
| Foydalanuvchi sessiyani o'chirdi, lekin u joriy sessiya edi | Auto-logout + Splash ekraniga |
| OTP eskirgandan keyin DELETE jo'natildi | `401 DELETE_OTP_NOT_FOUND` → "Qaytadan kod so'rang" |
| Foydalanuvchi hisobni o'chirib keyin qayta ro'yxatdan o'tdi | **Yangi hisob** (phone hash boshqa) — eski ma'lumotlar tiklanmaydi |
| Driver hisobini o'chirdi, lekin to'lanmagan komissiya bor | DriverProfile BLOCKED qoladi, financial trail saqlanadi |

---

## 10. Tugallanish darajasi

| Funksiya | Backend | Mobil |
|---|---|---|
| GET profile | ✅ | ⏳ |
| PATCH name | ✅ | ⏳ |
| POST avatar (multipart) | ✅ | ⏳ |
| DELETE avatar (PATCH null) | ✅ | ⏳ |
| Sessions list + delete | ✅ | ⏳ |
| Account deletion (OTP) | ✅ | ⏳ |
| Driver preferences | ✅ | ⏳ |
| ⏳ Telefon o'zgartirish | Faza 2 — eski + yangi raqam OTP | — |
| ⏳ Email qo'shish | Faza 3 | — |
| ⏳ Saved places CRUD endpoint | Faza 2 (hozir lokal SharedPrefs) | — |

---

## 11. Tegishli hujjatlar

- `MOBILE_DESIGN.md §8` — Profile tab umumiy dizayni
- `MOBILE_DESIGN.md §16` — Settings (til, mavzu, bildirishnomalar)
- `MOBILE_DESIGN.md §21` — Play Market submission (hisob o'chirish bandi)
- Swagger UI: `/api/docs/passenger`, `/api/docs/driver`

---

**So'nggi yangilanish:** 2026-05-25
