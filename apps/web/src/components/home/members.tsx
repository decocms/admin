// deno-lint-ignore-file ensure-tailwind-design-system-tokens/ensure-tailwind-design-system-tokens
import { Avatar } from "../common/avatar";
import { useLazyTeamMembers } from "../../hooks/use-lazy-team-members";

export function OrgAvatars({ teamId }: { teamId: number }) {
  const {
    data: members,
    isLoading,
    elementRef,
  } = useLazyTeamMembers(teamId ?? null);

  return (
    <div ref={elementRef} className="flex items-center">
      {isLoading ? <OrgAvatars.Skeleton /> : (
        members?.members
          .slice(0, 3)
          .map((member) => (
            <Avatar
              key={member.id}
              url={member.profiles.metadata.avatar_url}
              fallback={member.profiles.metadata.full_name}
              shape="circle"
              className="w-6 h-6 border border-border -ml-2 first:ml-0"
              size="sm"
            />
          ))
      )}
    </div>
  );
}

OrgAvatars.Skeleton = () => (
  <div className="flex items-center">
    {Array.from({ length: 4 }).map((_, index) => (
      <div
        key={index}
        className="h-6 w-6 bg-stone-200 rounded-full animate-pulse -ml-2 first:ml-0"
      />
    ))}
  </div>
);

export const OrgMemberCount = ({ teamId }: { teamId: number }) => {
  const {
    data: members,
    isLoading,
    elementRef,
  } = useLazyTeamMembers(teamId ?? null);

  return (
    <div ref={elementRef} className="text-xs">
      {isLoading ? <OrgMemberCount.Skeleton /> : (
        `${members?.members.length || 0} members`
      )}
    </div>
  );
};

OrgMemberCount.Skeleton = () => (
  <div className="h-4 w-8 bg-stone-200 rounded-md animate-pulse" />
);
