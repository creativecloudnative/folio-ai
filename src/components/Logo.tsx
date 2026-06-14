export default function Logo({ className }: { className?: string }) {
  return (
    <span className={`font-mono tracking-tight ${className}`}>
      <span className="text-white">folio</span>
      <span className="text-indigo-400">-ai</span>
    </span>
  )
}
