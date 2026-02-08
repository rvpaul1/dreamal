import { useMemo } from "react";

export interface HeadingInfo {
  level: number;
  prefixLength: number;
  collapsed: boolean;
}

export interface BulletInfo {
  indentLevel: number;
  prefixLength: number;
}

function getHeadingInfo(line: string): HeadingInfo | null {
  const collapsedMatch = line.match(/^\^ (#{1,6}) /);
  if (collapsedMatch) {
    return {
      level: collapsedMatch[1].length,
      prefixLength: collapsedMatch[0].length,
      collapsed: true,
    };
  }
  const match = line.match(/^(#{1,6}) /);
  if (match) {
    return {
      level: match[1].length,
      prefixLength: match[0].length,
      collapsed: false,
    };
  }
  return null;
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
