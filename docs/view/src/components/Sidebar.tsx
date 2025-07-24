import { useEffect, useState } from 'react';

interface TreeNode {
  name: string;
  type: 'file' | 'folder';
  children: TreeNode[];
  doc?: any;
  path: string[];
  id: string;
}

interface FlatNode {
  name: string;
  type: 'file' | 'folder';
  doc?: any;
  path: string[];
  depth: number;
  id: string;
  hasChildren: boolean;
}

interface SidebarProps {
  tree: FlatNode[];
  locale: string;
  translations: Record<string, string>;
}

interface TreeItemProps {
  node: FlatNode;
  isVisible: boolean;
  isExpanded: boolean;
  onToggle: (folderId: string) => void;
  locale: string;
  translations: Record<string, string>;
}

function TreeItem({ node, isVisible, isExpanded, onToggle, locale, translations }: TreeItemProps) {
  if (!isVisible) return null;

  return (
    <li 
      className={`tree-item ${node.type === 'folder' ? 'folder' : 'file'}`}
      data-depth={node.depth}
      data-id={node.id}
    >
      <div className={`flex items-center py-1.5 px-2 rounded-md transition-colors ${
        node.depth > 0 ? 'ml-4' : ''
      } ${
        node.type === 'folder' 
          ? 'text-slate-700 font-medium' 
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
      }`}>
        {node.depth > 0 && (
          <div className="w-4 h-px bg-slate-300 mr-2 flex-shrink-0"></div>
        )}
        {node.type === 'folder' ? (
          <button 
            className="text-slate-500 mr-2 text-xs transition-transform duration-200 ease-in-out"
            onClick={() => onToggle(node.id)}
            aria-label={`Toggle ${node.name} folder`}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full mr-2 flex-shrink-0"></span>
        )}
        {node.type === 'folder' ? (
          <button 
            className="font-medium bg-none border-none p-0 cursor-pointer text-left w-full hover:text-slate-900"
            onClick={() => onToggle(node.id)}
          >
            {translations[`sidebar.section.${node.name}`] || node.name}
          </button>
        ) : (
          <a 
            href={`/${locale}/${node.path.join('/')}`}
            className="hover:underline"
          >
            {node.doc?.data?.title || node.name}
          </a>
        )}
      </div>
    </li>
  );
}

interface TreeListProps {
  tree: FlatNode[];
  treeState: Map<string, boolean>;
  onToggle: (folderId: string) => void;
  locale: string;
  translations: Record<string, string>;
}

function TreeList({ tree, treeState, onToggle, locale, translations }: TreeListProps) {
  const isNodeVisible = (node: FlatNode): boolean => {
    if (node.depth === 0) return true;
    
    // Find the parent folder
    const parentPath = node.path.slice(0, -1);
    const parentId = parentPath.join('/');
    
    return treeState.get(parentId) !== false;
  };

  return (
    <ul className="space-y-0.5">
      {tree.map((node) => {
        const isVisible = isNodeVisible(node);
        const isExpanded = treeState.get(node.id) !== false;
        
        return (
          <TreeItem
            key={node.id}
            node={node}
            isVisible={isVisible}
            isExpanded={isExpanded}
            onToggle={onToggle}
            locale={locale}
            translations={translations}
          />
        );
      })}
    </ul>
  );
}

export default function Sidebar({ tree, locale, translations }: SidebarProps) {
  const [treeState, setTreeState] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    // Load saved state from localStorage
    const savedState = JSON.parse(localStorage.getItem('sidebar-tree-state') || '{}');
    const initialState = new Map();
    
    // Initialize tree state - default to expanded
    tree.forEach(node => {
      if (node.type === 'folder') {
        initialState.set(node.id, savedState[node.id] !== false);
      }
    });
    
    setTreeState(initialState);
  }, [tree]);

  const updateFolderVisibility = (folderId: string, isExpanded: boolean) => {
    setTreeState(prev => {
      const newState = new Map(prev);
      newState.set(folderId, isExpanded);
      return newState;
    });

    // Save state to localStorage
    const stateToSave: Record<string, boolean> = {};
    treeState.forEach((value, key) => {
      stateToSave[key] = value;
    });
    stateToSave[folderId] = isExpanded;
    localStorage.setItem('sidebar-tree-state', JSON.stringify(stateToSave));
  };

  const handleFolderToggle = (folderId: string) => {
    const currentState = treeState.get(folderId) || false;
    updateFolderVisibility(folderId, !currentState);
  };

  return (
    <div className="flex flex-col h-full min-h-screen bg-slate-50 gap-4 p-4 border-r border-slate-200 w-64">
      <h1 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-3">
        Documentation
      </h1>
      <nav className="flex-1">
        <TreeList
          tree={tree}
          treeState={treeState}
          onToggle={handleFolderToggle}
          locale={locale}
          translations={translations}
        />
      </nav>
    </div>
  );
}
