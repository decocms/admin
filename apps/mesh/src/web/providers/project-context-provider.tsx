import { createContext, useContext } from "react";
import { ProjectLocator } from "../lib/locator";

interface ProjectContextType {
  locator: ProjectLocator;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const useProjectContext = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error(
      "useProjectContext must be used within a ProjectContextProvider",
    );
  }
  return context;
};

export const ProjectContextProvider = ({
  children,
  locator,
}: {
  children: React.ReactNode;
  locator: ProjectLocator;
}) => {
  return (
    <ProjectContext.Provider value={{ locator }}>
      {children}
    </ProjectContext.Provider>
  );
};
