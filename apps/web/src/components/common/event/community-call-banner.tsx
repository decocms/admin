import { EventBanner } from "../event-banner";

// Event URLs
const COMMUNITY_CALL_URL = "https://decocms.com/discord";
const WORKSHOP_URL = "https://luma.com/6f1xmde8";

// Banner decoration images
const LEFT_BACKGROUND_IMAGE = "/img/banner-decoration-2.svg";
const RIGHT_BACKGROUND_IMAGE = "/img/banner-decoration-1.svg";

// Applied AI for Software Development - November 19, 2025, 8:30AM-1PM BRT
const WORKSHOP_START_DATE = new Date(2025, 10, 19, 8, 30, 0, 0); // Month is 0-indexed (10 = November)
const WORKSHOP_END_DATE = new Date(2025, 10, 19, 13, 0, 0, 0);

function getNextFridayAt2PM(now: Date = new Date()): {
  startDate: Date;
  endDate: Date;
} {
  const day = now.getDay(); // 0=Sun..5=Fri,6=Sat
  const hour = now.getHours();
  const minute = now.getMinutes();
  const second = now.getSeconds();

  // Days until this week's Friday; 0 when today is Friday
  let daysUntilFriday = (5 - day + 7) % 7;

  // If it's already past 3pm Friday, roll to next week; if 2–3pm, keep today (active)
  if (daysUntilFriday === 0) {
    const nowSec = hour * 3600 + minute * 60 + second;
    const _startSec = 14 * 3600;
    const endSec = 15 * 3600;
    if (nowSec >= endSec) daysUntilFriday = 7;
  }

  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + daysUntilFriday);

  const startDate = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    14,
    0,
    0,
    0,
  );
  const endDate = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    15,
    0,
    0,
    0,
  );
  return { startDate, endDate };
}

const {
  startDate: COMMUNITY_CALL_START_DATE,
  endDate: COMMUNITY_CALL_END_DATE,
} = getNextFridayAt2PM();

export function CommunityCallBanner() {
  const now = new Date();

  // If workshop hasn't ended yet, show workshop banner
  if (now < WORKSHOP_END_DATE) {
    return (
      <EventBanner
        startDate={WORKSHOP_START_DATE}
        endDate={WORKSHOP_END_DATE}
        upcoming={{
          subtitle: "APPLIED AI WORKSHOP",
          title: "Hands-on workshops with engineers shipping AI globally",
          buttonText: "Register now!",
          buttonAction: WORKSHOP_URL,
        }}
        active={{
          subtitle: "APPLIED AI | LIVE NOW",
          title: "Hands-on AI workshops happening right now!",
          buttonText: "Join Now!",
          buttonAction: WORKSHOP_URL,
        }}
        past={{
          subtitle: "APPLIED AI WORKSHOP",
          title: "Hands-on workshops with engineers shipping AI globally",
          buttonText: "Watch replay",
          buttonAction: WORKSHOP_URL,
        }}
        leftBackgroundImage={LEFT_BACKGROUND_IMAGE}
        rightBackgroundImage={RIGHT_BACKGROUND_IMAGE}
      />
    );
  }

  // After workshop ends, show regular Community Call banner
  return (
    <EventBanner
      startDate={COMMUNITY_CALL_START_DATE}
      endDate={COMMUNITY_CALL_END_DATE}
      upcoming={{
        subtitle: "COMMUNITY CALL",
        title: "Join us every Friday and learn the future of AI Apps",
        buttonText: "Join us",
        buttonAction: COMMUNITY_CALL_URL,
      }}
      active={{
        subtitle: "COMMUNITY CALL | LIVE NOW",
        title: "Join us live for AI tips!",
        buttonText: "Watch Live",
        buttonAction: COMMUNITY_CALL_URL,
      }}
      past={{
        subtitle: "COMMUNITY CALL",
        title: "Join us every Friday and learn the future of AI Apps",
        buttonText: "Join us",
        buttonAction: COMMUNITY_CALL_URL,
      }}
      leftBackgroundImage={LEFT_BACKGROUND_IMAGE}
      rightBackgroundImage={RIGHT_BACKGROUND_IMAGE}
    />
  );
}
