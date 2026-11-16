// Admin Messages: this role's own chat page and route (/dashboard/admin/messages).
// The chat itself is ChatPage; this file holds what the admin sees in it.
import ChatPage from './ChatPage.jsx'

const TEXTS = {
  start: 'Message any account about a report, a verification or a dispute.',
  empty: 'Search by name or town to message anyone.',
  pick: 'Pick a conversation, or search for any account by name or town.',
}

export function AdminMessages({ call, user }) {
  return <ChatPage call={call} user={user} texts={TEXTS} />
}
