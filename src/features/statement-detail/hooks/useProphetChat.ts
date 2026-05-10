// ============================================================================
// useProphetChat — alias de useProphet pour respecter la spec §7
// ============================================================================
// La spec place ce hook dans statement-detail/hooks/useProphetChat.ts.
// Le hook lui-même vit dans prophet-copilot/hooks/useProphet.ts pour rester
// avec son bundle (drawer, tools, components). Ce fichier expose juste les
// re-exports pour que les consommateurs respectent la convention spec.
// ============================================================================

export {
  useProphet as useProphetChat,
  type UseProphetResult as UseProphetChatResult,
  type UseProphetArgs as UseProphetChatArgs,
} from '../../prophet-copilot/hooks/useProphet';
