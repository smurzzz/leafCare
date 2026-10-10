/**
 * Vector illustrations. docs/ui-ux.md asks for the UI kit's artwork to be
 * recreated simply in React Native rather than shipping randomised stock: the
 * leaf-and-drop mark, the three onboarding scenes, the sleeping plant, the
 * cracked pot and the camera-permission leaf frame.
 */

import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

export const LeafLogo = ({
  size = 96,
  color = '#FFFFFF',
  dropletColor = '#E7F4EA',
}: {
  size?: number;
  color?: string;
  dropletColor?: string;
}) => (
  <Svg width={size} height={size} viewBox="0 0 96 96">
    <Path
      d="M20 60C20 38 38 20 60 20c0 22-18 40-40 40Z"
      fill={color}
      opacity={0.92}
    />
    <Path d="M20 60c14-6 26-18 34-32" stroke={dropletColor} strokeWidth={3} fill="none" strokeLinecap="round" />
    <Path
      d="M52 34c0-6 5.5-10 11-10 0 6-5.5 10-11 10Z"
      fill={dropletColor}
      opacity={0.85}
    />
  </Svg>
);

/** Faint leaf silhouettes behind the splash gradient. */
export const LeafDecor = ({ size = 240, color = '#FFFFFF', rotate = 12 }: { size?: number; color?: string; rotate?: number }) => (
  <View style={{ transform: [{ rotate: `${rotate}deg` }] }}>
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M18 78C18 44 44 18 78 18c0 34-26 60-60 60Z"
        fill={color}
        opacity={0.5}
      />
      <Path d="M18 78C38 66 58 46 70 26" stroke={color} strokeWidth={2} fill="none" />
    </Svg>
  </View>
);

/** The white watering-drop inside the concentric rings (screen 01). */
export const SplashMark = ({ size = 128 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 128 128">
    <Circle cx={64} cy={64} r={62} stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} fill="none" />
    <Circle cx={64} cy={64} r={46} fill="rgba(255,255,255,0.14)" />
    <Path
      d="M64 30c12 14 20 24 20 34a20 20 0 1 1-40 0c0-10 8-20 20-34Z"
      fill="#FFFFFF"
    />
    <Circle cx={58} cy={66} r={6} fill="#CDE8D4" opacity={0.9} />
  </Svg>
);

