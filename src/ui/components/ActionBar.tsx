import { type ReactNode } from 'react'

export function ActionBarBtn({ label, shortcut, onClick, icon, color, active }: {
  label: string; shortcut: string; onClick: () => void; icon: ReactNode; color: string; active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="btn-factory flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-150 group"
      style={{
        background: active ? `${color}18` : 'transparent',
        border: `1px solid ${active ? `${color}40` : 'transparent'}`,
        boxShadow: active ? `0 0 15px ${color}20` : 'none',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(216,128,16,0.08)'
        ;(e.currentTarget as HTMLElement).style.border = '1px solid rgba(216,128,16,0.25)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = active ? `${color}14` : 'transparent'
        ;(e.currentTarget as HTMLElement).style.border = `1px solid ${active ? `${color}35` : 'transparent'}`
      }}
    >
      <span style={{ color: active ? color : 'rgba(255,255,255,0.5)', filter: active ? `drop-shadow(0 0 6px ${color})` : 'none' }}>
        {icon}
      </span>
      <span className="text-[9px] font-orbitron tracking-wider" style={{ color: active ? color : 'rgba(255,255,255,0.35)' }}>
        {label}
      </span>
      {shortcut && (
        <span className="text-[8px] px-1 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.2)' }}>
          {shortcut}
        </span>
      )}
    </button>
  )
}

export function WrenchIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg> }
export function FlaskIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6l1 9H8L9 3z" /><path d="M6.4 18.3a2 2 0 0 0 1.8 1.7h7.6a2 2 0 0 0 1.8-1.7L18 12H6l.4 6.3z" /></svg> }
export function PackageIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27,6.96 12,12.01 20.73,6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg> }
export function ChartIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg> }
export function TrophyIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="14,9 12,11 10,9" /><path d="M21 4H3v4a9 9 0 0 0 18 0V4z" /><path d="M12 17v4" /><line x1="8" y1="21" x2="16" y2="21" /></svg> }
export function GemIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" /><line x1="12" y1="22" x2="12" y2="15.5" /><polyline points="22,8.5 12,15.5 2,8.5" /><polyline points="2,8.5 12,2 22,8.5" /></svg> }
export function SaveIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" /></svg> }
export function FriendsIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
