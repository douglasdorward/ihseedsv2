import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from "react";

const navigationEvent = "ih-seeds:navigation";

function getPathname() {
  return window.location.pathname.replace(/\/+$/, "") || "/";
}

export function navigate(href: string, replace = false) {
  if (href === getPathname()) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (replace) window.history.replaceState({}, "", href);
  else window.history.pushState({}, "", href);
  window.dispatchEvent(new Event(navigationEvent));
}

export function useLocation() {
  const [location, setLocation] = useState(getPathname);

  useEffect(() => {
    const syncLocation = () => setLocation(getPathname());
    window.addEventListener("popstate", syncLocation);
    window.addEventListener(navigationEvent, syncLocation);
    return () => {
      window.removeEventListener("popstate", syncLocation);
      window.removeEventListener(navigationEvent, syncLocation);
    };
  }, []);

  return [location, navigate] as const;
}

export function useParams<T extends Record<string, string>>() {
  const [location] = useLocation();
  const slug = decodeURIComponent(location.split("/").filter(Boolean).at(-1) ?? "");
  return { slug } as T;
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
};

export function Link({ href, onClick, target, ...props }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      target === "_blank" ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigate(href);
  };

  return <a href={href} target={target} onClick={handleClick} {...props} />;
}