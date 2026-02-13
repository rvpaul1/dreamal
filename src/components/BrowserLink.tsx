import { openUrl } from "@tauri-apps/plugin-opener";

function normalizeUrl(url: string): string {
  if (!/^https?:\/\//i.test(url)) {
    return `https://${url}`;
  }
  return url;
}

export function BrowserLink({
  href,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <span
      {...props}
      role="link"
      onMouseDown={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await openUrl(normalizeUrl(href));
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {children}
    </span>
  );
}
