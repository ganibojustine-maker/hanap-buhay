// Client Messages: this role's own chat page and route (/dashboard/client/messages).
// The chat itself is ChatPage; this file holds what the client sees in it.
import ChatPage from './ChatPage.jsx'

const TEXTS = {
  start: 'Message workers who sent proposals for your gigs, or workers you booked.',
  empty: 'Workers who send proposals or take your bookings will show up here.',
  pick: 'Pick a conversation, or start a new one with a worker.',
}

export function ClientMessages({ call, user }) {
  return <ChatPage call={call} user={user} texts={TEXTS} />
}
