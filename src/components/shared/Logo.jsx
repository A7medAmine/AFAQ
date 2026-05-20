export default function Logo({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#071528" />
          <stop offset="100%" stopColor="#0F1E32" />
        </linearGradient>
        <linearGradient id="logoAccent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2460E7" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#logoBg)" stroke="url(#logoAccent)" strokeWidth="2.5" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(59,130,246,0.3)" strokeWidth="1.5" strokeDasharray="5 3" />
      <path d="M57 18 L34 52 L49 52 L43 82 L66 48 L51 48 Z" fill="white" opacity="0.92" />
      <path d="M54 62 L48 76 L60 57 L51 57 Z" fill="rgba(59,130,246,0.35)" />
      <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(96,165,250,0.1)" strokeWidth="6" />
    </svg>
  )
}
