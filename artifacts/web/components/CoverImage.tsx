"use client";

// A client component so the width-capping loader (a function) can reach
// next/image; server components cannot pass functions to it.
import Image from "next/image";
import { cappedImageLoader } from "../lib/image-loader";
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
      loader={cappedImageLoader}
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
      loader={cappedImageLoader}
      src={optimizableSrc(src)}
      alt={alt}
      width={width && width > 0 ? width : 800}
      height={height && height > 0 ? height : 600}
      sizes={sizes}
      priority={priority}
    />
  );
}
