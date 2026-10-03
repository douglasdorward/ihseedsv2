import Image from "next/image";
import { optimizableSrc } from "../lib/image-src";

export function CoverImage({
  src,
  alt,
  sizes,
  priority = false,
  className = "cover-image",
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (!src) return null;
  return (
    <Image
      className={className}
      src={optimizableSrc(src)}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}

export function ContentImage({
  src,
  alt,
  width,
  height,
  sizes,
  className,
  priority = false,
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  if (!src) return null;
  return (
    <Image
      className={className}
      src={optimizableSrc(src)}
      alt={alt}
      width={width && width > 0 ? width : 800}
      height={height && height > 0 ? height : 600}
      sizes={sizes}
      priority={priority}
    />
  );
}
