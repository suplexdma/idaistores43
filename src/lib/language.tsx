"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Language = "en" | "ur";

type TranslationKey =
  | "home"
  | "shop"
  | "about"
  | "contact"
  | "search"
  | "account"
  | "wishlist"
  | "cart"
  | "explore"
  | "deliveryBanner"
  | "heroEyebrow"
  | "heroTitle"
  | "heroDescription"
  | "shopNow"
  | "browseCategories"
  | "cashDelivery"
  | "shopByCategory"
  | "browseAll"
  | "newArrivals"
  | "freeDelivery"
  | "deliveryCharge"
  | "thoughtfulPicks"
  | "footerTagline"
  | "shopAll"
  | "ourStory"
  | "deliveryReturns"
  | "yourCart"
  | "getInTouch"
  | "servingPakistan"
  | "whatsapp"
  | "newsletter"
  | "newsletterText"
  | "emailAddress"
  | "join"
  | "newsletterThanks"
  | "allRightsReserved"
  | "fullName"
  | "phone"
  | "emailOptional"
  | "city"
  | "completeAddress"
  | "orderNotes"
  | "deliveryInformation"
  | "paymentMethod"
  | "cod"
  | "payOnDelivery"
  | "placeOrder"
  | "placeOrderWhatsApp"
  | "orderSavedBeforeWhatsApp"
  | "checkout"
  | "almostYours"
  | "subtotal"
  | "delivery"
  | "total"
  | "bagEmpty"
  | "emptyBagDescription"
  | "exploreShop"
  | "english"
  | "urdu"
  | "idaiEdit"
  | "littleDetails"
  | "betterDays"
  | "findSomething"
  | "freshlyAdded"
  | "homeAboutHeading"
  | "homeAboutText"
  | "newArrivalUnavailable"
  | "newProductsSoon"
  | "oneStoreManyChoices"
  | "trendingNow"
  | "originalProducts"
  | "easyReturns"
  | "supportAlways"
  | "curatedFinds"
  | "sectionEyebrow"
  | "viewCollection"
  | "yourOrder"
  | "deliveryOneStep"
  | "free"
  | "categories"
  | "moreForFreeDelivery";

