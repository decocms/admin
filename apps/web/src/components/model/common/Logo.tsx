import { cn } from "@deco/ui/lib/utils.ts";
import { Avatar } from "../../common/Avatar.tsx";

interface Props {
  logo: string;
  name: string;
}

export default function Logo({ logo, name }: Props) {
  return (
    <div
      className={cn(
        "rounded-2xl relative flex items-center justify-center p-2 h-16 w-16",
        "before:content-[''] before:absolute before:inset-0 before:rounded-2xl before:p-[1px] before:bg-gradient-to-t before:from-slate-300 before:to-slate-100",
        "before:![mask:linear-gradient(#000_0_0)_exclude_content-box,_linear-gradient(#000_0_0)]",
      )}
    >
      <Avatar
        url={logo}
        fallback={name}
        fallbackClassName="!bg-transparent"
        className="w-full h-full rounded-lg"
        objectFit="contain"
      />
    </div>
  );
}