const Frame = ({ children, size = 190 }: { children: React.ReactNode; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 200 200">
    {children}
  </Svg>
);

export const OnboardingArtIdentify = ({ size = 210 }: { size?: number }) => (
  <Frame size={size}>
    <Rect x={26} y={40} width={148} height={126} rx={18} fill="#E7F4EA" />
    <Circle cx={62} cy={72} r={16} fill="#CDE8D4" />
    <Rect x={88} y={60} width={66} height={10} rx={5} fill="#CDE8D4" />
    <Rect x={36} y={150} width={128} height={12} rx={6} fill="#FFFFFF" />
    <Path d="M96 96 L126 96 L126 126 Z" fill="#4DA9DB" opacity={0.55} />
    <Path
      d="M150 120c0-14 12-26 26-26 0 14-12 26-26 26Z"
      fill="#1F6B4A"
    />
    <Path d="M150 120c9-4 16-11 20-19" stroke="#CDE8D4" strokeWidth={2} fill="none" />
    <Path d="M40 96v-14h14" stroke="#1F6B4A" strokeWidth={4} fill="none" strokeLinecap="round" />
    <Path d="M160 62v14h-14" stroke="#1F6B4A" strokeWidth={4} fill="none" strokeLinecap="round" />
  </Frame>
);

export const OnboardingArtReminder = ({ size = 210 }: { size?: number }) => (
  <Frame size={size}>
    <Rect x={24} y={36} width={152} height={130} rx={20} fill="#E7F4EA" />
    <Rect x={24} y={36} width={152} height={30} rx={20} fill="#CDE8D4" />
    <G>
      {[0, 1, 2, 3, 4].map((column) =>
        [0, 1, 2].map((row) => (
          <Circle
            key={`${column}-${row}`}
            cx={44 + column * 26}
            cy={88 + row * 28}
            r={7}
            fill={(column + row) % 3 === 0 ? '#1F6B4A' : '#F28482'}
            opacity={0.85}
          />
        )),
      )}
    </G>
    <Path
      d="M140 132c14 0 24 12 24 26H116c0-14 10-26 24-26Z"
      fill="#4DA9DB"
      opacity={0.8}
    />
    <Path d="M164 158c16-6 26-18 26-18" stroke="#4DA9DB" strokeWidth={6} fill="none" strokeLinecap="round" />
  </Frame>
);

export const OnboardingArtGrow = ({ size = 210 }: { size?: number }) => (
  <Frame size={size}>
    <Circle cx={100} cy={112} r={54} fill="#CDE8D4" opacity={0.5} />
    <Path d="M100 158c0-28 0-44 0-52" stroke="#1F6B4A" strokeWidth={5} strokeLinecap="round" />
    <Path d="M100 118c-22 0-34-14-34-30 20 0 34 12 34 30Z" fill="#1F6B4A" />
    <Path d="M100 106c18 0 30-12 30-26-18 0-30 10-30 26Z" fill="#40916D" />
    <Rect x={62} y={152} width={76} height={30} rx={12} fill="#1F6B4A" opacity={0.9} />
    <Path
      d="M64 44c26 0 46 14 46 32H48c0-18 4-32 16-32Z"
      fill="#F2EDE6"
      opacity={0.9}
    />
    <Circle cx={150} cy={52} r={4} fill="#E85D04" />
    <Circle cx={58} cy={62} r={3} fill="#E85D04" />
  </Frame>
);

/** Sleeping plant in a mint circle with Zzz (screen 19). */
export const SleepingPlantArt = ({ size = 160 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 200 200">
    <Circle cx={100} cy={100} r={92} fill="#E7F4EA" />
    <Path d="M100 140c0-22 0-34 0-42" stroke="#1F6B4A" strokeWidth={5} strokeLinecap="round" />
    <Path d="M100 108c-18 0-28-11-28-24 16 0 28 10 28 24Z" fill="#1F6B4A" />
    <Path d="M100 96c14 0 24-9 24-20-14 0-24 8-24 20Z" fill="#40916D" />
    <Rect x={74} y={132} width={52} height={30} rx={10} fill="#1F6B4A" />
    <SvgText x={140} y={62} fontSize={22} fill="#1F6B4A" fontWeight="bold">
      Z
    </SvgText>
    <SvgText x={152} y={44} fontSize={16} fill="#1F6B4A" fontWeight="bold">
      z
    </SvgText>
    <Path d="M46 156c14 0 26 4 32 10" stroke="#CDE8D4" strokeWidth={7} fill="none" strokeLinecap="round" />
  </Svg>
);

/** Sad cracked pot (screen 25). */
export const CrackedPotArt = ({ size = 160 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 200 200">
    <Ellipse cx={100} cy={166} rx={58} ry={10} fill="#F2EDE6" />
    <Path d="M62 92h76l-10 66H72Z" fill="#F28482" opacity={0.85} />
    <Path d="M60 84h80v14H60Z" fill="#B4443C" opacity={0.85} />
    <Path d="M96 96l8 22-10 16 12 22" stroke="#FEE7E7" strokeWidth={4} fill="none" strokeLinecap="round" />
    <Path d="M100 84c-16 0-26-12-26-26 16 0 26 10 26 26Z" fill="#40916D" opacity={0.9} />
    <Path d="M100 78c14 0 22-10 22-22-14 0-22 9-22 22Z" fill="#1F6B4A" opacity={0.9} />
    <Path d="M42 132c8 10 8 20 0 30" stroke="#CDE8D4" strokeWidth={5} fill="none" strokeLinecap="round" />
    <Path d="M162 128c-8 10-8 20 0 30" stroke="#CDE8D4" strokeWidth={5} fill="none" strokeLinecap="round" />
  </Svg>
);

/** Leaf inside a scan frame with a shutter (screen 24). */
export const CameraPermissionArt = ({ size = 160 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 200 200">
    <Rect x={30} y={34} width={140} height={100} rx={18} fill="#E7F4EA" />
    <Path d="M45 60v-11h11" stroke="#1F6B4A" strokeWidth={5} fill="none" strokeLinecap="round" />
    <Path d="M155 60v-11h-11" stroke="#1F6B4A" strokeWidth={5} fill="none" strokeLinecap="round" />
    <Path d="M45 108v11h11" stroke="#1F6B4A" strokeWidth={5} fill="none" strokeLinecap="round" />
    <Path d="M155 108v11h-11" stroke="#1F6B4A" strokeWidth={5} fill="none" strokeLinecap="round" />
    <Path d="M100 112c-22 0-36-16-36-34 22 0 36 14 36 34Z" fill="#1F6B4A" />
    <Path d="M100 96c18 0 30-12 30-26-18 0-30 10-30 26Z" fill="#40916D" />
    <Circle cx={100} cy={158} r={26} fill="#FFFFFF" stroke="#1F6B4A" strokeWidth={5} />
    <Circle cx={100} cy={158} r={13} fill="#4DA9DB" opacity={0.5} />
  </Svg>
);

/** Recognisable Google "G" without pulling in a brand asset. */
export const GoogleMark = ({ size = 18 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48">
    <Path
      fill="#EA4335"
      d="M24 9.5c3.7 0 7 1.3 9.6 3.8l6.4-6.4C36.1 3.2 30.4 1 24 1 14.6 1 6.6 6.3 2.8 14l7.7 6c1.9-5.7 7.2-9.5 13.5-9.5Z"
    />
    <Path
      fill="#4285F4"
      d="M46.5 24.5c0-1.6-.2-3.1-.5-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5Z"
    />
    <Path
      fill="#FBBC05"
      d="M10.5 28c-.5-1.5-.8-3-.8-4.5s.3-3.1.8-4.5l-7.7-6C1.4 16 1 19.9 1 23.5s.4 7.5 1.8 10.5l7.7-6Z"
    />
    <Path
      fill="#34A853"
      d="M24 46c6.4 0 11.8-2.1 15.7-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.2 2.3-6.3 0-11.6-3.8-13.5-9.5l-7.7 6C6.6 41.7 14.6 46 24 46Z"
    />
  </Svg>
);

export const GoogleGradientDefs = () => (
  <Defs>
    <LinearGradient id="forestGradient" x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor="#40916D" />
      <Stop offset="0.5" stopColor="#1F6B4A" />
      <Stop offset="1" stopColor="#163D2E" />
    </LinearGradient>
  </Defs>
);
