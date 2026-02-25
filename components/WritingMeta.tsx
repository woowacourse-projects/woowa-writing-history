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
      <dl className={styles.list}>
        {author && (
          <div className={styles.item}>
            <dt className={styles.term}>저자</dt>
            <dd className={styles.value}>
              <a className={styles.link} href={profileUrl} target="_blank" rel="noreferrer">
                @{author}
              </a>
            </dd>
          </div>
        )}
        {source && (
          <div className={styles.item}>
            <dt className={styles.term}>원문</dt>
            <dd className={styles.value}>
              <a className={styles.sourceLink} href={source} target="_blank" rel="noreferrer">
                GitHub 파일 보기
              </a>
            </dd>
          </div>
        )}
      </dl>
    </aside>
  )
}