const translations: Record<Language, Record<TranslationKey, string>> = {
  en: {
    home: "Home",
    shop: "Shop",
    about: "About",
    contact: "Contact",
    search: "Search products and brands",
    account: "Account",
    wishlist: "Wishlist",
    cart: "Cart",
    explore: "Explore IDAI",
    deliveryBanner: "Thoughtful finds, delivered to your door · Free delivery over PKR 2,000",
    heroEyebrow: "Everyday things, thoughtfully chosen",
    heroTitle: "Purpose Is More Important Than Need.",
    heroDescription: "Discover stationery, gifts, home essentials, and useful little finds for everyday life.",
    shopNow: "Explore the collection",
    browseCategories: "Browse categories",
    cashDelivery: "Cash on Delivery",
    shopByCategory: "Shop by category",
    browseAll: "Browse all",
    newArrivals: "New arrivals",
    freeDelivery: "Free delivery over PKR 2,000",
    deliveryCharge: "A simple flat PKR 300 delivery fee on smaller orders.",
    thoughtfulPicks: "Thoughtfully selected",
    footerTagline: "Thoughtfully selected essentials for a home and life that feel like yours.",
    shopAll: "Shop all",
    ourStory: "Our story",
    deliveryReturns: "Delivery & returns",
    yourCart: "Your cart",
    getInTouch: "Get in touch",
    servingPakistan: "Serving customers across Pakistan",
    whatsapp: "Chat with us on WhatsApp",
    newsletter: "A little note from us",
    newsletterText: "Join our list for thoughtful finds and store news.",
    emailAddress: "Your email address",
    join: "Join",
    newsletterThanks: "Thank you! Newsletter signup will be available soon.",
    allRightsReserved: "All rights reserved.",
    fullName: "Full name",
    phone: "Phone number",
    emailOptional: "Email (optional)",
    city: "City",
    completeAddress: "Complete address",
    orderNotes: "Order notes (optional)",
    deliveryInformation: "Delivery information",
    paymentMethod: "Payment method",
    cod: "Cash on Delivery",
    payOnDelivery: "Pay in cash when your order arrives.",
    placeOrder: "Place order (Cash on Delivery)",
    placeOrderWhatsApp: "Place order via WhatsApp",
    orderSavedBeforeWhatsApp: "WhatsApp orders are saved before we open your conversation.",
    checkout: "Checkout",
    almostYours: "Almost yours",
    subtotal: "Subtotal",
    delivery: "Delivery",
    total: "Total",
    bagEmpty: "Your bag is empty",
    emptyBagDescription: "Add a few thoughtful finds before checking out.",
    exploreShop: "Explore the shop",
    english: "English",
    urdu: "اردو",
    idaiEdit: "IDAI edit",
    littleDetails: "Little details. Better days.",
    betterDays: "Little details make better days.",
    findSomething: "Find your something",
    freshlyAdded: "Freshly added",
    homeAboutHeading: "Purpose is at the heart of every pick.",
    homeAboutText: "Discover thoughtfully selected stationery, toys, gifts, kitchenware, and home essentials, with convenient Cash on Delivery.",
    newArrivalUnavailable: "New arrivals are temporarily unavailable. Please visit the shop again soon.",
    newProductsSoon: "New products will appear here as soon as the collection is ready.",
    oneStoreManyChoices: "One Store, Many Choices.",
    trendingNow: "Trending now",
    originalProducts: "100% Original Products",
    easyReturns: "15-Day Easy Returns",
    supportAlways: "Here to help, always",
    curatedFinds: "A considered collection for the way you live, work, play and gift.",
    sectionEyebrow: "Made for everyday moments",
    viewCollection: "View collection",
    yourOrder: "Your order",
    deliveryOneStep: "Delivery details and payment in one simple step.",
    free: "Free",
    categories: "Categories",
    moreForFreeDelivery: "Add {amount} more for free delivery.",
  },
  ur: {
    home: "صفحۂ اول",
    shop: "خریداری",
    about: "ہمارے بارے میں",
    contact: "رابطہ",
    search: "مصنوعات اور برانڈ تلاش کریں",
    account: "اکاؤنٹ",
    wishlist: "پسندیدہ",
    cart: "کارٹ",
    explore: "آئی ڈائی دیکھیں",
    deliveryBanner: "منتخب اشیاء آپ کے دروازے تک · 2,000 روپے سے زیادہ پر مفت ڈیلیوری",
    heroEyebrow: "روزمرہ کی چیزیں، سوچ سمجھ کر منتخب",
    heroTitle: "مقصد ضرورت سے زیادہ اہم ہے۔",
    heroDescription: "اسٹیشنری، تحائف، گھر کی ضروریات اور روزمرہ کی منتخب اشیاء دریافت کریں۔",
    shopNow: "کلیکشن دیکھیں",
    browseCategories: "اقسام دیکھیں",
    cashDelivery: "کیش آن ڈیلیوری",
    shopByCategory: "قسم کے لحاظ سے خریداری",
    browseAll: "سب دیکھیں",
    newArrivals: "نئی مصنوعات",
    freeDelivery: "2,000 روپے سے زیادہ پر مفت ڈیلیوری",
    deliveryCharge: "کم آرڈر پر صرف 300 روپے ڈیلیوری چارج۔",
    thoughtfulPicks: "سوچ سمجھ کر منتخب",
    footerTagline: "آپ کے گھر اور روزمرہ زندگی کے لیے منتخب ضروری اشیاء۔",
    shopAll: "تمام مصنوعات",
    ourStory: "ہماری کہانی",
    deliveryReturns: "ڈیلیوری اور واپسی",
    yourCart: "آپ کا کارٹ",
    getInTouch: "رابطہ کریں",
    servingPakistan: "پاکستان بھر میں صارفین کے لیے",
    whatsapp: "واٹس ایپ پر رابطہ کریں",
    newsletter: "ہماری جانب سے ایک پیغام",
    newsletterText: "منتخب اشیاء اور اسٹور کی خبروں کے لیے شامل ہوں۔",
    emailAddress: "آپ کا ای میل",
    join: "شامل ہوں",
    newsletterThanks: "شکریہ! نیوز لیٹر کی سہولت جلد دستیاب ہوگی۔",
    allRightsReserved: "جملہ حقوق محفوظ ہیں۔",
    fullName: "پورا نام",
    phone: "فون نمبر",
    emailOptional: "ای میل (اختیاری)",
    city: "شہر",
    completeAddress: "مکمل پتہ",
    orderNotes: "آرڈر کے نوٹس (اختیاری)",
    deliveryInformation: "ڈیلیوری کی معلومات",
    paymentMethod: "ادائیگی کا طریقہ",
    cod: "کیش آن ڈیلیوری",
    payOnDelivery: "آرڈر پہنچنے پر نقد ادائیگی کریں۔",
    placeOrder: "آرڈر کریں (کیش آن ڈیلیوری)",
    placeOrderWhatsApp: "واٹس ایپ کے ذریعے آرڈر کریں",
    orderSavedBeforeWhatsApp: "واٹس ایپ کھولنے سے پہلے آپ کا آرڈر محفوظ کیا جائے گا۔",
    checkout: "چیک آؤٹ",
    almostYours: "بس مکمل ہونے والا ہے",
    subtotal: "ذیلی ٹوٹل",
    delivery: "ڈیلیوری",
    total: "کل رقم",
    bagEmpty: "آپ کا کارٹ خالی ہے",
    emptyBagDescription: "چیک آؤٹ سے پہلے اپنی پسند کی اشیاء شامل کریں۔",
    exploreShop: "اسٹور دیکھیں",
    english: "English",
    urdu: "اردو",
    idaiEdit: "آئی ڈائی کا انتخاب",
    littleDetails: "چھوٹی تفصیلات، بہتر دن۔",
    betterDays: "چھوٹی تفصیلات سے دن بہتر بنتے ہیں۔",
    findSomething: "اپنی پسند تلاش کریں",
    freshlyAdded: "تازہ شامل کردہ",
    homeAboutHeading: "ہر انتخاب میں مقصد شامل ہے۔",
    homeAboutText: "سوچ سمجھ کر منتخب اسٹیشنری، کھلونے، تحائف، کچن اور گھر کی ضروری اشیاء دریافت کریں۔ کیش آن ڈیلیوری بھی دستیاب ہے۔",
    newArrivalUnavailable: "نئی مصنوعات فی الحال دستیاب نہیں۔ براہ کرم جلد دوبارہ اسٹور دیکھیں۔",
    newProductsSoon: "نئی کلیکشن تیار ہوتے ہی مصنوعات یہاں نظر آئیں گی۔",
    oneStoreManyChoices: "ایک اسٹور، بے شمار انتخاب۔",
    trendingNow: "آج کی مقبول مصنوعات",
    originalProducts: "100٪ اصل مصنوعات",
    easyReturns: "15 دن میں آسان واپسی",
    supportAlways: "ہم مدد کے لیے حاضر ہیں",
    curatedFinds: "آپ کے رہن سہن، کام، کھیل اور تحائف کے لیے منتخب کلیکشن۔",
    sectionEyebrow: "روزمرہ کے خاص لمحات کے لیے",
    viewCollection: "کلیکشن دیکھیں",
    yourOrder: "آپ کا آرڈر",
    deliveryOneStep: "ڈیلیوری کی تفصیلات اور ادائیگی ایک آسان مرحلے میں۔",
    free: "مفت",
    categories: "اقسام",
    moreForFreeDelivery: "مفت ڈیلیوری کے لیے مزید {amount} کی خریداری کریں۔",
  },
};

type LanguageContextValue = {
  language: Language;
  direction: "ltr" | "rtl";
  t: (key: TranslationKey) => string;
  setLanguage: (language: Language) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem("idai-language", nextLanguage);
  }, []);

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem("idai-language");
    if (savedLanguage === "en" || savedLanguage === "ur") {
      setLanguageState(savedLanguage);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ur" ? "rtl" : "ltr";
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      direction: language === "ur" ? "rtl" : "ltr",
      t: (key) => translations[language][key],
      setLanguage,
    }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider.");
  }
  return context;
}

export type { TranslationKey };
