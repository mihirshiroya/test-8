// ============================================================
// USER / AUTH
// ============================================================

export type UserRole = 'USER' | 'ADMIN' | 'MODERATOR';

export type AuthProvider = 'LOCAL' | 'GOOGLE';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;

  role: UserRole;
  provider: AuthProvider;

  isEmailVerified: boolean;
  isActive: boolean;

  avatar?: string;
  lastLoginAt?: string;

  totalFocusHours: number;
  pfpFrame: string;

  createdAt: string;
  updatedAt: string;
}

// ============================================================
// AUTH STATE
// ============================================================

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ============================================================
// AUTH REQUESTS
// ============================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface GoogleAuthRequest {
  googleToken: string;
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  pfpFrame?: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// ============================================================
// AUTH RESPONSE
// ============================================================

export interface AuthResponse {
  success: boolean;
  message: string;

  data: {
    user: User;

    tokens: {
      accessToken: string;
      refreshToken: string;
    };

    isNewUser?: boolean;
  };
}

// ============================================================
// GENERIC API RESPONSE
// ============================================================

export interface ApiError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: ApiError[];
}

// ============================================================
// SESSION / GOOGLE AUTH
// ============================================================

export interface Session {
  id: string;
  createdAt: string;
  expiresAt: string;
  isExpired: boolean;
}

export interface UserSession {
  sessions: Session[];
}

export interface GoogleAuthStatus {
  isLinked: boolean;
  provider: string;
  hasPassword: boolean;
  canUnlink: boolean;
}

// ============================================================
// PAGINATION
// ============================================================

export interface Pagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
}

// ============================================================
// ADMIN USER MANAGEMENT
// ============================================================

export interface PaginatedUsers {
  users: User[];
  pagination: Pagination;
}

export interface UserFilters {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  provider?: AuthProvider;
  verified?: boolean;
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface UpdateRolePayload {
  userId: string;
  role: UserRole;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  verifiedUsers: number;
  recentUsers: number;

  breakdown: Array<{
    role: UserRole;
    provider: AuthProvider;
    isEmailVerified: boolean;
    isActive: boolean;
    _count: number;
  }>;
}

export interface AdminState {
  users: User[];
  currentUser: User | null;
  stats: UserStats | null;

  pagination: Pagination;
  filters: UserFilters;

  isLoading: boolean;
  error: string | null;
}

// ============================================================
// WORKSPACE
// ============================================================

export interface Workspace {
  id: string;
  userId: string;

  name: string;
  description?: string | null;

  tint: string;
  icon: string;

  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
  tint?: string;
  icon?: string;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string;
  tint?: string;
  icon?: string;
}

export interface WorkspaceWithTasks extends Workspace {
  tasks: Task[];
}

// ============================================================
// TASK ENUMS
// ============================================================

export type TaskStatus =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'COMPLETED';

export type TaskPriority =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'URGENT';

// ============================================================
// TASK
// ============================================================

export interface Task {
  id: string;

  userId: string;
  workspaceId: string;

  title: string;
  description: string;

  status: TaskStatus;
  priority: TaskPriority;

  position: number;

  startDate?: string | null;
  deadlineDate?: string | null;

  plannedDurationSeconds: number;
  actualDurationSeconds: number;

  startedAt?: string | null;
  completedAt?: string | null;

  createdAt: string;
  updatedAt: string;
}

// ============================================================
// TASK WITH RELATIONS
// ============================================================

export interface TaskWithSessions extends Task {
  sessions: TaskSession[];
}

export interface TaskWithWorkspace extends Task {
  workspace: Workspace;
}

export interface TaskWithRelations extends Task {
  workspace: Workspace;
  sessions: TaskSession[];
}

// ============================================================
// TASK REQUESTS
// ============================================================

export interface CreateTaskRequest {
  workspaceId: string;

  title: string;
  description: string;

  status?: TaskStatus;
  priority?: TaskPriority;

  position?: number;

  startDate?: string | null;
  deadlineDate?: string | null;

  plannedDurationSeconds?: number;
}

export interface UpdateTaskRequest {
  workspaceId?: string;

  title?: string;
  description?: string;

  status?: TaskStatus;
  priority?: TaskPriority;

  position?: number;

  startDate?: string | null;
  deadlineDate?: string | null;

  plannedDurationSeconds?: number;
  actualDurationSeconds?: number;

  startedAt?: string | null;
  completedAt?: string | null;
}

export interface UpdateTaskStatusRequest {
  status: TaskStatus;
}

export interface UpdateTaskPriorityRequest {
  priority: TaskPriority;
}

export interface MoveTaskRequest {
  workspaceId?: string;
  position: number;
  status?: TaskStatus;
}

// ============================================================
// TASK SESSION
// ============================================================

export interface TaskSession {
  id: string;

  userId: string;
  taskId: string;

  startedAt: string;
  endedAt?: string | null;

  durationSeconds?: number | null;

  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskSessionRequest {
  taskId: string;
  startedAt?: string;
}

export interface CompleteTaskSessionRequest {
  endedAt?: string;
  durationSeconds?: number;
}

// ============================================================
// ACTIVITY ENUM
// ============================================================

export type ActivityType =
  | 'TASK_CREATED'
  | 'TASK_COMPLETED'
  | 'TASK_STARTED'
  | 'TASK_UPDATED'
  | 'TASK_DELETED'
  | 'SESSION_STARTED'
  | 'SESSION_COMPLETED'
  | 'STATUS_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'DEADLINE_CHANGED';

// ============================================================
// DAILY ACTIVITY
// ============================================================

export interface DailyActivity {
  id: string;

