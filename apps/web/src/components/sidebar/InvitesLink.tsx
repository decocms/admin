import { useInvites } from "@deco/sdk/hooks";

export default function InvitesCount() {
  const { data: invites = [] } = useInvites();

  return (
    <span className="absolute right-2 top-1/2 -mt-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
      {invites.length}
    </span>
  );
}
