import { artifacts } from '../data/artifacts'
import InnerPageCanvas from './InnerPageCanvas'
import BackGlyph from './BackGlyph'

const statusStyle: Record<string, string> = {
  alive: 'text-cyan-500/50',
  unstable: 'text-amber-500/50',
  seed: 'text-cyan-600/40',
  dormant: 'text-gray-600/40',
}

export default function ArtifactsPage({ onBack }: { onBack: () => void }) {
  return (
    <>
      <InnerPageCanvas />
      <div className="relative z-10 min-h-screen text-gray-400 px-6 py-12 sm:px-12 md:px-24 lg:px-40">
        <BackGlyph onClick={onBack} />

        <div className="max-w-2xl mx-auto pt-8">
          <p className="text-gray-600 text-xs tracking-[0.3em] uppercase mb-16 font-mono">
            artifacts
          </p>

          <div className="space-y-12">
            {artifacts.map((artifact) => (
              <div key={artifact.id} className="group">
                <h2 className="text-gray-300/80 text-base sm:text-lg font-light leading-relaxed">
                  {artifact.title}
                </h2>

                <div className="flex items-center gap-3 mt-2">
                  <span className="text-gray-600 text-[10px] tracking-wider uppercase font-mono">
                    {artifact.type}
                  </span>
                  <span className={`text-[10px] tracking-wider uppercase font-mono ${statusStyle[artifact.status] || 'text-gray-600'}`}>
                    {artifact.status}
                  </span>
                </div>

                <p className="text-gray-500/70 text-sm mt-3 leading-relaxed">
                  {artifact.description}
                </p>

                <p className="text-gray-600/50 text-xs mt-2 italic font-mono">
                  {artifact.why}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
