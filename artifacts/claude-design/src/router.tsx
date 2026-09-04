import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from "react";

const navigationEvent = "ih-seeds:navigation";

function getPathname() {
  return window.location.pathname.replace(/\/+$/, "") || "/";
}

type NavigateOptions = {
  replace?: boolean;
};

export function navigate(href: string, options: NavigateOptions | boolean = {}) {
  const replace = typeof options === "boolean" ? options : options.replace ?? false;
  const target = new URL(href, window.location.href);
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const destination = `${target.pathname}${target.search}${target.hash}`;

  if (destination === current) {
    if (target.hash) document.getElementById(decodeURIComponent(target.hash.slice(1)))?.scrollIntoView();
    else window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (replace) window.history.replaceState({}, "", destination);
  else window.history.pushState({}, "", destination);
  window.dispatchEvent(new Event(navigationEvent));
  if (target.hash) {
    window.requestAnimationFrame(() => {
      document.getElementById(decodeURIComponent(target.hash.slice(1)))?.scrollIntoView();
    });
  }
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