import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 18, children, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** 2x2 squares: switch to the grid view. */
export const GridIcon = (p: Props) => (
  <Icon {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </Icon>
);

/** Three tall cards side by side: back to the carousel. */
export const RowsIcon = (p: Props) => (
  <Icon {...p}>
    <rect x="2.5" y="7" width="5" height="10" rx="1.5" />
    <rect x="9.5" y="4.5" width="5" height="15" rx="1.5" />
    <rect x="16.5" y="7" width="5" height="10" rx="1.5" />
  </Icon>
);
