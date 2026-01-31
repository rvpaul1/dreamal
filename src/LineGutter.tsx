interface LineGutterProps {
  headingInfo: { level: number; prefixLength: number } | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function LineGutter({
  headingInfo,
  isCollapsed,
  onToggleCollapse,
}: LineGutterProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleCollapse();
  };

  return (
    <div className="line-gutter">
      {headingInfo && (
        <span
          className={`heading-collapse-arrow ${isCollapsed ? "collapsed" : ""}`}
          onClick={handleClick}
        >
          {isCollapsed ? "▶" : "▼"}
        </span>
      )}
    </div>
  );
}
