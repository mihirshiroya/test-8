import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import api from "../../api/config" // your axios instance (baseURL + auth header)
import type { Doc, Content } from "../../lib/docs-data"
import type { Folder, TintKey, IconKey } from "../../components/Ui/folder-data"

// ---------------------------------------------------------------------------
// Notes slice – all data now lives in the backend (Postgres via Prisma).
// The store is only a cache of what the API returned.
//
// The thunk names match the old action names (addFolder, addTopic, ...), so
// existing `dispatch(addFolder(...))` calls keep working – they are just async.
// ---------------------------------------------------------------------------

type Topic = Doc["topics"][number]
type Subtopic = Topic["subtopics"][number]
type Status = "idle" | "loading" | "succeeded" | "failed"

// Same shape as Folder (id, name, tint, icon, items, updatedAt) + optional description.
// `items` is computed by the backend (total subtopics), `updatedAt` is a ms timestamp.
export type StoredFolder = Folder & { description?: string }

export interface NotesState {
  folders: StoredFolder[]
  docs: Record<string, Doc>
  status: Status // folder list
  docStatus: Record<string, Status> // per-folder doc
  error: string | null
}

const initialState: NotesState = {
  folders: [],
  docs: {},
  status: "idle",
  docStatus: {},
  error: null,
}

// ---------------------------------------------------------------------------
// Thunk factory (wraps try/catch + error message extraction)
// ---------------------------------------------------------------------------

const errMsg = (e: any): string =>
  e?.response?.data?.message ?? e?.message ?? "Something went wrong"

const thunk = <Ret, Arg = void>(type: string, fn: (arg: Arg) => Promise<Ret>) =>
  createAsyncThunk<Ret, Arg, { rejectValue: string }>(type, async (arg, { rejectWithValue }) => {
    try {
      return await fn(arg)
    } catch (e) {
      return rejectWithValue(errMsg(e))
    }
  })

// ---------------------------------------------------------------------------
// Thunks – folders
// ---------------------------------------------------------------------------

export const fetchFolders = thunk<StoredFolder[]>("notes/fetchFolders", async () => {
  const { data } = await api.get("/notes")
  return data.data.folders
})

export const fetchDoc = thunk<{ folderId: string; doc: Doc; folder: StoredFolder }, string>(
  "notes/fetchDoc",
  async (folderId) => {
    const { data } = await api.get(`/notes/${folderId}`)
    return { folderId, doc: data.data.doc, folder: data.data.folder }
  }
)

export const addFolder = thunk<
  { folder: StoredFolder; doc: Doc },
  { title: string; tint: TintKey; icon: IconKey }
>("notes/addFolder", async (body) => {
  const { data } = await api.post("/notes", body)
  return data.data
})

export const updateFolder = thunk<
  StoredFolder,
  { id: string; title: string; tint: TintKey; icon: IconKey; description?: string }
>("notes/updateFolder", async ({ id, ...body }) => {
  const { data } = await api.patch(`/notes/${id}`, body)
  return data.data.folder
})

export const deleteFolder = thunk<string, string>("notes/deleteFolder", async (id) => {
  await api.delete(`/notes/${id}`)
  return id
})

// Replace the whole doc for a folder
export const setDoc = thunk<
  { folderId: string; doc: Doc; folder: StoredFolder },
  { folderId: string; doc: Doc }
>("notes/setDoc", async ({ folderId, doc }) => {
  const { data } = await api.put(`/notes/${folderId}/doc`, { doc })
  return { folderId, doc: data.data.doc, folder: data.data.folder }
})

// ---------------------------------------------------------------------------
// Thunks – topics
// ---------------------------------------------------------------------------

export const addTopic = thunk<
  { folderId: string; topic: Topic; folder: StoredFolder },
  { folderId: string; title: string }
>("notes/addTopic", async ({ folderId, title }) => {
  const { data } = await api.post(`/notes/${folderId}/topics`, { title })
  return { folderId, topic: data.data.topic, folder: data.data.folder }
})

export const updateTopic = thunk<
  { folderId: string; topic: Pick<Topic, "id" | "title">; folder: StoredFolder },
  { folderId: string; topicId: string; title: string }
>("notes/updateTopic", async ({ folderId, topicId, title }) => {
  const { data } = await api.patch(`/notes/topics/${topicId}`, { title })
  return { folderId, topic: data.data.topic, folder: data.data.folder }
})

export const deleteTopic = thunk<
  { folderId: string; topicId: string; folder: StoredFolder },
  { folderId: string; topicId: string }
>("notes/deleteTopic", async ({ folderId, topicId }) => {
  const { data } = await api.delete(`/notes/topics/${topicId}`)
  return { folderId, topicId, folder: data.data.folder }
})

