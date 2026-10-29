import type { SVGProps } from 'react'

export type IconName =
  | 'dashboard'
  | 'sales'
  | 'payment'
  | 'clients'
  | 'expenses'
  | 'withdrawals'
  | 'otherIncome'
  | 'history'
  | 'audit'
  | 'catalog'
  | 'backup'
  | 'more'
  | 'menu'
  | 'plus'
  | 'arrowLeft'
  | 'arrowRight'
  | 'arrowUpRight'
  | 'arrowDownLeft'
  | 'chevronDown'
  | 'chevronLeft'
  | 'chevronRight'
  | 'search'
  | 'logout'
  | 'close'
  | 'check'
  | 'alert'
  | 'info'
  | 'download'
  | 'edit'
  | 'ban'
  | 'money'
  | 'calendar'
  | 'user'
  | 'phone'
  | 'file'
  | 'eye'
  | 'eyeOff'
  | 'refresh'
  | 'lock'
  | 'mail'
  | 'sparkle'
  | 'external'

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number
  title?: string
}

export function Icon({ name, size = 20, title, strokeWidth = 1.8, ...rest }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': title ? undefined : true,
    role: title ? 'img' : undefined,
    ...rest,
  }

  return (
    <svg {...common}>
      {title ? <title>{title}</title> : null}
      {name === 'dashboard' && (
        <>
          <rect x="3" y="3" width="7" height="7" rx="2" />
          <rect x="14" y="3" width="7" height="7" rx="2" />
          <rect x="3" y="14" width="7" height="7" rx="2" />
          <rect x="14" y="14" width="7" height="7" rx="2" />
        </>
      )}
      {name === 'sales' && (
        <>
          <path d="M20.6 13.2 13.2 20.6a2 2 0 0 1-2.8 0L3 13.2V3h10.2l7.4 7.4a2 2 0 0 1 0 2.8Z" />
          <circle cx="7.5" cy="7.5" r="1.2" />
        </>
      )}
      {name === 'payment' && (
        <>
          <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
          <path d="M2.5 9.5h19" />
          <path d="M6.5 15h4" />
        </>
      )}
      {name === 'clients' && (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      )}
      {name === 'expenses' && (
        <>
          <path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21V3Z" />
          <path d="M9 8h6M9 12h6" />
        </>
      )}
      {name === 'withdrawals' && (
        <>
          <path d="M20 7V5a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a3 3 0 0 1-3-3V6" />
          <path d="M16 14h.01" />
        </>
      )}
      {name === 'otherIncome' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </>
      )}
      {name === 'history' && (
        <>
          <path d="M3 12a9 9 0 1 0 2.6-6.3L3 8" />
          <path d="M3 3v5h5" />
          <path d="M12 7v5l3 2" />
        </>
      )}
      {name === 'audit' && (
        <>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
          <path d="m9 12 2 2 4-4" />
        </>
      )}
      {name === 'catalog' && (
        <>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
          <path d="M9 7h7" />
        </>
      )}
      {name === 'backup' && (
        <>
          <ellipse cx="12" cy="5" rx="8" ry="3" />
          <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
          <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
        </>
      )}
      {name === 'more' && (
        <>
          <circle cx="5" cy="12" r="1" fill="currentColor" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
          <circle cx="19" cy="12" r="1" fill="currentColor" />
        </>
      )}
      {name === 'menu' && <path d="M4 7h16M4 12h16M4 17h16" />}
      {name === 'plus' && <path d="M12 5v14M5 12h14" />}
      {name === 'arrowLeft' && <path d="M19 12H5m7-7-7 7 7 7" />}
      {name === 'arrowRight' && <path d="M5 12h14m-7-7 7 7-7 7" />}
      {name === 'arrowUpRight' && <path d="M7 17 17 7M8 7h9v9" />}
      {name === 'arrowDownLeft' && <path d="M17 7 7 17M16 17H7V8" />}
      {name === 'chevronDown' && <path d="m6 9 6 6 6-6" />}
      {name === 'chevronLeft' && <path d="m15 18-6-6 6-6" />}
      {name === 'chevronRight' && <path d="m9 18 6-6-6-6" />}
      {name === 'search' && (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </>
      )}
      {name === 'logout' && (
        <>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5M21 12H9" />
        </>
      )}
      {name === 'close' && <path d="M18 6 6 18M6 6l12 12" />}
      {name === 'check' && <path d="m20 6-11 11-5-5" />}
      {name === 'alert' && (
        <>
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 17h.01" />
        </>
      )}
      {name === 'info' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </>
      )}
      {name === 'download' && (
        <>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="m7 10 5 5 5-5M12 15V3" />
        </>
      )}
      {name === 'edit' && (
        <>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </>
      )}
      {name === 'ban' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m5.6 5.6 12.8 12.8" />
        </>
      )}
      {name === 'money' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v10M15 9.5c0-1.4-1.3-2-3-2s-3 .6-3 2 1.3 2 3 2 3 .6 3 2-1.3 2-3 2-3-.6-3-2" />
        </>
      )}
      {name === 'calendar' && (
        <>
          <rect x="3" y="4.5" width="18" height="17" rx="2.5" />
          <path d="M8 2.5v4M16 2.5v4M3 9.5h18" />
        </>
      )}
      {name === 'user' && (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </>
      )}
      {name === 'phone' && (
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z" />
      )}
      {name === 'file' && (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6M9 13h6M9 17h4" />
        </>
      )}
      {name === 'eye' && (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
      {name === 'eyeOff' && (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 6.2A11 11 0 0 1 12 6c6.5 0 10 6 10 6a18 18 0 0 1-3 3.7M6.6 6.6A18 18 0 0 0 2 12s3.5 6 10 6a10 10 0 0 0 4.4-1" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </>
      )}
      {name === 'refresh' && (
        <>
          <path d="M21 12a9 9 0 0 1-15.5 6.2L3 15" />
          <path d="M3 12A9 9 0 0 1 18.5 5.8L21 9" />
          <path d="M3 21v-6h6M21 3v6h-6" />
        </>
      )}
      {name === 'lock' && (
        <>
          <rect x="4" y="10" width="16" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </>
      )}
      {name === 'mail' && (
        <>
          <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
          <path d="m3 6 9 7 9-7" />
        </>
      )}
      {name === 'sparkle' && (
        <>
          <path d="M12 3c.6 4.8 4.2 8.4 9 9-4.8.6-8.4 4.2-9 9-.6-4.8-4.2-8.4-9-9 4.8-.6 8.4-4.2 9-9Z" />
        </>
      )}
      {name === 'external' && (
        <>
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <path d="M15 3h6v6M10 14 21 3" />
        </>
      )}
    </svg>
  )
}

export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <rect width="64" height="64" rx="18" fill="currentColor" />
        <path
          d="M20 40c8-2 15-9 18-18 2 8 0 15-5 20-4 4-9 5-13 4 0-2 0-4 0-6Z"
          fill="#ffe5d9"
        />
        <path
          d="M20 46c9-1 18-7 23-17"
          stroke="#8e3f52"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}
