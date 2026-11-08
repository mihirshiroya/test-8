import { useLocation } from 'react-router-dom'

const WORKSPACE_ROUTE = /^\/(?:overview|notes|calender|session|kanban|projects|profile|settings|account|admin)(?:\/|$)/i

export function WorkspaceAppearance() {
  const { pathname } = useLocation()

  return WORKSPACE_ROUTE.test(pathname) ? (
    <span hidden data-workspace-ui="cloud" />
  ) : null
}
