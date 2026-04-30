import { artifacts } from '../data/artifacts'

const statusStyle: Record<string, string> = {
  alive: 'text-emerald-600/60',
  unstable: 'text-amber-600/60',
  seed: 'text-cyan-700/50',
  dormant: 'text-gray-600/50',
}

export default function ArtifactsPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-[#060810] text-gray-400 px-6 py-12 sm:px-12 md:px-24 lg:px-40">
      <div className="max-w-2xl mx-auto">
        <p className="text-gray-600 text-xs tracking-[0.3em] uppercase mb-16 font-mono">
          artifacts
        </p>

        <div className="space-y-12">
          {artifacts.map((artifact) => (
            <div key={artifact.id} className="group">
              <h2 className="text-gray-300/90 text-base sm:text-lg font-light leading-relaxed">
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

              <p className="text-gray-500/80 text-sm mt-3 leading-relaxed">
                {artifact.description}
              </p>

              <p className="text-gray-600/60 text-xs mt-2 italic font-mono">
                {artifact.why}
              </p>
            </div>
          ))}
        </div>

        <button
          onClick={onBack}
          className="mt-20 mb-12 w-6 h-6 rounded-full border border-gray-800 hover:border-gray-600 flex items-center justify-center transition-colors duration-500 cursor-pointer"
          aria-label="Return to clearing"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-gray-700 hover:bg-gray-500 transition-colors duration-500" />
        </button>
      </div>
    </div>
  )
}
