export default function Skeleton({ className = '', style }) {
  return (
    <div
      className={`rounded-lg ${className}`}
      style={{
        background: 'var(--color-border-light)',
        animation: 'shimmer 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  )
}
