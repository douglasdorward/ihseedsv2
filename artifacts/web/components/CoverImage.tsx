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
