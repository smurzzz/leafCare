/**
 * Line icons drawn as SVG paths so the app needs no icon font or image assets
 * and can tint every glyph from the theme.
 */

import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconProps = {
  size?: number;
  color: string;
  strokeWidth?: number;
};

const SvgIcon = ({
  size = 22,
  children,
}: {
  size?: number;
  children: React.ReactNode;
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {children}
  </Svg>
);

export const HomeIcon = ({ size, color, strokeWidth = 1.9 }: IconProps) => (
  <SvgIcon size={size}>
    <Path
      d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1v-8.5Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
  </SvgIcon>
);

export const LeafIcon = ({ size, color, strokeWidth = 1.9 }: IconProps) => (
  <SvgIcon size={size}>
    <Path
      d="M20 4c0 9-6 16-14 16 0-9 6-16 14-16Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
    <Path d="M6 20C9 15 13 11 18 8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </SvgIcon>
);

export const BellIcon = ({ size, color, strokeWidth = 1.9 }: IconProps) => (
  <SvgIcon size={size}>
    <Path
      d="M7 11a5 5 0 0 1 10 0v3.5l1.2 2.2H5.8L7 14.5V11Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
    <Path d="M10.5 20a1.8 1.8 0 0 0 3 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </SvgIcon>
);

export const UserIcon = ({ size, color, strokeWidth = 1.9 }: IconProps) => (
  <SvgIcon size={size}>
    <Circle cx={12} cy={9} r={3.4} stroke={color} strokeWidth={strokeWidth} />
    <Path
      d="M5.5 20c1.2-3.4 3.6-5 6.5-5s5.3 1.6 6.5 5"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </SvgIcon>
);

export const ScanFrameIcon = ({ size, color, strokeWidth = 2.2 }: IconProps) => (
  <SvgIcon size={size}>
    <Path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Path d="M20 15v3.5A1.5 1.5 0 0 1 18.5 20H15" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Path d="M7 12h10" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </SvgIcon>
);

export const PlusIcon = ({ size, color, strokeWidth = 2.4 }: IconProps) => (
  <SvgIcon size={size}>
    <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </SvgIcon>
);

export const CloseIcon = ({ size, color, strokeWidth = 2.2 }: IconProps) => (
  <SvgIcon size={size}>
    <Path d="M6 6l12 12M18 6 6 18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </SvgIcon>
);

export const CheckIcon = ({ size, color, strokeWidth = 2.6 }: IconProps) => (
  <SvgIcon size={size}>
    <Path d="M5 13l5 5L19 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </SvgIcon>
);

export const DropletIcon = ({ size, color, strokeWidth = 2 }: IconProps) => (
  <SvgIcon size={size}>
    <Path
      d="M12 3.5c3.2 4 5 6.6 5 9a5 5 0 0 1-10 0c0-2.4 1.8-5 5-9Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
  </SvgIcon>
);

export const FlameIcon = ({ size, color, strokeWidth = 2 }: IconProps) => (
  <SvgIcon size={size}>
    <Path
      d="M12 3c3 3.6 5.5 6.2 5.5 9.6A5.5 5.5 0 0 1 12 18a5.5 5.5 0 0 1-5.5-5.4C6.5 9 8.4 6.6 12 3Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
  </SvgIcon>
);

export const GearIcon = ({ size, color, strokeWidth = 1.9 }: IconProps) => (
  <SvgIcon size={size}>
    <Circle cx={12} cy={12} r={3.2} stroke={color} strokeWidth={strokeWidth} />
    <Path
      d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.5 1.5M16.5 16.5 18 18M18 6l-1.5 1.5M7.5 16.5 6 18"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </SvgIcon>
);

export const CalendarIcon = ({ size, color, strokeWidth = 1.9 }: IconProps) => (
  <SvgIcon size={size}>
    <Rect x={4} y={5.5} width={16} height={14} rx={3} stroke={color} strokeWidth={strokeWidth} />
    <Path d="M4 10h16M9 4v3M15 4v3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </SvgIcon>
);

export const CameraIcon = ({ size, color, strokeWidth = 1.9 }: IconProps) => (
  <SvgIcon size={size}>
    <Path
      d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1-1.6h5.4l1 1.6h1.8A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
    <Circle cx={12} cy={12.5} r={3.2} stroke={color} strokeWidth={strokeWidth} />
  </SvgIcon>
);

export const FlashIcon = ({ size, color, strokeWidth = 1.9 }: IconProps) => (
  <SvgIcon size={size}>
    <Path
      d="M13 3 6 13h5l-1 8 7-10h-5l1-8Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
  </SvgIcon>
);

export const FlipIcon = ({ size, color, strokeWidth = 1.9 }: IconProps) => (
  <SvgIcon size={size}>
    <Path d="M4 9a8 8 0 0 1 13.5-3.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Path d="M20 15a8 8 0 0 1-13.5 3.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Path d="M17 3v3.5h-3.5M7 21v-3.5h3.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </SvgIcon>
);

export const TrashIcon = ({ size, color, strokeWidth = 1.9 }: IconProps) => (
  <SvgIcon size={size}>
    <Path d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Path d="M7 7l1 12a1.5 1.5 0 0 0 1.5 1.4h5A1.5 1.5 0 0 0 16 19l1-12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </SvgIcon>
);

export const LockIcon = ({ size, color, strokeWidth = 1.9 }: IconProps) => (
  <SvgIcon size={size}>
    <Rect x={5} y={10.5} width={14} height={9.5} rx={2.5} stroke={color} strokeWidth={strokeWidth} />
    <Path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </SvgIcon>
);

export const ShieldIcon = ({ size, color, strokeWidth = 1.9 }: IconProps) => (
  <SvgIcon size={size}>
    <Path d="M12 3.5 19 6v6c0 4.2-3 7-7 8.5-4-1.5-7-4.3-7-8.5V6l7-2.5Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
  </SvgIcon>
);

export const EditIcon = ({ size, color, strokeWidth = 1.9 }: IconProps) => (
  <SvgIcon size={size}>
    <Path d="M4 20h4l10-10-4-4L4 16v4Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    <Path d="M14 6l4 4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </SvgIcon>
);

export const ChevronLeftIcon = ({ size, color, strokeWidth = 2.2 }: IconProps) => (
  <SvgIcon size={size}>
    <Path d="M14.5 5 8 12l6.5 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </SvgIcon>
);

export const ChevronRightIcon = ({ size, color, strokeWidth = 2.2 }: IconProps) => (
  <SvgIcon size={size}>
    <Path d="M9.5 5 16 12l-6.5 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </SvgIcon>
);

export const SearchIcon = ({ size, color, strokeWidth = 2 }: IconProps) => (
  <SvgIcon size={size}>
    <Circle cx={11} cy={11} r={6} stroke={color} strokeWidth={strokeWidth} />
    <Path d="M15.5 15.5 20 20" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </SvgIcon>
);

export const ClockIcon = ({ size, color, strokeWidth = 1.9 }: IconProps) => (
  <SvgIcon size={size}>
    <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={strokeWidth} />
    <Path d="M12 7.5V12l3 2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </SvgIcon>
);

export const WarningIcon = ({ size, color, strokeWidth = 2 }: IconProps) => (
  <SvgIcon size={size}>
    <Path d="M12 4.5 21 19.5H3L12 4.5Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    <Path d="M12 10v4.5M12 17.2v.1" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </SvgIcon>
);

export const LogoutIcon = ({ size, color, strokeWidth = 1.9 }: IconProps) => (
  <SvgIcon size={size}>
    <Path d="M15 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Path d="M16 8l4 4-4 4M20 12h-9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </SvgIcon>
);
