import type { ReactNode } from 'react'
import styles from './Toggle.module.css'

interface ToggleProps {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}

export function Toggle({ title, defaultOpen = false, children }: ToggleProps) {
  return (
    <details className={styles.toggle} open={defaultOpen || undefined}>
      <summary className={styles.summary}>{title}</summary>
      <div className={styles.content}>{children}</div>
    </details>
  )
}
