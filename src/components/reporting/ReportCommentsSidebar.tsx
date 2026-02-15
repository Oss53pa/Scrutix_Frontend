import { useState } from 'react';
import {
  MessageSquare,
  Send,
  Check,
  Trash2,
  Reply,
  MoreVertical,
  User,
  Clock,
  Filter,
} from 'lucide-react';
import { Button } from '../ui';
import type { ReportComment } from '../../types';

interface ReportCommentsSidebarProps {
  comments: ReportComment[];
  currentPage: number;
  onAddComment: (comment: Omit<ReportComment, 'id' | 'createdAt'>) => void;
  onResolveComment: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
  readOnly?: boolean;
}

export function ReportCommentsSidebar({
  comments,
  currentPage,
  onAddComment,
  onResolveComment,
  onDeleteComment,
  readOnly = false,
}: ReportCommentsSidebarProps) {
  const [newComment, setNewComment] = useState('');
  const [filter, setFilter] = useState<'all' | 'page' | 'unresolved'>('all');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  // Filter comments
  const filteredComments = comments.filter((comment) => {
    if (filter === 'page') return comment.pageNumber === currentPage;
    if (filter === 'unresolved') return !comment.resolved;
    return true;
  });

  // Sort by date (newest first)
  const sortedComments = [...filteredComments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Handle submit
  const handleSubmit = () => {
    if (!newComment.trim()) return;

    onAddComment({
      sectionId: 'general',
      pageNumber: currentPage,
      author: 'Utilisateur',
      content: newComment.trim(),
      resolved: false,
    });

    setNewComment('');
  };

  // Format date
  const formatDate = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "À l'instant";
    if (minutes < 60) return `Il y a ${minutes} min`;
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    return d.toLocaleDateString('fr-FR');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with filters */}
      <div className="flex-shrink-0 p-4 border-b border-primary-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-primary-900 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Commentaires
            <span className="text-xs bg-primary-100 text-primary-600 px-2 py-0.5 rounded-full">
              {comments.length}
            </span>
          </h3>
          <Filter className="w-4 h-4 text-primary-400" />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              filter === 'all'
                ? 'bg-primary-900 text-white'
                : 'bg-primary-100 text-primary-600 hover:bg-primary-200'
            }`}
          >
            Tous ({comments.length})
          </button>
          <button
            onClick={() => setFilter('page')}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              filter === 'page'
                ? 'bg-primary-900 text-white'
                : 'bg-primary-100 text-primary-600 hover:bg-primary-200'
            }`}
          >
            Cette page ({comments.filter((c) => c.pageNumber === currentPage).length})
          </button>
          <button
            onClick={() => setFilter('unresolved')}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              filter === 'unresolved'
                ? 'bg-primary-900 text-white'
                : 'bg-primary-100 text-primary-600 hover:bg-primary-200'
            }`}
          >
            Non résolus ({comments.filter((c) => !c.resolved).length})
          </button>
        </div>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto">
        {sortedComments.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-12 h-12 text-primary-200 mx-auto mb-3" />
            <p className="text-primary-500 text-sm">Aucun commentaire</p>
            <p className="text-primary-400 text-xs mt-1">
              {filter === 'page'
                ? 'Aucun commentaire sur cette page'
                : filter === 'unresolved'
                ? 'Tous les commentaires sont résolus'
                : 'Ajoutez un commentaire ci-dessous'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-primary-100">
            {sortedComments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onResolve={() => onResolveComment(comment.id)}
                onDelete={() => onDeleteComment(comment.id)}
                onReply={() => setReplyingTo(comment.id)}
                formatDate={formatDate}
                readOnly={readOnly}
                isReplying={replyingTo === comment.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* New comment input */}
      {!readOnly && (
        <div className="flex-shrink-0 p-4 border-t border-primary-200 bg-primary-50">
          <div className="flex gap-2">
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={`Ajouter un commentaire (page ${currentPage + 1})...`}
                className="w-full px-3 py-2 text-sm border border-primary-200 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={!newComment.trim()}
              className="self-end"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-primary-400 mt-1">
            Entrée pour envoyer, Shift+Entrée pour nouvelle ligne
          </p>
        </div>
      )}
    </div>
  );
}

// Comment item component
function CommentItem({
  comment,
  onResolve,
  onDelete,
  onReply,
  formatDate,
  readOnly,
  isReplying: _isReplying,
}: {
  comment: ReportComment;
  onResolve: () => void;
  onDelete: () => void;
  onReply: () => void;
  formatDate: (date: Date) => string;
  readOnly: boolean;
  isReplying: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className={`p-4 ${comment.resolved ? 'bg-green-50/50' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {comment.authorAvatar ? (
            <img
              src={comment.authorAvatar}
              alt={comment.author}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary-200 flex items-center justify-center">
              <User className="w-4 h-4 text-primary-500" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-primary-900 text-sm truncate">
                {comment.author}
              </span>
              <span className="text-xs text-primary-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(comment.createdAt)}
              </span>
            </div>

            {/* Actions menu */}
            {!readOnly && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1 hover:bg-primary-100 rounded"
                >
                  <MoreVertical className="w-4 h-4 text-primary-400" />
                </button>

                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-primary-200 rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
                    {!comment.resolved && (
                      <button
                        onClick={() => {
                          onResolve();
                          setShowMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-primary-700 hover:bg-primary-50 flex items-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        Résoudre
                      </button>
                    )}
                    <button
                      onClick={() => {
                        onReply();
                        setShowMenu(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-primary-700 hover:bg-primary-50 flex items-center gap-2"
                    >
                      <Reply className="w-4 h-4" />
                      Répondre
                    </button>
                    <button
                      onClick={() => {
                        onDelete();
                        setShowMenu(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Page reference */}
          <span className="inline-flex items-center text-xs text-primary-400 mt-1 mb-2">
            Page {comment.pageNumber + 1}
            {comment.resolved && (
              <span className="ml-2 text-green-600 flex items-center gap-1">
                <Check className="w-3 h-3" />
                Résolu
              </span>
            )}
          </span>

          {/* Comment text */}
          <p className="text-sm text-primary-700 whitespace-pre-wrap">
            {comment.content}
          </p>

          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-3 pl-4 border-l-2 border-primary-200 space-y-2">
              {comment.replies.map((reply) => (
                <div key={reply.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-primary-900">
                      {reply.author}
                    </span>
                    <span className="text-xs text-primary-400">
                      {formatDate(reply.createdAt)}
                    </span>
                  </div>
                  <p className="text-primary-700 mt-0.5">{reply.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
