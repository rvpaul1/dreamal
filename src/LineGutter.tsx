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
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleCollapse();
  };

  return (
    <div className="line-gutter" onMouseDown={handleMouseDown}>
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
