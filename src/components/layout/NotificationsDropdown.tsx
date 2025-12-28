import { useState, useRef, useEffect } from 'react';
import { Bell, X, AlertTriangle, CheckCircle, FileText, Upload, Trash2 } from 'lucide-react';
import { Button } from '../ui';
import { useAppStore } from '../../store';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Notification {
  id: string;
  type: 'anomaly_critical' | 'anomaly_detected' | 'import_complete' | 'analysis_complete' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

export function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Utiliser le store pour les notifications (simulation si pas de store)
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'anomaly_critical',
      title: 'Anomalie critique detectee',
      message: '3 alertes anti-blanchiment necessitent votre attention',
      isRead: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
    },
    {
      id: '2',
      type: 'analysis_complete',
      title: 'Analyse terminee',
      message: 'L\'analyse du client ABC a identifie 12 anomalies',
      isRead: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2h ago
    },
    {
      id: '3',
      type: 'import_complete',
      title: 'Import reussi',
      message: '245 transactions importees depuis le fichier bancaire',
      isRead: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    },
  ]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'anomaly_critical':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'anomaly_detected':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'analysis_complete':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'import_complete':
        return <Upload className="w-4 h-4 text-blue-500" />;
      default:
        return <FileText className="w-4 h-4 text-primary-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton Notifications */}
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-primary-200 overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-primary-100 flex items-center justify-between bg-primary-50">
            <h3 className="font-semibold text-primary-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-primary-600 hover:text-primary-800"
                >
                  Tout marquer comme lu
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Effacer tout
                </button>
              )}
            </div>
          </div>

          {/* Liste des notifications */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-12 h-12 text-primary-200 mx-auto mb-3" />
                <p className="text-primary-500">Aucune notification</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-4 py-3 border-b border-primary-50 hover:bg-primary-50 transition-colors ${
                    !notification.isRead ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-medium ${
                          !notification.isRead ? 'text-primary-900' : 'text-primary-600'
                        }`}>
                          {notification.title}
                        </p>
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="text-primary-400 hover:text-red-500 ml-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-primary-500 mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-primary-400">
                          {formatDistanceToNow(notification.createdAt, { addSuffix: true, locale: fr })}
                        </span>
                        {!notification.isRead && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Marquer comme lu
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-primary-100 bg-primary-50">
              <button className="text-sm text-primary-600 hover:text-primary-800 w-full text-center">
                Voir toutes les notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
