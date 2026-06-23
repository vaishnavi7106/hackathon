// Reusable SVG illustration components for Uzhavar AI

export function WaterDropIll({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 100 115" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="wd-body" x1="30" y1="5" x2="70" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7DD3FC" />
          <stop offset="100%" stopColor="#0369A1" />
        </linearGradient>
        <linearGradient id="wd-wave1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#BAE6FD" />
          <stop offset="100%" stopColor="#7DD3FC" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="wd-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Glow behind drop */}
      <ellipse cx="50" cy="65" rx="36" ry="36" fill="url(#wd-glow)" />

      {/* Main raindrop shape */}
      <path d="M50 6 C50 6 16 52 16 72 C16 90.4 31.6 104 50 104 C68.4 104 84 90.4 84 72 C84 52 50 6 50 6Z"
        fill="url(#wd-body)" />

      {/* Inner glossy highlight */}
      <path d="M36 42 C32 52 30 60 32 70" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.3" />
      <ellipse cx="38" cy="48" rx="5" ry="9" fill="white" opacity="0.2" transform="rotate(-20 38 48)" />

      {/* Ripple ring 1 */}
      <ellipse cx="50" cy="107" rx="28" ry="6" fill="#BAE6FD" opacity="0.55" />
      {/* Ripple ring 2 */}
      <ellipse cx="50" cy="111" rx="18" ry="4" fill="#93C5FD" opacity="0.35" />

      {/* Small sparkle drops */}
      <circle cx="28" cy="38" r="3.5" fill="#7DD3FC" opacity="0.7" />
      <circle cx="76" cy="46" r="2.5" fill="#BAE6FD" opacity="0.65" />
      <circle cx="20" cy="65" r="2" fill="#38BDF8" opacity="0.5" />
      <circle cx="84" cy="70" r="1.5" fill="#7DD3FC" opacity="0.45" />

      {/* Mini drop accents */}
      <path d="M22 30 C22 30 18 36 18 38 C18 40 19.8 41 22 41 C24.2 41 26 40 26 38 C26 36 22 30 22 30Z"
        fill="#38BDF8" opacity="0.4" />
    </svg>
  )
}

export function SproutIll({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 100 115" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sp-soil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A16207" />
          <stop offset="100%" stopColor="#713F12" />
        </linearGradient>
        <linearGradient id="sp-leaf-l" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#86EFAC" />
          <stop offset="100%" stopColor="#16A34A" />
        </linearGradient>
        <linearGradient id="sp-leaf-r" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ADE80" />
          <stop offset="100%" stopColor="#15803D" />
        </linearGradient>
        <radialGradient id="sp-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="70%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#EAB308" />
        </radialGradient>
      </defs>

      {/* Sun */}
      <circle cx="76" cy="20" r="15" fill="url(#sp-sun)" />
      {/* Sun rays */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
        const rad = (deg * Math.PI) / 180
        const x1 = 76 + 18 * Math.cos(rad)
        const y1 = 20 + 18 * Math.sin(rad)
        const x2 = 76 + 24 * Math.cos(rad)
        const y2 = 20 + 24 * Math.sin(rad)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FDE047" strokeWidth="2.5" strokeLinecap="round" />
      })}

      {/* Soil mound */}
      <ellipse cx="50" cy="90" rx="40" ry="12" fill="url(#sp-soil)" />
      <rect x="10" y="90" width="80" height="16" rx="0" fill="url(#sp-soil)" />
      {/* Soil texture lumps */}
      <ellipse cx="28" cy="88" rx="9" ry="4" fill="#92400E" opacity="0.5" />
      <ellipse cx="68" cy="91" rx="7" ry="3.5" fill="#92400E" opacity="0.4" />
      <ellipse cx="50" cy="87" rx="11" ry="4" fill="#B45309" opacity="0.3" />

      {/* Main stem */}
      <path d="M50 88 Q48 72 50 58 Q52 44 50 32" stroke="#15803D" strokeWidth="4" strokeLinecap="round" fill="none" />

      {/* Left leaf */}
      <path d="M50 68 Q32 60 22 44 Q28 38 38 44 Q44 48 50 60Z" fill="url(#sp-leaf-l)" />
      <path d="M50 68 Q36 56 26 46" stroke="#14532D" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.35" />

      {/* Right leaf */}
      <path d="M50 54 Q68 44 78 28 Q70 24 62 32 Q56 38 50 50Z" fill="url(#sp-leaf-r)" />
      <path d="M50 54 Q64 42 74 30" stroke="#14532D" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.35" />

      {/* Top bud */}
      <path d="M50 32 C46 28 44 24 46 20 C48 16 52 16 54 20 C56 24 54 28 50 32Z" fill="#4ADE80" />
      <path d="M50 32 C54 28 56 24 54 20" stroke="#15803D" strokeWidth="1" fill="none" opacity="0.4" />

      {/* Small leaves at sides of bud */}
      <path d="M46 26 Q38 22 36 16 Q42 16 46 22Z" fill="#86EFAC" opacity="0.8" />
      <path d="M54 26 Q62 22 64 16 Q58 16 54 22Z" fill="#4ADE80" opacity="0.8" />

      {/* Sparkle dots */}
      <circle cx="18" cy="52" r="3" fill="#4ADE80" opacity="0.5" />
      <circle cx="82" cy="44" r="2" fill="#86EFAC" opacity="0.5" />
    </svg>
  )
}

