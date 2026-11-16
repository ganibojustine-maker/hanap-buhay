// Employer Messages: this role's own chat page and route (/dashboard/employer/messages).
// The chat itself is ChatPage; this file holds what the employer sees in it.
import ChatPage from './ChatPage.jsx'

const TEXTS = {
  start: 'Message your applicants, or workers you found in Find Workers.',
  empty: 'Workers who apply to your job posts will show up here.',
  pick: 'Pick a conversation, or start a new one with an applicant or a worker.',
}

export function EmployerMessages({ call, user }) {
  return <ChatPage call={call} user={user} texts={TEXTS} />
}
