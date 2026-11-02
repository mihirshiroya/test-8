import { BoardView } from "../components/Ui/board-view"

export default function KanbanPage() {
  return (
    <BoardView
      title="Kanban"
      description="all tasks merged into one board. Each card is tagged with its source. The single-active-task rule still applies — starting any task pauses whatever else was running, whether a note or a project."
      workspaceId={null}
    />
  )
}
