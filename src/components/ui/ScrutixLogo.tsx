interface ScrutixLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm: { icon: 36, text: 'text-3xl' },
  md: { icon: 44, text: 'text-4xl' },
  lg: { icon: 52, text: 'text-5xl' },
  xl: { icon: 64, text: 'text-6xl' },
};

export function ScrutixLogo({ size = 'md', showText = true, className = '' }: ScrutixLogoProps) {
  const { icon, text } = sizes[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Logo Icon - Shield with magnifying glass and chart */}
      <div
        className="relative flex-shrink-0"
        style={{ width: icon, height: icon }}
      >
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Gradient definitions */}
          <defs>
            <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e3a5f" />
              <stop offset="100%" stopColor="#0f2744" />
            </linearGradient>
            <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
            <linearGradient id="barGradient" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>

          {/* Shield base */}
          <path
            d="M32 4L8 14v18c0 14 10.67 26.67 24 30 13.33-3.33 24-16 24-30V14L32 4z"
            fill="url(#shieldGradient)"
          />

          {/* Shield inner border */}
          <path
            d="M32 8L12 16.5v14.5c0 11.5 8.67 21.83 20 24.5 11.33-2.67 20-13 20-24.5V16.5L32 8z"
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
          />

          {/* Bar chart inside shield */}
          <rect x="18" y="36" width="6" height="12" rx="1" fill="url(#barGradient)" opacity="0.9" />
          <rect x="26" y="30" width="6" height="18" rx="1" fill="url(#barGradient)" opacity="0.9" />
          <rect x="34" y="24" width="6" height="24" rx="1" fill="url(#barGradient)" opacity="0.9" />

          {/* Magnifying glass */}
          <circle
            cx="42"
            cy="22"
            r="10"
            fill="url(#accentGradient)"
            stroke="white"
            strokeWidth="2"
          />
          <circle
            cx="42"
            cy="22"
            r="5"
            fill="none"
            stroke="white"
            strokeWidth="2"
            opacity="0.8"
          />
          <line
            x1="49"
            y1="29"
            x2="54"
            y2="34"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Checkmark in magnifying glass */}
          <path
            d="M38 22l3 3 5-6"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Text */}
      {showText && (
        <span className={`font-display ${text} font-medium text-primary-900 tracking-tight`}>
          Scrutix
        </span>
      )}
    </div>
  );
}

// Icon-only version for smaller uses
export function ScrutixIcon({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ width: size, height: size }}
    >
      <defs>
        <linearGradient id="shieldGradientIcon" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e3a5f" />
          <stop offset="100%" stopColor="#0f2744" />
        </linearGradient>
        <linearGradient id="accentGradientIcon" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="barGradientIcon" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>

      <path
        d="M32 4L8 14v18c0 14 10.67 26.67 24 30 13.33-3.33 24-16 24-30V14L32 4z"
        fill="url(#shieldGradientIcon)"
      />

      <path
        d="M32 8L12 16.5v14.5c0 11.5 8.67 21.83 20 24.5 11.33-2.67 20-13 20-24.5V16.5L32 8z"
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="1"
      />

      <rect x="18" y="36" width="6" height="12" rx="1" fill="url(#barGradientIcon)" opacity="0.9" />
      <rect x="26" y="30" width="6" height="18" rx="1" fill="url(#barGradientIcon)" opacity="0.9" />
      <rect x="34" y="24" width="6" height="24" rx="1" fill="url(#barGradientIcon)" opacity="0.9" />

      <circle
        cx="42"
        cy="22"
        r="10"
        fill="url(#accentGradientIcon)"
        stroke="white"
        strokeWidth="2"
      />
      <circle
        cx="42"
        cy="22"
        r="5"
        fill="none"
        stroke="white"
        strokeWidth="2"
        opacity="0.8"
      />
      <line
        x1="49"
        y1="29"
        x2="54"
        y2="34"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M38 22l3 3 5-6"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
