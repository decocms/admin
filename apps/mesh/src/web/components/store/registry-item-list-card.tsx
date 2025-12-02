interface RegistryItemListCardProps {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  onClick: () => void;
}

function getInitials(name: string): string {
  return name
    .split(/[\s\-_]/)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function RegistryItemListCard({
  id,
  name,
  description,
  icon,
  onClick,
}: RegistryItemListCardProps) {
  const initials = getInitials(name);

  return (
    <div
      className="flex p-2 gap-2 cursor-pointer overflow-hidden items-center hover:bg-muted rounded-lg"
      onClick={onClick}
    >
      <div className="h-8 w-8 rounded flex items-center justify-center bg-linear-to-br from-primary/20 to-primary/10 text-xs font-semibold text-primary shrink-0">
        {icon ? (
          <img
            src={icon}
            alt={name}
            className="h-full w-full object-cover rounded"
          />
        ) : (
          initials
        )}
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <h3 className="text-sm font-semibold truncate">{name}</h3>
        <p className="text-xs text-muted-foreground truncate">
          {description || "No description"}
        </p>
      </div>
    </div>
  );
}

