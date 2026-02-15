import { useState, useRef, useEffect } from 'react';
import { Bell, X, AlertTriangle, CheckCircle, FileText, Upload, Clock, Play } from 'lucide-react';
import { Button } from '../ui';
import { useAppStore } from '../../store';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { NotificationType } from '../../types';

const DEMO_NOTIFICATIONS = [
  {
    type: 'anomaly_critical' as NotificationType,
    title: 'Anomalie critique détectée',
    message: '3 alertes anti-blanchiment nécessitent votre attention immédiate',
  },
  {
    type: 'analysis_complete' as NotificationType,
    title: 'Analyse terminée',
    message: "L'analyse du client ABC Corp a identifié 12 anomalies potentielles",
  },
  {
    type: 'import_complete' as NotificationType,
    title: 'Import réussi',
    message: '245 transactions importées depuis le fichier bancaire',
  },
  {
    type: 'invoice_overdue' as NotificationType,
    title: 'Facture en retard',
    message: 'La facture #2024-0042 est en retard de 15 jours',
  },
  {
    type: 'anomaly_detected' as NotificationType,
    title: 'Anomalie détectée',
    message: 'Transaction inhabituelle de 15 000€ sur le compte client XYZ',
  },
];

export function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Utiliser le store pour les notifications
  const notifications = useAppStore((state) => state.notifications);
  const addNotification = useAppStore((state) => state.addNotification);
  const markAsRead = useAppStore((state) => state.markAsRead);
  const markAllAsRead = useAppStore((state) => state.markAllAsRead);
  const deleteNotification = useAppStore((state) => state.deleteNotification);
  const clearNotifications = useAppStore((state) => state.clearNotifications);
  const getUnreadCount = useAppStore((state) => state.getUnreadCount);

  const unreadCount = getUnreadCount();

  const loadDemoNotifications = () => {
    DEMO_NOTIFICATIONS.forEach((notif) => {
      addNotification(notif);
    });
  };

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

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'anomaly_critical':
        return <AlertTriangle className="w-4 h-4 text-primary-500" />;
      case 'anomaly_detected':
        return <AlertTriangle className="w-4 h-4 text-primary-500" />;
      case 'analysis_complete':
        return <CheckCircle className="w-4 h-4 text-primary-500" />;
      case 'import_complete':
        return <Upload className="w-4 h-4 text-primary-500" />;
      case 'invoice_due':
        return <Clock className="w-4 h-4 text-primary-500" />;
      case 'invoice_overdue':
        return <AlertTriangle className="w-4 h-4 text-primary-500" />;
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
                  onClick={clearNotifications}
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
                <p className="text-primary-500 mb-4">Aucune notification</p>
                <button
                  onClick={loadDemoNotifications}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-primary-600 hover:text-primary-800 bg-primary-100 hover:bg-primary-200 rounded-lg transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Voir une démo
                </button>
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
