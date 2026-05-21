import { memo } from 'react'
import type { TutorialStep } from '../core/systems/tutorial'

interface Props {
  step: TutorialStep
  index: number
  total: number
  onSkip: () => void
}

export default memo(function TutorialOverlay({ step, index, total, onSkip }: Props) {
  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="absolute bottom-32 left-1/2 -translate-x-1/2 pointer-events-auto animate-slide-up" style={{ maxWidth: '480px' }}>
        <div
          className="rounded-2xl p-4"
          style={{
            background: 'linear-gradient(135deg, rgba(15,20,24,0.95), rgba(10,13,17,0.95))',
            border: '1px solid rgba(244,114,182,0.3)',
            borderTop: '1px solid rgba(244,114,182,0.5)',
            boxShadow: '0 0 60px rgba(0,0,0,0.8), 0 0 30px rgba(244,114,182,0.08)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ background: 'rgba(244,114,182,0.1)', border: '1px solid rgba(244,114,182,0.2)' }}
            >
              {step.message.split(' ')[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-orbitron font-bold text-sm" style={{ color: '#f472b6' }}>
                {step.message}
              </div>
              <div className="text-xs text-white/60 mt-1 leading-relaxed">
                {step.detail}
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <div
                    className="h-1 rounded-full"
                    style={{
                      width: `${(index / total) * 100}%`,
                      maxWidth: '120px',
                      background: 'linear-gradient(90deg, #f472b6, #ec4899)',
                    }}
                  />
                  <span className="text-[10px] text-white/30 font-orbitron">
                    {index}/{total}
                  </span>
                </div>
                <button
                  onClick={onSkip}
                  className="text-[10px] font-orbitron px-2 py-1 rounded-lg transition-colors"
                  style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  SKIP ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
