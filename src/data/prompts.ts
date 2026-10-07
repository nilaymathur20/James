export interface PromptStarter {
  id: string;
  category: string;
  title: string;
  description: string;
  prompt: string;
  personaId: string;
}

export const PROMPT_STARTERS: PromptStarter[] = [
  {
    id: '1',
    category: 'Architecture',
    title: 'High-traffic backend design',
    description: 'Structure an event-driven system for high concurrent WebSocket connections',
    prompt: 'Design an event-driven backend architecture capable of handling 50,000 active WebSocket connections. Explain data partitioning, server horizontal scaling, and message broker failover.',
    personaId: 'architect',
  },
  {
    id: '2',
    category: 'TypeScript',
    title: 'Refactor and optimize code',
    description: 'Inspect in-memory algorithms for CPU and memory allocation efficiency',
    prompt: 'Review an in-memory graph search algorithm in TypeScript. Show how to reduce object allocations using typed arrays and pooling, and provide before/after code snippets.',
    personaId: 'architect',
  },
  {
    id: '3',
    category: 'Security',
    title: 'Web authentication review',
    description: 'Compare session storage strategies and token refresh models',
    prompt: 'Evaluate session token storage in Single Page Applications. Compare httpOnly cookies against in-memory bearer tokens with refresh token rotation, highlighting common failure modes.',
    personaId: 'cyber',
  },
  {
    id: '4',
    category: 'Design Systems',
    title: 'Audit interface accessibility',
    description: 'Review contrast ratios, keyboard navigation, and semantic HTML',
    prompt: 'List the practical steps to audit a web application for WCAG 2.1 AA accessibility. Cover color contrast math, focus states, screen reader landmarks, and touch target sizing.',
    personaId: 'designer',
  },
  {
    id: '5',
    category: 'Summary',
    title: 'Concise executive brief',
    description: 'Condense a complex technical trade-off into 3 clear action items',
    prompt: 'Summarize the practical pros and cons of migrating from a monolith to microservices for a 15-person engineering team. Give me a bottom-line recommendation and three concrete risks.',
    personaId: 'executive',
  },
  {
    id: '6',
    category: 'Analysis',
    title: 'First-principles logic check',
    description: 'Break down an engineering hypothesis with counter-arguments',
    prompt: 'Analyze the trade-offs of using SQLite in production for read-heavy web services versus PostgreSQL. Break down durability guarantees, backup strategies, and write contention limits.',
    personaId: 'socratic',
  },
];
