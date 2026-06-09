# [+] FAB — Buyurtma yaratish flow (Passenger)

> **Diqqat:** Bu fayl markaziy **[+] FAB** tugmasi orqali ochiladigan **Order flow** (O1–O4)'ni hujjatlashtiradi: yo'lovchi aniq buyurtma yaratadi, haydovchilar taklif yuboradi.
>
> Mobil ilovaning umumiy dizayni — `MOBILE_DESIGN.md`'da.

---

## 0. Tezkor xulosa

### [+] FAB bosilganda — to'g'ridan-to'g'ri Order flow'ga o'tadi

```
┌─────────────────────────────┐
│  🚗 Buyurtma berish         │
│  Hozir / yaqin vaqtga       │
│  Haydovchilar taklif        │
│  yuboradi                   │
└─────────────────────────────┘
```

### Order flow (O1–O4)

| Ekran | Maqsad | Mapbox | Backend API |
|---|---|---|---|
| **O1** | "Qayerga?" — viloyat/tuman tanlash | yo'q | `GET /api/districts` |
| **O2** | Xaritada aniq dropoff pin tanlash | ha — fixed center pin | (Mapbox geocoding) |
| **O3** | "Qayerdan?" — default uy + tahrirlash | ha (tahrirlanganda) | (SharedPrefs `home_address`) |
| **O4** | Yo'l preview + narx kiritish + tasdiqlash | ha — polyline + 2 marker | `GET /api/routes`, `POST /api/orders` |

**Order qoidalari:**
- Bir vaqtda **bir nechta** faol buyurtma yaratish mumkin (avvalgi `409 ACTIVE_ORDER_EXISTS` cheklovi olib tashlandi).
- Narx `route.basePrice × 0.3` ↔ `route.basePrice × 5` oralig'ida.
- `pickupLat`/`pickupLng` va `dropoffLat`/`dropoffLng` **majburiy juftlik**.

### ⚠️ MUHIM — Passenger driver kelishini KUTMAYDI

**Order passenger tomondan ASYNC yaratiladi:**

| Savol | Javob |
|---|---|
| Order yaratish uchun online driver kerakmi? | **❌ YO'Q** |
| Driver e'lon (DriverAnnouncement) chiqargani shartmi? | **❌ YO'Q** |
| Yaqin atrofda driver bo'lishi shartmi? | **❌ YO'Q** |
| Kechki 02:00 da yaratsam ishlaydimi? | **✅ HA** — DB'da OPEN turadi |
| Driver hech kim ko'rmasa nima bo'ladi? | Order TTL `env.ORDER_TTL_MINUTES` (default 24 soat) → `EXPIRED` |

**Backend `POST /api/orders` tekshiradi (driver bilan bog'liq HECH NARSA yo'q):**
1. ✅ Route mavjud va faol
2. ✅ Narx `0.3x–5x` oralig'ida
3. ✅ Passengerda boshqa faol order yo'q

Order DB'da **passive** turadi — qachondir driver online bo'lib, ro'yxatni ochsa ko'radi va taklif yuboradi. Bu klassik **publish-subscribe / queue pattern** — Uber, Yandex, inDrive ham xuddi shu mexanizmda ishlaydi.

---

## 1. Flow diagrammasi

```
        [+] FAB bosildi
              │
              ▼
        ┌──────────┐
        │    O1    │  Qayerga?
        └────┬─────┘
             ▼
        ┌──────────┐
        │    O2    │  Mapbox pin
        └────┬─────┘
             ▼
        ┌──────────┐
        │    O3    │  Qayerdan?
        └────┬─────┘
             ▼
        ┌──────────┐
        │    O4    │  Narx + submit
        └────┬─────┘
             ▼
       POST /api/orders
             │
             ▼
        Order Detail
        (Tab 2 → tracking)
```

---

## 2. OrderDraft — state model

Flow boshidan oxirigacha bitta `OrderDraft` obyekti to'ldiriladi. Foydalanuvchi ortga qaytsa, ma'lumotlar saqlanib qoladi.

