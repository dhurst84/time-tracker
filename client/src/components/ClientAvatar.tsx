import { useState } from 'react'
import { avatarInitials } from '../lib/utils'

interface ClientAvatarProps {
  name: string
  color: string
  website?: string
  size?: 'sm' | 'lg'
  className?: string
}

function extractDomain(website: string): string | null {
  try {
    const url = website.startsWith('http') ? website : `https://${website}`
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

export default function ClientAvatar({ name, color, website, size = 'sm', className = '' }: ClientAvatarProps) {
  const [logoFailed, setLogoFailed] = useState(false)

  const domain = website ? extractDomain(website) : null
  const showLogo = !!domain && !logoFailed

  const sizeClasses = size === 'lg'
    ? 'w-12 h-12 rounded-xl text-base'
    : 'w-8 h-8 rounded-lg text-xs'

  return (
    <div
      className={`${sizeClasses} flex items-center justify-center flex-shrink-0 overflow-hidden ${className}`}
      style={showLogo ? { backgroundColor: '#fff', border: '1px solid #e7e5e4' } : { backgroundColor: color }}
    >
      {showLogo ? (
        <img
          src={`https://logo.clearbit.com/${domain}`}
          alt={name}
          className="w-full h-full object-contain p-1"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <span className="text-white font-semibold">{avatarInitials(name)}</span>
      )}
    </div>
  )
}
