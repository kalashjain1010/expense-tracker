/** Brand mark — coin + rupee, matches Kharcha green */
export default function KharchaLogo({ size = 36, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="64" height="64" rx="16" fill="#1a5c45" />
      <rect x="3" y="3" width="58" height="58" rx="14" stroke="#e8f5ee" strokeOpacity="0.18" strokeWidth="2" />
      <path
        className="logo-arc"
        d="M20 36c0-7.2 5.4-12.5 12-12.5S44 28.8 44 36"
        stroke="#e8f5ee"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle className="logo-coin" cx="32" cy="23" r="4.5" fill="#e8a54b" />
      <text
        x="32"
        y="48"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="14"
        fontWeight="700"
        fill="#e8f5ee"
      >
        ₹
      </text>
    </svg>
  )
}
