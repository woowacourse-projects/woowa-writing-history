import styles from './WritingMeta.module.css'

interface WritingMetaProps {
  author?: string
  source?: string
}

export function WritingMeta({ author, source }: WritingMetaProps) {
  if (!author && !source) {
    return null
  }

  const profileUrl = author ? `https://github.com/${encodeURIComponent(author)}` : ''

  return (
    <aside className={styles.meta} aria-label="글 정보">
      <div className={styles.row}>
        {author && (
          <span className={styles.item}>
            <span className={styles.label}>저자</span>
            <a className={styles.link} href={profileUrl} target="_blank" rel="noreferrer">
              @{author}
            </a>
          </span>
        )}
        {author && source && <span className={styles.separator}>·</span>}
        {source && (
          <a className={styles.sourceLink} href={source} target="_blank" rel="noreferrer">
            원문 보기
          </a>
        )}
      </div>
    </aside>
  )
}
