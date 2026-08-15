'use client'

export type ProjectTimelineItem = {
  id: string
  label: string
  state: 'complete' | 'active' | 'upcoming'
}

export function ProjectTimeline({ items, totalWords }: { items: ProjectTimelineItem[]; totalWords: number }) {
  return (
    <section className="pis-project-timeline" aria-labelledby="project-timeline-title">
      <div className="pis-section-heading"><div><p className="pis-kicker">Put rada</p><h2 id="project-timeline-title">Od teme do predaje</h2></div><span>{totalWords.toLocaleString('hr-HR')} riječi</span></div>
      <ol>
        {items.map((item) => <li key={item.id} data-state={item.state} aria-current={item.state === 'active' ? 'step' : undefined}><i aria-hidden="true" />{item.label}</li>)}
      </ol>
    </section>
  )
}
