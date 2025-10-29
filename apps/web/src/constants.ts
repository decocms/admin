export const ALLOWANCES = [
  "camera",
  "microphone",
  "display-capture",
  "autoplay",
  "accelerometer",
  "clipboard-write",
  "encrypted-media",
  "gyroscope",
  "picture-in-picture",
  "web-share",
  "fullscreen",
  "geolocation",
  "payment",
].join("; ");

export const WELL_KNOWN_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "aol.com",
  "hotmail.co.uk",
  "hotmail.fr",
  "msn.com",
  "yahoo.fr",
  "wanadoo.fr",
  "orange.fr",
  "comcast.net",
  "yahoo.co.uk",
  "yahoo.com.br",
  "yahoo.co.in",
  "live.com",
  "rediffmail.com",
  "free.fr",
  "gmx.de",
  "web.de",
  "yandex.ru",
  "ymail.com",
  "libero.it",
  "outlook.com",
  "uol.com.br",
  "bol.com.br",
  "mail.ru",
  "cox.net",
  "hotmail.it",
  "sbcglobal.net",
  "sfr.fr",
  "live.fr",
  "verizon.net",
  "live.co.uk",
  "googlemail.com",
  "yahoo.es",
  "ig.com.br",
  "live.nl",
  "bigpond.com",
  "terra.com.br",
  "yahoo.it",
  "neuf.fr",
  "yahoo.de",
  "alice.it",
  "rocketmail.com",
  "att.net",
  "laposte.net",
  "facebook.com",
  "bellsouth.net",
  "yahoo.in",
  "hotmail.es",
  "charter.net",
  "yahoo.ca",
  "yahoo.com.au",
  "rambler.ru",
  "hotmail.de",
  "tiscali.it",
  "shaw.ca",
  "yahoo.co.jp",
  "sky.com",
  "earthlink.net",
  "optonline.net",
  "freenet.de",
  "t-online.de",
  "aliceadsl.fr",
  "virgilio.it",
  "home.nl",
  "qq.com",
  "telenet.be",
  "me.com",
  "icloud.com", // Apple iCloud
  "proton.me", // ProtonMail
  "fastmail.com", // Fastmail
  "zoho.com", // Zoho Mail
  "hushmail.com", // Hushmail
  "yahoo.com.ph", // Yahoo Philippines
  "mailinator.com", // Temporary email
  "gmx.com", // GMX International
  "yahoo.com.hk", // Yahoo Hong Kong
  "yahoo.co.th", // Yahoo Thailand
  "yahoo.com.vn", // Yahoo Vietnam
  "yahoo.com.cn", // Yahoo China (legacy)
  "mailbox.org", // Secure German provider
  "posteo.de", // Secure German provider
  "bigmir.net", // Ukraine
  "ukr.net", // Ukraine
  "126.com", // Chinese provider
  "163.com", // Chinese provider
  "sina.com", // Chinese provider
  "tutanota.com", // Secure email
  "runbox.com", // Secure email
  "zoznam.sk", // Slovakia
  "seznam.cz", // Czech Republic
  "naver.com", // South Korea
  "daum.net", // South Korea
  "lycos.com", // Legacy provider
  "bellsouth.net",
  "mac.com",
  "live.ca",
  "aim.com",
  "bigpond.net.au",
  "netzero.net", // Legacy provider
  "usa.net", // Legacy provider
  "excite.com", // Legacy provider
  "outlook.co.uk", // Outlook UK
  "outlook.de", // Outlook Germany
  "mailbox.org", // Privacy-focused
]);

export const DECO_ADMIN_EMAIL_DOMAINS = [
  "deco.cx",
  "decocms.com",
  "carcara.tech",
  "caracara.tech",
] as const;

export const POSTHOG_PROJECT_API_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;

export const POSTHOG_ORIGIN = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

// Uncomment this if you want to test event tracking in development
// export const POSTHOG_SHOULD_TRACK = true;
export const POSTHOG_SHOULD_TRACK = import.meta.env.MODE !== "development";

export const LEGACY_INTEGRATIONS = [
  "i:user-management",
  "i:workspace-management",
];
