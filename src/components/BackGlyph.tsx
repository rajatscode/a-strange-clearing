export default function BackGlyph({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed top-6 left-6 z-20 w-8 h-8 flex items-center justify-center cursor-pointer group"
      aria-label="Return to clearing"
    >
      <div
        className="w-2 h-2 rounded-full transition-all duration-500"
        style={{
          backgroundColor: 'rgba(100, 210, 220, 0.35)',
          boxShadow: '0 0 6px rgba(100, 210, 220, 0.15), 0 0 12px rgba(100, 210, 220, 0.05)',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget
          el.style.backgroundColor = 'rgba(100, 210, 220, 0.6)'
          el.style.boxShadow = '0 0 8px rgba(100, 210, 220, 0.3), 0 0 16px rgba(100, 210, 220, 0.1)'
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget
          el.style.backgroundColor = 'rgba(100, 210, 220, 0.35)'
          el.style.boxShadow = '0 0 6px rgba(100, 210, 220, 0.15), 0 0 12px rgba(100, 210, 220, 0.05)'
        }}
      />
    </button>
  )
}
