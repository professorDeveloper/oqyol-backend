import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://rideshare_user:rideshare_pass@localhost:5432/rideshare?schema=public";

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Uzbekistan viloyatlari + Toshkent shahar. Lat/Lng — viloyat markazi taxminiy.
// radiusKm — order matching uchun standart radius.
const REGIONS = [
  {
    code: "TSH",
    name: "Toshkent shahri",
    lat: 41.3111,
    lng: 69.2797,
    radiusKm: 35,
    districts: [
      "Bektemir",
      "Chilonzor",
      "Mirobod",
      "Mirzo Ulug'bek",
      "Olmazor",
      "Sergeli",
      "Shayxontohur",
      "Uchtepa",
      "Yakkasaroy",
      "Yangihayot",
      "Yashnobod",
      "Yunusobod",
    ],
  },
  {
    code: "TAS",
    name: "Toshkent viloyati",
    lat: 41.0,
    lng: 69.5833,
    radiusKm: 120,
    districts: [
      "Angren",
      "Bekobod",
      "Bo'ka",
      "Bo'stonliq",
      "Chinoz",
      "Chirchiq",
      "Ohangaron",
      "Olmaliq",
      "Oqqo'rg'on",
      "O'rta Chirchiq",
      "Parkent",
      "Piskent",
      "Quyichirchiq",
      "Qibray",
      "Yangiyo'l",
      "Yuqori Chirchiq",
      "Zangiota",
      "Nurafshon",
    ],
  },
  {
    code: "AND",
    name: "Andijon viloyati",
    lat: 40.7821,
    lng: 72.3442,
    radiusKm: 80,
    districts: [
      "Andijon shahri",
      "Andijon tumani",
      "Asaka",
      "Baliqchi",
      "Bo'z",
      "Buloqboshi",
      "Izboskan",
      "Jalaquduq",
      "Xo'jaobod",
      "Qo'rg'ontepa",
      "Marhamat",
      "Oltinko'l",
      "Paxtaobod",
      "Shahrixon",
      "Ulug'nor",
    ],
  },
  {
    code: "BUX",
    name: "Buxoro viloyati",
    lat: 39.7747,
    lng: 64.4286,
    radiusKm: 120,
    districts: [
      "Buxoro shahri",
      "Buxoro tumani",
      "G'ijduvon",
      "Jondor",
      "Kogon shahri",
      "Kogon tumani",
      "Olot",
      "Peshku",
      "Qorako'l",
      "Qorovulbozor",
      "Romitan",
      "Shofirkon",
      "Vobkent",
    ],
  },
  {
    code: "FAR",
    name: "Farg'ona viloyati",
    lat: 40.3864,
    lng: 71.7864,
    radiusKm: 90,
    districts: [
      "Farg'ona shahri",
      "Marg'ilon",
      "Qo'qon",
      "Quvasoy",
      "Beshariq",
      "Bog'dod",
      "Buvayda",
      "Dang'ara",
      "Farg'ona tumani",
      "Furqat",
      "Quva",
      "Oltiariq",
      "Rishton",
      "So'x",
      "Toshloq",
      "O'zbekiston",
      "Uchko'prik",
      "Yozyovon",
    ],
  },
  {
    code: "JIZ",
    name: "Jizzax viloyati",
    lat: 40.1158,
    lng: 67.8422,
    radiusKm: 140,
    districts: [
      "Jizzax shahri",
      "Arnasoy",
      "Baxmal",
      "Do'stlik",
      "Forish",
      "G'allaorol",
      "Mirzacho'l",
      "Paxtakor",
      "Yangiobod",
      "Zomin",
      "Zafarobod",
      "Zarbdor",
      "Sharof Rashidov",
    ],
  },
  {
    code: "NAM",
    name: "Namangan viloyati",
    lat: 40.9983,
    lng: 71.6726,
    radiusKm: 80,
    districts: [
      "Namangan shahri",
      "Namangan tumani",
      "Chortoq",
      "Chust",
      "Kosonsoy",
      "Mingbuloq",
      "Norin",
      "Pop",
      "To'raqo'rg'on",
      "Uchqo'rg'on",
      "Uychi",
      "Yangiqo'rg'on",
    ],
  },
  {
    code: "NAV",
    name: "Navoiy viloyati",
    lat: 40.0844,
    lng: 65.3792,
    radiusKm: 200,
    districts: [
      "Navoiy shahri",
      "Karmana",
      "Konimex",
      "Nurota",
      "Qiziltepa",
      "Tomdi",
      "Uchquduq",
      "Xatirchi",
    ],
  },
  {
    code: "QAS",
    name: "Qashqadaryo viloyati",
    lat: 38.8617,
    lng: 65.7886,
    radiusKm: 140,
    districts: [
      "Qarshi shahri",
      "Shahrisabz shahri",
      "G'uzor",
      "Dehqonobod",
      "Qamashi",
      "Qarshi tumani",
      "Kasbi",
      "Kitob",
      "Koson",
      "Mirishkor",
      "Muborak",
      "Nishon",
      "Shahrisabz tumani",
      "Yakkabog'",
      "Chiroqchi",
    ],
  },
  {
    code: "SAM",
    name: "Samarqand viloyati",
    lat: 39.6542,
    lng: 66.9597,
    radiusKm: 120,
    districts: [
      "Samarqand shahri",
      "Samarqand tumani",
      "Bulung'ur",
      "Ishtixon",
      "Jomboy",
      "Kattaqo'rg'on shahri",
      "Kattaqo'rg'on tumani",
      "Narpay",
      "Nurobod",
      "Oqdaryo",
      "Past Darg'om",
      "Payariq",
      "Paxtachi",
      "Qo'shrabot",
      "Tayloq",
      "Urgut",
    ],
  },
  {
    code: "SIR",
    name: "Sirdaryo viloyati",
    lat: 40.8347,
    lng: 68.6611,
    radiusKm: 80,
    districts: [
      "Guliston shahri",
      "Sirdaryo tumani",
      "Boyovut",
      "Mirzaobod",
      "Oqoltin",
      "Sayxunobod",
      "Sardoba",
      "Xovos",
      "Yangiyer",
      "Shirin",
    ],
  },
  {
    code: "SUR",
    name: "Surxondaryo viloyati",
    lat: 37.2242,
    lng: 67.2783,
    radiusKm: 150,
    districts: [
      "Termiz shahri",
      "Termiz tumani",
      "Angor",
      "Bandixon",
      "Boysun",
      "Denov",
      "Jarqo'rg'on",
      "Qiziriq",
      "Qumqo'rg'on",
      "Muzrabod",
      "Oltinsoy",
      "Sariosiyo",
      "Sherobod",
      "Sho'rchi",
      "Uzun",
    ],
  },
  {
    code: "XOR",
    name: "Xorazm viloyati",
    lat: 41.5500,
    lng: 60.6333,
    radiusKm: 100,
    districts: [
      "Urganch shahri",
      "Urganch tumani",
      "Xiva shahri",
      "Xiva tumani",
      "Bog'ot",
      "Gurlan",
      "Xazorasp",
      "Xonqa",
      "Qo'shko'pir",
      "Shovot",
      "Yangiariq",
      "Yangibozor",
      "Tuproqqal'a",
    ],
  },
  {
    code: "QQR",
    name: "Qoraqalpog'iston Respublikasi",
    lat: 42.4731,
    lng: 59.6103,
    radiusKm: 300,
    districts: [
      "Nukus shahri",
      "Nukus tumani",
      "Amudaryo",
      "Beruniy",
      "Chimboy",
      "Ellikqala",
      "Kegeyli",
      "Mo'ynoq",
      "Qanliko'l",
      "Qorao'zak",
      "Qo'ng'irot",
      "Shumanay",
      "Taxiatosh",
      "Taxtako'pir",
      "To'rtko'l",
      "Xo'jayli",
    ],
  },
];

