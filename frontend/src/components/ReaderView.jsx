export default function ReaderView({ article, showImages }) {
  return (
    <article>
      <h1 className="text-2xl md:text-3xl font-semibold leading-snug mb-2">
        {article.title}
      </h1>
      {(article.byline || article.siteName) && (
        <p className="font-mono text-xs text-ink-soft dark:text-white/40 mb-8">
          {[article.byline, article.siteName].filter(Boolean).join(' · ')}
        </p>
      )}
      <div className="space-y-5 text-[17px] leading-[1.8]">
        {article.content.map((block, i) => {
          if (block.type === 'image') {
            return showImages ? (
              <img key={i} src={block.src} alt={block.alt} className="rounded-md w-full" loading="lazy" />
            ) : null
          }
          if (block.type === 'heading') {
            const Tag = `h${Math.min(block.level + 1, 6)}`
            return (
              <Tag key={i} className="font-semibold pt-4 text-lg md:text-xl">
                {block.text}
              </Tag>
            )
          }
          if (block.type === 'quote') {
            return (
              <blockquote
                key={i}
                className="border-l-2 border-accent dark:border-accent-bright pl-4 italic text-ink-soft dark:text-white/70"
              >
                {block.text}
              </blockquote>
            )
          }
          if (block.type === 'list') {
            const ListTag = block.ordered ? 'ol' : 'ul'
            return (
              <ListTag key={i} className={block.ordered ? 'list-decimal pl-5' : 'list-disc pl-5'}>
                {block.items.map((item, j) => <li key={j} className="mb-2">{item}</li>)}
              </ListTag>
            )
          }
          return <p key={i}>{block.text}</p>
        })}
      </div>
    </article>
  )
}