export function GrainSackIll({ size = 90 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gs-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="60%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
        <linearGradient id="gs-neck" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#92400E" />
        </linearGradient>
        <linearGradient id="gs-wheat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>

      {/* Shadow */}
      <ellipse cx="50" cy="112" rx="36" ry="7" fill="#92400E" opacity="0.18" />

      {/* Sack body */}
      <path d="M20 42 Q16 48 16 60 L16 96 Q16 106 28 108 L72 108 Q84 108 84 96 L84 60 Q84 48 80 42Z"
        fill="url(#gs-body)" />

      {/* Weave texture — horizontal */}
      {[54, 66, 78, 90].map((y) => (
        <line key={y} x1="16" y1={y} x2="84" y2={y} stroke="#92400E" strokeWidth="1" opacity="0.18" />
      ))}
      {/* Weave texture — vertical */}
      {[30, 42, 54, 66, 78].map((x) => (
        <line key={x} x1={x} y1="42" x2={x} y2="108" stroke="#92400E" strokeWidth="1" opacity="0.12" />
      ))}

      {/* Sack highlight */}
      <path d="M22 50 Q20 65 20 80" stroke="white" strokeWidth="5" strokeLinecap="round" opacity="0.12" />
      <ellipse cx="32" cy="68" rx="8" ry="22" fill="white" opacity="0.08" transform="rotate(-5 32 68)" />

      {/* Neck */}
      <rect x="30" y="26" width="40" height="20" rx="6" fill="url(#gs-neck)" />

      {/* Rope tie */}
      <rect x="36" y="18" width="28" height="12" rx="5" fill="#78350F" />
      {/* Knot circle */}
      <circle cx="50" cy="18" r="8" fill="#92400E" />
      <circle cx="50" cy="18" r="4" fill="#78350F" />
      {/* Rope ends hanging */}
      <path d="M44 26 Q40 30 42 36" stroke="#92400E" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M56 26 Q60 30 58 36" stroke="#92400E" strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* Wheat stalks right */}
      <path d="M86 108 Q88 88 85 64" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <ellipse cx="85" cy="60" rx="6" ry="14" fill="url(#gs-wheat)" transform="rotate(10 85 60)" />
      <line x1="80" y1="72" x2="88" y2="68" stroke="#FDE68A" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="80" y1="80" x2="88" y2="76" stroke="#FDE68A" strokeWidth="1.5" strokeLinecap="round" />

      {/* Second wheat stalk */}
      <path d="M94 108 Q96 92 92 70" stroke="#B45309" strokeWidth="2" strokeLinecap="round" fill="none" />
      <ellipse cx="92" cy="66" rx="5" ry="11" fill="#FDE68A" opacity="0.8" transform="rotate(-8 92 66)" />

      {/* Small label */}
      <rect x="34" y="74" width="32" height="18" rx="4" fill="white" opacity="0.25" />
      <rect x="38" y="78" width="24" height="2.5" rx="1" fill="white" opacity="0.5" />
      <rect x="38" y="83" width="18" height="2.5" rx="1" fill="white" opacity="0.4" />
      <rect x="38" y="88" width="20" height="2.5" rx="1" fill="white" opacity="0.4" />
    </svg>
  )
}

export function CameraLeafIll({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cl-phone" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient id="cl-screen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ECFDF5" />
          <stop offset="100%" stopColor="#D1FAE5" />
        </linearGradient>
        <linearGradient id="cl-leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4ADE80" />
          <stop offset="100%" stopColor="#15803D" />
        </linearGradient>
      </defs>

      {/* Background glow */}
      <circle cx="50" cy="50" r="38" fill="#ECFDF5" opacity="0.4" />

      {/* Phone body */}
      <rect x="26" y="8" width="48" height="82" rx="10" fill="url(#cl-phone)" />
      {/* Phone side button */}
      <rect x="74" y="30" width="3" height="12" rx="1.5" fill="#334155" />

      {/* Screen */}
      <rect x="30" y="14" width="40" height="60" rx="5" fill="url(#cl-screen)" />

      {/* Leaf on screen */}
      <path d="M50 62 Q35 54 33 40 C33 40 44 34 52 44 C56 36 66 32 70 38 C70 38 68 54 56 60Z"
        fill="url(#cl-leaf)" />
      {/* Leaf main vein */}
      <path d="M50 62 L50 42" stroke="#14532D" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5" />
      {/* Leaf side veins */}
      <path d="M50 54 Q43 50 38 46" stroke="#14532D" strokeWidth="1" fill="none" opacity="0.35" />
      <path d="M50 48 Q56 44 62 40" stroke="#14532D" strokeWidth="1" fill="none" opacity="0.35" />

      {/* Scan line */}
      <line x1="30" y1="47" x2="70" y2="47" stroke="#0EA5E9" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.9" />

      {/* Corner scan brackets */}
      <path d="M32 18 L32 24 L38 24" stroke="#0A5C47" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M68 18 L68 24 L62 24" stroke="#0A5C47" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 70 L32 64 L38 64" stroke="#0A5C47" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M68 70 L68 64 L62 64" stroke="#0A5C47" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* Bottom bar */}
      <rect x="38" y="78" width="24" height="7" rx="3.5" fill="#1E293B" />
      <circle cx="50" cy="81.5" r="2.5" fill="#334155" />

      {/* Sparkle dots around phone */}
      <circle cx="18" cy="28" r="3.5" fill="#4ADE80" opacity="0.6" />
      <circle cx="82" cy="22" r="2.5" fill="#FDE047" opacity="0.65" />
      <circle cx="80" cy="58" r="3" fill="#4ADE80" opacity="0.5" />
      <circle cx="16" cy="60" r="2" fill="#86EFAC" opacity="0.5" />
      {/* Star sparkle */}
      <path d="M84 40 L85.5 36 L87 40 L91 40 L88 43 L89 47 L85.5 44.5 L82 47 L83 43 L80 40Z"
        fill="#FDE047" opacity="0.6" />
    </svg>
  )
}

