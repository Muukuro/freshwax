import Image from "next/image";

const logoSizes = {
  hero: "w-[14rem]",
  sidebar: "w-[12rem]",
  mobile: "w-[8rem]",
} as const;

export function BrandLogo({
  className,
  size = "hero",
}: {
  className?: string;
  size?: keyof typeof logoSizes;
}) {
  return (
    <span
      aria-label="Freshwax"
      className={["brand-logo inline-flex", logoSizes[size], className].filter(Boolean).join(" ")}
      role="img"
    >
      <Image
        alt=""
        aria-hidden="true"
        className="brand-logo__image brand-logo__image--light h-auto w-full"
        height={800}
        priority
        src="/freshwax-logo-light.svg"
        width={2677}
      />
      <Image
        alt=""
        aria-hidden="true"
        className="brand-logo__image brand-logo__image--dark h-auto w-full"
        height={800}
        priority
        src="/freshwax-logo.svg"
        width={2677}
      />
    </span>
  );
}