  dailyAnalyticsId: string;

  taskId?: string | null;

  type: ActivityType;

  metadata?: Record<string, unknown> | null;

  createdAt: string;
}

// ============================================================
// DAILY ANALYTICS
// ============================================================

export interface DailyAnalytics {
  id: string;

  userId: string;

  analyticsDate: string;

  createdTaskCount: number;
  completedTaskCount: number;

  totalSessions: number;
  totalFocusSeconds: number;

  createdAt: string;
  updatedAt: string;
}

export interface DailyAnalyticsWithActivities
  extends DailyAnalytics {
  activities: DailyActivity[];
}

export interface DailyAnalyticsResponse {
  analytics: DailyAnalytics;
  activities: DailyActivity[];
}

// ============================================================
// NOTES ENUMS
// ============================================================

export type ContentType = 'text' | 'code';

export type NoteTint =
  | 'blue'
  | 'violet'
  | 'pink'
  | 'amber'
  | 'emerald'
  | 'rose'
  | 'cyan'
  | 'lime';

export type NoteIcon =
  | 'folder'
  | 'doc'
  | 'image'
  | 'star'
  | 'work'
  | 'heart'
  | 'code'
  | 'music'
  | 'rocket'
  | 'camera';

// ============================================================
// NOTE
// ============================================================

export interface Note {
  id: string;

  userId: string;

  title: string;

  tint: NoteTint;
  icon: NoteIcon;

  createdAt: string;
  updatedAt: string;
}

// ============================================================
// TOPIC
// ============================================================

export interface Topic {
  id: string;

  noteId: string;

  title: string;
  position: number;

  createdAt: string;
  updatedAt: string;
}

export interface TopicWithSubtopics extends Topic {
  subtopics: Subtopic[];
}

// ============================================================
// SUBTOPIC
// ============================================================

export interface Subtopic {
  id: string;

  topicId: string;

  title: string;
  description?: string | null;

  position: number;

  createdAt: string;
  updatedAt: string;
}

export interface SubtopicWithContent extends Subtopic {
  content: Content[];
}

// ============================================================
// CONTENT
// ============================================================

export interface Content {
  id: string;

  subtopicId: string;

  title: string;

  type: ContentType;

  content: string;

  language?: string | null;

  position: number;

  createdAt: string;
  updatedAt: string;
}

// ============================================================
// NOTE RELATIONS
// ============================================================

export interface NoteWithTopics extends Note {
  topics: Topic[];
}

export interface NoteWithRelations extends Note {
  topics: Array<
    Topic & {
      subtopics: Array<
        Subtopic & {
          content: Content[];
        }
      >;
    }
  >;
}

// ============================================================
// NOTE REQUESTS
// ============================================================

export interface CreateNoteRequest {
  title: string;
  tint?: NoteTint;
  icon?: NoteIcon;
}

export interface UpdateNoteRequest {
  title?: string;
  tint?: NoteTint;
  icon?: NoteIcon;
}

export interface CreateTopicRequest {
  noteId: string;
  title: string;
  position?: number;
}

export interface UpdateTopicRequest {
  title?: string;
  position?: number;
}

export interface CreateSubtopicRequest {
  topicId: string;
  title: string;
  description?: string;
  position?: number;
}

export interface UpdateSubtopicRequest {
  title?: string;
  description?: string;
  position?: number;
}

export interface CreateContentRequest {
  subtopicId: string;

  title: string;
  type: ContentType;

  content: string;

  language?: string;
  position?: number;
}

export interface UpdateContentRequest {
  title?: string;
  type?: ContentType;
  content?: string;
  language?: string;
  position?: number;
}

// ============================================================
// NOTE / DOC STATE
// ============================================================

export interface NotesState {
  notes: Note[];
  currentNote: NoteWithRelations | null;

  isLoading: boolean;
  error: string | null;
}

// ============================================================
// TASK STATE
// ============================================================

export interface TasksState {
  tasks: Task[];

  activeTask: Task | null;
  activeSession: TaskSession | null;

  isLoading: boolean;
  error: string | null;
}

// ============================================================
// WORKSPACE STATE
// ============================================================

export interface WorkspaceState {
  workspaces: Workspace[];

  currentWorkspace: Workspace | null;

  isLoading: boolean;
  error: string | null;
}

// ============================================================
// ANALYTICS STATE
// ============================================================

export interface AnalyticsState {
  analytics: DailyAnalytics[];
  activities: DailyActivity[];

  isLoading: boolean;
  error: string | null;
}

// ============================================================
// COMMON LIST RESPONSES
// ============================================================

export interface WorkspacesResponse {
  workspaces: Workspace[];
}

export interface TasksResponse {
  tasks: Task[];
}

export interface NotesResponse {
  notes: Note[];
}

export interface TaskSessionsResponse {
  sessions: TaskSession[];
}

export interface ActivitiesResponse {
  activities: DailyActivity[];
}

export interface AnalyticsResponse {
  analytics: DailyAnalytics[];
}