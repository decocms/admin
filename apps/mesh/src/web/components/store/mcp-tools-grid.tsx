interface MCPToolsGridProps {
  tools: MCPApp[];
  onCardClick: (app: MCPApp) => void;
  title?: string;
  subtitle?: string;
}

export function MCPToolsGrid({
  tools,
  onCardClick,
  title,
  subtitle,
}: MCPToolsGridProps) {
  if (tools.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {title && (
        <div>
          <h2 className="text-lg font-medium">{title}</h2>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {tools.map((app) => (
          <MCPToolCard key={app.id} app={app} onCardClick={onCardClick} />
        ))}
      </div>
    </div>
  );
}
