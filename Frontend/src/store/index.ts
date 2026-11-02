import {
  configureStore,
  combineReducers,
} from "@reduxjs/toolkit";

import {
  persistStore,
  persistReducer,
} from "redux-persist";

import storage from "redux-persist/lib/storage";

import {
  useDispatch,
  useSelector,
} from "react-redux";

import authReducer from "./slices/authSlice";
import adminReducer from "./slices/adminSlice";
import taskReducer from "./slices/taskSlice";
import notesReducer from "./slices/notesSlice";
import analyticsReducer from "./slices/analyticsSlice";

// ---------------------------------------------------------------------------
// Persist configuration
// ---------------------------------------------------------------------------

const persistConfig = {
  key: "root",
  storage,
  // "tasks" is intentionally not persisted: a rehydrated status of
  // "succeeded"/"loading" blocked every refetch, leaving the board showing
  // stale (or no) data. The server is the source of truth for tasks + timer.
  whitelist: [
    "auth",
    "admin",
    "notes",
  ],
  // Drop any "tasks" blob saved by older builds before it is rehydrated.
  migrate: (state: unknown) => {
    if (state && typeof state === "object" && "tasks" in state) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tasks, ...rest } = state as Record<string, unknown>;
      return Promise.resolve(rest as never);
    }
    return Promise.resolve(state as never);
  },
};

// ---------------------------------------------------------------------------
// Root reducer
// ---------------------------------------------------------------------------

const rootReducer = combineReducers({
  auth: authReducer,
  admin: adminReducer,
  tasks: taskReducer,
  notes: notesReducer,
  analytics: analyticsReducer,
});

// ---------------------------------------------------------------------------
// Persisted reducer
// ---------------------------------------------------------------------------

const persistedReducer = persistReducer(
  persistConfig,
  rootReducer
);

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const store = configureStore({
  reducer: persistedReducer,

  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          "persist/PERSIST",
          "persist/REHYDRATE",
        ],
      },
    }),
});

// ---------------------------------------------------------------------------
// Persistor
// ---------------------------------------------------------------------------

export const persistor = persistStore(store);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RootState =
  ReturnType<typeof store.getState>;

export type AppDispatch =
  typeof store.dispatch;

// ---------------------------------------------------------------------------
// Typed Redux Hooks
// ---------------------------------------------------------------------------

export const useAppDispatch =
  useDispatch.withTypes<AppDispatch>();

export const useAppSelector =
  useSelector.withTypes<RootState>();
