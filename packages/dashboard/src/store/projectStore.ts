import { create } from 'zustand';
import { api } from '../services/api';

interface Project {
  id: string;
  name: string;
  orgId: string;
}

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  loading: boolean;
  fetchProjects: () => Promise<void>;
  setActiveProject: (id: string) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  loading: false,
  fetchProjects: async () => {
    set({ loading: true });
    try {
      const orgRes = await api.get('/orgs');
      const org = orgRes.data.data[0];
      if (!org) {
        set({ loading: false });
        return;
      }
      const projRes = await api.get(`/orgs/${org.id}/projects`);
      const projects = projRes.data.data;
      set({ projects });
      
      const currentActive = get().activeProjectId;
      if (!currentActive && projects.length > 0) {
        set({ activeProjectId: projects[0].id });
      }
    } catch (err) {
      console.error('Failed to fetch projects', err);
    } finally {
      set({ loading: false });
    }
  },
  setActiveProject: (id: string) => {
    set({ activeProjectId: id });
  }
}));
