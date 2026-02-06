import React, { useState } from 'react';
import { 
  Inbox, HelpCircle, Bot, Settings, Package, ChevronLeft, ChevronRight, 
  GraduationCap, Brain, Megaphone, BarChart3, ArrowLeft,
  MessageSquare, Instagram, Facebook, FolderPlus, Trash2, Folder
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MessagingTag } from '@/hooks/useMessagingTags';
import { MessagingFolder } from '@/hooks/useMessagingFolders';
import { FolderCreateDialog } from './FolderCreateDialog';

type FilterType = 'inbox' | 'needs-help' | 'ai-managed';
type ChannelType = 'all' | 'whatsapp' | 'instagram' | 'messenger';

interface MessagingSidebarProps {
  activeFilter: FilterType;
  activeChannel: ChannelType;
  activeTagId?: string | null;
  activeFolderId?: string | null;
  onFilterChange: (filter: FilterType) => void;
  onChannelChange: (channel: ChannelType) => void;
  onTagChange?: (tagId: string | null) => void;
  onFolderChange?: (folderId: string | null) => void;
  onNavigate: (section: 'config' | 'catalog' | 'train' | 'knowledge' | 'campaigns' | 'stats' | 'tags') => void;
  counts: {
    total: number;
    pending: number;
    resolved: number;
    whatsapp: number;
    instagram: number;
    messenger: number;
  };
  tags?: MessagingTag[];
  tagCounts?: Record<string, number>;
  folders?: MessagingFolder[];
  folderCounts?: Record<string, number>;
  onCreateFolder?: (data: { name: string; color: string }) => void;
  isCreatingFolder?: boolean;
  onDeleteFolder?: (folderId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const filterItems: Array<{
  id: FilterType;
  label: string;
  icon: React.ElementType;
  countKey: 'total' | 'pending' | 'resolved';
}> = [
  { id: 'inbox', label: 'Todos los chats', icon: Inbox, countKey: 'total' },
  { id: 'needs-help', label: 'Necesita ayuda', icon: HelpCircle, countKey: 'pending' },
  { id: 'ai-managed', label: 'IA gestionada', icon: Bot, countKey: 'resolved' },
];

const channelItems: Array<{
  id: ChannelType;
  label: string;
  icon: React.ElementType;
  countKey: 'whatsapp' | 'instagram' | 'messenger';
  color: string;
  activeColor: string;
}> = [
  { 
    id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, countKey: 'whatsapp',
    color: 'text-emerald-400', activeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
  },
  { 
    id: 'instagram', label: 'Instagram', icon: Instagram, countKey: 'instagram',
    color: 'text-pink-400', activeColor: 'bg-pink-500/20 text-pink-400 border-pink-500/30'
  },
  { 
    id: 'messenger', label: 'Messenger', icon: Facebook, countKey: 'messenger',
    color: 'text-blue-400', activeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  },
];

export const MessagingSidebar: React.FC<MessagingSidebarProps> = ({
  activeFilter,
  activeChannel,
  activeTagId,
  activeFolderId,
  onFilterChange,
  onChannelChange,
  onTagChange,
  onFolderChange,
  onNavigate,
  counts,
  tags = [],
  tagCounts = {},
  folders = [],
  folderCounts = {},
  onCreateFolder,
  isCreatingFolder,
  onDeleteFolder,
  collapsed,
  onToggleCollapse,
}) => {
  const [showCreateFolder, setShowCreateFolder] = useState(false);

  return (
    <div
      className={cn(
        "flex flex-col h-screen bg-slate-900 text-white transition-all duration-300 flex-shrink-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header with collapse button */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
        {!collapsed && (
          <span className="font-semibold text-sm text-slate-200">Centro de Mensajes</span>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors ml-auto"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-slate-400" />
          )}
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {/* Back to Sewdle button */}
        <div className="px-2 py-3 border-b border-slate-700">
          <a
            href="/dashboard"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Volver a Sewdle</span>}
          </a>
        </div>

        {/* Channels section */}
        <div className="py-4 px-2 border-b border-slate-700">
          {!collapsed && (
            <span className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Canales
            </span>
          )}
          <ul className="space-y-1 mt-2">
            {channelItems.map((item) => {
              const Icon = item.icon;
              const count = counts[item.countKey];
              const isActive = activeChannel === item.id;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => onChannelChange(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors border border-transparent",
                      isActive
                        ? item.activeColor
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    <Icon className={cn("h-5 w-5 flex-shrink-0", !isActive && item.color)} />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left text-sm font-medium truncate">
                          {item.label}
                        </span>
                        <span
                          className={cn(
                            "text-xs font-semibold px-2 py-0.5 rounded-full",
                            isActive ? "bg-white/20" : "bg-slate-700 text-slate-300"
                          )}
                        >
                          {count}
                        </span>
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Filter items */}
        <nav className="py-4">
          {!collapsed && (
            <span className="px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Bandeja
            </span>
          )}
          <ul className="space-y-1 px-2 mt-2">
            {filterItems.map((item) => {
              const Icon = item.icon;
              const count = counts[item.countKey];
              const isActive = activeFilter === item.id;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => onFilterChange(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                      isActive
                        ? "bg-indigo-600 text-white"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left text-sm font-medium truncate">
                          {item.label}
                        </span>
                        <span
                          className={cn(
                            "text-xs font-semibold px-2 py-0.5 rounded-full",
                            isActive ? "bg-indigo-500 text-white" : "bg-slate-700 text-slate-300"
                          )}
                        >
                          {count}
                        </span>
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          
          {/* Stats button */}
          <div className="mt-4 px-2">
            <button
              onClick={() => onNavigate('stats')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <BarChart3 className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm font-medium">Estadísticas</span>}
            </button>
          </div>
        </nav>

        {/* Folders section */}
        <div className="border-t border-slate-700 py-4 px-2">
          {!collapsed && (
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Carpetas
              </span>
              <button
                onClick={() => setShowCreateFolder(true)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {collapsed && (
            <button
              onClick={() => setShowCreateFolder(true)}
              className="w-full flex items-center justify-center px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors mb-1"
            >
              <FolderPlus className="h-5 w-5" />
            </button>
          )}
          <ul className="space-y-1">
            {activeFolderId && (
              <li>
                <button
                  onClick={() => onFolderChange?.(null)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <Inbox className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && <span className="text-sm font-medium">Todos los chats</span>}
                </button>
              </li>
            )}
            {folders.map((folder) => {
              const count = folderCounts[folder.id] || 0;
              const isActive = activeFolderId === folder.id;

              return (
                <li key={folder.id}>
                  <button
                    onClick={() => onFolderChange?.(isActive ? null : folder.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group/folder",
                      isActive
                        ? "bg-slate-700 text-white"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    <Folder className="h-4 w-4 flex-shrink-0" style={{ color: folder.color }} />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left text-sm font-medium truncate">
                          {folder.name}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                          {count}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteFolder?.(folder.id);
                          }}
                          className="opacity-0 group-hover/folder:opacity-100 text-slate-500 hover:text-red-400 transition-all"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Tags section */}
        {tags.length > 0 && (
          <div className="border-t border-slate-700 py-4 px-2">
            {!collapsed && (
              <div className="flex items-center justify-between px-3 mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Etiquetas
                </span>
                <button
                  onClick={() => onNavigate('tags')}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Gestionar
                </button>
              </div>
            )}
            <ul className="space-y-1">
              {tags.map((tag) => {
                const count = tagCounts[tag.id] || 0;
                const isActive = activeTagId === tag.id;

                return (
                  <li key={tag.id}>
                    <button
                      onClick={() => onTagChange?.(isActive ? null : tag.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                        isActive
                          ? "bg-slate-700 text-white"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      )}
                    >
                      <span 
                        className="w-3 h-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: tag.color }}
                      />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left text-sm font-medium truncate">
                            {tag.name}
                          </span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                            {count}
                          </span>
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* AI Training section */}
        <div className="border-t border-slate-700 py-4 px-2 space-y-1">
          {!collapsed && (
            <span className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Entrenamiento
            </span>
          )}
          <button
            onClick={() => onNavigate('train')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors mt-2"
          >
            <GraduationCap className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Entrenar IA</span>}
          </button>
          <button
            onClick={() => onNavigate('knowledge')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Brain className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Conocimiento</span>}
          </button>
          <button
            onClick={() => onNavigate('campaigns')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Megaphone className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Campañas</span>}
          </button>
        </div>

        {/* Footer with config and catalog */}
        <div className="border-t border-slate-700 py-4 px-2 space-y-1">
          <button
            onClick={() => onNavigate('config')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Settings className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Configuración</span>}
          </button>
          <button
            onClick={() => onNavigate('catalog')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Package className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Catálogo</span>}
          </button>
        </div>
      </div>

      {/* Folder Create Dialog */}
      <FolderCreateDialog
        open={showCreateFolder}
        onOpenChange={setShowCreateFolder}
        onCreate={(data) => onCreateFolder?.(data)}
        isLoading={isCreatingFolder}
      />
    </div>
  );
};
