export default function Logo({ size = 44, variant }) {
  const src = variant === 'black'
    ? '/images/logo/logo_trnsp_black.png'
    : variant === 'white'
      ? '/images/logo/logo_trnsp_white.png'
      : undefined

  if (src) {
    return (
      <img src={src} alt="AFAQ Logo" width={size} height={size} style={{ objectFit: 'contain' }} />
    )
  }

  return (
    <picture>
      <source srcSet="/images/logo/logo_trnsp_white.png" media="(prefers-color-scheme: dark)" />
      <img
        src="/images/logo/logo_trnsp_black.png"
        alt="AFAQ Logo"
        width={size}
        height={size}
        style={{ objectFit: 'contain' }}
      />
    </picture>
  )
}