// ---------------------------------------------------------------------------
// Thunks – subtopics
// ---------------------------------------------------------------------------

export const addSubtopic = thunk<
  { folderId: string; topicId: string; subtopic: Subtopic; folder: StoredFolder },
  { folderId: string; topicId: string; title: string; description?: string }
>("notes/addSubtopic", async ({ folderId, topicId, title, description }) => {
  const { data } = await api.post(`/notes/topics/${topicId}/subtopics`, { title, description })
  return { folderId, topicId, subtopic: data.data.subtopic, folder: data.data.folder }
})

export const updateSubtopic = thunk<
  {
    folderId: string
    topicId: string
    subtopic: Pick<Subtopic, "id" | "title" | "description">
    folder: StoredFolder
  },
  { folderId: string; topicId: string; subtopicId: string; title?: string; description?: string }
>("notes/updateSubtopic", async ({ folderId, topicId, subtopicId, ...body }) => {
  const { data } = await api.patch(`/notes/subtopics/${subtopicId}`, body)
  return { folderId, topicId, subtopic: data.data.subtopic, folder: data.data.folder }
})

export const deleteSubtopic = thunk<
  { folderId: string; topicId: string; subtopicId: string; folder: StoredFolder },
  { folderId: string; topicId: string; subtopicId: string }
>("notes/deleteSubtopic", async ({ folderId, topicId, subtopicId }) => {
  const { data } = await api.delete(`/notes/subtopics/${subtopicId}`)
  return { folderId, topicId, subtopicId, folder: data.data.folder }
})

// ---------------------------------------------------------------------------
// Thunks – content blocks
// ---------------------------------------------------------------------------

export const addContent = thunk<
  { folderId: string; topicId: string; subtopicId: string; content: Content; folder: StoredFolder },
  { folderId: string; topicId: string; subtopicId: string; content: Omit<Content, "id"> }
>("notes/addContent", async ({ folderId, topicId, subtopicId, content }) => {
  const { data } = await api.post(`/notes/subtopics/${subtopicId}/content`, content)
  return { folderId, topicId, subtopicId, content: data.data.content, folder: data.data.folder }
})

export const updateContent = thunk<
  { folderId: string; topicId: string; subtopicId: string; content: Content; folder: StoredFolder },
  {
    folderId: string
    topicId: string
    subtopicId: string
    contentId: string
    changes: Partial<Omit<Content, "id">>
  }
>("notes/updateContent", async ({ folderId, topicId, subtopicId, contentId, changes }) => {
  const { data } = await api.patch(`/notes/content/${contentId}`, changes)
  return { folderId, topicId, subtopicId, content: data.data.content, folder: data.data.folder }
})

export const deleteContent = thunk<
  { folderId: string; topicId: string; subtopicId: string; contentId: string; folder: StoredFolder },
  { folderId: string; topicId: string; subtopicId: string; contentId: string }
>("notes/deleteContent", async ({ folderId, topicId, subtopicId, contentId }) => {
  const { data } = await api.delete(`/notes/content/${contentId}`)
  return { folderId, topicId, subtopicId, contentId, folder: data.data.folder }
})

// ---------------------------------------------------------------------------
// Reducer helpers
// ---------------------------------------------------------------------------

function upsertFolder(state: NotesState, folder: StoredFolder) {
  const i = state.folders.findIndex((f) => f.id === folder.id)
  if (i === -1) state.folders.unshift(folder)
  else state.folders[i] = folder
}

const findTopic = (state: NotesState, folderId: string, topicId: string) =>
  state.docs[folderId]?.topics.find((t) => t.id === topicId)

const findSubtopic = (state: NotesState, folderId: string, topicId: string, subtopicId: string) =>
  findTopic(state, folderId, topicId)?.subtopics.find((s) => s.id === subtopicId)

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

