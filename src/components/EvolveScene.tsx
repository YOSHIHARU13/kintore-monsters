import { useEffect, useState } from 'react'
import { MonsterImage } from './MonsterImage'
import type { monArt } from '../lib/art'

type Art = ReturnType<typeof monArt>

// 進化の演出：今の姿に光が集まる → 光に包まれて形が揺らぐ → 白く弾ける → 新しい姿が現れる
type Phase = 'gather' | 'morph' | 'burst' | 'done'
const GATHER_MS = 1100
const MORPH_MS = 1300
const BURST_MS = 420

export function EvolveScene({ before, after, name, label, onClose }: { before: Art; after: Art; name: string; label: string; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('gather')
  useEffect(() => {
    if (phase === 'done') return
    const next: Record<Exclude<Phase, 'done'>, [Phase, number]> = {
      gather: ['morph', GATHER_MS],
      morph: ['burst', MORPH_MS],
      burst: ['done', BURST_MS],
    }
    const [to, ms] = next[phase]
    const t = setTimeout(() => {
      setPhase(to)
      if (to === 'burst') navigator.vibrate?.([60, 40, 60, 40, 240])
    }, ms)
    return () => clearTimeout(t)
  }, [phase])

  return (
    <div className={`beat-overlay evolve-overlay phase-${phase}`} onClick={() => (phase === 'done' ? onClose() : setPhase('done'))}>
      <div className="evolve-rays" />
      {phase !== 'done' &&
        Array.from({ length: 18 }, (_, i) => <i key={i} className="evolve-mote" style={{ ['--i' as string]: i }} />)}
      <div className="beat-text">
        <div className="evolve-stage">
          {phase === 'done' ? (
            <div className="evolve-after">
              <MonsterImage {...after} size={200} />
            </div>
          ) : (
            <>
              <div className="evolve-before">
                <MonsterImage {...before} size={200} />
              </div>
              {phase === 'morph' && (
                <div className="evolve-ghost">
                  <MonsterImage {...after} size={200} />
                </div>
              )}
            </>
          )}
          {phase === 'burst' && <div className="hatch-flash" />}
        </div>
        {phase === 'done' ? (
          <>
            <div className="beat-title">{label}</div>
            <div className="beat-sub">{name}になった！</div>
            <div className="muted small">タップして続ける</div>
          </>
        ) : (
          <div className="beat-sub evolve-wait">……！？</div>
        )}
      </div>
    </div>
  )
}