async function main() {
  let regionInserts = 0;
  let regionUpdates = 0;
  let districtInserts = 0;

  for (const r of REGIONS) {
    const region = await prisma.region.upsert({
      where: { name: r.name },
      update: {
        code: r.code,
        lat: r.lat,
        lng: r.lng,
        radiusKm: r.radiusKm,
      },
      create: {
        name: r.name,
        code: r.code,
        lat: r.lat,
        lng: r.lng,
        radiusKm: r.radiusKm,
      },
    });

    if (region.createdAt === undefined) regionInserts += 1;
    else regionUpdates += 1;

    for (const districtName of r.districts) {
      const result = await prisma.district.upsert({
        where: { regionId_name: { regionId: region.id, name: districtName } },
        update: {},
        create: { regionId: region.id, name: districtName },
      });
      if (result) districtInserts += 1;
    }
  }

  // Demo passenger for Play Store review / "guest" login.
  // Backend accepts phone +998901234567 with OTP code OTP_DEMO_CODE (12345)
  // without sending a real SMS — see otp.service.js demo-phone bypass.
  const demoPhone = process.env.DEMO_PHONE || "+998901234567";
  await prisma.user.upsert({
    where: { phone: demoPhone },
    update: { isActive: true },
    create: {
      phone: demoPhone,
      firstName: "Demo",
      lastName: "Passenger",
      role: "USER",
      registeredApp: "PASSENGER",
      referralCode: "DEMO0001",
      isActive: true,
    },
  });
  console.log(`Demo passenger ready: ${demoPhone} (OTP code from OTP_DEMO_CODE)`);

  const totalRegions = await prisma.region.count();
  const totalDistricts = await prisma.district.count();

  console.log(
    `Seed complete. Regions in DB: ${totalRegions}, Districts in DB: ${totalDistricts}.`
  );
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