export function SchemeIll({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sc-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="sc-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#DBEAFE" />
          <stop offset="100%" stopColor="#BFDBFE" />
        </linearGradient>
        <linearGradient id="sc-doc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F0FDF4" />
          <stop offset="100%" stopColor="#DCFCE7" />
        </linearGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="50" cy="95" rx="38" ry="5" fill="#1D4ED8" opacity="0.12" />

      {/* Building body */}
      <rect x="12" y="46" width="64" height="46" rx="2" fill="url(#sc-body)" />

      {/* Roof */}
      <path d="M5 48 L50 18 L95 48Z" fill="url(#sc-roof)" />
      {/* Roof ridge ornament */}
      <rect x="42" y="10" width="16" height="14" rx="2" fill="#1D4ED8" />
      <circle cx="50" cy="10" r="3" fill="#60A5FA" />

      {/* Pillars */}
      {[20, 34, 48, 62, 76].map((x) => (
        <rect key={x} x={x} y="48" width="8" height="44" rx="2" fill="#93C5FD" />
      ))}

      {/* Base step */}
      <rect x="8" y="88" width="72" height="6" rx="1" fill="#2563EB" opacity="0.4" />

      {/* Document overlay */}
      <rect x="50" y="38" width="42" height="52" rx="8" fill="url(#sc-doc)" stroke="#86EFAC" strokeWidth="1.5" />
      {/* Doc header bar */}
      <rect x="50" y="38" width="42" height="12" rx="8" fill="#D1FAE5" />
      <rect x="50" y="44" width="42" height="6" rx="0" fill="#D1FAE5" />
      {/* Doc lines */}
      <rect x="56" y="56" width="28" height="3" rx="1.5" fill="#16A34A" opacity="0.45" />
      <rect x="56" y="63" width="22" height="3" rx="1.5" fill="#16A34A" opacity="0.35" />
      <rect x="56" y="70" width="26" height="3" rx="1.5" fill="#16A34A" opacity="0.35" />
      {/* Check badge */}
      <circle cx="71" cy="82" r="11" fill="#16A34A" />
      <path d="M64.5 82 L69 87 L78 75" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

export function SunWeatherIll({ size = 90 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="sw-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FEF9C3" />
          <stop offset="50%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#F59E0B" />
        </radialGradient>
        <linearGradient id="sw-cloud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="#E0F2FE" />
        </linearGradient>
      </defs>

      {/* Sun rays */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
        const rad = (deg * Math.PI) / 180
        const x1 = 42 + 22 * Math.cos(rad)
        const y1 = 42 + 22 * Math.sin(rad)
        const x2 = 42 + 30 * Math.cos(rad)
        const y2 = 42 + 30 * Math.sin(rad)
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FDE047" strokeWidth="2.5" strokeLinecap="round" />
      })}

      {/* Sun body */}
      <circle cx="42" cy="42" r="20" fill="url(#sw-sun)" />
      {/* Sun inner highlight */}
      <circle cx="36" cy="36" r="6" fill="white" opacity="0.25" />

      {/* Cloud body */}
      <ellipse cx="68" cy="70" rx="22" ry="14" fill="url(#sw-cloud)" />
      <ellipse cx="52" cy="72" rx="16" ry="12" fill="url(#sw-cloud)" />
      <ellipse cx="60" cy="64" rx="16" ry="14" fill="url(#sw-cloud)" />
      <ellipse cx="76" cy="66" rx="14" ry="12" fill="url(#sw-cloud)" />
      {/* Cloud shadow line */}
      <ellipse cx="64" cy="83" rx="24" ry="4" fill="#BAE6FD" opacity="0.3" />

      {/* Rain drops under cloud */}
      <path d="M52 86 L50 94" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <path d="M62 88 L60 96" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <path d="M72 86 L70 94" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    </svg>
  )
}
