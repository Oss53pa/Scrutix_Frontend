import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, MessageSquare, Sparkles, AlertCircle, Trash2 } from 'lucide-react';
import { Button, Alert } from '../ui';
import { useClaude } from '../../hooks';
import type { Transaction, Anomaly, BankConditions } from '../../types';
import type { ChatMessage } from '../../services/ClaudeService';

interface ClaudeChatProps {
  isOpen: boolean;
  onClose: () => void;
  context?: {
    transactions?: Transaction[];
    anomalies?: Anomaly[];
    clientName?: string;
    bankConditions?: BankConditions;
  };
}

const SUGGESTED_PROMPTS = [
  "Resume les anomalies critiques detectees",
  "Quels sont les frais bancaires les plus eleves?",
  "Explique les surfacturations identifiees",
  "Y a-t-il des patterns suspects dans les transactions?",
  "Quelles economies pourraient etre realisees?",
];

export function ClaudeChat({ isOpen, onClose, context }: ClaudeChatProps) {
  const { isEnabled, isConfigured, chat, isLoading, error: claudeError, config } = useClaude();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus sur l'input quand le modal s'ouvre
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setError(null);

    try {
      const result = await chat(input.trim(), context, messages);

      if (result) {
        const assistantMessage: ChatMessage = {
          id: `msg-${Date.now()}-response`,
          role: 'assistant',
          content: result.response,
          timestamp: new Date(),
          tokensUsed: result.tokensUsed,
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        setError('Impossible d\'obtenir une reponse de Claude');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la communication avec Claude');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const handleClearHistory = () => {
    setMessages([]);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-primary-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="font-semibold text-primary-900">Assistant Claude IA</h2>
              <p className="text-xs text-primary-500">
                {context?.clientName ? `Client: ${context.clientName}` : 'Analyse bancaire intelligente'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearHistory} title="Effacer l'historique">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        {!isConfigured ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <Alert variant="warning" title="Claude AI non configure">
              <p>Configurez votre cle API Claude dans les Parametres pour utiliser l'assistant.</p>
            </Alert>
          </div>
        ) : !isEnabled || !config.enableChat ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <Alert variant="info" title="Chat IA desactive">
              <p>Activez Claude AI et la fonctionnalite Chat dans les Parametres.</p>
            </Alert>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-12 h-12 text-primary-200 mx-auto mb-4" />
                  <p className="text-primary-500 mb-2">Commencez une conversation</p>
                  <p className="text-sm text-primary-400">
                    Posez des questions sur vos transactions, anomalies ou demandez des analyses.
                  </p>

                  {/* Context info */}
                  {context && (
                    <div className="mt-4 p-3 bg-primary-50 rounded-lg text-left text-xs">
                      <p className="font-medium text-primary-700 mb-1">Contexte charge:</p>
                      <ul className="text-primary-500 space-y-1">
                        {context.transactions && (
                          <li>{context.transactions.length} transactions</li>
                        )}
                        {context.anomalies && (
                          <li>{context.anomalies.length} anomalies detectees</li>
                        )}
                        {context.bankConditions && (
                          <li>Conditions: {context.bankConditions.bankName}</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Suggestions */}
                  <div className="mt-6">
                    <p className="text-xs text-primary-400 mb-3">Suggestions:</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {SUGGESTED_PROMPTS.slice(0, 3).map((prompt, i) => (
                        <button
                          key={i}
                          onClick={() => handleSuggestion(prompt)}
                          className="text-xs px-3 py-1.5 bg-primary-100 text-primary-700 rounded-full hover:bg-primary-200 transition-colors"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] p-3 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-primary-900 text-white'
                          : 'bg-primary-100 text-primary-900'
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                      <div className={`flex items-center gap-2 mt-1 text-xs ${
                        msg.role === 'user' ? 'text-primary-300' : 'text-primary-400'
                      }`}>
                        <span>{new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                        {msg.tokensUsed && (
                          <span>({msg.tokensUsed} tokens)</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-primary-100 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-primary-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Claude reflechit...</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error */}
              {(error || claudeError) && (
                <div className="flex justify-center">
                  <div className="bg-red-50 text-red-700 p-3 rounded-lg flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {error || claudeError}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-primary-200 p-4">
              {/* Quick suggestions when typing */}
              {input.length === 0 && messages.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {SUGGESTED_PROMPTS.slice(3).map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestion(prompt)}
                      className="text-xs px-2 py-1 bg-primary-50 text-primary-600 rounded hover:bg-primary-100 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Posez une question sur vos donnees bancaires..."
                  disabled={isLoading}
                  rows={1}
                  className="flex-1 px-4 py-2 border border-primary-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-primary-50 disabled:text-primary-400"
                  style={{ minHeight: '42px', maxHeight: '120px' }}
                />
                <Button
                  variant="primary"
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="bg-primary-600 hover:bg-primary-700"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-primary-400 mt-2 text-center">
                Appuyez sur Entree pour envoyer, Shift+Entree pour un saut de ligne
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
