import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight } from 'lucide-react'

export function Button({ children, to, href, variant = 'primary', size = 'md', className = '', icon, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 cursor-pointer'

  const sizes = {
    sm: 'px-4 py-2 text-sm rounded-2xl',
    md: 'px-7 py-3.5 text-sm rounded-2xl',
    lg: 'px-8 py-4 text-base rounded-2xl',
  }

  const variants = {
    primary: {
      background: '#0F172A',
      color: '#fff',
      border: 'none',
    },
    outline: {
      background: '#fff',
      color: '#0F172A',
      border: '2px solid #0F172A',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--color-text-muted)',
      border: 'none',
    },
    white: {
      background: '#fff',
      color: '#0A1628',
      border: 'none',
    },
  }

  const style = variants[variant]

  const classes = `${base} ${sizes[size]} ${className}`

  const content = <><span>{children}</span>{icon === 'arrow' && <ArrowRight size={16} />}{icon === 'external' && <ArrowUpRight size={16} />}</>

  if (to) return <Link to={to} className={classes} style={style}>{content}</Link>
  if (href) return <a href={href} className={classes} style={style} target="_blank" rel="noopener noreferrer">{content}</a>
  return <button className={classes} style={style} {...props}>{content}</button>
}
