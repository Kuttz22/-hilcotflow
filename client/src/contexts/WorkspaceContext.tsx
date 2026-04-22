import React, { createContext, useContext, useMemo, useState } from "react";

export type WorkspaceSummary = {
  id: number;
  name: string;
  type?: string | null;
  description?: string | null;
};

type WorkspaceContextValue = {
  workspaces: WorkspaceSummary[];
  activeWorkspace: WorkspaceSummary | null;
  setActiveWorkspace: (workspace: WorkspaceSummary | null) => void;
  refetch: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaces: [],
  activeWorkspace: null,
  setActiveWorkspace: () => {},
  refetch: async () => {},
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceSummary | null>(null);

  const value = useMemo(
    () => ({
      workspaces,
      activeWorkspace,
      setActiveWorkspace,
      refetch: async () => {
        return;
      },
    }),
    [workspaces, activeWorkspace]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
