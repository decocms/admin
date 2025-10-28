import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getTeamMembers, KEYS } from "@deco/sdk";

type TeamMembers = Awaited<ReturnType<typeof getTeamMembers>>;

/**
 * Hook to lazily fetch team members only when the element becomes visible
 * @param teamId - The ID of the team to fetch members for
 * @param options - Configuration options
 */
export const useLazyTeamMembers = (
  teamId: number | null,
  { withActivity }: { withActivity?: boolean } = { withActivity: false },
) => {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Only trigger once
        }
      },
      {
        rootMargin: "50px", // Start loading 50px before the element becomes visible
        threshold: 0.1,
      },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  const query = useQuery({
    queryKey: KEYS.TEAM_MEMBERS_WITH_ACTIVITY(teamId ?? -1, withActivity),
    queryFn: ({ signal }): Promise<TeamMembers> => {
      if (teamId === null) {
        return Promise.resolve({ members: [], invites: [] });
      }
      return getTeamMembers({ teamId, withActivity }, signal);
    },
    enabled: isVisible && teamId !== null, // Only fetch when visible and teamId is valid
  });

  return {
    ...query,
    elementRef,
    isVisible,
  };
};
