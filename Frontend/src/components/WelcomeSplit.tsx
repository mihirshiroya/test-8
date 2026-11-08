import type { ReactNode } from "react"
import { BadgeCheck, CalendarDays, LayoutGrid, ListTodo, NotebookPen, Timer } from "lucide-react"
import "./welcome-split.css"

interface WelcomeSplitProps {
  eyebrow: string
  title: ReactNode
  description: string
  benefits: string[]
  children: ReactNode
  desktopSetup?: boolean
}

export default function WelcomeSplit({ eyebrow, title, description, benefits, children, desktopSetup = false }: WelcomeSplitProps) {
  return (
    <div className={`welcome-split${desktopSetup ? " welcome-split--setup" : ""}`}>
      <div className="welcome-story">
        <div className="welcome-story-inner">
          <span className="welcome-eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p className="welcome-description">{description}</p>
          <ul className="welcome-benefits">
            {benefits.map((benefit) => <li key={benefit}><BadgeCheck size={16} aria-hidden="true" />{benefit}</li>)}
          </ul>
          <div className="welcome-tools" aria-hidden="true">
            {[ListTodo, CalendarDays, NotebookPen, Timer, LayoutGrid].map((Icon, index) => (
              <span key={index}><i><Icon size={22} strokeWidth={1.7} /></i></span>
            ))}
          </div>
          <span className="welcome-footnote">A LITTLE PROGRESS. EVERY DAY.</span>
        </div>
      </div>
      <div className="welcome-art-panel">{children}</div>
    </div>
  )
}
