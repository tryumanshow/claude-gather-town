import React, { useMemo } from 'react';
import type { FileEntry } from '@theater/shared';

// Collapsible tree node
export interface TreeNode extends FileEntry {
  children?: TreeNode[];
  loaded?: boolean;
  expanded?: boolean;
}

export const FILE_ICONS: Record<string, string> = {
  typescript: '🟦', javascript: '🟨', python: '🐍', json: '📋',
  markdown: '📝', css: '🎨', html: '🌐', shell: '🖥️',
  rust: '🦀', go: '🔵', yaml: '⚙️', default: '📄',
  directory: '📁', directoryOpen: '📂',
};

export function getFileIcon(entry: FileEntry | TreeNode, expanded?: boolean): string {
  if (entry.type === 'directory') return expanded ? FILE_ICONS.directoryOpen : FILE_ICONS.directory;
  const ext = entry.name.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', json: 'json', md: 'markdown', css: 'css', scss: 'css',
    html: 'html', sh: 'shell', rs: 'rust', go: 'go', yaml: 'yaml', yml: 'yaml',
  };
  return FILE_ICONS[langMap[ext] || 'default'] || FILE_ICONS.default;
}

export function formatSize(bytes?: number): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

// Static styles extracted to module level to avoid creating new objects per tree node render
export const treeNodeBaseStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '2px 8px',
  fontSize: '12px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  lineHeight: '22px',
};
export const treeNodeIconStyle: React.CSSProperties = { fontSize: '8px', color: '#999', width: '10px', textAlign: 'center', flexShrink: 0 };
export const treeNodeSpacerStyle: React.CSSProperties = { width: '10px', flexShrink: 0 };
export const treeNodeShrinkStyle: React.CSSProperties = { flexShrink: 0 };
export const treeNodeEllipsisStyle: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis' };
export const treeNodeSizeStyle: React.CSSProperties = { marginLeft: 'auto', color: '#555', fontSize: '10px', flexShrink: 0 };

// Memoized to skip re-renders when props unchanged — important for deep trees with 100s of nodes
export const TreeNodeView = React.memo(function TreeNodeView({
  node,
  depth,
  onClick,
  activeFile,
}: {
  node: TreeNode;
  depth: number;
  onClick: (node: TreeNode) => void;
  activeFile: string | null;
}) {
  const isActive = node.type === 'file' && node.path === activeFile;
  const nodeStyle = useMemo<React.CSSProperties>(() => ({
    ...treeNodeBaseStyle,
    paddingLeft: `${12 + depth * 16}px`,
    color: isActive ? '#fff' : '#cccccc',
    background: isActive ? '#094771' : 'transparent',
  }), [depth, isActive]);

  return (
    <>
      <div
        onClick={() => onClick(node)}
        style={nodeStyle}
        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#2a2d2e'; }}
        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        {node.type === 'directory' && (
          <span style={treeNodeIconStyle}>
            {node.expanded ? '▼' : '▶'}
          </span>
        )}
        {node.type === 'file' && <span style={treeNodeSpacerStyle} />}
        <span style={treeNodeShrinkStyle}>{getFileIcon(node, node.expanded)}</span>
        <span style={treeNodeEllipsisStyle}>{node.name}</span>
        {node.type === 'file' && node.size != null && (
          <span style={treeNodeSizeStyle}>
            {formatSize(node.size)}
          </span>
        )}
      </div>
      {node.expanded && node.children && node.children.map(child => (
        <TreeNodeView
          key={child.path}
          node={child}
          depth={depth + 1}
          onClick={onClick}
          activeFile={activeFile}
        />
      ))}
    </>
  );
});

// Helper: recursively update a node in the tree by path
export function updateTreeNode(nodes: TreeNode[], targetPath: string, updater: (node: TreeNode) => TreeNode): TreeNode[] {
  return nodes.map(node => {
    if (node.path === targetPath) return updater(node);
    if (node.children && targetPath.startsWith(node.path + '/')) {
      return { ...node, children: updateTreeNode(node.children, targetPath, updater) };
    }
    return node;
  });
}
