// Worker Messages: this role's own chat page and route (/dashboard/worker/messages).
// The chat itself is ChatPage; this file holds what the worker sees in it.
import ChatPage from './ChatPage.jsx'

const TEXTS = {
  start: 'Message employers you applied to, clients you sent proposals to, or anyone you are connected with.',
  empty: 'Apply to jobs, send proposals or follow people, and they will show up here.',
  pick: 'Pick a conversation, or start a new one with an employer or a client.',
}

export function WorkerMessages({ call, user }) {
  return <ChatPage call={call} user={user} texts={TEXTS} />
}
