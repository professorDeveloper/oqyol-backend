# Rideshare Matching Platform — Backend Specification

> Shaharlararo yo'lovchi-haydovchi matching marketplace.
> Platform taksi xizmati emas — faqat ishonchli moslashtirish, tekshirish va komissiya yig'ish.

---

## Tech Stack

| Texnologiya | Maqsad |
|---|---|
| **NestJS** (TypeScript) | Backend framework |
| **PostgreSQL** + PostGIS | Asosiy DB + GPS hisob-kitob |
| **Prisma** | ORM, migration, type-safe queries |
| **Redis** | OTP cache, session store, rate limiting |
| **Passport + JWT** | Authentication (access + refresh tokens) |
| **class-validator** | DTO validation |
| **Swagger/OpenAPI** | API documentation (avtomatik) |
| **Docker + docker-compose** | Development environment |
| **Node Cron / Bull** | Scheduled jobs (order expiry, announcement expiry) |

---

## Papka Tuzilishi (Project Structure)

```
rideshare-api/
├── prisma/
│   ├── schema.prisma              # DB schema
│   ├── migrations/                # DB migrations
│   └── seed.ts                    # Seed data (regions, routes, admin user)
│
├── src/
│   ├── common/
│   │   ├── decorators/            # @CurrentUser, @Roles, custom decorators
│   │   ├── guards/                # JwtAuthGuard, RolesGuard
│   │   ├── filters/               # HttpExceptionFilter, PrismaExceptionFilter
│   │   ├── pipes/                 # ValidationPipe config
│   │   ├── interceptors/          # ResponseInterceptor, LoggingInterceptor
│   │   ├── dto/                   # PaginationDto, ApiResponseDto
│   │   └── utils/                 # Haversine, OTP generator, helpers
│   │
│   ├── config/
│   │   ├── app.config.ts          # Environment variables validation
│   │   ├── database.config.ts     # PostgreSQL connection
│   │   ├── redis.config.ts        # Redis connection
│   │   └── jwt.config.ts          # JWT secrets, expiry
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/        # JwtStrategy, JwtRefreshStrategy
│   │   │   └── dto/
│   │   │       ├── send-otp.dto.ts
│   │   │       ├── verify-otp.dto.ts
│   │   │       └── refresh-token.dto.ts
│   │   │
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── dto/
│   │   │       ├── update-profile.dto.ts
│   │   │       └── user-response.dto.ts
│   │   │
│   │   ├── drivers/
│   │   │   ├── drivers.module.ts
│   │   │   ├── drivers.controller.ts
│   │   │   ├── drivers.service.ts
│   │   │   └── dto/
│   │   │       ├── create-application.dto.ts
│   │   │       ├── update-driver-profile.dto.ts
│   │   │       └── driver-tags.dto.ts       # smoking, ac, music, pets
│   │   │
│   │   ├── vehicles/
│   │   │   ├── vehicles.module.ts
│   │   │   ├── vehicles.controller.ts
│   │   │   ├── vehicles.service.ts
│   │   │   └── dto/
│   │   │       ├── create-vehicle.dto.ts
│   │   │       └── update-vehicle.dto.ts
│   │   │
│   │   ├── regions/
│   │   │   ├── regions.module.ts
│   │   │   ├── regions.controller.ts
│   │   │   ├── regions.service.ts
│   │   │   └── dto/
│   │   │
│   │   ├── routes/
│   │   │   ├── routes.module.ts
│   │   │   ├── routes.controller.ts
│   │   │   ├── routes.service.ts
│   │   │   └── dto/
│   │   │
│   │   ├── orders/
│   │   │   ├── orders.module.ts
│   │   │   ├── orders.controller.ts
│   │   │   ├── orders.service.ts
│   │   │   ├── orders.cron.ts             # Order expiry job
│   │   │   └── dto/
│   │   │       ├── create-order.dto.ts
│   │   │       ├── cancel-order.dto.ts
│   │   │       ├── arrive-order.dto.ts
│   │   │       └── confirm-otp.dto.ts
│   │   │
│   │   ├── offers/
│   │   │   ├── offers.module.ts
│   │   │   ├── offers.controller.ts
│   │   │   ├── offers.service.ts
│   │   │   └── dto/
│   │   │       ├── create-offer.dto.ts     # Haydovchi counter-offer
│   │   │       ├── respond-offer.dto.ts    # Yo'lovchi accept/reject
│   │   │       └── offer-response.dto.ts
│   │   │
│   │   ├── announcements/
│   │   │   ├── announcements.module.ts
│   │   │   ├── announcements.controller.ts
│   │   │   ├── announcements.service.ts
│   │   │   ├── announcements.cron.ts      # Expiry job
│   │   │   └── dto/
│   │   │       ├── create-announcement.dto.ts
│   │   │       └── announcement-response.dto.ts
│   │   │
│   │   ├── wallet/
│   │   │   ├── wallet.module.ts
│   │   │   ├── wallet.controller.ts
│   │   │   ├── wallet.service.ts
│   │   │   └── dto/
│   │   │
│   │   ├── ratings/
│   │   │   ├── ratings.module.ts
│   │   │   ├── ratings.controller.ts
│   │   │   ├── ratings.service.ts
│   │   │   └── dto/
│   │   │       └── create-rating.dto.ts
│   │   │
│   │   ├── referrals/
│   │   │   ├── referrals.module.ts
│   │   │   ├── referrals.controller.ts
│   │   │   ├── referrals.service.ts
│   │   │   └── dto/
│   │   │
│   │   ├── disputes/
│   │   │   ├── disputes.module.ts
│   │   │   ├── disputes.controller.ts
│   │   │   ├── disputes.service.ts
│   │   │   └── dto/
│   │   │
│   │   ├── notifications/
│   │   │   ├── notifications.module.ts
│   │   │   ├── notifications.service.ts   # Push + SMS
│   │   │   └── dto/
│   │   │
│   │   └── admin/
│   │       ├── admin.module.ts
│   │       ├── admin.controller.ts
│   │       ├── admin.service.ts
│   │       └── dto/
│   │
│   ├── app.module.ts
│   └── main.ts
│
├── test/
│   ├── e2e/                       # End-to-end testlar
│   └── unit/                      # Unit testlar
│
├── docker-compose.yml             # PostgreSQL + Redis
├── .env.example
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
├── package.json
└── README.md
```

