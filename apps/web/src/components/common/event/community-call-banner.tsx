import { EventBanner } from "../event-banner";

// Community call URLs
const COMMUNITY_CALL_URL = "https://decocms.com/discord"; // Discord link for all states

// Banner decoration images
const LEFT_BACKGROUND_IMAGE = "/img/banner-decoration-2.svg";
const RIGHT_BACKGROUND_IMAGE = "/img/banner-decoration-1.svg";

function getNextFridayAt2PM(): { startDate: Date; endDate: Date } {
  const now = new Date();
  const currentDay = now.getDay(); // 0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday
  const currentHour = now.getHours();

  // Calculate days until next Friday
  let daysUntilFriday = 0;
  if (currentDay < 5) {
    // Before Friday this week
    daysUntilFriday = 5 - currentDay;
  } else if (currentDay === 5 && currentHour < 14) {
    // It's Friday before 2pm local time
    daysUntilFriday = 0;
  } else {
    // It's Friday after 2pm local time, or weekend - go to next Friday
    daysUntilFriday = currentDay === 5 ? 7 : 7 - currentDay + 5;
  }

  // Create target date
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + daysUntilFriday);

  // Set to 2pm local time
  const startDate = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    14,
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