```dart
class OrderDraft {
  // Dropoff (O1 → O2 da to'ldiriladi)
  String? dropoffRegionId;       // Route topish uchun
  String? dropoffDistrictId;     // optional analytics
  double? dropoffLat;
  double? dropoffLng;
  String? dropoffAddress;        // reverse-geocode matni

  // Pickup (O3 da to'ldiriladi — default: uy)
  String? pickupRegionId;
  String? pickupDistrictId;
  double? pickupLat;
  double? pickupLng;
  String? pickupAddress;

  // Route (O4 da topiladi)
  String? routeId;
  num? basePrice;
  num? distanceKm;
  int? estimatedDurationMin;

  // Foydalanuvchi tanlovlari (O4)
  int? passengerPrice;
  int seatsRequested = 1;
  RideType rideType = RideType.SOLO;
  DateTime? scheduledAt;

  bool get isReadyForRoute =>
      pickupRegionId != null && dropoffRegionId != null;

  bool get isReadyToSubmit =>
      routeId != null &&
      passengerPrice != null &&
      pickupLat != null && pickupLng != null &&
      dropoffLat != null && dropoffLng != null;
}

enum RideType { SOLO, CARPOOL }
```

> **Saqlash strategiyasi:** Riverpod/Bloc'da `StateNotifier<OrderDraft>` — flow boshlanganda yangi instance, "Buyurtma berish" muvaffaqiyatli bo'lganda tozalanadi. Ilova foreground'dan chiqsa state'ni `SharedPreferences`'ga ham yozish maslahat (foydalanuvchi qaytib kelganda davom etishi uchun).

---

## 3. O1 — "Qayerga?" ekran

### 3.1 Layout

```
┌─────────────────────────────┐
│  ←   Qayerga ketasiz?       │
│                             │
│  🔍 Manzilni qidiring...    │   search input
│                             │
│  ─── So'nggi manzillar ───  │
│  📍 Samarqand, Registon     │   (lokal, SharedPrefs)
│  📍 Buxoro, Lyabi Hauz      │
│                             │
│  ─── Saqlangan ───          │
│  🏠 Uy — Yunusobod, Bobur 12│
│  🏢 Ish — Chilonzor 19      │
│                             │
│  ─── Viloyatlar ───         │
│  Toshkent shahri        ▸   │
│  Toshkent viloyati      ▸   │
│  Samarqand              ▸   │
│  Buxoro                 ▸   │
│  ...                        │
└─────────────────────────────┘
```

### 3.2 Datalar

