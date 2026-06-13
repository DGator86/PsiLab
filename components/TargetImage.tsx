"use client";

import { DRAWINGS } from "@/lib/drawings";

/** Renders an rv_targets image: a Wikimedia photo URL or an inline "svg:<id>" drawing. */
export default function TargetImage({
  imageUrl,
  alt,
  className = "h-56 w-full object-cover",
}: {
  imageUrl: string;
  alt: string;
  className?: string;
}) {
  if (imageUrl.startsWith("svg:")) {
    const def = DRAWINGS.find((d) => d.id === imageUrl.slice(4));
    if (!def) return <div className={`${className} bg-black/30`} aria-label={alt} />;
    return (
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label={alt}
        className={`${className} bg-[#0a0f1a] p-4`}
        fill="none"
        stroke="#e8eef7"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {def.paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </svg>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={imageUrl} alt={alt} className={className} />;
}
