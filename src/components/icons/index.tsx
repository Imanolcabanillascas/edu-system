// Iconos SVG minimalistas, sin dependencias externas (peso ínfimo, sin requests adicionales)
// Todos heredan color de `currentColor` y aceptan tamaño vía prop `size`.
import { CSSProperties } from "react";

interface IconProps {
  size?: number;
  style?: CSSProperties;
  className?: string;
}

const base = (size = 18) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const IconSchool = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <path d="M12 3 2 8l10 5 10-5-10-5Z" />
    <path d="M6 10.5V16c0 1 2.7 3 6 3s6-2 6-3v-5.5" />
    <path d="M22 8v6" />
  </svg>
);

export const IconTeacher = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20c0-3.5 3.4-6 7.5-6s7.5 2.5 7.5 6" />
    <path d="M16 4.5c1.2.4 2 1.5 2 2.8 0 1.3-.8 2.4-2 2.8" />
  </svg>
);

export const IconStudent = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20c0-3.5 3.4-6 7.5-6s7.5 2.5 7.5 6" />
  </svg>
);

export const IconClass = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <rect x="3" y="4" width="18" height="14" rx="2" />
    <path d="M3 9h18" />
    <path d="M8 4v5M16 4v5" />
  </svg>
);

export const IconTask = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </svg>
);

export const IconExam = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8M8 12l1.5 1.5L12 11M8 16h5" />
  </svg>
);

export const IconCard = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <path d="M2.5 9.5h19" />
    <path d="M6 14.5h4" />
  </svg>
);

export const IconSearch = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);

export const IconPlus = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconEdit = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
  </svg>
);

export const IconTrash = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
    <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
    <path d="M10 11v5M14 11v5" />
  </svg>
);

export const IconDownload = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <path d="M12 3v13" />
    <path d="M7 11l5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
);

export const IconFile = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5" />
  </svg>
);

export const IconClock = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </svg>
);

export const IconLocation = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
);

export const IconAlert = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <path d="M10.3 3.9 2.4 18a1.5 1.5 0 0 0 1.3 2.3h16.6a1.5 1.5 0 0 0 1.3-2.3L13.7 3.9a1.5 1.5 0 0 0-2.6 0Z" />
    <path d="M12 9v4M12 16.5h.01" />
  </svg>
);

export const IconCheck = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const IconX = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const IconLogout = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

export const IconIdCard = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <circle cx="8.5" cy="11" r="2" />
    <path d="M5.5 16c.5-1.5 1.7-2.3 3-2.3s2.5.8 3 2.3" />
    <path d="M14.5 9.5h4M14.5 12.5h4M14.5 15.5h2.5" />
  </svg>
);

export const IconPhone = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <path d="M5 4h3.2l1.3 4.3L7.2 10a12 12 0 0 0 6.8 6.8l1.7-2.3 4.3 1.3V19a2 2 0 0 1-2 2C10.5 21 3 13.5 3 6a2 2 0 0 1 2-2Z" />
  </svg>
);

export const IconUserShield = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20c0-3.5 3.4-6 7.5-6s7.5 2.5 7.5 6" />
  </svg>
);

export const IconChevronDown = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const IconLayers = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <path d="M12 3 3 8l9 5 9-5-9-5Z" />
    <path d="M3 13l9 5 9-5" />
    <path d="M3 18l9 5 9-5" />
  </svg>
);

export const IconBook = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <path d="M4 4.5C4 3.7 4.7 3 5.5 3H12v18H5.5c-.8 0-1.5-.7-1.5-1.5v-15Z" />
    <path d="M20 4.5c0-.8-.7-1.5-1.5-1.5H12v18h6.5c.8 0 1.5-.7 1.5-1.5v-15Z" />
  </svg>
);

export const IconChart = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <path d="M4 20V10M4 20h16M10 20V4M16 20v-7" />
  </svg>
);

export const IconMenu = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

export const IconReport = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <path d="M7 17v-5M12 17V9M17 17v-8" />
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </svg>
);
export const IconArrowRight = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={style} className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const IconLoader = ({ size, style, className }: IconProps) => (
  <svg {...base(size)} style={{ animation: "spin 0.8s linear infinite", ...style }} className={className}>
    <path d="M21 12a9 9 0 1 1-9-9" />
  </svg>
);
