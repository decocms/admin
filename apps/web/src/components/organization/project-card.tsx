import { Avatar } from "../common/avatar/index.tsx";
import { ChevronRight } from "lucide-react";

interface ProjectMember {
  id: string;
  avatarUrl?: string;
  name: string;
}

interface ProjectCardProps {
  id: string;
  name: string;
  slug: string;
  description?: string;
  avatarUrl?: string;
  backgroundColor: string;
  patternColor?: string;
  members: ProjectMember[];
  memberCount: number;
  onClick?: () => void;
}

export function ProjectCard({ 
  id, 
  name, 
  slug, 
  description, 
  avatarUrl, 
  backgroundColor,
  patternColor = "#FCA5A5",
  members, 
  memberCount,
  onClick 
}: ProjectCardProps) {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Navigate to the workspace
      window.location.href = `/${slug}/agents`;
    }
  };

  return (
    <div 
      className="bg-card rounded-2xl overflow-hidden cursor-pointer hover:bg-accent transition-all duration-200 flex flex-col"
      onClick={handleClick}
    >
      {/* Header */}
      <div className="p-4 flex flex-col gap-4 flex-1">
        <div className="flex items-start justify-between">
          <div className={`w-12 h-12 ${backgroundColor} rounded-xl flex items-center justify-center relative overflow-hidden`}>
            {/* SVG Pattern */}
            <div className="absolute inset-0 flex items-center justify-center">
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none" className="w-8 h-8">
                <rect x="15.2836" width="2.47243" height="2.47235" fill={patternColor}/>
                <rect x="15.2867" y="2.46973" width="2.47243" height="2.47235" fill={patternColor}/>
                <rect x="22.7046" y="2.43457" width="2.47243" height="2.47235" fill={patternColor}/>
                <rect x="28.133" y="7.86621" width="2.47243" height="2.47235" fill={patternColor}/>
                <rect x="30.5684" y="15.2812" width="2.47243" height="2.47235" fill={patternColor}/>
                <rect x="28.0987" y="15.2812" width="2.47243" height="2.47235" fill={patternColor}/>
                <rect x="28.1335" y="22.6992" width="2.47243" height="2.47235" fill={patternColor}/>
                <rect x="22.7046" y="28.1279" width="2.47243" height="2.47235" fill={patternColor}/>
                <rect x="15.2842" y="28.0938" width="2.47243" height="2.47235" fill={patternColor}/>
                <rect x="15.2841" y="30.5664" width="2.47243" height="2.47235" fill={patternColor}/>
                <rect x="7.86603" y="28.1309" width="2.47243" height="2.47235" fill={patternColor}/>
                <rect x="2.43774" y="22.7002" width="2.47243" height="2.47235" fill={patternColor}/>
                <rect y="15.2822" width="2.47243" height="2.47235" fill={patternColor}/>
                <rect x="2.47363" y="15.2832" width="2.47243" height="2.47235" fill={patternColor}/>
                <rect x="2.43842" y="7.86523" width="2.47243" height="2.47235" fill={patternColor}/>
                <rect x="7.86792" y="10.1123" width="2.47243" height="2.47235" fill={patternColor}/>
                <rect width="2.47243" height="2.47235" transform="matrix(1 0 0 -1 7.86755 22.6992)" fill={patternColor}/>
                <rect width="2.47243" height="2.47235" transform="matrix(-1 0 0 1 25.1734 10.1133)" fill={patternColor}/>
                <rect width="2.47243" height="2.47235" transform="matrix(-1 0 0 1 17.7531 12.8105)" fill={patternColor}/>
                <rect width="2.47243" height="2.47235" transform="matrix(-1 0 0 1 17.7536 17.7549)" fill={patternColor}/>
                <rect width="2.47243" height="2.47235" transform="matrix(-1 0 0 1 17.7534 15.2832)" fill={patternColor}/>
                <rect width="2.47243" height="2.47235" transform="matrix(-1 0 0 1 15.2841 15.2832)" fill={patternColor}/>
                <rect width="2.47243" height="2.47235" transform="matrix(-1 0 0 1 20.2283 15.2832)" fill={patternColor}/>
                <rect x="25.1729" y="22.7002" width="2.47243" height="2.47235" transform="rotate(180 25.1729 22.7002)" fill={patternColor}/>
                <rect x="7.86707" y="2.43555" width="2.47243" height="2.47235" fill={patternColor}/>
                <rect x="10.3427" y="7.64062" width="2.47243" height="2.47235" fill={patternColor}/>
                <rect width="2.47243" height="2.47235" transform="matrix(1 0 0 -1 10.3428 25.1719)" fill={patternColor}/>
                <rect width="2.47243" height="2.47235" transform="matrix(-1 0 0 1 22.7039 7.64062)" fill={patternColor}/>
                <rect x="22.7049" y="25.1709" width="2.47243" height="2.47235" transform="rotate(180 22.7049 25.1709)" fill={patternColor}/>
              </svg>
            </div>
            <div className="absolute inset-0 border-2 border-border/30 rounded-xl" />
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
        </div>

        <div className="flex flex-col leading-none">
          <span className="text-xs text-muted-foreground block">@{slug}</span>
          <h3 className="text-lg font-medium text-foreground leading-tight mt-1">{name}</h3>
        </div>
      </div>

      {/* Members Footer */}
      <div className="h-12 border-t border-border flex items-center justify-between px-4 bg-transparent">
        <div className="flex items-center pl-0 pr-1 py-0">
          {members.slice(0, 4).map((member, index) => (
            <div
              key={member.id}
              className="bg-background bg-center bg-contain -mr-2 relative rounded-full size-6 border border-border"
              style={{ 
                backgroundImage: member.avatarUrl ? `url('${member.avatarUrl}')` : undefined,
                backgroundSize: 'contain'
              }}
            >
              {!member.avatarUrl && (
                <div className="w-full h-full rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                  {member.name.charAt(0)}
                </div>
              )}
            </div>
          ))}
        </div>
        <span className="text-xs text-muted-foreground font-normal leading-4">
          {memberCount} member{memberCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