- **Search input** — debounce 200ms, lokal substring match (`name`, `region.name` bo'yicha).
- **So'nggi manzillar** — oxirgi 5 ta tanlangan dropoff (lokal). Tap → `dropoffLat/Lng/Address/RegionId/DistrictId` to'g'ridan-to'g'ri to'ldiriladi va **O3'ga** o'tiladi (O2'ni o'tkazib yuborish).
- **Saqlangan joylar** — A5b yoki Profile'da saqlangan. Tap → xuddi yuqoridagidek O3'ga.
- **Viloyatlar/tumanlar** — tap → O2'ga `regionId` bilan o'tish (xarita o'sha viloyat markazidan ochiladi).

### 3.3 API

| Maqsad | Endpoint | Cache |
|---|---|---|
| Viloyatlar | `GET /api/regions` | 7 kun (SharedPrefs) |
| Tumanlar | `GET /api/districts` | 7 kun |
| Tumanlar by region | `GET /api/regions/{id}/districts` | 7 kun |

**Javob shakli (regions):**
```json
{
  "success": true,
  "data": [
    {
      "id": "r0000000-...",
      "name": "Toshkent",
      "code": "TAS",
      "lat": 41.31,
      "lng": 69.24
    }
  ]
}
```

**Javob shakli (districts):**
```json
{
  "success": true,
  "data": [
    {
      "id": "d0000000-...",
      "regionId": "r0000000-...",
      "name": "Yunusobod",
      "isActive": true
    }
  ]
}
```

### 3.4 Empty / error states

- Qidiruv bo'yicha hech narsa topilmasa: "Topilmadi" + recent/saqlangan'ga qaytarish.
- `GET /api/districts` xato bersa: cached versiyani ko'rsatish, banner "Internet yo'q, oxirgi yuklab olingan ro'yxat".

---

## 4. O2 — Xaritada aniq nuqta tanlash (Mapbox)

### 4.1 Layout

```
┌─────────────────────────────┐
│  ←   Manzilni tanlang       │
│                             │
│        🗺  MAPBOX MAP        │
│                             │
│         ┌──────┐            │   FIXED CENTER PIN
│         │  🎯  │            │   (xarita harakatlanadi,
│         └──────┘            │    pin markazda turadi)
│                             │
│  ╭─────────────────────────╮│   bottom sheet (peek)
│  │ Samarqand, Registon ko' ││   ← reverse-geocode
│  │ Samarqand sh., Registon ││
│  │                         ││
│  │ [   Tasdiqlash    ]     ││
│  ╰─────────────────────────╯│
└─────────────────────────────┘
```

### 4.2 Mapbox sozlamalari

| Parametr | Qiymat |
|---|---|
| Style URL | `mapbox://styles/mapbox/streets-v12` (dark mode'da `dark-v11`) |
| Initial camera | `region.lat/lng` (zoom 11, bearing 0, pitch 0) |
| Min zoom | 8 (foydalanuvchi tashqariga chiqib ketmasin) |
| Max zoom | 19 |
| User location | Ko'rsatish (puck blue dot), lekin pin foydalanuvchi GPS'iga lock qilinmagan |
| Compass | Hidden |
| Scale bar | Hidden |
| Logo position | bottom-left (Mapbox attribution majburiy) |
| Attribution position | bottom-right, compact |

### 4.3 Center pin

- **Map widget ustida fixed `Stack` element** (Mapbox marker EMAS — chunki marker xarita bilan birga harakatlanadi).
- Asset: `assets/icons/map_pin_yellow.svg` (brand sariq), shadow drop.
- Hajm: 48x64 (tip pastda).
- Animatsiya: foydalanuvchi xaritani sudraganida pin yengil **yuqoriga sakraydi** (Lottie yoki TweenAnimationBuilder, 200ms).

### 4.4 Reverse geocode

**Variant A (rasmiy, billing'da hisoblanadi):**

```
GET https://api.mapbox.com/geocoding/v5/mapbox.places/{lng},{lat}.json
    ?access_token={MAPBOX_PUBLIC_TOKEN}
    &limit=1
    &language=uz
    &types=address,place,locality,neighborhood,poi
```

**Trigger:** `onCameraIdle` event (foydalanuvchi xaritani sudrab to'xtaganda).
**Debounce:** 500ms — bo'lmasa Mapbox bill bo'g'iladi.

**Javob (qisqartirilgan):**
```json
{
  "features": [
    {
      "place_name": "Registon ko'chasi 5, Samarqand, O'zbekiston",
      "text": "Registon ko'chasi 5",
      "center": [66.959, 39.654],
      "context": [
        { "id": "place.xxx", "text": "Samarqand" },
        { "id": "region.xxx", "text": "Samarqand viloyati" }
      ]
    }
  ]
}
```

Bottom sheet'da:
- 1-qator (qora, 16sp, bold): `features[0].text` (masalan, "Registon ko'chasi 5")
- 2-qator (kulrang, 13sp): `features[0].place_name` (to'liq)

**Variant B (tekin, oddiy):**

Mapbox'siz — lokal yondashuv:
- `regions` keshidan eng yaqinini haversine bilan toping
- `districts` keshidan eng yaqin tumanni toping
- Sheet'da `"{regionName}, {districtName}"` ko'rsating
- Foydalanuvchi qo'lda ham address yoza olishi uchun ixtiyoriy "Tahrirlash" tugmasi qo'ying

**Tavsiya:** Boshlanishda Variant A — UX yaxshi va Mapbox bepul tier (100k geocode/oy) MVP uchun yetadi. O'sgach kerak bo'lsa caching qatlam qo'shish (lat/lng round 4 decimal → keshda saqlash).

### 4.5 "Tasdiqlash" tugmasi bosilganda

```dart
draft = draft.copyWith(
  dropoffLat: pinLat,
  dropoffLng: pinLng,
  dropoffAddress: sheetTitle,           // features[0].text
  dropoffRegionId: matchedRegionId,     // contextdan yoki haversine'dan
  dropoffDistrictId: matchedDistrictId, // ixtiyoriy
);
Navigator.pushReplacementNamed(context, '/order/o3');
```

### 4.6 Error / edge cases

| Holat | Yechim |
|---|---|
| Reverse-geocode xato (network / 429) | Sheet'da "Manzil topilmadi" + lat/lng ko'rsatish; foydalanuvchi qo'lda address yozishi mumkin |
| Foydalanuvchi viloyatdan tashqariga sudradi | Banner: "Bu yo'nalish hozircha mavjud emas" (Route topilmaganda real-time tekshirish O4'da bo'ladi) |
| GPS rad etilgan | Map default region markazidan ochiladi, "Mening joylashuvim" tugmasi disabled |
| Mapbox token noto'g'ri | Crash report + foydalanuvchi uchun: "Xarita yuklanmadi, qayta urinib ko'ring" |

---

## 5. O3 — "Qayerdan?" ekran

### 5.1 Layout

```
┌─────────────────────────────┐
│  ←   Qayerdan?              │
│                             │
│  ╭─────────────────────────╮│
│  │ 🏠 Uy                   ││   DEFAULT (tanlangan)
│  │    Yunusobod, Bobur 12  ││
│  │                      ✓  ││
│  ╰─────────────────────────╯│
│                             │
│  ╭─────────────────────────╮│
│  │ 🏢 Ish                  ││
│  │    Chilonzor 19         ││
│  ╰─────────────────────────╯│
│                             │
│  ╭─────────────────────────╮│
│  │ 📍 Hozirgi joylashuv    ││   GPS
│  ╰─────────────────────────╯│
│                             │
│  ╭─────────────────────────╮│
│  │ 🗺  Xaritada tanlash    ││   → O1/O2 takror
│  ╰─────────────────────────╯│
│                             │
│  [    Davom etish      ]    │
└─────────────────────────────┘
```

### 5.2 Default mantiq

1. **A5b** (auth) yoki Profile'da uy manzili saqlangan bo'lsa — avtomatik **Uy** tanlanadi.
2. Saqlanmagan bo'lsa — "Hozirgi joylashuv" default (GPS so'raladi).
3. GPS ham yo'q bo'lsa — "Xaritada tanlash" majburiy.

### 5.3 "Hozirgi joylashuv" flow

```dart
final pos = await Geolocator.getCurrentPosition(
  desiredAccuracy: LocationAccuracy.high,
  timeLimit: Duration(seconds: 10),
);
final geocode = await mapboxReverseGeocode(pos.latitude, pos.longitude);

draft = draft.copyWith(
  pickupLat: pos.latitude,
  pickupLng: pos.longitude,
  pickupAddress: geocode.text,
  pickupRegionId: geocode.regionId,
  pickupDistrictId: geocode.districtId,
);
```

**Timeout:** 10s. Vaqt o'tsa "GPS topilmadi, xaritadan tanlang" banner.

### 5.4 "Xaritada tanlash"

O2 ekraniga o'tish — lekin **pickup** rejimida. Yagona farq: header matni "Qayerdan?" + tasdiqlanganda `pickup*` maydonlari to'ldiriladi (dropoff emas).

> **Reuse pattern:** O2 ekranini bitta Widget qiling, `MapPickerMode mode = pickup | dropoff` parametr orqali pickup yoki dropoff'ga yozishini boshqaring.

### 5.5 "Davom etish" — validatsiya

Bosilganda:
1. `pickupLat`, `pickupLng`, `pickupRegionId` to'liqmi?
2. `pickupRegionId == dropoffRegionId` bo'lsa: banner "Bir xil viloyat ichidagi sayohatlar hozircha qo'llab-quvvatlanmaydi" (faza 1 — interregional faqat). Faza 2'da intra-region ham qo'shilishi mumkin.
3. Mavjud bo'lsa → O4'ga o'tish.

---

## 6. O4 — Yo'l preview + narx kiritish

### 6.1 Layout

```
┌─────────────────────────────┐
│  ←   Yo'l tafsiloti         │
│                             │
│        🗺  MAPBOX MAP        │
│                             │
│      🟢 ─────────── 🔴      │   polyline + 2 marker
│   Yunusobod      Registon   │
│                             │
│  ╭─────────────────────────╮│   draggable sheet (half)
│  │ Yunusobod → Registon    ││
│  │ 🛣 308 km · ⏱ ~4 soat   ││
│  │                         ││
│  │ ─── Narx ───            ││
│  │ ┌─────────────────────┐ ││
│  │ │  120 000 so'm  [✎]  │ ││   ← MAJBURIY input
│  │ └─────────────────────┘ ││
│  │ ────●─────────────────  ││   slider
│  │ 36k     120k     600k   ││   min · tavsiya · max
│  │                         ││
│  │ 👥 1 o'rin           ▾ ││   1–4
│  │ 🚗 Yakka             ▾ ││   SOLO / CARPOOL
│  │ 📅 Hozir             ▾ ││   now / +1h / ertaga
│  │                         ││
│  │ [  Buyurtma berish    ] ││
│  ╰─────────────────────────╯│
└─────────────────────────────┘
```

### 6.2 Route topish

Sheet ochilganda darhol:

```
GET /api/routes?fromRegionId={pickupRegionId}&toRegionId={dropoffRegionId}
```

**Javob:**
```json
{
  "success": true,
  "data": [
    {
      "id": "rt000000-...",
      "fromRegionId": "...",
      "toRegionId": "...",
      "distanceKm": 308,
      "estimatedDurationMin": 240,
      "basePrice": 120000,
      "isActive": true
    }
  ]
}
```

- **0 ta natija** → banner "Bu yo'nalish hozircha mavjud emas", "Buyurtma berish" tugmasi disabled.
- **1 yoki ko'p** → birinchisini olish, `draft.routeId = data[0].id`, `draft.basePrice = data[0].basePrice`.

### 6.3 Narx input qoidalari

| Qoida | Qiymat |
|---|---|
| Default | `basePrice` (tavsiya) |
| Min | `basePrice × 0.3` (yaxlitlash 1000ga) |
| Max | `basePrice × 5` |
| Qadam | 1 000 so'm (slider step) |
| Format | "120 000 so'm" (3 raqamdan ajratish, NumberFormat) |
| Klaviatura | Number-only |
| Real-time validatsiya | Min'dan past yoki max'dan yuqori bo'lsa — submit disabled + qizil border |

**Frontend rendering:**
```dart
final base = draft.basePrice!;
final min = (base * 0.3).round();
final max = (base * 5).round();

bool isValid(int p) => p >= min && p <= max;
```

> **Eslatma:** Backend ham bu validatsiyani qiladi (`400 PRICE_OUT_OF_RANGE`). Frontend faqat UX uchun — submit oldidan xato ko'rsatish.

### 6.4 Boshqa parametrlar

| Field | UI | Default | Qiymatlar |
|---|---|---|---|
| `seatsRequested` | dropdown / +/- | 1 | 1, 2, 3, 4 |
| `rideType` | segmented | SOLO | SOLO ("Yakka") / CARPOOL ("Birga") |
| `scheduledAt` | date+time picker | `null` (hozir) | `null` yoki `now + 30min`'dan keyin |

> **CARPOOL semantikasi:** Yo'lovchi 1 o'rin oladi, lekin haydovchi qolgan o'rinlarni boshqalar bilan to'ldirishi mumkin → arzon. SOLO — yo'lovchi to'liq mashinani buyurtma qiladi (lekin `seatsRequested` baribir 1–4 bo'lishi mumkin, masalan oilali yo'lovchi).

### 6.5 Mapbox preview

- 🟢 yashil marker — `draft.pickupLat/Lng`
- 🔴 qizil marker — `draft.dropoffLat/Lng`
- **Polyline** — Faza 1: to'g'ri chiziq (`LineLayer` ikki nuqta orasida)
- **Camera:** `cameraForCoordinateBounds()` ikki marker'ni o'rab oladi, padding `EdgeInsets.fromLTRB(60, 100, 60, 280)` (sheet baland bo'lgani uchun bottom katta)
- Foydalanuvchi sheet'ni yuqoriga sudraganda map gestur disabled (sheet'ga ustunlik)

**Faza 2 (ixtiyoriy):**
```
GET https://api.mapbox.com/directions/v5/mapbox/driving/{pickupLng},{pickupLat};{dropoffLng},{dropoffLat}
    ?access_token={token}
    &geometries=geojson
    &overview=simplified
```
Bu real yo'lni qaytaradi — polyline'ga `geometry.coordinates` ni qo'yish.

### 6.6 "Buyurtma berish" — POST /api/orders

**Body:**
```json
{
  "routeId": "rt000000-...",
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

`scheduledAt` ni ISO 8601 formatda yuborish: `"2026-05-25T09:00:00.000Z"`. UTC formatda jo'natish maslahat (lokaldan UTC'ga aylantirib).

**Header:** `Authorization: Bearer {accessToken}` (har doim).

> **Eslatma:** Bu endpoint **driver mavjudligini tekshirmaydi**. Order DB'da `status=OPEN` holatda yaratiladi va `expiresAt` (default: 24 soat) gacha turadi. Birinchi kelgan driver `GET /api/driver/orders/open` orqali ko'rib taklif yuboradi. Tunda, sayohatdan oldingi kun yoki driver yo'q paytda yaratish — to'liq ishlaydi.

### 6.7 Muvaffaqiyatli javob (`201`)

```json
{
  "success": true,
  "data": {
    "id": "ord00000-...",
    "status": "OPEN",
    "rideType": "SOLO",
    "seatsRequested": 1,
    "passengerPrice": 120000,
    "finalPrice": null,
    "pickup": {
      "lat": 41.311081,
      "lng": 69.240562,
      "address": "Toshkent, Yunusobod, Bobur ko'chasi 12"
    },
    "dropoff": {
      "lat": 39.654009,
      "lng": 66.959882,
      "address": "Samarqand, Registon maydoni 5"
    },
    "route": { "id": "...", "distanceKm": 308, "estimatedDurationMin": 240, "basePrice": 120000 },
    "passenger": { "id": "...", "firstName": "Aziza", "lastName": "K.", "phone": null },
    "driver": null,
    "otpCode": null,
    "scheduledAt": null,
    "acceptedAt": null,
    "arrivedAt": null,
    "foundAt": null,
    "cancelledAt": null,
    "cancellationReason": null,
    "expiresAt": "2026-05-24T15:00:00.000Z",
    "createdAt": "2026-05-24T13:30:00.000Z"
  }
}
```

**Keyingi qadam:**
1. `OrderDraft` ni tozalash.
2. "So'nggi manzillar" lokal ro'yxatga `dropoffAddress` qo'shish (top 5).
3. `Navigator.pushReplacement` → **Order Detail / Tracking** ekrani (`/orders/{id}`).
4. Toast/snackbar: "Buyurtma berildi · Takliflarni kuting".

### 6.8 Xatoliklar

| HTTP / kod | Sabab | UX |
|---|---|---|
| `400 VALIDATION_ERROR` | Body noto'g'ri (lat/lng juftlik buzilgan) | Sheet'da inline xato + retry |
| `400 PRICE_OUT_OF_RANGE` | Narx min/max tashqarida | Inline qizil matn: "Narx 36 000–600 000 so'm oralig'ida bo'lishi kerak" |
| `400 ROUTE_INVALID` | `routeId` topilmadi / o'chirilgan | Banner: "Bu yo'nalish endi mavjud emas", O1'ga qaytarish |
| `401 UNAUTHORIZED` | Token muddati o'tgan | Auto refresh tokenni urinish, bo'lmasa logout |
| `500` / network | Backend / internet | Toast "Server xatosi, qayta urining", tugma yana faollashadi |

### 6.9 Loading va idempotency

- "Buyurtma berish" tugmasi bosilgach — disabled + spinner.
- **Idempotency key:** Tavsiya — har bir order yaratishda `Idempotency-Key: {uuidv4}` header yuborish (backend kelajakda qo'llab-quvvatlasin). Bu double-tap'dan himoyalaydi.
- Hozir: `debounce(submitButton, 2000ms)` — 2 soniya ichida 2 marta bosilmasin.

---

## 7. Mapbox texnik checklist

### 7.1 Setup

- [ ] `mapbox_maps_flutter: ^2.x` qo'shish (`pubspec.yaml`)
- [ ] Public token `.env` da: `MAPBOX_PUBLIC_TOKEN=pk.xxxx`
- [ ] Android: `AndroidManifest.xml` ga internet + location permissions
- [ ] iOS: `Info.plist` ga `NSLocationWhenInUseUsageDescription` + uzbekcha matn
- [ ] Token URL-restricted to app bundle id (Mapbox dashboard'da)

### 7.2 Style va asset'lar

- [ ] Custom style (ixtiyoriy) — Mapbox Studio'da brand ranglar (sariq accent, kulrang yo'llar)
- [ ] Pin asset'lar: `pin_pickup_green.svg`, `pin_dropoff_red.svg`, `pin_center_yellow.svg`
- [ ] Markerlarni `PointAnnotationManager` orqali qo'shish — `iconSize`, `iconAnchor` "bottom"

### 7.3 Camera

- [ ] O2: `flyTo(region.lat/lng, zoom: 11)` — 600ms animation
- [ ] O4: `cameraForCoordinateBounds([pickup, dropoff], padding)` → `flyTo()`
- [ ] Foydalanuvchi xaritani sudragandan keyin camera lock ochiq qoladi (auto-follow YO'Q O2/O4'da)

### 7.4 Performance

- [ ] Map'ni dispose qilish (ekran yopilganda)
- [ ] Polyline'ni faqat route topilgandan keyin qo'shish (oldindan emas)
- [ ] Reverse-geocode debounce 500ms majburiy (billing!)

### 7.5 Offline

- [ ] Tile'lar avtomatik keshlanadi (Mapbox SDK qiladi)
- [ ] Yo'q internet'da — last cached view ko'rsatiladi + banner "Offline rejim"

---

## 8. Validatsiya checklist (submit oldidan)

```dart
bool canSubmit(OrderDraft d) {
  if (d.routeId == null) return false;
  if (d.passengerPrice == null) return false;

  // Geo juftlik
  if ((d.pickupLat == null) != (d.pickupLng == null)) return false;
  if ((d.dropoffLat == null) != (d.dropoffLng == null)) return false;
  if (d.pickupLat == null || d.dropoffLat == null) return false;

  // Address uzunligi
  if (d.pickupAddress != null && d.pickupAddress!.length < 2) return false;
  if (d.dropoffAddress != null && d.dropoffAddress!.length > 300) return false;

  // Narx oralig'i
  final base = d.basePrice!.toInt();
  final min = (base * 0.3).round();
  final max = (base * 5).round();
  if (d.passengerPrice! < min || d.passengerPrice! > max) return false;

  // Seats
  if (d.seatsRequested < 1 || d.seatsRequested > 4) return false;

  // ScheduledAt (agar bo'lsa) — kelajakda
  if (d.scheduledAt != null && d.scheduledAt!.isBefore(DateTime.now())) {
    return false;
  }

  return true;
}
```

---

## 9. Edge cases

| Holat | Yechim |
|---|---|
| Foydalanuvchi O2 da dropoff tanladi, ortga qaytdi va boshqa viloyatga tanladi | `draft.dropoff*` overwrite, route qayta topiladi |
| Pickup va dropoff bir xil viloyat | "Intra-region hozircha qo'llab-quvvatlanmaydi" (Route DB'da yo'q) |
| GPS rad qilingan + uy manzili saqlanmagan | O3'da faqat "Xaritada tanlash" qoladi |
| Foydalanuvchi narx 120 000 yozdi, lekin route 50 000 (boshqasi) | Sheet'da real-time min/max o'zgaradi |
| `scheduledAt` o'tmishda | Frontend validatsiya: disabled |
| App backgroundga ketdi O2'da | State `SharedPrefs`'da, qaytib kelganda davom etadi |
| Yo'lovchining allaqachon faol orderi bor | O4'da "Buyurtma berish" → `409` → "Sizda faol order bor" dialog → "Tafsilot" → o'sha orderga |
| Mapbox token rate-limit (429) | Reverse-geocode'siz davom etish, address bo'sh qoladi |
| Foydalanuvchi yo'lovchi mashinada o'tirib turibdi (driver allaqachon yetib kelgan) | UI da hech qanday cheklov yo'q — faqat bitta order/vaqt qoidasi |

---

## 10. Sinov checklisti (QA)

### 10.1 Golden path

- [ ] O1 → search "Sam" → "Samarqand" → O2
- [ ] O2 → xaritani sudradi → pin Registon ustida → "Tasdiqlash" → O3
- [ ] O3 → "Uy" default → "Davom etish" → O4
- [ ] O4 → narx 120 000 default → "Buyurtma berish" → 201 → tracking ekrani
- [ ] Order'da `pickup` va `dropoff` to'g'ri saqlangan (DB tekshirish yoki Order Detail API)

### 10.2 Edge cases

- [ ] Narx min'dan past → submit disabled + qizil border
- [ ] Narx max'dan yuqori → xuddi shu
- [ ] Bir xil viloyat tanlash → "Yo'nalish mavjud emas" banner
- [ ] Internet uzilgan → toast + retry
- [ ] Faol order bor → `409` dialog
- [ ] GPS rad → O3'da "Hozirgi joylashuv" disabled
- [ ] Mapbox token noto'g'ri → graceful degrade (lokal district selection variant B'ga)
- [ ] Tez 5 marta "Buyurtma berish" bosish → 1 ta order yaratiladi (debounce)
- [ ] App background → foreground (O2'da) → davom etadi, pin avvalgi joyida

### 10.3 Performance

- [ ] O2 ochilishi < 1s (icon set preload)
- [ ] Reverse-geocode latency < 800ms p95 (debounce 500ms + Mapbox ~300ms)
- [ ] O4 yo'l preview render < 500ms
- [ ] `POST /api/orders` round-trip < 1s p95

---

## 11. Analytics event'lar (taklif)

| Event | Property'lar |
|---|---|
| `fab_pressed` | — |
| `order_o1_district_selected` | `regionId`, `districtId` |
| `order_o2_pin_confirmed` | `lat` (round 0.01°), `lng`, `reverseGeocodeMs` |
| `order_o3_pickup_selected` | `source: home / work / gps / map` |
| `order_o4_route_found` | `routeId`, `distanceKm`, `basePrice` |
| `order_o4_price_changed` | `delta: -X / +X` (`basePrice`'dan) |
| `order_submit_pressed` | `passengerPrice`, `rideType`, `seatsRequested`, `scheduled: bool` |
| `order_created` | `orderId`, `priceVsBaseRatio: 0.83` |
| `order_submit_failed` | `errorCode` |

> Privacy: lat/lng har doim **0.01° ga yaxlitlanadi** (~1 km aniqlik) — aniq joylashuvni analytics'ga yuborish mumkin emas.

---

## 12. Tugallanish darajasi

| Bo'lim | Backend | Mobil |
|---|---|---|
| O1 — district list | ✅ Tayyor | ⏳ Implement |
| O2 — Mapbox pin + reverse-geocode | ✅ Tayyor (lat/lng/address qabul qiladi) | ⏳ Implement |
| O3 — pickup default | ✅ Tayyor | ⏳ Implement |
| O4 — route + narx + submit | ✅ Tayyor (passengerPrice + geo validatsiya) | ⏳ Implement |
| Idempotency-Key | ⏳ Kelajak | ⏳ Tavsiya |
| `POST /api/routes/estimate` (narx bez yaratish) | ⏳ Kelajak | — |
| Mapbox Directions API (real polyline) | — | ⏳ Faza 2 |

---

## 13. Tegishli hujjatlar

- `MOBILE_DESIGN.md` — umumiy passenger app dizayn (bottom-nav, Home, Orders, Inbox, Profile)
- `BACKEND_SPEC.md` — barcha endpointlar va biznes qoidalari
- Swagger UI: `http://localhost:3000/api/docs/passenger` va `/api/docs/driver` — runtime API kontrakti

---

**So'nggi yangilanish:** 2026-05-25
**Maqsad:** Mobil dasturchi shu bitta faylni o'qib, [+] FAB Order flow'ini to'liq implement qila olishi kerak.