---

## Rollar va Huquqlar (Roles & Permissions)

### USER (default)
- Ro'yxatdan o'tish, login
- Profil ko'rish/tahrirlash
- Buyurtma yaratish (narx bilan)
- Haydovchi counter-offer'ini qabul/rad qilish
- Haydovchi e'lonlarini ko'rish va javob berish
- Buyurtmani bekor qilish
- OTP berish (ARRIVED statusda)
- Haydovchini baholash (1-5)
- Dispute ochish
- Referral kod olish va ulashish
- Haydovchi bo'lish uchun ariza berish

### DRIVER (admin tasdiqlagan)
- USER ning barcha huquqlari
- Driver profil tahrirlash (tags: chekish, AC, musiqa, hayvon)
- Mashina qo'shish/tahrirlash
- Marshrutlarni ko'rish (feed)
- Buyurtmani qabul qilish
- Counter-offer berish (o'z narxini taklif qilish)
- E'lon yaratish ("bugun ketaman")
- GPS bilan yetib kelganini tasdiqlash
- OTP kiritish (FOUND uchun)
- Yo'lovchini baholash (1-5)
- Wallet balansini ko'rish
- Carpooling rejimda o'rindiq sonini boshqarish

### ADMIN (back office)
- Barcha foydalanuvchilarni ko'rish/tahrirlash/bloklash
- Haydovchi arizalarini ko'rish/tasdiqlash/rad qilish
- Wallet topup (haydovchi balansiga pul qo'shish)
- Komissiya sozlamalarini boshqarish
- Buyurtmalarni ko'rish
- Dispute'larni ko'rib chiqish va hal qilish
- Regionlar va marshrutlarni boshqarish
- Hisobotlar va statistika
- Anti-fraud harakatlar (ogohlantirish, suspend, block)
- Referral bonus summalarini sozlash

---

## Database Schema (Prisma)

### users
| Ustun | Tur | Izoh |
|---|---|---|
| id | UUID | PK |
| phone | String | Unique, +998... |
| first_name | String | |
| last_name | String | |
| role | Enum | USER, DRIVER, ADMIN |
| avatar_url | String? | |
| referral_code | String | Unique, avtomatik generatsiya |
| referred_by | UUID? | FK → users |
| is_active | Boolean | Default true |
| created_at | DateTime | |
| updated_at | DateTime | |

### user_sessions
| Ustun | Tur | Izoh |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users |
| device_name | String | "iPhone 14", "Samsung S24" |
| device_id | String | Unique device identifier |
| refresh_token_hash | String | Hashed refresh token |
| last_active_at | DateTime | |
| expires_at | DateTime | |
| created_at | DateTime | |

### driver_applications
| Ustun | Tur | Izoh |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users |
| license_front_url | String | Haydovchilik guvohnomasi (old) |
| license_back_url | String | Haydovchilik guvohnomasi (orqa) |
| passport_url | String | Passport rasmi |
| status | Enum | PENDING, APPROVED, REJECTED |
| reviewed_by | UUID? | FK → users (admin) |
| rejection_reason | String? | |
| reviewed_at | DateTime? | |
| created_at | DateTime | |

### driver_profiles
| Ustun | Tur | Izoh |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users, Unique |
| status | Enum | ACTIVE, SUSPENDED, BLOCKED |
| smoking_allowed | Boolean | Default false |
| ac_available | Boolean | Default false |
| music_allowed | Boolean | Default true |
| pets_allowed | Boolean | Default false |
| bio | String? | Qisqa tavsif |
| avg_rating | Decimal? | O'rtacha reyting (cache, har baho da yangilanadi) |
| total_ratings | Int | Jami baholar soni (default 0) |
| suspended_until | DateTime? | |
| created_at | DateTime | |
| updated_at | DateTime | |

### vehicles
| Ustun | Tur | Izoh |
|---|---|---|
| id | UUID | PK |
| driver_id | UUID | FK → driver_profiles |
| brand | String | "Chevrolet" |
| model | String | "Cobalt" |
| color | String | "Oq" |
| plate_number | String | "01A123BC" |
| year | Int | 2022 |
| seat_count | Int | Umumiy o'rindiq soni |
| photo_url | String? | |
| is_active | Boolean | Default true |
| created_at | DateTime | |

### regions
| Ustun | Tur | Izoh |
|---|---|---|
| id | UUID | PK |
| name | String | "Toshkent", "Samarqand" |
| lat | Float | Markaz koordinatasi |
| lng | Float | |
| radius_km | Float | Shahar radiusi |
| is_active | Boolean | |

### routes
| Ustun | Tur | Izoh |
|---|---|---|
| id | UUID | PK |
| from_region_id | UUID | FK → regions |
| to_region_id | UUID | FK → regions |
| distance_km | Float | Masofa |
| estimated_duration_min | Int | Taxminiy vaqt (daqiqa) |
| base_price | Decimal | Platforma tavsiya narxi |
| is_active | Boolean | |

### orders
| Ustun | Tur | Izoh |
|---|---|---|
| id | UUID | PK |
| passenger_id | UUID | FK → users |
| driver_id | UUID? | FK → users (qabul qilgandan keyin) |
| route_id | UUID | FK → routes |
| status | Enum | OPEN, ACCEPTED, ARRIVED, FOUND, CANCELLED, EXPIRED, DISPUTED |
| ride_type | Enum | SOLO, CARPOOL |
| seats_requested | Int | Default 1 (carpool uchun) |
| passenger_price | Decimal | Yo'lovchi taklif qilgan narx |
| final_price | Decimal? | Kelishilgan narx (counter-offer dan keyin) |
| otp_code | String? | 4-raqamli, ACCEPTED da generatsiya |
| scheduled_at | DateTime? | Oldindan bron uchun (null = hozir) |
| accepted_at | DateTime? | |
| arrived_at | DateTime? | |
| found_at | DateTime? | |
| cancelled_at | DateTime? | |
| cancelled_by | UUID? | Kim bekor qildi |
| cancellation_reason | String? | |
| expires_at | DateTime | OPEN uchun auto-expiry vaqti |
| created_at | DateTime | |

### order_status_history
| Ustun | Tur | Izoh |
|---|---|---|
| id | UUID | PK |
| order_id | UUID | FK → orders |
| status | Enum | O'zgargan status |
| changed_by | UUID | FK → users |
| metadata | JSON? | Qo'shimcha ma'lumot |
| created_at | DateTime | |

### offers (Counter-offer / Negotiation)
| Ustun | Tur | Izoh |
|---|---|---|
| id | UUID | PK |
| order_id | UUID | FK → orders |
| driver_id | UUID | FK → users |
| offered_price | Decimal | Haydovchi taklif narxi |
| status | Enum | PENDING, ACCEPTED, REJECTED, EXPIRED |
| message | String? | Qisqa xabar ("AC bor, tez olib ketaman") |
| responded_at | DateTime? | |
| expires_at | DateTime | Auto-expiry |
| created_at | DateTime | |

### driver_announcements
| Ustun | Tur | Izoh |
|---|---|---|
| id | UUID | PK |
| driver_id | UUID | FK → users |
| route_id | UUID | FK → routes |
| departure_time | DateTime | Ketish vaqti |
| available_seats | Int | Bo'sh o'rindiqlar |
| price_per_seat | Decimal | Har bir o'rindiq narxi |
| status | Enum | ACTIVE, EXPIRED, CANCELLED |
| note | String? | Qo'shimcha izoh |
| expires_at | DateTime | Avtomatik expiry |
| created_at | DateTime | |

### wallets
| Ustun | Tur | Izoh |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users, Unique |
| balance | Decimal | Joriy balans |
| held_amount | Decimal | Hold qilingan summa |
| created_at | DateTime | |
| updated_at | DateTime | |

### wallet_transactions
| Ustun | Tur | Izoh |
|---|---|---|
| id | UUID | PK |
| wallet_id | UUID | FK → wallets |
| type | Enum | TOPUP, HOLD, CAPTURE, RELEASE, BONUS |
| amount | Decimal | Summa |
| reference_id | UUID? | Order yoki referral ID |
| description | String | Izoh |
| created_at | DateTime | |

### commission_holds
| Ustun | Tur | Izoh |
|---|---|---|
| id | UUID | PK |
| order_id | UUID | FK → orders |
| wallet_id | UUID | FK → wallets |
| amount | Decimal | Hold summa |
| status | Enum | HELD, CAPTURED, RELEASED |
| held_at | DateTime | |
| resolved_at | DateTime? | |

### ratings
| Ustun | Tur | Izoh |
|---|---|---|
| id | UUID | PK |
| order_id | UUID | FK → orders |
| rater_id | UUID | FK → users (baholovchi) |
| rated_id | UUID | FK → users (baholanuvchi) |
| score | Int | 1-5 |
| created_at | DateTime | |

### referrals
| Ustun | Tur | Izoh |
|---|---|---|
| id | UUID | PK |
| referrer_id | UUID | FK → users (taklif qiluvchi) |
| referred_id | UUID | FK → users (taklif qilingan) |
| bonus_amount | Decimal | Bonus summasi |
| status | Enum | PENDING, COMPLETED |
| completed_at | DateTime? | Birinchi safar tugagandan keyin |
| created_at | DateTime | |

### order_location_proofs
| Ustun | Tur | Izoh |
|---|---|---|
| id | UUID | PK |
| order_id | UUID | FK → orders |
| driver_id | UUID | FK → users |
| lat | Float | GPS koordinata |
| lng | Float | |
| accuracy_meters | Float | GPS aniqlik |
| distance_to_pickup_m | Float | Pickup nuqtasigacha masofa |
| is_valid | Boolean | Radius ichidami? |
| checked_at | DateTime | |

### disputes
| Ustun | Tur | Izoh |
|---|---|---|
| id | UUID | PK |
| order_id | UUID | FK → orders |
| opened_by | UUID | FK → users |
| reason | String | Sabab |
| description | String | Batafsil |
| status | Enum | OPEN, REVIEWING, RESOLVED, REJECTED |
| resolution | String? | Admin qarori |
| resolved_by | UUID? | FK → users (admin) |
| resolved_at | DateTime? | |
| created_at | DateTime | |

### notifications
| Ustun | Tur | Izoh |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users |
| title | String | Sarlavha |
| body | String | Xabar matni |
| type | Enum | ORDER, OFFER, WALLET, SYSTEM, REFERRAL |
| data | JSON? | Qo'shimcha data (order_id va h.k.) |
| is_read | Boolean | Default false |
| created_at | DateTime | |

### risk_events
| Ustun | Tur | Izoh |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users |
| event_type | Enum | CANCEL, INVALID_ARRIVAL, DISPUTE, FAKE_GPS |
| severity | Enum | LOW, MEDIUM, HIGH |
| metadata | JSON? | |
| created_at | DateTime | |

### admin_actions
| Ustun | Tur | Izoh |
|---|---|---|
| id | UUID | PK |
| admin_id | UUID | FK → users |
| action | String | "approve_driver", "block_user", "topup_wallet" |
| target_id | UUID | Target entity ID |
| details | JSON? | |
| created_at | DateTime | |

---

## API Endpoints

### Auth Module
```
POST   /api/auth/send-otp          # OTP yuborish (phone)
POST   /api/auth/verify-otp        # OTP tasdiqlash → JWT tokens
POST   /api/auth/refresh            # Access token yangilash
POST   /api/auth/logout             # Joriy session tugatish
DELETE /api/auth/sessions/:id       # Boshqa qurilmadagi sessionni tugatish
GET    /api/auth/sessions           # Barcha aktiv sessionlar ro'yxati
```

### Users Module
```
GET    /api/users/me                # Joriy user profil
PATCH  /api/users/me                # Profilni tahrirlash
GET    /api/users/:id               # User profil ko'rish (public)
```

### Drivers Module
```
POST   /api/drivers/apply                    # Haydovchi arizasi
GET    /api/drivers/application-status       # Ariza holati
GET    /api/drivers/profile                  # Driver profil
PATCH  /api/drivers/profile                  # Profil tahrirlash (tags ham)
GET    /api/drivers/:id/stats                # Route badge — marshrut tajribasi
```

### Vehicles Module
```
POST   /api/vehicles                # Mashina qo'shish
GET    /api/vehicles                # Haydovchi mashinalari
PATCH  /api/vehicles/:id            # Mashina tahrirlash
DELETE /api/vehicles/:id            # Mashina o'chirish
```

### Regions Module
```
GET    /api/regions                  # Barcha shaharlar
```

### Routes Module
```
GET    /api/routes                   # Barcha marshrutlar
GET    /api/routes/:id               # Marshrut detallari
GET    /api/routes/search?from=&to=  # Marshrut qidirish
```

### Orders Module
```
POST   /api/orders                   # Buyurtma yaratish (narx bilan)
GET    /api/orders                   # Mening buyurtmalarim (paginated)
GET    /api/orders/:id               # Buyurtma detallari
PATCH  /api/orders/:id/cancel        # Buyurtmani bekor qilish
GET    /api/orders/feed              # Haydovchi feed (mavjud buyurtmalar)
PATCH  /api/orders/:id/accept        # Buyurtmani qabul qilish (haydovchi)
PATCH  /api/orders/:id/arrive        # GPS bilan yetib kelganini tasdiqlash
PATCH  /api/orders/:id/confirm-otp   # OTP kiritish → FOUND
GET    /api/orders/:id/history       # Status tarixi
```

### Offers Module (Negotiation)
```
POST   /api/offers                   # Counter-offer yaratish (haydovchi)
GET    /api/offers/order/:orderId    # Buyurtmadagi barcha offerlar
PATCH  /api/offers/:id/accept        # Offerni qabul qilish (yo'lovchi)
PATCH  /api/offers/:id/reject        # Offerni rad qilish (yo'lovchi)
GET    /api/offers/my                # Haydovchining barcha offerlari
```

### Announcements Module
```
POST   /api/announcements            # E'lon yaratish (haydovchi)
GET    /api/announcements            # Barcha aktiv e'lonlar (feed)
GET    /api/announcements/my         # Mening e'lonlarim
PATCH  /api/announcements/:id        # E'lonni tahrirlash
DELETE /api/announcements/:id        # E'lonni bekor qilish
GET    /api/announcements/route/:id  # Marshrut bo'yicha e'lonlar
```

### Wallet Module
```
GET    /api/wallet                   # Balans ko'rish
GET    /api/wallet/transactions      # Tranzaksiya tarixi (paginated)
```

### Ratings Module
```
POST   /api/ratings                  # Baho berish (safar tugagandan keyin)
GET    /api/ratings/user/:id         # Foydalanuvchi reytingi (avg + count)
```

### Referrals Module
```
GET    /api/referrals/code           # Mening referral kodam
GET    /api/referrals/stats          # Nechta odam taklif qilganim
POST   /api/referrals/apply          # Referral kod kiritish (ro'yxatdan o'tishda)
```

### Disputes Module
```
POST   /api/disputes                 # Dispute ochish
GET    /api/disputes                 # Mening dispute'larim
GET    /api/disputes/:id             # Dispute detallari
```

### Notifications Module
```
GET    /api/notifications            # Bildirishnomalar (paginated)
PATCH  /api/notifications/:id/read   # O'qildi deb belgilash
PATCH  /api/notifications/read-all   # Hammasini o'qildi
```

### Admin Module
```
# Users
GET    /api/admin/users                          # Barcha userlar (filter, search, paginate)
PATCH  /api/admin/users/:id/block                # Userni bloklash
PATCH  /api/admin/users/:id/unblock              # Blokni ochish

# Driver Applications
GET    /api/admin/applications                   # Barcha arizalar (filter by status)
PATCH  /api/admin/applications/:id/approve       # Arizani tasdiqlash
PATCH  /api/admin/applications/:id/reject        # Arizani rad qilish

# Drivers
GET    /api/admin/drivers                        # Barcha haydovchilar
PATCH  /api/admin/drivers/:id/suspend            # Haydovchini suspend qilish
PATCH  /api/admin/drivers/:id/unsuspend          # Suspendni ochish

# Wallet
POST   /api/admin/wallet/:userId/topup           # Balansga pul qo'shish
GET    /api/admin/wallet/transactions             # Barcha tranzaksiyalar

# Commission
GET    /api/admin/commission/settings             # Komissiya sozlamalari
PATCH  /api/admin/commission/settings             # Komissiya o'zgartirish

# Orders
GET    /api/admin/orders                          # Barcha buyurtmalar
GET    /api/admin/orders/:id                      # Buyurtma detallari

# Disputes
GET    /api/admin/disputes                        # Barcha dispute'lar
PATCH  /api/admin/disputes/:id/resolve            # Dispute hal qilish
PATCH  /api/admin/disputes/:id/reject             # Dispute rad qilish

# Regions & Routes
POST   /api/admin/regions                         # Region qo'shish
PATCH  /api/admin/regions/:id                     # Region tahrirlash
POST   /api/admin/routes                          # Marshrut qo'shish
PATCH  /api/admin/routes/:id                      # Marshrut tahrirlash

# Referrals
PATCH  /api/admin/referrals/settings              # Bonus summa sozlash

# Statistics
GET    /api/admin/stats/dashboard                 # Umumiy statistika
GET    /api/admin/stats/orders                    # Buyurtma statistikasi
GET    /api/admin/stats/revenue                   # Daromad hisoboti

# Risk & Anti-fraud
GET    /api/admin/risk-events                     # Risk hodisalari
GET    /api/admin/risk-events/user/:id            # User risk tarixi
```

---

## Biznes Qoidalar (Business Rules)

### Auth
1. OTP 4 raqamli, 2 daqiqa amal qiladi
2. OTP yuborishda rate limit: 1 marta/60 soniya, max 5 marta/soat
3. OTP Redis'da saqlanadi (cache)
4. Access token: 15 daqiqa, Refresh token: 30 kun
5. Bitta qurilmada bitta aktiv session
6. Refresh token rotate qilinadi (har yangilanishda yangi token)

### Driver Application
1. Faqat USER roli ariza bera oladi
2. Bitta vaqtda faqat bitta PENDING ariza bo'lishi mumkin
3. APPROVED bo'lganda: role → DRIVER, driver_profile yaratiladi, wallet yaratiladi
4. REJECTED bo'lganda: qayta ariza berish mumkin

### Orders
1. Yo'lovchi narx bilan buyurtma yaratadi
2. `scheduled_at` bo'lsa — oldindan bron, bo'lmasa — hozir
3. `ride_type`: SOLO yoki CARPOOL
4. CARPOOL da `seats_requested` 1-dan ko'p bo'lishi mumkin
5. OPEN statusda `expires_at` bo'ladi (default: 30 daqiqa, bron uchun departure_time gacha)
6. **DB locking**: haydovchi ACCEPT qilganda `SELECT FOR UPDATE` — ikki haydovchi bir vaqtda qabul qila olmaydi
7. ACCEPTED da OTP kod generatsiya qilinadi va yo'lovchiga yuboriladi
8. ACCEPTED da komissiya HOLD qilinadi (wallet'dan)
9. ARRIVED — haydovchi GPS jo'natadi, radius tekshiriladi
10. FOUND — haydovchi OTP kiritadi, mos kelsa → FOUND, komissiya CAPTURE
11. CANCELLED — kim va qaysi statusda bekor qilganiga qarab qoidalar farq qiladi

### Cancellation Rules
| Kim | Qaysi statusda | Natija |
|---|---|---|
| Yo'lovchi | OPEN | Erkin bekor qilish |
| Yo'lovchi | ACCEPTED | Cancel counter +1, 3 ta dan keyin ogohlantirish |
| Haydovchi | ACCEPTED | Cancel counter +1, komissiya RELEASE, 3 ta dan keyin ogohlantirish |
| Tizim | OPEN (expired) | Avtomatik EXPIRED |

### Negotiation (Counter-offer)
1. Buyurtma OPEN statusda bo'lganda haydovchi counter-offer bera oladi
2. Bir buyurtmaga bir haydovchi faqat bitta aktiv offer bera oladi
3. Offer expiry: 10 daqiqa (auto-expire)
4. Yo'lovchi accept qilsa → order ACCEPTED bo'ladi, `final_price` = offer narxi
5. Yo'lovchi reject qilsa → offer REJECTED, haydovchi yangi offer bera oladi
6. Yo'lovchi to'g'ridan-to'g'ri haydovchini tanlasa (offersiz) → `final_price` = `passenger_price`

### Carpooling
1. Haydovchi vehicle'da `seat_count` belgilaydi
2. CARPOOL orderlarda bir marshrutda bir nechta aktiv order bo'lishi mumkin
3. Har bir yangi order qabul qilinganda `available_seats -= seats_requested`
4. Bo'sh o'rindiq qolmasa — feed'da ko'rinmaydi
5. Har bir yo'lovchi uchun alohida order, alohida OTP, alohida to'lov

### Driver Announcements
1. Faqat ACTIVE statusdagi haydovchi e'lon bera oladi
2. `departure_time` o'tgan vaqt bo'lmasligi kerak
3. `expires_at` = `departure_time` (ketish vaqti o'tsa, avtomatik expire)
4. Yo'lovchi e'lonni ko'rib to'g'ridan-to'g'ri order yaratadi (haydovchiga yo'naltirilgan)
5. Bir vaqtda max 3 ta aktiv e'lon

### Wallet & Commission
1. Wallet faqat DRIVER uchun yaratiladi
2. Admin topup qiladi (naqd pul oladi → balansga qo'shadi)
3. Komissiya foizi admin sozlaydi (default: 10%)
4. ACCEPTED da: `commission = final_price * commission_rate` → HOLD
5. FOUND da: HOLD → CAPTURE (balansdan chiqadi)
6. CANCELLED da: HOLD → RELEASE (balansga qaytadi)
7. Balans yetarli bo'lmasa — haydovchi order qabul qila olmaydi

### GPS Arrival Proof
1. Haydovchi ARRIVE qilganda GPS koordinata yuboriladi
2. Haversine formula bilan pickup nuqtasigacha masofa hisoblanadi
3. **Radius**: 500 metr ichida bo'lsa — valid
4. **Accuracy threshold**: GPS accuracy > 100m bo'lsa — rad qilinadi
5. Invalid arrival urinishlari risk_events ga yoziladi
6. 3 ta invalid urinishdan keyin — admin ogohlantirish

### OTP Confirmation
1. 4-raqamli kod, ACCEPTED da generatsiya
2. Yo'lovchi kodini haydovchiga og'zaki aytadi
3. Haydovchi ilovaga kiritadi
4. 3 marta noto'g'ri kiritsa — order DISPUTED ga o'tadi
5. OTP amal qilish muddati: cheksiz (order FOUND yoki CANCELLED bo'lgunicha)

### Ratings
1. Faqat FOUND statusli orderda baho berish mumkin
2. FOUND dan 24 soat ichida baho berish kerak
3. Ikki tomonlama: yo'lovchi → haydovchi, haydovchi → yo'lovchi
4. Bir orderda bir marta baho berish mumkin
5. Profildagi reyting = barcha baholar o'rtachasi

### Route Experience Badge
1. Haydovchi profilida marshrut bo'yicha tugatilgan safarlar soni
2. Hisob: `COUNT(orders WHERE driver_id AND route_id AND status = FOUND)`
3. Feed'da haydovchi nomi yonida ko'rinadi
4. Alohida jadval kerak emas — query bilan hisoblanadi

### Referral System
1. Har bir user ro'yxatdan o'tganda avtomatik referral kod oladi
2. Yangi user ro'yxatdan o'tishda referral kod kiritadi (ixtiyoriy)
3. Bonus shartlari: referred user birinchi safarni tugatganda (FOUND)
4. Bonus ikki tomonga: referrer ham, referred ham oladi
5. Bonus summasi admin sozlaydi
6. Bonus wallet'ga BONUS transaction sifatida tushadi

### Anti-Fraud & Risk
1. **Cancel limit**: 3 ta cancel / 24 soat → ogohlantirish, 5 ta → vaqtinchalik suspend
2. **Invalid arrival**: 3 ta invalid GPS urinish → admin ogohlantirish
3. **Fake GPS detection**: accuracy < 5m + tezlik anomaliyasi → risk event
4. **OTP brute force**: 3 ta noto'g'ri OTP → order DISPUTED
5. **Dispute counter**: 3+ ochiq dispute → profil tekshiruvga olinadi
6. Risk eventlar admin panelda ko'rinadi

### Driver Feed Filtering
Haydovchi feed'da faqat quyidagi ordersni ko'radi:
1. Status = OPEN
2. Marshrut haydovchi marshrut sozlamalariga mos (agar belgilangan bo'lsa)
3. Haydovchi status = ACTIVE (suspended/blocked emas)
4. Wallet balans yetarli (komissiya uchun)
5. Haydovchi blocked qilinmagan (yo'lovchi tomonidan)
6. CARPOOL order bo'lsa — bo'sh o'rindiq bor
7. Scheduled order bo'lsa — departure_time hali o'tmagan

---

## Cron Jobs / Background Tasks

| Job | Interval | Vazifasi |
|---|---|---|
| Order Expiry | Har 1 daqiqa | OPEN + `expires_at` o'tgan → EXPIRED |
| Announcement Expiry | Har 5 daqiqa | ACTIVE + `expires_at` o'tgan → EXPIRED |
| Offer Expiry | Har 1 daqiqa | PENDING + `expires_at` o'tgan → EXPIRED |
| Rating Reminder | Har 1 soat | FOUND + 12 soat o'tgan + baho berilmagan → notification |
| Cancel Counter Reset | Har 24 soat | Kunlik cancel counterlarni reset |
| Suspend Check | Har 1 soat | Cancel/risk limit oshganlarga auto-suspend |

---

## Environment Variables

```env
# App
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/rideshare

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d

# SMS Provider
SMS_API_URL=https://sms-provider.uz/api
SMS_API_KEY=your-sms-api-key

# Commission
DEFAULT_COMMISSION_RATE=0.10

# GPS
ARRIVAL_RADIUS_METERS=500
GPS_ACCURACY_THRESHOLD_METERS=100

# Order
ORDER_EXPIRY_MINUTES=30
OFFER_EXPIRY_MINUTES=10

# Referral
REFERRAL_BONUS_AMOUNT=10000

# Anti-fraud
MAX_CANCELS_PER_DAY=5
MAX_INVALID_ARRIVALS=3
MAX_OTP_ATTEMPTS=3
```

---

## Docker Compose (Development)

```yaml
version: '3.8'
services:
  postgres:
    image: postgis/postgis:15-3.3
    environment:
      POSTGRES_DB: rideshare
      POSTGRES_USER: rideshare_user
      POSTGRES_PASSWORD: rideshare_pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

---

## Implementation Priority (Ketma-ketlik)

### Phase 1 — Core (MVP asosi)
1. Project setup (NestJS, Prisma, Docker)
2. Auth module (OTP, JWT, sessions)
3. Users module
4. Regions & Routes module (seed data)
5. Drivers module (application, approval)
6. Vehicles module
7. Wallet module (topup, balance)

### Phase 2 — Order Flow
8. Orders module (create, accept, arrive, confirm)
9. Commission (hold/capture/release)
10. GPS arrival proof
11. OTP confirmation
12. Order expiry cron

### Phase 3 — New Features
13. Offers module (counter-offer / negotiation)
14. Announcements module
15. Ratings module
16. Referrals module

### Phase 4 — Admin & Safety
17. Admin module (users, drivers, orders, wallet, stats)
18. Disputes module
19. Anti-fraud & risk events
20. Notifications module (push)

---

## Performance & Server Optimizatsiya

### Database Indexlar (muhim!)

```
-- Auth tezligi
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_referral_code ON users(referral_code);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_device_id ON user_sessions(device_id);

-- Order feed tezligi (eng muhim query)
CREATE INDEX idx_orders_status_route ON orders(status, route_id) WHERE status = 'OPEN';
CREATE INDEX idx_orders_passenger ON orders(passenger_id, status);
CREATE INDEX idx_orders_driver ON orders(driver_id, status);
CREATE INDEX idx_orders_expires_at ON orders(expires_at) WHERE status = 'OPEN';
CREATE INDEX idx_orders_scheduled ON orders(scheduled_at) WHERE scheduled_at IS NOT NULL;

-- Offer tezligi
CREATE INDEX idx_offers_order_status ON offers(order_id, status);
CREATE INDEX idx_offers_driver ON offers(driver_id, status);
CREATE INDEX idx_offers_expires ON offers(expires_at) WHERE status = 'PENDING';

-- Announcement feed
CREATE INDEX idx_announcements_status_route ON driver_announcements(status, route_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_announcements_driver ON driver_announcements(driver_id, status);
CREATE INDEX idx_announcements_expires ON driver_announcements(expires_at) WHERE status = 'ACTIVE';

-- Wallet tezligi
CREATE INDEX idx_wallets_user ON wallets(user_id);
CREATE INDEX idx_wallet_tx_wallet ON wallet_transactions(wallet_id, created_at DESC);
CREATE INDEX idx_commission_holds_order ON commission_holds(order_id);
CREATE INDEX idx_commission_holds_status ON commission_holds(status) WHERE status = 'HELD';

-- Rating hisoblash
CREATE INDEX idx_ratings_rated ON ratings(rated_id);
CREATE INDEX idx_ratings_order ON ratings(order_id);

-- Driver feed filter
CREATE INDEX idx_driver_profiles_status ON driver_profiles(status) WHERE status = 'ACTIVE';
CREATE INDEX idx_driver_applications_user ON driver_applications(user_id, status);

-- Risk & admin
CREATE INDEX idx_risk_events_user ON risk_events(user_id, created_at DESC);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_disputes_status ON disputes(status);
```

**Partial index** ishlatilgan (`WHERE status = 'OPEN'`) — bu faqat kerakli qatorlarni indekslaydi, disk va RAM tejaydi.

### Query Optimizatsiya

1. **Driver feed** — eng ko'p so'raladigan endpoint:
   ```sql
   -- Yomon: barcha orderlarni olib, JS da filter
   SELECT * FROM orders;

   -- Yaxshi: DB da filter, faqat kerakli fieldlar
   SELECT o.id, o.passenger_price, o.ride_type, o.seats_requested, o.scheduled_at,
          r.from_region_id, r.to_region_id, r.distance_km,
          u.first_name, u.avatar_url
   FROM orders o
   JOIN routes r ON o.route_id = r.id
   JOIN users u ON o.passenger_id = u.id
   WHERE o.status = 'OPEN'
     AND o.expires_at > NOW()
     AND o.route_id IN (SELECT route_id FROM driver_routes WHERE driver_id = $1)
   ORDER BY o.created_at DESC
   LIMIT 20 OFFSET 0;
   ```

2. **Route badge** — cache bilan:
   ```sql
   -- Har safar COUNT qilmaslik uchun Redis cache (TTL: 1 soat)
   -- Key: route_badge:{driver_id}:{route_id}
   -- Value: completed trip count
   ```

3. **Rating o'rtachasi** — `driver_profiles` jadvaliga `avg_rating` va `total_ratings` fieldlar qo'shiladi:
   ```sql
   -- Har baho berilganda yangilanadi (trigger yoki service da)
   UPDATE driver_profiles
   SET avg_rating = (SELECT AVG(score)::NUMERIC(2,1) FROM ratings WHERE rated_id = $1),
       total_ratings = (SELECT COUNT(*) FROM ratings WHERE rated_id = $1)
   WHERE user_id = $1;
   ```

### Redis Cache Strategiyasi

| Key pattern | TTL | Maqsad |
|---|---|---|
| `otp:{phone}` | 2 min | OTP kodi |
| `otp_rate:{phone}` | 1 soat | OTP yuborish limiti |
| `session:{userId}:{deviceId}` | 30 kun | Session ma'lumot |
| `route_badge:{driverId}:{routeId}` | 1 soat | Marshrut tajriba soni |
| `user_rating:{userId}` | 30 min | O'rtacha reyting |
| `active_regions` | 6 soat | Regionlar ro'yxati (kamdan-kam o'zgaradi) |
| `active_routes` | 6 soat | Marshrutlar ro'yxati |
| `commission_rate` | 24 soat | Komissiya foizi |
| `cancel_count:{userId}` | 24 soat | Kunlik cancel soni |

### Connection Pool & Server Tuning

```env
# Prisma connection pool
DATABASE_URL=postgresql://user:pass@localhost:5432/rideshare?connection_limit=20&pool_timeout=10

# NestJS server
THROTTLE_TTL=60          # Rate limit oynasi (soniya)
THROTTLE_LIMIT=100       # Oyna ichida max so'rov
MAX_JSON_SIZE=10mb       # Rasm upload uchun
CORS_ORIGINS=*           # Production da aniq domain
```

### Rate Limiting (Throttle)

| Endpoint guruhi | Limit | Sabab |
|---|---|---|
| `POST /auth/send-otp` | 1/60s, 5/soat | SMS spam oldini olish |
| `POST /auth/verify-otp` | 5/5min | Brute force |
| `POST /orders` | 10/daqiqa | Spam buyurtma |
| `POST /offers` | 20/daqiqa | Spam offer |
| `GET /orders/feed` | 60/daqiqa | Feed polling |
| Boshqa GET lar | 100/daqiqa | Umumiy |
| Boshqa POST/PATCH lar | 30/daqiqa | Umumiy |

### Pagination Best Practices

```typescript
// Barcha list endpointlarda:
// ?page=1&limit=20&sort=created_at&order=desc

// Response format:
{
  success: true,
  data: [...],
  meta: {
    page: 1,
    limit: 20,
    total: 150,
    totalPages: 8,
    hasNext: true,
    hasPrev: false
  }
}
```

### Logging & Monitoring

```typescript
// Request log format (har bir so'rov):
{
  method: 'POST',
  path: '/api/orders',
  userId: 'uuid',
  statusCode: 201,
  duration: 45,        // ms
  timestamp: '2026-05-12T...'
}

// Muhim eventlar uchun structured logging:
// - Auth: login, logout, failed OTP
// - Orders: status o'zgarishi
// - Wallet: HOLD, CAPTURE, RELEASE, TOPUP
// - Admin: barcha admin harakatlari
// - Risk: fraud hodisalar
```

### Error Handling Strategiyasi

```typescript
// Global exception filter:
// 1. PrismaClientKnownRequestError → user-friendly xato
//    - P2002 (unique constraint) → "Bu telefon raqam allaqachon ro'yxatdan o'tgan"
//    - P2025 (not found) → "Ma'lumot topilmadi"
// 2. HttpException → to'g'ridan-to'g'ri qaytarish
// 3. Kutilmagan xato → 500 + log yozish (user ga detail ko'rsatilmaydi)

// API Error Response:
{
  success: false,
  error: "Xato xabari",
  statusCode: 400,
  timestamp: "2026-05-12T...",
  path: "/api/orders"
}
```

### File Upload (Haydovchi hujjatlar, avatar)

```
# Upload flow:
1. Client → POST /api/upload → multer → local disk (development)
2. Production da: S3 yoki MinIO
3. Max file size: 5MB
4. Ruxsat berilgan formatlar: jpg, jpeg, png, pdf
5. Fayl nomi: UUID + extension (collision yo'q)
6. Upload papka: /uploads/{userId}/{filename}

# Upload endpoint:
POST /api/upload          # Fayl yuklash → URL qaytaradi
GET  /uploads/:filename   # Static serve (development)
```

---

## Security (Xavfsizlik)

### Authentication & Authorization
1. **JWT** — access token headerda: `Authorization: Bearer <token>`
2. **Refresh token** — httpOnly cookie yoki body da
3. **Role-based access** — `@Roles('ADMIN')` decorator + RolesGuard
4. **Resource ownership** — user faqat o'z resurslarini ko'ra/o'zgartira oladi

### Input Validation
1. **class-validator** — barcha DTO larda validation
2. **Whitelist** — faqat DTO da belgilangan fieldlar qabul qilinadi, ortiqchasi tashlanadi
3. **Transform** — `@Transform()` bilan sanitize (trim, lowercase)
4. **Phone format** — `+998XXXXXXXXX` formati majburiy

### Database Security
1. **Prisma** — SQL injection yo'q (parameterized queries)
2. **Transaction isolation** — wallet operatsiyalarda `READ COMMITTED`
3. **Row locking** — `SELECT FOR UPDATE` concurrent access uchun

### API Security
1. **Helmet** — HTTP security headers
2. **CORS** — faqat ruxsat berilgan domainlar
3. **Rate limiting** — @nestjs/throttler
4. **Request size limit** — katta payload oldini olish
5. **No sensitive data in logs** — OTP, token, password logga yozilmaydi

---

## Deployment (Production)

### Minimal server talablari
- **VPS**: 2 CPU, 4GB RAM, 40GB SSD (boshlash uchun yetarli)
- **OS**: Ubuntu 22.04 LTS
- **Node.js**: 20 LTS
- **PostgreSQL**: 15+
- **Redis**: 7+

### Production setup
```
# PM2 bilan ishga tushirish
npm run build
pm2 start dist/main.js --name rideshare-api -i 2

# Yoki Docker
docker-compose -f docker-compose.prod.yml up -d
```

### Nginx reverse proxy
```nginx
server {
    listen 80;
    server_name api.rideshare.uz;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /uploads/ {
        alias /var/www/rideshare/uploads/;
        expires 30d;
    }
}
```

---

## Notes

- **Barcha narxlar** `Decimal` tipida saqlanadi (floating point xatolik bo'lmasligi uchun)
- **Barcha vaqtlar** UTC da saqlanadi, frontend o'zi local time ga aylantiradi
- **Soft delete** ishlatilmaydi — faqat `is_active` flag bilan
- **Pagination** barcha list endpoint'larda: `?page=1&limit=20`
- **API Response format**: `{ success: boolean, data: T, message?: string }`
- **Error format**: `{ success: false, error: string, statusCode: number }`
- **OTP, token, parol** hech qachon response da qaytarilmaydi (faqat yangi yaratilganda)
- **Barcha UUID** v4 formatda
- **Barcha enum'lar** SCREAMING_SNAKE_CASE da (OPEN, ACCEPTED, FOUND)
- **Barcha endpoint'lar** `/api/` prefiksi bilan
- **Swagger** `/api/docs` da avtomatik generatsiya qilinadi
