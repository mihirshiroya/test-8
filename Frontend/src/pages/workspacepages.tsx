"use client"

import { useParams, Navigate } from "react-router-dom"

import { BoardView } from "../components/Ui/board-view"
import { useWorkspaceStore } from "../store/slices/taskSlice"

/**
 * /projects/:projectSlug — the slug is the workspace id (see AppSidebar),
 * so the board is scoped to that workspace and new tasks default to it.
 */
export function ProjectPage() {
  const { projectSlug: workspaceId } = useParams<{
    projectSlug: string
  }>()

  const { workspaces, status } = useWorkspaceStore()

  if (!workspaceId) {
    return <Navigate to="/overview" replace />
  }

  const workspace = workspaces.find((w) => w.id === workspaceId)

  if (status === "succeeded" && !workspace) {
    return <Navigate to="/overview" replace />
  }

  const name = workspace?.name ?? ""

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1">
        <BoardView
          key={workspaceId}
          title={name}
          description={name ? `All tasks for ${name}.` : undefined}
          workspaceId={workspaceId}
        />
      </div>
    </div>
  )
}