export const notesSlice = createSlice({
  name: "notes",
  initialState,
  reducers: {
    // call on logout so the next user doesn't see cached notes
    resetNotes: () => initialState,
    clearNotesError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // ---- folder list ----
      .addCase(fetchFolders.pending, (state) => {
        state.status = "loading"
        state.error = null
      })
      .addCase(fetchFolders.fulfilled, (state, action) => {
        state.folders = action.payload
        state.status = "succeeded"
      })
      .addCase(fetchFolders.rejected, (state) => {
        state.status = "failed"
      })

      // ---- single doc ----
      .addCase(fetchDoc.pending, (state, action) => {
        state.docStatus[action.meta.arg] = "loading"
      })
      .addCase(fetchDoc.fulfilled, (state, action) => {
        const { folderId, doc, folder } = action.payload
        state.docs[folderId] = doc
        state.docStatus[folderId] = "succeeded"
        upsertFolder(state, folder)
      })
      .addCase(fetchDoc.rejected, (state, action) => {
        state.docStatus[action.meta.arg] = "failed"
      })

      // ---- folder CRUD ----
      .addCase(addFolder.fulfilled, (state, action) => {
        const { folder, doc } = action.payload
        upsertFolder(state, folder)
        state.docs[folder.id] = doc
        state.docStatus[folder.id] = "succeeded"
      })
      .addCase(updateFolder.fulfilled, (state, action) => {
        upsertFolder(state, action.payload)
      })
      .addCase(deleteFolder.fulfilled, (state, action) => {
        state.folders = state.folders.filter((f) => f.id !== action.payload)
        delete state.docs[action.payload]
        delete state.docStatus[action.payload]
      })
      .addCase(setDoc.fulfilled, (state, action) => {
        const { folderId, doc, folder } = action.payload
        state.docs[folderId] = doc
        upsertFolder(state, folder)
      })

      // ---- topics ----
      .addCase(addTopic.fulfilled, (state, action) => {
        const { folderId, topic, folder } = action.payload
        state.docs[folderId]?.topics.push(topic)
        upsertFolder(state, folder)
      })
      .addCase(updateTopic.fulfilled, (state, action) => {
        const { folderId, topic, folder } = action.payload
        const target = findTopic(state, folderId, topic.id)
        if (target) target.title = topic.title
        upsertFolder(state, folder)
      })
      .addCase(deleteTopic.fulfilled, (state, action) => {
        const { folderId, topicId, folder } = action.payload
        const doc = state.docs[folderId]
        if (doc) doc.topics = doc.topics.filter((t) => t.id !== topicId)
        upsertFolder(state, folder)
      })

      // ---- subtopics ----
      .addCase(addSubtopic.fulfilled, (state, action) => {
        const { folderId, topicId, subtopic, folder } = action.payload
        findTopic(state, folderId, topicId)?.subtopics.push(subtopic)
        upsertFolder(state, folder)
      })
      .addCase(updateSubtopic.fulfilled, (state, action) => {
        const { folderId, topicId, subtopic, folder } = action.payload
        const target = findSubtopic(state, folderId, topicId, subtopic.id)
        if (target) {
          target.title = subtopic.title
          target.description = subtopic.description
        }
        upsertFolder(state, folder)
      })
      .addCase(deleteSubtopic.fulfilled, (state, action) => {
        const { folderId, topicId, subtopicId, folder } = action.payload
        const topic = findTopic(state, folderId, topicId)
        if (topic) topic.subtopics = topic.subtopics.filter((s) => s.id !== subtopicId)
        upsertFolder(state, folder)
      })

      // ---- content ----
      .addCase(addContent.fulfilled, (state, action) => {
        const { folderId, topicId, subtopicId, content, folder } = action.payload
        findSubtopic(state, folderId, topicId, subtopicId)?.content.push(content)
        upsertFolder(state, folder)
      })
      .addCase(updateContent.fulfilled, (state, action) => {
        const { folderId, topicId, subtopicId, content, folder } = action.payload
        const subtopic = findSubtopic(state, folderId, topicId, subtopicId)
        const i = subtopic?.content.findIndex((c) => c.id === content.id) ?? -1
        if (subtopic && i !== -1) subtopic.content[i] = content
        upsertFolder(state, folder)
      })
      .addCase(deleteContent.fulfilled, (state, action) => {
        const { folderId, topicId, subtopicId, contentId, folder } = action.payload
        const subtopic = findSubtopic(state, folderId, topicId, subtopicId)
        if (subtopic) subtopic.content = subtopic.content.filter((c) => c.id !== contentId)
        upsertFolder(state, folder)
      })

      // ---- any rejected notes/* thunk -> store the error message ----
      .addMatcher(
        (action: { type: string }) =>
          action.type.startsWith("notes/") && action.type.endsWith("/rejected"),
        (state, action: any) => {
          state.error = action.payload ?? action.error?.message ?? "Something went wrong"
        }
      )
  },
})

export const { resetNotes, clearNotesError } = notesSlice.actions

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectFolders = (state: any): StoredFolder[] => state.notes.folders
export const selectDoc = (folderId: string) => (state: any): Doc | undefined =>
  state.notes.docs[folderId]
export const selectNotesStatus = (state: any): Status => state.notes.status
export const selectDocStatus = (folderId: string) => (state: any): Status =>
  state.notes.docStatus[folderId] ?? "idle"
export const selectNotesError = (state: any): string | null => state.notes.error

export default notesSlice.reducer