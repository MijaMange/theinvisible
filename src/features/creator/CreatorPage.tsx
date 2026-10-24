import { useCallback, useState } from 'react'
import type { ExhibitView } from '../neuron/types'
import { ExhibitNavigation } from '../neuron/components/ExhibitNavigation'
import { CreatorAvatar } from './CreatorAvatar'

type CreatorPageProps = {
  view: ExhibitView
  prefersReducedMotion: boolean
  onNavigate: (view: ExhibitView) => void
  onCreator: () => void
}

export function CreatorPage({
  view,
  prefersReducedMotion,
  onNavigate,
  onCreator,
}: CreatorPageProps) {
  const [avatarStatus, setAvatarStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  const handleAvatarLoaded = useCallback(() => setAvatarStatus('loaded'), [])
  const handleAvatarError = useCallback(() => setAvatarStatus('error'), [])

  return (
    <main className="creator-page" aria-labelledby="creator-title">
      <header className="editorial">
        <h2 className="editorial__brand">THE INVISIBLE</h2>
        <p>An exploration of the architecture of thought.</p>
      </header>
      <ExhibitNavigation
        view={view}
        creatorActive
        onNavigate={onNavigate}
        onCreator={onCreator}
      />

      <div className="creator-main">
        <div className="creator-portrait" aria-label="Three-dimensional portrait of Mija">
          <CreatorAvatar
            prefersReducedMotion={prefersReducedMotion}
            onLoaded={handleAvatarLoaded}
            onError={handleAvatarError}
          />
          {avatarStatus === 'loading' && (
            <p className="creator-avatar-status" role="status">
              Loading portrait…
            </p>
          )}
          {avatarStatus === 'error' && (
            <p className="creator-avatar-status creator-avatar-status--error" role="alert">
              The portrait could not be loaded. Place <code>mija_avatar.glb</code> in
              <code> public/models/</code> and refresh.
            </p>
          )}
        </div>

        <section className="creator-introduction">
          <p className="creator-introduction__eyebrow">BEHIND THE EXHIBITION</p>
          <h1 id="creator-title">Meet the Creator</h1>
          <p>
            I'm Mija, a frontend developer with a curiosity for neuroscience. The Invisible
            is where I bring code and biology together.
          </p>
        </section>
      </div>
    </main>
  )
}
