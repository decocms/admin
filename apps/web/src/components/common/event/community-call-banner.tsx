import { EventBanner } from "../event-banner";

// Community call URLs
const COMMUNITY_CALL_URL = "https://decocms.com/discord"; // Discord link for all states

// Banner decoration images
const LEFT_BACKGROUND_IMAGE = "/img/banner-decoration-2.svg";
const RIGHT_BACKGROUND_IMAGE = "/img/banner-decoration-1.svg";

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
