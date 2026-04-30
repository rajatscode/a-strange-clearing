import { useState, useRef, useEffect } from 'react'
import { notes } from '../data/notes'
import InnerPageCanvas from './InnerPageCanvas'
import BackGlyph from './BackGlyph'

const statusColor: Record<string, string> = {
  fragment: 'text-amber-500/50',
  rough: 'text-cyan-500/40',
  'field note': 'text-emerald-500/40',
}

export default function NotesPage({ onBack }: { onBack: () => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <>
      <InnerPageCanvas />
      <div className="relative z-10 min-h-screen text-gray-400 px-6 py-12 sm:px-12 md:px-24 lg:px-40">
        <BackGlyph onClick={onBack} />

        <div className="max-w-2xl mx-auto pt-8">
          <p className="text-gray-600 text-xs tracking-[0.3em] uppercase mb-16 font-mono">
            fragments
          </p>

          <div className="space-y-10">
            {notes.map((note) => {
              const isOpen = expandedId === note.id
              return (
                <div
                  key={note.id}
                  className="cursor-pointer group"
                  onClick={() => setExpandedId(isOpen ? null : note.id)}
                >
                  <h2 className="text-gray-300/80 text-base sm:text-lg font-light leading-relaxed group-hover:text-gray-200/90 transition-colors duration-500">
                    {note.title}
                  </h2>

                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-[10px] tracking-wider uppercase font-mono ${statusColor[note.status] || 'text-gray-600'}`}>
                      {note.status}
                    </span>
                    <span className="text-gray-700 text-[10px]">
                      {note.tags.join(' \u00b7 ')}
                    </span>
                  </div>

                  <p className="text-gray-500/70 text-sm mt-3 leading-relaxed italic">
                    {note.excerpt}
                  </p>

                  {isOpen && (
                    <NoteBody body={note.body} noteId={note.id} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

function NoteBody({ body, noteId }: { body: string; noteId: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger fade-in on next frame
    requestAnimationFrame(() => setVisible(true))
  }, [noteId])

  return (
    <p
      ref={ref}
      className="text-gray-400/80 text-sm mt-6 leading-[1.8] border-l border-gray-800/60 pl-4"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 1s ease-in-out',
      }}
    >
      {body}
    </p>
  )
}
