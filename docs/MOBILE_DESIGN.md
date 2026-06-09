# Rideshare Mobile — Dizayn va Flow Spetsifikatsiyasi

**Mavzu:** Passenger (yo'lovchi) ilovasi
**Navigatsiya:** Bottom Navigation Bar — 4 ta tab + markazda sariq FAB (`+`)
**Xarita:** Mapbox — buyurtma yaratish va kuzatish flow'larida

---

## 0. Tezkor xulosa

- **4 ta asosiy tab:** Home · Orders · Inbox · Profile
- **Markazda sariq dumaloq FAB (`+`)** — yangi buyurtma yaratish (xarita bilan)
- **Mapbox aniq qaerda ishlatiladi:** [+] FAB flow (pickup/dropoff tanlash), faol buyurtma kuzatish (ACCEPTED/ARRIVED/FOUND), Profil → uy manzili
- **API status:** har endpoint yonida ✅ MAVJUD yoki ⏳ KELAJAK belgilangan

---

## 1. Bottom Navigation arxitekturasi

```
┌────────────────────────────────────────────┐
│                                            │
│                                            │
│            (TAB content area)              │
│                                            │
│                                            │
│                                            │
├────────────────────────────────────────────┤
│                                            │
│                  ╭─────╮                   │  ← Markaziy FAB (cutout/elevated)
│                  │  +  │                   │     56x56, #FFB300, dropshadow
│                  ╰─────╯                   │
│   🏠      📋               🔔     👤        │   tab ikonlari
│  Home   Orders          Inbox  Profile     │   12px label
└────────────────────────────────────────────┘
```

**Texnik detallar:**

- **Bar balandligi:** 72px (safe-area exclusive)
- **FAB:** 56x56, `border-radius: 28` (to'liq dumaloq), rang `#FFB300`, ko'tarilgan (notch yoki floating), drop shadow `0 6 16 rgba(0,0,0,0.18)`
- **Tab ikon:** 24px, **active rang `#1A73E8`**, inactive `#9CA3AF`
- **Label:** 12px, regular, active'da semibold
- **Order:** Home (chap), Orders, **[+] FAB (markaz)**, Inbox, Profile (o'ng)
- **FAB tap → modal yoki stack push**: yangi buyurtma flow ochiladi (full-screen)
- Auth ekranlarida (A0–A5) bottom nav **YO'Q** — auth tugagandan keyin paydo bo'ladi

---

## 2. Brand va palitra

- **Primary:** `#1A73E8` (ko'k) — CTA, faol tab ikon
- **Accent / FAB:** `#FFB300` (sariq) — markaziy + tugma, OTP, badge
- **Success:** `#16A34A`
- **Warning:** `#F59E0B`
- **Danger:** `#DC2626`
- **Bg yorug':** `#FFFFFF`, **bg qora:** `#0F1115`
- **Surface yorug':** `#F5F7FA`, **surface qora:** `#1A1E25`
- **Text:** primary `#111827`, secondary `#6B7280`, disabled `#9CA3AF`
- **Border:** `#E5E7EB`

**Tipografika:** Inter / SF Pro — display=28, h1=22, h2=18, body=15, caption=13, tiny=11.

**Spacing:** 4px base — 4, 8, 12, 16, 20, 24, 32. Sahifa padding 16px.

**Komponentlar:**
- Tugma: 52px, radius 12
- Input: 52px, radius 12
- Card: radius 16, shadow `0 2 8 rgba(0,0,0,0.06)`
- Bottom sheet (xarita ekranlarda): radius 24 top, handle 36x4

---

## 3. Auth Flow (A0–A5)

Auth tugamaguncha bottom nav ko'rinmaydi. Stack navigatsiya.

### 3.1 Ekranlar

| # | Ekran | API ✅/⏳ |
|---|---|---|
| A0 | Splash | `GET /api/me` ✅ — token validate |
| A1 | Welcome (3 slide) | — |
| A2 | Telefon kiritish | `POST /api/auth/send-otp` ✅ |
| A3 | OTP kiritish | `POST /api/auth/verify-otp` ✅ |
| A4 | Profil to'ldirish (multipart) | `POST /api/auth/complete-register` ✅ |
| A5 | Joylashuvga ruxsat + uy manzili | `GET /api/regions` ✅, `GET /api/regions/:id/districts` ✅ |

### 3.2 A0 Splash

`accessToken` mavjud bo'lsa `GET /api/me` orqali validate → 200 bo'lsa Home tab. 401 → `POST /api/auth/refresh` ✅ urinish. Hammasi fail bo'lsa — A1.

### 3.3 A1 Welcome

3 slide, "Boshlash" → A2.

### 3.4 A2 Telefon

```
┌─────────────────────────────┐
│  ←                          │
│   Telefon raqamingiz        │
│                             │
│   ┌──────────────────────┐  │
│   │ 🇺🇿 +998 90 123 45 67│  │   masked, +998 fix
│   └──────────────────────┘  │
│                             │
│   [   Davom etish    ]      │
└─────────────────────────────┘
```

**API ✅** `POST /api/auth/send-otp { phone }`
- 200 → A3
- 429 → kutish timer

### 3.5 A3 OTP

4 katak, auto-focus next, SMS autofill (iOS `oneTimeCode`, Android SMS Retriever), oxirgi raqamda auto-submit. 60s resend cooldown.

**API ✅** `POST /api/auth/verify-otp { phone, code, deviceId, deviceName, appType: "PASSENGER" }`
- `200` → mavjud user → Home (Tab 1)
- `202` → yangi user → A4 (`registerToken`)
- `401` → "Kod noto'g'ri"
- `403 WRONG_APP` → driver app deeplink modal
- `429` → cooldown timer

### 3.6 A4 Profil (multipart)

Ism, familiya, avatar (kamera/galereya + 1:1 crop, ≤5MB), referal kod.

**API ✅** `POST /api/auth/complete-register` — **multipart/form-data**:
- `registerToken` (text), `firstName`, `lastName`, `referralCode?`, `avatar?` (jpeg/png/webp)
- `201` → A5

### 3.7 A5 Joylashuvga ruxsat + uy manzili

**Birinchi xarita ekrani.** Mapbox.

**A5a — Permission so'rash:** illyustratsiya + tugma "Ruxsat berish" → OS dialog.

**A5b — Uy manzili tanlash (Mapbox xaritasi):**

```
┌─────────────────────────────┐
│  ←   Uy manzilingiz         │
│                             │
│      🗺  MAPBOX MAP          │
│                             │
│         ┌──────┐            │   fixed center pin
│         │  📍  │            │
│         └──────┘            │
│                             │
│   ┌─[ 📍 ]─┐                │   "Joriy joylashuv" FAB
│                             │
│  ╭─────────────────────────╮│   bottom sheet
│  │ Toshkent shahri         ││   reverse-geocoded
│  │ Chilonzor               ││
│  │                         ││
│  │ [   Tasdiqlash    ]     ││
│  ╰─────────────────────────╯│
└─────────────────────────────┘
```

**API ✅** `GET /api/regions` — viloyatlar ro'yxati keshlanadi
**API ✅** `GET /api/regions/{id}/districts` — tanlangan viloyat tumanlari

**Reverse-geocode (faza 1):** Pin koordinatasini bizning DB'dagi viloyat lat/lng bilan **haversine** masofa orqali eng yaqin viloyatni topadi. Tuman keyin sheet'da manual tanlanadi.

**Faza 2 (kelajak):** Mapbox Geocoding API — aniq ko'cha-nomer.

**Saqlash (local):** `homeRegionId`, `homeDistrictId`, `homeLat`, `homeLng` (secureStorage).

Skip mumkin → keyin Profil tab'dan o'zgartiriladi.

---

## 4. Tab 1 — Home (🏠)

**Bu ekran xarita EMAS.** Bu — "feed" tipidagi sahifa: aktiv buyurtma, mashhur yo'nalishlar, oxirgi sayohatlar. Yangi buyurtma yaratish faqat [+] FAB orqali.

### 4.1 Layout

```
┌─────────────────────────────┐
│  Salom, Sherzod 👋          │   header
│  📍 Toshkent · Chilonzor    │   tap → A5b (uyni o'zgartirish)
│                             │
├─────────────────────────────┤
│  🟢 Faol buyurtma           │   (faqat aktiv order bo'lsa)
│  ┌───────────────────────┐  │
│  │ Toshkent → Samarqand  │  │
│  │ Status: Haydovchi     │  │   real-time status
│  │ yo'lda · ETA 8 daq    │  │
│  │ [Tafsilot]            │  │   tap → Order Detail (Mapbox)
│  └───────────────────────┘  │
├─────────────────────────────┤
│  Mashhur yo'nalishlar       │   horizontal scroll
│  ┌──────┐ ┌──────┐ ┌─────┐  │
│  │ TAS→ │ │ TAS→ │ │TAS→ │  │
│  │ SAM  │ │ AND  │ │ BUX │  │   tap → [+] flow ni pre-fill
│  │120k  │ │140k  │ │180k │  │
│  └──────┘ └──────┘ └─────┘  │
├─────────────────────────────┤
│  Oxirgi sayohatlaringiz     │
│  ▸ Toshkent → Samarqand     │   tap → [+] pre-fill yoki detail
│  ▸ Toshkent → Andijon       │
├─────────────────────────────┤
│  Referal: SHZ4Q2  [Nusxa]   │   compact card
└─────────────────────────────┘
                       [+] FAB ← markazda
🏠   📋        🔔   👤
```

### 4.2 API'lar

| Maqsad | API | Status |
|---|---|---|
| User ismi va avatar | `GET /api/me` | ✅ |
| Faol buyurtma | `GET /api/orders/mine?status=ACCEPTED,ARRIVED,FOUND,OPEN&limit=1` | ✅ |
| Oxirgi sayohatlar | `GET /api/orders/mine?status=FOUND&limit=5` | ✅ |
| Mashhur yo'nalishlar | `GET /api/routes` | ✅ — barcha aktiv route, frontend top N tanlaydi |
| Referal kod | `GET /api/me` ichida `referralCode` | ✅ |

### 4.3 Faol buyurtma kartochkasi

Polling: Home ekran ochiq turganda har 10s `GET /api/orders/mine?status=...&limit=1`. Faol bo'lsa ko'rsatiladi. Tap → Order Detail (Tab 2 → tracking, Mapbox bilan).

---

## 5. Markaziy [+] FAB — Buyurtma yaratish flow (Mapbox)

**FAB tap'i bilan modal/full-screen stack ochiladi:** O1 → O2 → O3 → O4.

### 5.1 O1 — Qayerga? (manzil qidirish)

```
┌─────────────────────────────┐
│  ✕   Qayerga ketmoqchisiz?  │
│  ┌────────────────────────┐ │
│  │ 🔍 Shahar, tuman...    │ │   live search
│  └────────────────────────┘ │
│                             │
│  Mashhur yo'nalishlar:      │
│   ▸ Samarqand               │
│   ▸ Andijon                 │
│   ▸ Buxoro                  │
│                             │
│  Barcha viloyatlar:         │
│   • Andijon viloyati      › │
│   • Buxoro viloyati       › │
│   • Farg'ona viloyati     › │
│   ...                       │
│                             │
│  [ 🗺 Xaritada tanlash ]    │   alternative → O2
└─────────────────────────────┘
```

**API ✅:**
- `GET /api/regions` — viloyatlar (kesh)
- `GET /api/districts` — barcha tumanlar (kesh)

Qidiruv — frontend substring match `name + region.name`.

### 5.2 O2 — Xaritada nuqta tanlash (Mapbox)

```
┌─────────────────────────────┐
│  ←   Manzilni tanlang       │
│                             │
│      🗺  MAPBOX MAP          │
│                             │
│         ┌──────┐            │   fixed center pin
│         │  🎯  │            │
│         └──────┘            │
│                             │
│  ╭─────────────────────────╮│   sheet (peek)
│  │ Samarqand shahri        ││   reverse-geocoded
│  │ Tanlangan tuman         ││
│  │                         ││
│  │ [   Tasdiqlash    ]     ││
│  ╰─────────────────────────╯│
└─────────────────────────────┘
```

**Mapbox:**
- Initial camera: tanlangan viloyat `region.lat/lng` (zoom 11)
- Pin fixed center
- `moveend` → pin lat/lng → reverse-geocode (haversine `regions`/`districts` ichidan)
- Sheet'da viloyat/tuman avto-yangilanadi

**Saqlash:** `dropoffLat`, `dropoffLng`, `dropoffAddress` (reverse-geocode natija matni: `"Samarqand, Registon ko'chasi 5"`), shuningdek `dropoffRegionId` (Route topish uchun).

> **Backend tushadi:** `pickupLat/Lng/Address` va `dropoffLat/Lng/Address` endi `POST /api/orders` body'sida yuboriladi va `Order.pickup{lat,lng,address}` / `Order.dropoff{...}` sifatida response'da qaytadi. Driver Mapbox xaritada aniq pin'ga ketadi (viloyat markazi emas).

### 5.3 O3 — "Qayerdan?" tanlash (default: uy)

Pickup default — uy manzili (A5b'da saqlangan). Tahrirlash kerak bo'lsa, O1/O2 kabi flow — yuqorida "Qayerdan?" sarlavhasi bilan.

### 5.4 O4 — Yo'l ko'rinishi + narx + parametrlar

```
┌─────────────────────────────┐
│  ←   Yo'l tafsiloti         │
│                             │
│      🗺  MAPBOX MAP          │
│                             │
│      🟢 ─────────── 🔴      │   polyline + 2 marker
│   Toshkent      Samarqand   │
│                             │
│  ╭─────────────────────────╮│   sheet (half)
│  │ Toshkent → Samarqand    ││
│  │ 🛣 308 km · ⏱ ~4 soat   ││
│  │                         ││
│  │ Narx                    ││
│  │ ┌─────────────────────┐ ││
│  │ │ 120 000 so'm   [✎]  │ ││   tahrirlanadigan
│  │ └─────────────────────┘ ││
│  │ Tavsiya: 120 000 so'm   ││   route.basePrice
│  │                         ││
│  │ 📅 Bugun, hozir      ▾ ││
│  │ 👥 1 o'rin           ▾ ││
│  │ 💬 Izoh (ixtiyoriy)  ▾ ││
│  │                         ││
│  │ [  Buyurtma berish    ] ││
│  ╰─────────────────────────╯│
└─────────────────────────────┘
```

**API ✅:**
- `GET /api/routes?fromRegionId={a}&toRegionId={b}` — `routeId`, `distanceKm`, `estimatedDurationMin`, `basePrice` topiladi
- `POST /api/orders` body:
  ```json
  {
    "routeId": "<uuid>",
    "passengerPrice": 120000,
    "seatsRequested": 1,
    "rideType": "SOLO",
    "pickupLat": 41.311081,
    "pickupLng": 69.240562,
    "pickupAddress": "Toshkent, Yunusobod, Bobur ko'chasi 12",
    "dropoffLat": 39.654009,
    "dropoffLng": 66.959882,
    "dropoffAddress": "Samarqand, Registon maydoni 5",
    "scheduledAt": null
  }
  ```
  - **`passengerPrice` MAJBURIY** — `basePrice`ning 0.3x–5x oralig'ida
  - **`pickup*` / `dropoff*`** — Mapbox'dan kelgan aniq nuqtalar (lat+lng birga; address — reverse-geocode matni). Schema-validatsiya `lat`/`lng`ni juftlikda talab qiladi.
  - `seatsRequested` default 1 (max 4)
  - `rideType` default "SOLO" (yoki "CARPOOL")
  - `scheduledAt` ixtiyoriy (oldindan bron)
  - `201` → response'da `data.pickup`, `data.dropoff` obyektlari qaytadi → Orders tab → Order Detail (tracking)
  - `400 PRICE_OUT_OF_RANGE` → "Narx 36 000–600 000 so'm oralig'ida bo'lishi kerak"
  - `400 ROUTE_INVALID` → route topilmadi yoki o'chirilgan

> **Narx validatsiyasi (frontend):** Foydalanuvchi narx kiritayotganda real-time `min`/`max`/`tavsiya` chiziqlarni ko'rsating (slider yoki +/- tugmalar). Tashqarida bo'lsa — submit disabled.

**Mapbox:**
- Polyline (faza 1 — to'g'ri chiziq, faza 2 — Mapbox Directions API)
- 2 marker (pickup yashil, dropoff qizil)
- Camera `fitBounds(pickup, dropoff)` padding 80px

---

## 6. Tab 2 — Orders (📋)

Buyurtmalar ro'yxati va detail/tracking ekran.

### 6.1 O5 — Ro'yxat (3 ta sub-tab)

```
┌─────────────────────────────┐
│   Buyurtmalarim             │
│  ┌───────────────────────┐  │
│  │ Faol │ Tugagan │ Bekor│  │   segmented control
│  └───────────────────────┘  │
│                             │
│  ┌─────────────────────┐    │
│  │ Toshkent → Samarqand│    │
│  │ 23.05.2026 · 14:30  │    │
│  │ 🟢 Yo'lda · 130k    │    │   status badge + price
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │ Toshkent → Andijon  │    │
│  │ 20.05.2026 · 09:00  │    │
│  │ ✓ Tugagan · 145k    │    │
│  │ ★ Reyting berilmagan│    │
│  └─────────────────────┘    │
│                             │
│  (pull-to-refresh)          │
└─────────────────────────────┘
🏠   📋        🔔   👤
       ▲ active
```

**API ✅:**
- Faol: `GET /api/orders/mine?status=OPEN,ACCEPTED,ARRIVED,FOUND`
- Tugagan: `GET /api/orders/mine?status=FOUND` (yoki kelajakda `COMPLETED`)
- Bekor: `GET /api/orders/mine?status=CANCELLED,EXPIRED`
- Pagination: `?page=1&limit=20` (server pagination'ni qo'llab quvvatlaydi)

Tap → O6 (status'iga qarab tafsilot/tracking yoki rating).

### 6.2 O6 — Order Detail / Tracking (Mapbox)

Status bo'yicha UI o'zgaradi.

#### O6a — OPEN (takliflar kutish)

```
┌─────────────────────────────┐
│  ←   OPEN · 11:42 qoldi     │   countdown to expiresAt
│                             │
│      🗺  MAPBOX MAP          │
│      🟢 ─────────── 🔴      │   yo'l polyline
│                             │
│  ╭─────────────────────────╮│   sheet (half)
│  │ 3 ta yangi taklif       ││
│  │ ┌─────────────────────┐ ││
│  │ │ 👤 Sherzod K. ★4.9  │ ││
│  │ │ Cobalt · 2022       │ ││
│  │ │ 125 000 so'm        │ ││
│  │ │ [Qabul] [Rad etish] │ ││
│  │ └─────────────────────┘ ││
│  │                         ││
│  │ [  Buyurtmani bekor   ] ││
│  ╰─────────────────────────╯│
└─────────────────────────────┘
```

**API ✅:**
- `GET /api/orders/{orderId}/offers` — har 5s polling (faza 2 — WebSocket)
- `POST /api/offers/{id}/accept` → O6b
- `POST /api/offers/{id}/reject` → ro'yxatdan o'chadi
- `POST /api/orders/{id}/cancel` → Orders ro'yxatga toast bilan
- `GET /api/orders/{id}` — order tafsilot (refresh)

**Mapbox:** Polyline `order.pickup.{lat,lng}` → `order.dropoff.{lat,lng}` (aniq nuqtalar — viloyat markazi emas). 2 marker (yashil pickup, qizil dropoff) + `fitBounds`. Driver live markerlar **kelajakda** (`/api/drivers/nearby` ⏳).

#### O6b — ACCEPTED (haydovchi yo'lda)

```
┌─────────────────────────────┐
│  Haydovchi yo'lda · ETA 7'  │   yashil banner top
│                             │
│      🗺  MAPBOX MAP          │
│                             │
│      🚗 → → → → 🟢          │   driver marker → pickup
│      (driver)   (siz)       │
│                             │
│  ╭─────────────────────────╮│   sheet (peek)
│  │ 👤 Sherzod K. ★4.9      ││
│  │ 🚗 Chevrolet Cobalt     ││
│  │    Oq · 01A123BC        ││
│  │                         ││
│  │ [📞 Qo'ng'iroq] [💬]    ││
│  │                         ││
│  │ Sizning OTP kodingiz:   ││
│  │       ┌─────┐           ││
│  │       │ 4729│           ││   GET /api/orders/:id .otpCode
│  │       └─────┘           ││
│  │                         ││
│  │ [  Bekor qilish  ]      ││
│  ╰─────────────────────────╯│
└─────────────────────────────┘
```

**API:**
- `GET /api/orders/{id}` ✅ — har 5s, status va `otpCode` keladi
- `POST /api/orders/{id}/cancel` ✅
- `GET /api/orders/{id}/driver-location` ⏳ **KELAJAK** — driver live marker uchun (hozir mavjud emas)

**Mapbox:**
- Driver marker animatsiyasi (`easeTo` 1s)
- Polyline driver→pickup
- "Follow camera" mode default ON, foydalanuvchi map'ni siljitsa — re-center FAB chiqadi

> **Faza 1 cheklov:** Driver position API mavjud emas → faza 1 da xarita driver markerini ko'rsatmaydi, faqat **status va ETA matn** ko'rsatiladi. Faza 2 da `/api/orders/{id}/driver-location` qo'shilgach to'liq tracking yoqiladi.

#### O6c — ARRIVED

Yuqori banner to'q yashil: **"🚖 Haydovchi yetib keldi"**. Sheet'da CTA "Tashqariga chiqing". Map'da pickup pin pulse animatsiyasi.

**API ✅:** `GET /api/orders/{id}` polling.

#### O6d — FOUND (yo'lda)

OTP karta olib tashlanadi. ETA destination'gacha. Mapbox: driver marker pickup → dropoff yo'nalishida (kelajak API bilan).

**API ✅:** `GET /api/orders/{id}` polling.

#### O6e — FOUND → Reyting (P6)

Status FOUND bo'lib turganda foydalanuvchi rating bermagani saqlansa, tugatilgan'lar bo'limidagi kartochkada "★ Reyting berilmagan" badge bilan ko'rinadi. Tap → Rating ekran.

```
┌─────────────────────────────┐
│  Sayohatingiz qanday o'tdi? │
│                             │
│   👤 Sherzod K.             │
│                             │
│    ☆  ☆  ☆  ☆  ☆           │
│                             │
│   Teglar (chip):            │
│   [Toza] [Vaqtida]          │
│   [Yoqimli] [Xavfsiz]       │
│                             │
│   ┌──────────────────────┐  │
│   │ Izoh (ixtiyoriy)     │  │
│   └──────────────────────┘  │
│                             │
│   [    Yuborish    ]        │
└─────────────────────────────┘
```

**API ✅:** `POST /api/orders/{id}/ratings { score, comment? }` → 201 → Orders ro'yxatga, toast.

---

## 7. Tab 3 — Inbox (🔔)

Bildirishnomalar — backend `notifications` moduli ✅ MAVJUD.

```
┌─────────────────────────────┐
│   Bildirishnomalar          │
│   [Hammasini o'qilgan deb]  │   PATCH /api/notifications/read-all
│                             │
│  Bugun                      │
│  ● 🆕 3 yangi taklif        │   ● = o'qilmagan (isRead=false)
│    Toshkent→Samarqand       │
│    14:32                    │
│                             │
│    ✅ Haydovchi qabul qildi  │
│    Sherzod K. 130 000       │
│    14:35                    │
│                             │
│    💰 Bonus qo'shildi        │
│    Referal: 10 000 so'm     │
│    13:10                    │
│                             │
│  Kecha                      │
│  ...                        │
│                             │
│  (pull-to-refresh)          │
└─────────────────────────────┘
🏠   📋        🔔   👤
            ▲ active (badge: 3)
```

### 7.1 API ✅ MAVJUD

| Maqsad | API |
|---|---|
| Ro'yxat (paginated) | `GET /api/notifications?page=1&limit=20&isRead=false` |
| Bittasini o'qish | `PATCH /api/notifications/{id}/read` |
| Hammasini o'qish | `PATCH /api/notifications/read-all` |

**Response shape:**
```json
{
  "success": true,
  "data": {
    "items": [
      { "id": "...", "title": "...", "body": "...", "type": "ORDER|OFFER|WALLET|SYSTEM|REFERRAL", "data": {...}, "isRead": false, "createdAt": "..." }
    ],
    "page": 1, "limit": 20, "total": 42, "totalPages": 3,
    "unreadTotal": 7
  }
}
```

`unreadTotal` — **tab badge**'da ishlatiladi.

### 7.2 Polling

Inbox tab'da: har 30s `GET /api/notifications?limit=1` orqali `unreadTotal` ni yangilash.
Boshqa tab'larda: har 60s `unreadTotal` ni tekshirish → tab badge'ini yangilash.

### 7.3 Notification turlari (type bo'yicha ikon va action)

| Type | Ikon | Tap action |
|---|---|---|
| `ORDER` | 🚗 | `data.orderId` → Order Detail |
| `OFFER` | 💬 | `data.orderId` → O6a (offers list) |
| `WALLET` | 💰 | Profile (driver only) |
| `SYSTEM` | ℹ️ | (link bo'lsa ochish) |
| `REFERRAL` | 🎁 | Referal sahifasi |

### 7.4 ⏳ KELAJAK

- Backend tarafda **event-driven trigger'lar**: order status o'zgarganda avto-notification (hozircha admin yoki cron qo'lda yaratadi)
- FCM/APNs push (server tokens'ni saqlashi va yuborishi kerak)
- WebSocket — real-time inbox badge

---

## 8. Tab 4 — Profile (👤)

```
┌─────────────────────────────┐
│   👤 [Avatar]               │
│   Sherzod Yusupov           │
│   +998 90 123 45 67         │
│   [Tahrirlash]              │   tap → P9a
│                             │
├─────────────────────────────┤
│  📍 Uy manzili              │
│     Toshkent · Chilonzor    │   tap → A5b (re-pick)
├─────────────────────────────┤
│  🎁 Referal kodingiz        │
│     SHZ4Q2  [Nusxa olish]   │
├─────────────────────────────┤
│  📜 Aktiv sessiyalar        │   tap → P9b
│  🌐 Til                     │
│  🌙 Mavzu                   │
│  ❓ Yordam                  │
│  🔒 Maxfiylik siyosati      │
├─────────────────────────────┤
│  [   Chiqish    ]           │   danger
└─────────────────────────────┘
🏠   📋        🔔   👤
                       ▲ active
```

### 8.1 API'lar

| Maqsad | API | Status |
|---|---|---|
| User ma'lumotlari | `GET /api/me` | ✅ |
| Profil tahrir (ism, familiya, avatarUrl) | `PATCH /api/me` | ✅ |
| Sessiyalar ro'yxati | `GET /api/auth/sessions` | ✅ |
| Sessiya o'chirish | `DELETE /api/auth/sessions/:id` | ✅ |
| Chiqish | `POST /api/auth/logout { sessionId }` | ✅ |
| Avatar yangilash (multipart) | `POST /api/me/avatar` (file `avatar`) | ✅ MAVJUD — R2'ga upload, eski avatar avto-o'chiriladi |
| **Hisobni o'chirish** | `DELETE /api/me { reason? }` | ✅ MAVJUD — soft delete + sessiyalar tugatiladi + faol orderlar bekor qilinadi (Play 2024 talab) |

---

## 9. Mapbox — aniq qaerda ishlatiladi

| Ekran | Maqsad | Mapbox feature | Status |
|---|---|---|---|
| **A5b** — uy manzili | GPS dan reverse-geocode | Fixed center pin + camera | ✅ Implement qilinadi |
| **O2** — manzil pin | Aniq nuqta tanlash | Fixed center pin + reverse-geocode | ✅ Implement qilinadi — lat/lng/address `POST /api/orders` ga ketadi |
| **O4** — yo'l preview | Pickup→dropoff | Polyline + 2 marker + fitBounds | ✅ Implement qilinadi (to'g'ri chiziq, faza 1) — marker'lar `pickup`/`dropoff` lat/lng dan |
| **O6a** — OPEN | Yo'l ko'rsatish | Polyline | ✅ Implement qilinadi |
| **O6b** — ACCEPTED | Driver tracking | Animated marker + follow camera | ⏳ Faza 2 — `/api/orders/:id/driver-location` kerak |
| **O6c** — ARRIVED | Pulse animatsiya | Marker pulse layer | ⏳ Faza 2 (driver pos kerak) |
| **O6d** — FOUND | Yo'l davomida | Animated marker | ⏳ Faza 2 |
| **Profil → uy** | Uyni o'zgartirish | Xuddi A5b | ✅ |

> **Faza 1 (hozirgi MVP)** uchun Mapbox **tanlash + yo'l preview + statik polyline** uchun ishlatiladi. **Driver live tracking faza 2 da** backend'da yangi endpoint qo'shilgandan keyin yoqiladi.

### 9.1 Mapbox texnik checklist

- **SDK:** `@rnmapbox/maps` (RN) yoki `mapbox_maps_flutter` (Flutter)
- **Token:** `pk.*` public — app build'iga embed
- **Style:** light = `mapbox://styles/mapbox/streets-v12`, dark = `mapbox://styles/mapbox/dark-v11`
- **Permissions:**
  - iOS: `NSLocationWhenInUseUsageDescription`
  - Android: `ACCESS_FINE_LOCATION`
- **Reverse geocode faza 1:** frontend haversine, `regions` ro'yxati orqali (DB lat/lng bizda bor)
- **Polyline faza 1:** to'g'ri chiziq (2 nuqta linestring)
- **Driver tracking faza 2:** `easeTo` 1s smooth animatsiya
- **Performance:** marker cluster (50+), tile cache 50MB max

---

## 10. Order State Machine (passenger)

```
OPEN ──takliflar──> [User Accept]
  │                       │
  │ User cancel           ▼
  │                  ACCEPTED ──driver yo'lda──> ACCEPTED (ETA update)
  │                       │
  │ Expire                ▼
  │                  ARRIVED ──driver "yetib boring" + OTP──┐
  │                       │                                  ▼
  │                       └── Driver cancel ──> CANCELLED   FOUND ──"yetdik"──> COMPLETED
  │                                                                                │
  └────────────────────────────────────────────────────────────────────────────────► RATING (P6)
```

**Status badge ranglari (UI):**

| Status | Rang |
|---|---|
| `OPEN` | Amber (`#FFB300`) + countdown |
| `ACCEPTED` | Blue (`#1A73E8`) |
| `ARRIVED` | Green light (`#16A34A`) |
| `FOUND` | Green dark |
| `CANCELLED` / `EXPIRED` | Grey |
| `DISPUTED` | Red |

---

## 11. **API STATUS TABEL** (mobil dasturchi uchun yagona reference)

### 11.1 ✅ MAVJUD — hozir ishlaydi (passenger uchun)

**Auth**
| Method | Path | Maqsad |
|---|---|---|
| POST | `/api/auth/send-otp` | OTP yuborish |
| POST | `/api/auth/verify-otp` | OTP tasdiqlash, tokens olish |
| POST | `/api/auth/complete-register` | Multipart — yangi user + avatar (ixtiyoriy) |
| POST | `/api/auth/refresh` | Token yangilash |
| POST | `/api/auth/logout` | Sessiyani tugatish |
| GET | `/api/auth/sessions` | Sessiyalar ro'yxati |
| DELETE | `/api/auth/sessions/{id}` | Sessiyani o'chirish |

**Profile**
| Method | Path | Maqsad |
|---|---|---|
| GET | `/api/me` | Mening profil |
| PATCH | `/api/me` | Profil tahriri (firstName, lastName, avatarUrl) |
| **POST** | **`/api/me/avatar`** (multipart) | **Profilda avatar almashtirish** 🆕 |
| **POST** | **`/api/me/deletion/request`** | **1-qadam — telefon raqamga OTP yuborish** 🆕🔒 |
| **DELETE** | **`/api/me`** | **2-qadam — OTP tasdiqlash bilan hisobni o'chirish (Play 2024 talab)** 🆕🔒 |

**Geografiya**
| Method | Path | Maqsad |
|---|---|---|
| GET | `/api/regions` | Barcha viloyatlar (lat/lng bilan) |
| GET | `/api/regions/{id}/districts` | Viloyat tumanlari |
| GET | `/api/districts` | Barcha tumanlar (region bilan) |
| GET | `/api/districts/by-region/{regionId}` | Alias |
| GET | `/api/districts/{id}` | Bitta tuman |

**Routes / Orders / Offers / Ratings**
| Method | Path | Maqsad |
|---|---|---|
| GET | `/api/routes?fromRegionId&toRegionId` | Route'lar (basePrice bilan) |
| POST | `/api/orders` | Yangi buyurtma (passengerPrice MAJBURIY, 0.3x–5x basePrice oralig'ida) 🔧 |
| GET | `/api/orders/mine?status&page&limit` | Mening buyurtmalarim |
| GET | `/api/orders/{id}` | Buyurtma detali (otpCode bilan, faqat ACCEPTED/ARRIVED da) |
| POST | `/api/orders/{id}/cancel` | Buyurtmani bekor qilish (reason majburiy) |
| GET | `/api/orders/{orderId}/offers` | Buyurtmaga kelgan takliflar |
| POST | `/api/offers/{id}/accept` | Taklifni qabul qilish |
| POST | `/api/offers/{id}/reject` | Taklifni rad etish |
| POST | `/api/orders/{id}/ratings` | Reyting berish (1-5 + comment) |

**Notifications 🆕**
| Method | Path | Maqsad |
|---|---|---|
| GET | `/api/notifications?page&limit&isRead` | Bildirishnomalar ro'yxati + unreadTotal |
| PATCH | `/api/notifications/{id}/read` | Bittasini o'qilgan deb belgilash |
| PATCH | `/api/notifications/read-all` | Hammasini o'qilgan |

**Disputes 🆕**
| Method | Path | Maqsad |
|---|---|---|
| POST | `/api/disputes` | Dispute ochish `{ orderId, reason, description }` |
| GET | `/api/disputes?status&page&limit` | Mening dispute'larim |
| GET | `/api/disputes/{id}` | Dispute tafsiloti |

### 11.2 🔧 DIQQAT: o'zgargan endpoint'lar

- **`POST /api/orders`** — endi `passengerPrice` **majburiy field**. `route.basePrice` ning 0.3x–5x oralig'ida bo'lishi shart. Tashqarida — `400 PRICE_OUT_OF_RANGE`. BACKEND_SPEC §Orders rule 1'ga to'liq mos.
- **`POST /api/orders` 🆕 geo maydonlar**: `pickupLat/Lng/Address`, `dropoffLat/Lng/Address`. Schema-level: `lat` va `lng` har doim juftlikda yuborilishi kerak (faqat bittasi → 422). Address — Mapbox reverse-geocode matni (max 300 chars). Hozircha optional (eski mijozlar uchun), lekin **yangi mobil versiyalar har doim yuborishi shart** — driver xaritada aniq pin'ga ketishi uchun.
- **Order response shape 🆕**: `data.pickup` va `data.dropoff` — `{ lat, lng, address }` obyektlari (yo'q bo'lsa `null`). `GET /api/orders/mine`, `GET /api/orders/{id}`, `GET /api/driver/orders/open` — barchasi shu shape'ni qaytaradi.
- **Driver `arrive` 🆕 mantig'i**: agar order'da aniq `pickupLat/Lng` bo'lsa — driver shu nuqtaga yaqin (`ARRIVAL_RADIUS_METERS` ichida) bo'lishi kerak; yo'q bo'lsa eski xulq (viloyat markazi). UX uchun ahamiyatsiz, lekin driver mobile'da "yetib keldim" tugmasi endi aniq pickup pin atrofida ishlaydi.

### 11.3 ⏳ KELAJAK (hozir mavjud emas)

| Method | Path | Nima uchun kerak |
|---|---|---|
| GET | `/api/drivers/nearby?lat&lng&radiusKm` | Home/O1 da yaqin driver markerlarini xaritada |
| GET | `/api/orders/{id}/driver-location` | O6b/c/d — live driver tracking |
| WS | `/ws/orders/{id}` | Real-time updates (polling o'rniga) |
| GET | `/api/announcements?routeId` | Driver e'lonlari ("bugun ketaman") — passenger ko'radi |
| GET | `/api/users/{id}` | Public driver profil (rating, ride history) |
| GET | `/api/orders/{id}/history` | Status tarixi (debug/transparency) |
| GET | `/api/ratings/user/{id}` | Foydalanuvchi reytingi (public) |
| GET | `/api/referrals/stats` | Necha kishi taklif qilingan + bonus statistikasi |
| Push | FCM / APNs | Backend push notification (faza 2) |
| POST | `/api/me/phone-change/{initiate,verify}` | Telefon raqamni o'zgartirish (faza 2) |

> Faza 1 da bu endpoint'lar yo'q. Mobil app polling orqali ishlashi va driver tracking'siz tugashi mumkin (faqat status va ETA matn).

### 11.3 Swagger UI

To'liq schema va misol so'rovlar: `http://localhost:3000/api/docs/passenger`

---

## 12. Xato kodlari → UX

| Code (server) | UX |
|---|---|
| `UNAUTHENTICATED` (401) | Tokens tozalash → A0 → A1 |
| `RATE_LIMITED` (429) | Toast + cooldown timer |
| `VALIDATION_ERROR` (400) | Inline xato input ostida |
| `WRONG_APP` (403) | Modal: driver app deeplink |
| `OTP_LOCKED` | "Yangi kod" → A2 |
| `DELETE_OTP_NOT_FOUND` | Toast: "Kod muddati o'tgan" → qayta `request` |
| `DELETE_OTP_INVALID` | OTP katakni qizilga, "Kod noto'g'ri (N urinish qoldi)" |
| `DELETE_OTP_LOCKED` | Toast + qayta `request` ekraniga qaytarish |
| `REFERRAL_INVALID` | A4 referal input ostida |
| `ALREADY_REGISTERED` | A2 ga qaytarish + toast |
| `ORDER_NOT_FOUND` (404) | Empty state + Orders tab |
| `LOCATION_DENIED` | Banner: "GPS o'chiq → Sozlamalar" deeplink |
| Network | Top banner + retry tugma |
| Mapbox tile fail | Map fade + caption "Internet zaif" |

---

## 13. Texnik tavsiyalar

### 13.1 Saqlash

- **Secure storage** (Keychain/EncryptedPrefs):
  - `accessToken`, `refreshToken`, `deviceId`
- **AsyncStorage/Prefs:**
  - `firstLaunch`, `homeRegionId`, `homeDistrictId`, `homeLat`, `homeLng`, `themeMode`, `mapStyle`, `lastReadInboxTs`

### 13.2 HTTP qatlami

- Interceptor `Authorization: Bearer {accessToken}`
- 401 → `POST /api/auth/refresh` (bir martalik), retry. Refresh ham fail → logout → A1
- Response shaklini wrap qiling: `{ success, data }` yoki `{ success: false, error, code, statusCode }`

### 13.3 State management

- **Auth** — global store (Redux/Zustand/Riverpod)
- **Active orders** — bir nechta faol order bo'lishi mumkin (ro'yxat sifatida saqlang)
- **Map state** — local screen state (faqat ekran ochiq turganda)

### 13.4 Polling jadval

| Ekran | API | Davriylik |
|---|---|---|
| Home | `GET /api/orders/mine?status=...&limit=1` | 10s |
| O6a (OPEN) | `GET /api/orders/{id}/offers` | 5s |
| O6a (OPEN) | `GET /api/orders/{id}` | 10s |
| O6b/c/d | `GET /api/orders/{id}` | 5s |

Ekran ekrandan chiqsa, timer'larni `clearInterval`.

### 13.5 Forma kutubxonalari

- React Native: `react-hook-form` + `zod`
- Flutter: `formz` yoki `reactive_forms`

### 13.6 Localizatsiya

- Default: `uz` (lotin)
- Sana: `dd.MM.yyyy HH:mm`, TZ `Asia/Tashkent`
- Narx: `120 000 so'm` (probel)
- Faza 2: `uz_cyrl`, `ru`

### 13.7 Sinov telefonlari

- iOS: iPhone SE (kichik), iPhone 14 Pro
- Android: Pixel 5 (low-end), Galaxy S23

---

## 14. Sprint reja

| Sprint | Davomiyligi | Mazmun | API'lar |
|---|---|---|---|
| **1** | 1 hafta | Auth A0–A4, token interceptor | `send-otp`, `verify-otp`, `complete-register`, `refresh`, `me` |
| **2** | 1 hafta | Bottom nav skeleton, A5 (Mapbox uy joyi), Profil tab | `regions`, `regions/:id/districts`, `me`, `sessions`, `logout` |
| **3** | 1.5 hafta | [+] FAB flow (O1→O4) — Mapbox tanlash + order yaratish | `regions`, `districts`, `routes`, `POST /orders` |
| **4** | 1 hafta | Orders tab (O5 ro'yxat) + O6a (OPEN + takliflar polling) | `orders/mine`, `orders/{id}/offers`, `accept`, `reject`, `cancel` |
| **5** | 1 hafta | O6b/c/d (ACCEPTED/ARRIVED/FOUND status) — Mapbox polyline, OTP, status polling | `orders/{id}` polling |
| **6** | yarim hafta | Rating (P6), Inbox local-only, Home faol kartochka | `ratings`, `orders/mine` faol filter |
| **7** | yarim hafta | Polish, dark mode QA, accessibility, empty/error states | — |
| **8 (v2)** | — | Driver live tracking, push, WebSocket, Inbox API | yangi backend endpoint'lar ⏳ |

---

## 15. To'liq passenger funktsiyalari (qo'shimcha ekranlar)

### 15.1 Saqlangan joylar (Saved Places)

**Path:** Profile tab → "Saqlangan joylar"

```
┌─────────────────────────────┐
│  ←   Saqlangan joylar       │
│                             │
│  🏠 Uy                      │
│     Chilonzor, 12-kvartal   │
│     [Tahrirlash] [O'chirish]│
│                             │
│  💼 Ish                     │
│     Tanlanmagan             │
│     [Tanlash]               │
│                             │
│  + Yangi joy qo'shish       │   tap → modal "Nom" + xarita
└─────────────────────────────┘
```

- Default: **Uy** (A5b'da to'ldirilgan) + **Ish** (bo'sh, foydalanuvchi to'ldiradi)
- Custom: foydalanuvchi yangi nom bilan istalgancha joy saqlay oladi
- Saqlash: **local prefs** (faza 1)
- API ⏳ KELAJAK: `GET /api/me/saved-places`, `POST/PUT/DELETE /api/me/saved-places/:id`
- **Mapbox** ishlatiladi — joy tanlash xuddi O2 kabi

Home ekrandagi tezkor chip'lar ham shu yerdan keladi: `[🏠 Uy] [💼 Ish] [+ Boshqa]`.

### 15.2 Chat haydovchi bilan

**Path:** O6b/c/d → 💬 tugma

Hozirgi backend'da chat endpoint **yo'q** ⏳. Faza 1 da quyidagi yondashuv:

1. **Telefon qo'ng'iroq** (📞) — `tel:+998901234567` deeplink, OS native dialer ochiladi
2. **WhatsApp deeplink** (qo'shimcha) — `https://wa.me/998901234567`
3. **Chat tugmasi** faza 2 da yoqiladi

**Faza 2 ⏳:**
- `GET /api/orders/{id}/messages`
- `POST /api/orders/{id}/messages { text }`
- `WS /ws/orders/{id}/chat` real-time
- UI: WhatsApp uslubidagi chat (oddiy)

### 15.3 SOS / Favqulodda yordam

**Path:** O6c/d (FOUND status'da) → 🚨 tugma sheet ichida

```
┌─────────────────────────────┐
│   🚨 Favqulodda yordam      │
│                             │
│   Quyidagilardan birini     │
│   tanlang:                  │
│                             │
│  [📞 102 — Politsiya]       │   tel:102
│  [📞 103 — Tez yordam]      │   tel:103
│  [📞 112 — Yagona xizmat]   │   tel:112
│                             │
│  [📍 Joylashuvni do'stga    │   share sheet
│      yuborish]              │   joriy GPS + ETA
│                             │
│  ✕ Bekor qilish             │
└─────────────────────────────┘
```

**Hold-to-confirm pattern:** Tugma 1.5s ushlab turilganda ishga tushadi (tasodifiy bosishdan himoya).

**Joylashuvni yuborish:** OS Share Sheet, matn `"Men yo'lda. Joylashuvim: https://maps.google.com/?q={lat},{lng}. Buyurtma: {orderId}"`.

**Faza 2 ⏳:** `POST /api/orders/{id}/sos { type, lat, lng }` — backend admin'ga alert yuboradi.

### 15.4 Referal (do'st taklif qilish)

**Path:** Home pastida yoki Profile → "Referal kodingiz"

```
┌─────────────────────────────┐
│   🎁 Do'stlaringizni        │
│       taklif qiling          │
│                             │
│   Har bir do'stingiz uchun  │
│   5 000 so'm bonus oling.   │
│                             │
│   Sizning kodingiz:         │
│   ┌─────────────┐           │
│   │  SHZ4Q2     │ [Nusxa]   │
│   └─────────────┘           │
│                             │
│  [📤 Ulashish]              │   OS share sheet
│                             │
│  Taklif qilganlar: 3        │   GET /api/me referrals
│  Olgan bonus: 15 000 so'm   │   ⏳ kelajak field
└─────────────────────────────┘
```

**Share matni:**
```
Salom! Rideshare ilovasiga qo'shiling va arzon yo'l toping.
Mening kodim: SHZ4Q2
Yuklab olish: https://rideshare.uz/app
```

**API ✅:** `GET /api/me` → `referralCode`
**API ⏳:** referral count va bonus statistikasi `GET /api/me/referrals`

### 15.5 Qidiruv tarixi

**O1 (Qayerga?) ekranida:**

- Oxirgi 10 ta tanlangan manzil local prefs'da saqlanadi (`recentDestinations`)
- "Tozalash" tugmasi sozlamalardan

### 15.6 Buyurtma haqida xabar berish (Report / Dispute)

**Path:** O6 (har qanday status) → ⋯ menyu → "Muammo bor"

```
┌─────────────────────────────┐
│  ←   Muammo bo'yicha xabar  │
│                             │
│  Sabab tanlang:             │
│  ◯ Haydovchi kelmadi        │
│  ◯ Notinch yoki qo'pol      │
│  ◯ Mashina holati yomon     │
│  ◯ Boshqa narx talab qildi  │
│  ◯ Boshqa sabab             │
│                             │
│  Tafsilot:                  │
│  ┌──────────────────────┐   │
│  │                      │   │
│  └──────────────────────┘   │
│                             │
│  📎 Rasm biriktirish        │   ixtiyoriy
│                             │
│  [   Yuborish    ]          │
└─────────────────────────────┘
```

**API ✅ MAVJUD:**
- `POST /api/disputes { orderId, reason, description }` — 201
- `GET /api/disputes?status&page&limit` — mening dispute'larim
- `GET /api/disputes/{id}` — bitta dispute tafsiloti

**Validatsiya:**
- `reason`: 3-100 belgi (qisqa)
- `description`: 10-2000 belgi (batafsil)
- `orderId`: faqat ACCEPTED/ARRIVED/FOUND/CANCELLED holatdagi orderlarga
- Bir order'ga foydalanuvchi bittadan ortiq ochiq dispute ocha olmaydi (`409 DISPUTE_ALREADY_OPEN`)

**Status'lar:**
- `OPEN` — admin hali ko'rmagan
- `REVIEWING` — admin ko'rib chiqyapti
- `RESOLVED` — hal qilindi (resolution matn ko'rinadi)
- `REJECTED` — rad etildi

Foydalanuvchi Profile → "Mening dispute'larim" orqali statusni kuzatishi mumkin.

---

## 16. Sozlamalar (Settings) — to'liq

**Path:** Profile tab → ⚙ Sozlamalar

```
┌─────────────────────────────┐
│   Sozlamalar                │
│                             │
│  Hisob                      │
│  ▸ Telefon raqamni o'zgart. │   ⏳ kelajak
│  ▸ Maxfiy ma'lumotlar       │
│  ▸ Sessiyalar               │   GET /api/auth/sessions ✅
│                             │
│  Bildirishnomalar           │
│  ▸ Push (master switch)     │   OS settings deeplink
│  ▸ Buyurtma yangiliklari ☑  │   local pref
│  ▸ Promo / chegirma     ☐  │
│  ▸ Tovush                ☑  │
│  ▸ Vibratsiya            ☑  │
│                             │
│  Ko'rinish                  │
│  ▸ Til                Uz ▾  │
│  ▸ Mavzu          Tizim ▾   │
│  ▸ Xarita uslubi  Yorug' ▾  │
│                             │
│  Maxfiylik va xavfsizlik    │
│  ▸ Joylashuvga ruxsat       │   OS settings deeplink
│  ▸ Hisobni o'chirish        │   ⏳ kelajak
│                             │
│  Yordam va ma'lumot         │
│  ▸ Tez-tez so'raladigan     │
│    savollar                 │
│  ▸ Biz bilan bog'lanish     │
│  ▸ Foydalanish shartlari    │
│  ▸ Maxfiylik siyosati       │
│  ▸ Versiya 1.0.0 (123)      │
└─────────────────────────────┘
```

### 16.1 Til o'zgartirish

Modal bottom sheet: O'zbek (lotin), Ўзбек (kirill, faza 2), Русский (faza 2). Tanlangach app reload qilinadi.

### 16.2 Mavzu

- Tizim (default)
- Yorug'
- Qora

Mapbox style mavzu o'zgarishi bilan avto-almashtirilsin.

### 16.3 Bildirishnoma sozlamalari

Faza 1 — local prefs (polling natijasini filterlash uchun). Faza 2 — push tokenlar bilan birga backend'ga yuboriladi.

### 16.4 Hisobni o'chirish ✅ MAVJUD

```
┌─────────────────────────────┐
│   ⚠ Hisobni o'chirish        │
│                             │
│   Hisobingiz va barcha      │
│   ma'lumotlaringiz          │
│   o'chiriladi. Buni qaytib  │
│   tiklab bo'lmaydi.         │
│                             │
│   Sabab (ixtiyoriy):        │
│   ┌──────────────────────┐  │
│   └──────────────────────┘  │
│                             │
│   [Bekor]  [Tasdiqlash]     │
└─────────────────────────────┘
```

**2-qadamli OTP tasdiqlash flow ✅ MAVJUD:**

**1-qadam:** `POST /api/me/deletion/request`
- Server foydalanuvchi telefon raqamiga 4 raqamli OTP yuboradi
- Alohida Redis key (`otp:delete:{phone}`) — login OTP bilan to'qnashmaydi
- Cap: 3 marta/soat (login'dan kam, abuse'dan himoya)
- Response: `{ message, phone, expiresInSeconds, cooldownSeconds }`

**2-qadam:** `DELETE /api/me { otpCode, reason? }`
- `otpCode` **majburiy** — 4–8 raqamli
- Server: `verifyDeletionOtp(phone, code)`
  - To'g'ri → davom
  - 3 marta noto'g'ri → `401 DELETE_OTP_LOCKED` (yangi kod so'rash kerak)
  - Muddati o'tgan → `401 DELETE_OTP_NOT_FOUND`

**Backend nima qiladi (OTP to'g'ri bo'lgach):**
1. `cancelUserActiveOrders` — barcha OPEN/ACCEPTED/ARRIVED orderlarni bekor qiladi
2. `deleteAllUserSessions` — barcha sessiyalar tugatiladi (boshqa qurilmalar ham logout bo'ladi)
3. `user.update`: `isActive=false`, phone anonymize qilinadi (`deleted_<id>@rideshare.local`), firstName="O'chirilgan", lastName="Foydalanuvchi", avatar = null
4. R2'dan avatar fayli o'chiriladi
5. Wallet/order history saqlab qolinadi (financial audit trail)

**Mobile UX flow:**

```
"Hisobni o'chirish" tap
   ↓
Modal: ogohlantirish + sabab (ixtiyoriy) + [Davom etish]
   ↓
POST /api/me/deletion/request → "Kod {phone} ga yuborildi"
   ↓
OTP modal (4 katak, auto-fill) + cooldown counter
   ↓
DELETE /api/me { otpCode, reason }
   ↓
✅ Toast "Hisob o'chirildi" → tokens tozalash → A1 (Welcome)
```

**Frontend:** muvaffaqiyatdan keyin tokens'ni o'chiring va A1'ga qaytaring.

> **Faza 2 ⏳:** 30 kun grace period (yangi `pendingDeletionAt` field) — foydalanuvchi shu vaqt ichida cancel qila olishi. Hozircha darhol amal qiladi.

### 16.5 Telefon raqamni o'zgartirish ⏳

Hozircha **yo'q**. Foydalanuvchi support orqali so'rashi kerak. Faza 2 da:
- `POST /api/me/phone-change/initiate { newPhone }` → OTP yangi raqamga
- `POST /api/me/phone-change/verify { code }` → almashtirish

---

## 17. App-level pattern'lar

### 17.1 Deep linking

**Universal links / App links:**

| Pattern | Action |
|---|---|
| `rideshare://order/{id}` | Order detail ochish |
| `rideshare://referral/{code}` | A4 referal kodi avto-fill |
| `rideshare://invite` | Share sheet |
| `https://rideshare.uz/app/order/{id}` | OS — agar app o'rnatilgan bo'lsa, oching; yo'q bo'lsa store |

iOS — `Associated Domains` + AASA fayl backend'da. Android — `assetlinks.json`.

### 17.2 Offline rejim

- **Auth ekranlar:** offline'da "Internet kerak" banner
- **Home/Orders:** oxirgi keshlangan ma'lumotlarni ko'rsatish + "Yangilash uchun internet kerak" toast
- **[+] FAB:** offline'da disabled, tap'da toast
- **O6 (faol order):** keshlangan ma'lumot ko'rsatiladi, polling pauza, internet qaytsa avto-resume
- **Mapbox:** tile cache ishlatiladi (oxirgi ko'rilgan joylar)

### 17.3 App life-cycle

| Event | Harakat |
|---|---|
| App foreground'ga keldi | Token validate, faol order refresh |
| App background'ga ketdi | Polling timer'larni pauza, Mapbox location pause |
| App background'da 5+ daqiqa | Foreground'da to'liq refresh |
| Telefon qulflandi | Polling stop |

### 17.4 App version / update prompt

**Faza 1:** `GET /api/health` response'iga `minVersion` field qo'shish ⏳ — agar joriy versiya kichik bo'lsa, modal majburiy update.

**Faza 2:** In-app review prompt (sayohatdan keyin random ehtimol bilan).

### 17.5 Loading skeleton'lar

Har ekran uchun:

| Ekran | Skeleton |
|---|---|
| Home | 1 ta "faol order" placeholder card + 3 ta horizontal route card |
| Orders ro'yxat | 5 ta order card placeholder |
| O6 (har qanday) | Sheet'da metainfo qatorlar |
| Profil | Avatar circle + 2 qator + 4 ta menu item |
| Inbox | 5 ta xabar card |

### 17.6 Empty state'lar

| Ekran | Bo'sh holat |
|---|---|
| Home — faol order yo'q | Card chiqmaydi, faqat "Mashhur yo'nalishlar" ko'rinadi |
| Home — recent yo'q | "Hozircha sayohat qilmagansiz" + "[+] Birinchi buyurtmani bering" |
| Orders ro'yxat — bo'sh | 📋 ikon + "Hali buyurtma bermagansiz" + "[+] Yangi buyurtma" tugma |
| O6a — taklif yo'q | "Hozircha taklif yo'q. Sabr qiling — odatda 1-2 daq" + spinner |
| Inbox — bo'sh | 🔔 ikon + "Bildirishnomalar shu yerda paydo bo'ladi" |
| Profil → sessiyalar | "Faqat shu qurilma faol" |

### 17.7 Modal va sheet pattern'lar

- **Modal full-screen:** O6 har qanday status uchun (custom dismiss yoki "✕")
- **Bottom sheet (3 snap):** Mapbox bilan ishlovchi barcha ekranlar (A5b, O2, O4, O6a-d)
- **ActionSheet:** Avatar tanlash, share sheet
- **Alert dialog:** Tasdiqlash (bekor qilish, hisobni o'chirish, sign-out)
- **Toast:** kichik feedback (1-3s), tepa yoki past
- **Snackbar bilan action:** "Buyurtma bekor qilindi" + "Bekor qilish" (undo, faza 2)

### 17.8 Permission re-request flow

Foydalanuvchi GPS'ni rad etgan bo'lsa:

```
┌─────────────────────────────┐
│  📍 GPS ruxsati kerak       │
│                             │
│  Yaqin haydovchilarni topish│
│  va manzilni belgilash uchun│
│  joylashuvga ruxsat bering. │
│                             │
│  [Sozlamalarni ochish]      │   OS settings deeplink
│  Keyinroq                   │
└─────────────────────────────┘
```

Bu A5'da, [+] FAB tap'da yoki O2'da ko'rinadi.

---

## 18. Analytics event'lar (taklif)

Backend yoki 3rd-party (Mixpanel, Amplitude, Firebase Analytics) ga yuborilishi:

| Event | Property'lar |
|---|---|
| `app_open` | `version`, `os`, `device` |
| `auth_otp_sent` | `phone_country` |
| `auth_login_success` | `is_new_user`, `app_type` |
| `auth_register_complete` | `had_referral`, `had_avatar` |
| `home_view` | `has_active_order` |
| `fab_tap` | — |
| `order_destination_selected` | `region_id`, `district_id`, `via_search\|via_map` |
| `order_create` | `route_id`, `passenger_price`, `scheduled` |
| `order_create_success` | `order_id` |
| `offer_accept` | `order_id`, `offer_id`, `price_diff_pct` |
| `order_cancel` | `order_id`, `status_at_cancel` |
| `rating_submit` | `order_id`, `score`, `had_comment` |
| `referral_share` | `channel` |

---

## 19. Xavfsizlik checklist

- **Tokens:** faqat secure storage (Keychain, EncryptedSharedPrefs). LocalStorage taqiqlangan.
- **Certificate pinning:** production'da TLS pin (Mapbox + own API)
- **Jailbreak / root detection:** ogohlantirish (login bloklanmaydi, faqat warning)
- **Screenshot bloklash:** OTP ekrani va karta ekranida (faza 2 — wallet)
- **Clipboard:** OTP avto-paste qilindi, ammo manually tozalash (`FLAG_SECURE` Android)
- **Logs:** prod build'da console log o'chiq, faqat crashlytics
- **Backend:** OWASP top 10 — backend tarafidan kuratsiya qilingan
- **Mapbox token:** public token'ni domain'ga bog'lab qo'ying (Mapbox dashboard)

---

## 20. QA va launch checklist

### 20.1 Critical paths (smoke test)

- [ ] Yangi telefon raqam bilan ro'yxatdan o'tish (A1 → A6)
- [ ] Mavjud foydalanuvchi login (A2 → A3 → Home)
- [ ] [+] FAB → manzil tanlash → buyurtma yaratish
- [ ] Order qabul qilish → tracking → rating
- [ ] Logout va qayta login

### 20.2 Edge cases

- [ ] OTP 5 marta noto'g'ri
- [ ] Telefon allaqachon driver sifatida ro'yxatda (`WRONG_APP`)
- [ ] Internet uzilib qoldi sayohat o'rtasida
- [ ] Faol order ekran ochiq turganda 30 daq foreground/background
- [ ] GPS rad etilgan holat
- [ ] Mapbox tile yuklanmadi (slow 3G)
- [ ] Dark mode — har ekran
- [ ] Til o'zgartirish
- [ ] Notch / kichik ekran (iPhone SE)
- [ ] System font kattalashtirilgan (a11y)

### 20.3 Performance

- [ ] Cold start ≤ 2.5s (mid-tier qurilma)
- [ ] FAB tap → Mapbox ekran ≤ 1s
- [ ] 60fps map pan/zoom
- [ ] Memory < 200MB (idle)

### 20.4 Store release

- [ ] App icon (1024x1024)
- [ ] Screenshot'lar (6 ta, har til uchun)
- [ ] App description (uz/ru)
- [ ] Privacy policy URL
- [ ] Support email
- [ ] Mapbox attribution sahifasi ("Sozlamalar → Atributlar")

---

## 21. Play Market (Google Play) submission checklist

> Bu bo'lim — ilovani Play Console'ga qo'yish uchun barcha talablar. Har band tekshirib chiqilishi shart.

### 21.1 Majburiy URL'lar (yo'q bo'lsa Play rad etadi)

| Hujjat | Joy | Holat |
|---|---|---|
| Privacy Policy | `https://rideshare.uz/privacy` | ⏳ landing'da host qilish |
| Terms of Service | `https://rideshare.uz/terms` | ⏳ |
| **Account Deletion** | `https://rideshare.uz/delete-account` | ⏳ — backend `DELETE /api/me` ✅ MAVJUD, lekin web sahifa kerak (Play 2024 majburiy) |
| Support email | `support@rideshare.uz` | ⏳ |

### 21.2 Data Safety form (Play Console majburiy)

Quyidagi ma'lumotlar yig'iladi — Play Console formasida deklarasiya qiling:

| Kategoriya | Ma'lumot | Maqsad | Ulashiladi? |
|---|---|---|---|
| Personal Info | Phone number | Account creation, auth | Ha — SMS provider (Eskiz/PlayMobile) |
| Personal Info | Name (firstName, lastName) | Profile, driver bilan tanishish | Yo'q |
| Personal Info | Avatar/photo | Profile | Ha — R2/CDN |
| Location | Precise (Mapbox + GPS) | Pickup point, driver matching, nearby drivers | Ha — Mapbox |
| Location | Approximate | Region/district determination | Yo'q |
| Financial | Order price | Buyurtma yaratish, hisob-kitob | Yo'q |
| App activity | Order history, ratings | Service functionality | Yo'q |
| Device IDs | deviceId (UUID) | Session management | Yo'q |

**Encryption:**
- ✅ In transit: TLS 1.2+
- ✅ At rest: PostgreSQL + R2 (encrypted)

**User control:**
- ✅ User can request deletion: `DELETE /api/me` (in-app) + web sahifa
- ✅ User can export data: ⏳ kelajak — `GET /api/me/export` (GDPR right)

### 21.3 Sensitive permission justifications

Play review qattiq tekshiradi — har birini batafsil yozing:

**`ACCESS_FINE_LOCATION` (foreground)**
> "Foydalanuvchi pickup nuqtasini xaritada belgilashi, yaqin atrofdagi haydovchilarni ko'rishi va haydovchi yetib kelganini tasdiqlashi uchun aniq GPS kerak. Ma'lumot faqat ilova foreground'da bo'lganda olinadi va serverga faqat order yaratishda yuboriladi."

**`ACCESS_BACKGROUND_LOCATION`** — agar live tracking foreground service'da bo'lsa:
> "Sayohat davomida (ACCEPTED → FOUND) haydovchi joylashuvini real-time kuzatish uchun. Foydalanuvchi explicit ravishda ruxsat beradi va istalgan vaqt notification'dan bekor qilishi mumkin. Tracking sayohat tugagandan keyin avtomatik to'xtaydi."
> Demo video kerak (15-30 sek) Play Console'ga yuklash.

**`CAMERA`**
> "Foydalanuvchi profil avatarini olish uchun (ixtiyoriy)."

**`READ_MEDIA_IMAGES`** yoki **Photo Picker** (Android 13+):
> "Galereyadan avatar tanlash uchun. Photo Picker ishlatiladi — ilova faqat foydalanuvchi tanlagan rasmga kira oladi."
> Tavsiya: `READ_MEDIA_IMAGES` o'rniga Android 13+ **Photo Picker API** (permissionsiz).

**`POST_NOTIFICATIONS` (Android 13+)**
> "Sayohat statusi yangilanganda (haydovchi qabul qildi, yetib keldi va h.k.) foydalanuvchiga bildirishnoma yuborish uchun."

**`INTERNET`** — avtomatik, justification shart emas.

### 21.4 Technical requirements (2026)

- [ ] **Target SDK 34+** (Android 14) — 2024 avgust'dan majburiy
- [ ] **Min SDK 24** (Android 7.0) tavsiya — 95%+ qurilmalar
- [ ] **64-bit only** (armeabi-v7a + arm64-v8a yo'q, faqat arm64) — 2019'dan majburiy
- [ ] **AAB (Android App Bundle)** — APK qabul qilinmaydi
- [ ] **Play App Signing** yoqilgan
- [ ] **ProGuard/R8** obfuscation production build'da
- [ ] **Edge-to-edge UI** (Android 15) — `enableEdgeToEdge()`
- [ ] **Predictive back gesture** qo'llab-quvvatlash (Android 14+)
- [ ] **Themed app icon** (monochrome layer)
- [ ] **Splash Screen API** (Android 12+) — `androidx.core:core-splashscreen`
- [ ] **Per-app language** (Android 13+) — `AppCompatDelegate.setApplicationLocales`

### 21.5 In-app majburiy elementlar (Play guidelines)

- [ ] **Permission rationale modal'lar** — OS dialog'dan oldin tushuntirish ekran (1.6.8 bo'limda)
- [ ] **Account deletion** Profile → Sozlamalar ichida ko'rinishi shart (16.4 ✅)
- [ ] **Mapbox attribution sahifasi** — Sozlamalar → "Atributlar" (Mapbox license)
- [ ] **Foydalanish shartlari va Maxfiylik siyosati** linklari A1 (Welcome) va Profile da
- [ ] **Bildirishnoma sozlamalari** — har turdagi notification'ni o'chirish imkoni (16.3 ✅)
- [ ] **Sayohat tugagandan keyin in-app review prompt** (Faza 2 — Google Play In-App Review API)

### 21.6 Content rating questionnaire

Play Console'da to'ldiriladi. Bu ilova uchun kutilayotgan natija: **PEGI 3 / Everyone**

- Yo'q: violence, scary content, adult themes, drugs, gambling, swear words
- Ha: location sharing (with consent), user-generated content (ratings/comments)
- Foydalanuvchi 1-1 muloqot (telefon/chat) — moderation kerak

### 21.7 Ride-sharing kategoriyasi — qo'shimcha vetting

Play moderatorlar so'rashi mumkin:
- Driver onboarding flow demo (license, vehicle, insurance hujjatlari)
- Background check policy
- Safety features (SOS, emergency contact, share location)
- Insurance policy (sayohat davomida)

Ushbu ma'lumotlarni avvaldan tayyorlab qo'ying.

### 21.8 Store listing assets

| Asset | O'lcham | Joy |
|---|---|---|
| App icon | 512x512 PNG (32-bit) | Play Console |
| Feature graphic | 1024x500 JPG/PNG | Play Console |
| Phone screenshots | min 320px, max 3840px, 16:9 yoki 9:16 (2-8 ta) | Play Console |
| 7" tablet screenshots | 1024x600+ | Ixtiyoriy |
| 10" tablet screenshots | 1280x800+ | Ixtiyoriy |
| Promo video | YouTube URL, 30s | Ixtiyoriy |
| Short description | 80 belgi | uz + ru |
| Full description | 4000 belgi | uz + ru |

**Screenshot tavsiyalari (passenger):**
1. Splash + welcome
2. Home — faol buyurtma bilan
3. [+] FAB tap → Mapbox ekran (manzil tanlash)
4. O4 — yo'l preview, polyline + narx
5. O6b — driver kuzatish (mock driver marker bilan)
6. P6 — reyting berish
7. Profile

### 21.9 Pre-launch testing

| Track | Foydalanuvchilar | Davomiyligi |
|---|---|---|
| **Internal testing** | Jamoa (max 100) | Cheksiz |
| **Closed testing (Alpha)** | 20-100 tester | 2-4 hafta |
| **Open testing (Beta)** | Cheksiz | 2-4 hafta |
| **Production** | Hamma | — |

**Play Console "Pre-launch report":**
- Avtomatik test'lar — 25+ qurilmalarda
- Crash detection
- Performance check
- Accessibility audit
- Security scan

**Talab qilinadigan metrika'lar (Play Vitals):**
- **Crash rate ≤ 1.09%** (bad behavior threshold)
- **ANR rate ≤ 0.47%**
- **Excessive wakeups ≤ 10/hour**

### 21.10 Compliance va policy

- [ ] **COPPA** — agar bolalar uchun emas → "Target audience: 13+" deklarasiya
- [ ] **GDPR-like** — EU foydalanuvchilar uchun consent banner (Mapbox uchun ham)
- [ ] **O'zbekiston Personal Data Protection Law** — data hosting (qaerda) deklarasiya
- [ ] **Mapbox Terms** — attribution, telemetry opt-out berish
- [ ] **SMS gateway compliance** — Eskiz/PlayMobile license

### 21.11 Yakuniy pre-submit checklist

- [ ] AAB build qilingan, signed
- [ ] Internal testing track'da 1 hafta — crash 0
- [ ] Pre-launch report yashil
- [ ] Privacy Policy + Terms + Delete Account URL'lar ishlaydi
- [ ] Data Safety form to'ldirilgan
- [ ] Content rating questionnaire bajarilgan
- [ ] Screenshot'lar (uz + ru) yuklangan
- [ ] App description tarjima qilingan
- [ ] Permission justifications yozilgan
- [ ] Mapbox attribution sahifasi mavjud
- [ ] Account deletion ishlaydi (in-app + web)
- [ ] Test foydalanuvchi credentials (Play review uchun)

---

## 22. Tugallanish darajasi (passenger MVP coverage)

Quyidagi jadval — passenger flow'ning har bir qismi qanchalik tayyor ekanini ko'rsatadi.

| Soha | Backend | Mobile dizayn | Yetishmaydi |
|---|---|---|---|
| Auth (A0-A4) | ✅ to'liq | ✅ to'liq | — |
| Joylashuv (A5) | ✅ regions/districts MAVJUD | ✅ Mapbox flow | Mapbox Geocoding API (faza 2) |
| Home tab (P1) | ✅ orders/mine, me, routes | ✅ to'liq | — |
| [+] flow (O1-O4) | ✅ regions, districts, routes, orders | ✅ Mapbox tanlash + polyline | Mapbox Directions API (faza 2) |
| Orders tab (O5) | ✅ orders/mine paginated | ✅ 3 sub-tab | — |
| OPEN tracking (O6a) | ✅ offers polling, accept, reject, cancel | ✅ | — |
| ACCEPTED tracking (O6b) | ✅ orders/{id} polling | ✅ | ⏳ Driver live location API |
| ARRIVED (O6c) | ✅ otpCode response | ✅ | — |
| FOUND (O6d) | ✅ | ✅ | ⏳ Driver live location |
| Rating (P6) | ✅ ratings | ✅ | — |
| Inbox tab | ✅ notifications module MAVJUD | ✅ to'liq | ⏳ Backend'da event-driven notification yaratish (order status o'zgarganda) |
| Profile tab | ✅ me, avatar, delete, sessions, logout | ✅ to'liq | — |
| Saqlangan joylar | ⏳ local-only faza 1 | ✅ | ⏳ Backend persist (faza 2) |
| Chat haydovchi bilan | — (tel: deeplink) | ✅ | ⏳ Chat module |
| SOS | — (tel:102/103) | ✅ | ⏳ `POST /api/orders/{id}/sos` |
| Referal | ✅ `me.referralCode` + complete-register'da apply | ✅ | ⏳ Stats endpoint |
| Dispute | ✅ disputes module MAVJUD | ✅ to'liq | — |
| Sozlamalar | ✅ to'liq | ✅ | ⏳ Telefon o'zgartirish, data export |
| Driver e'lonlari | ⏳ announcements module backend'da yo'q | — | ⏳ `GET /api/announcements` |
| Play Market | ✅ `DELETE /api/me` MAVJUD | ✅ checklist tayyor | ⏳ Web sahifalar (Privacy, Terms, Delete) |

**Passenger MVP — backend coverage: ~85%**, **dizayn coverage: 100%**.

Qolgan 15% — driver live tracking (Mapbox flow'ning eng "wow" qismi) va event-driven notification trigger'lar. Ular faza 2 da qo'shilishi tavsiya etiladi — MVP launch'i uchun majburiy emas.

---

## 23. Designer deliverable'lar

1. **Figma fayl** — barcha ekranlar (light + dark)
2. **Mapbox style mock** — raster screenshot light/dark variantlari
3. **Komponent kutubxonasi** — tugma, input, sheet, marker, status badge, **bottom nav (FAB cutout bilan)**
4. **Lottie animatsiyalar** — splash logo, success checkmark, marker pulse
5. **App icon + splash** (PNG @1x/2x/3x, SVG)
6. **Marker SVG'lar:**
   - User puck (ko'k davra + halo)
   - Driver marker (mashina ikon, bearing rotation)
   - Pickup pin (yashil 🟢)
   - Dropoff pin (qizil 🔴)
   - Target pin (sariq 🎯)
7. **Onboarding illyustratsiyalar** — 3 ta SVG yoki Lottie
8. **Bottom nav komponenti** — FAB cutout, active/inactive state, ripple animation
