import { useMemo } from "react";

export interface HeadingInfo {
  level: number;
  prefixLength: number;
  collapsed: boolean;
  scrollableLines?: number;
}

export interface BulletInfo {
  indentLevel: number;
  prefixLength: number;
}

function getHeadingInfo(line: string): HeadingInfo | null {
  const fullMatch = line.match(/^(?:~S(\d+)~ )?(\^ )?(#{1,6}) /);
  if (!fullMatch) return null;
  return {
    level: fullMatch[3].length,
    prefixLength: fullMatch[0].length,
    collapsed: !!fullMatch[2],
    scrollableLines: fullMatch[1] ? parseInt(fullMatch[1], 10) : undefined,
  };
}

function getBulletInfo(line: string): BulletInfo | null {
  const match = line.match(/^(\t+)- /);
  if (match) {
    return {
      indentLevel: match[1].length,
      prefixLength: match[0].length,
    };
  }
  return null;
}

export function useMarkdown(lines: string[]) {
  const lineInfo = useMemo(() => {
    return lines.map((line) => ({
      headingInfo: getHeadingInfo(line),
      bulletInfo: getBulletInfo(line),
    }));
  }, [lines]);

  const getLineClass = (lineIndex: number): string => {
    const info = lineInfo[lineIndex];
    if (info?.headingInfo) {
      return `editor-line md-h${info.headingInfo.level}`;
    }
    return "editor-line";
  };

  const getHeadingInfoForLine = (lineIndex: number): HeadingInfo | null => {
    return lineInfo[lineIndex]?.headingInfo ?? null;
  };

  const getBulletInfoForLine = (lineIndex: number): BulletInfo | null => {
    return lineInfo[lineIndex]?.bulletInfo ?? null;
  };

  return {
    getLineClass,
    getHeadingInfo: getHeadingInfoForLine,
    getBulletInfo: getBulletInfoForLine,
  };
}
