import type {
  Candidate,
  Domain,
  MatchFeature,
  NormalizedInput,
} from "@pharmassist/domain";

export interface KnowledgeCard {
  readonly cardId: string;
  readonly intent: string;
  readonly domain: Domain;
  readonly title: string;
  readonly aliases: readonly string[];
  readonly keywords: readonly string[];
  readonly sayNow: readonly string[];
  readonly askNext: Readonly<{
    question: string;
    reason: string;
    priority: number;
    slot: string;
  }>;
  readonly avoid: readonly string[];
  readonly approved: boolean;
  readonly synthetic: boolean;
  readonly revoked?: boolean;
  readonly expiresAt: string;
}

interface TrieNode {
  ids: Set<string>;
  children: Map<string, TrieNode>;
}
function node(): TrieNode {
  return { ids: new Set(), children: new Map() };
}

export class TokenTrie {
  readonly root = node();
  add(tokens: readonly string[], cardId: string): void {
    let current = this.root;
    for (const token of tokens) {
      let next = current.children.get(token);
      if (!next) {
        next = node();
        current.children.set(token, next);
      }
      current = next;
    }
    current.ids.add(cardId);
  }
  search(tokens: readonly string[]): Set<string> {
    const found = new Set<string>();
    for (let start = 0; start < tokens.length; start += 1) {
      let current: TrieNode | undefined = this.root;
      for (let index = start; index < tokens.length && current; index += 1) {
        current = current.children.get(tokens[index]!);
        if (current) for (const id of current.ids) found.add(id);
      }
    }
    return found;
  }
}

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
const grams = (text: string, sizes: readonly number[] = [2, 3]): string[] => {
  const compact = text.replace(/\s+/gu, "");
  const result: string[] = [];
  for (const size of sizes)
    for (let index = 0; index <= compact.length - size; index += 1)
      result.push(compact.slice(index, index + size));
  return result;
};

export interface RetrievalIndex {
  readonly cards: ReadonlyMap<string, KnowledgeCard>;
  readonly exact: ReadonlyMap<string, readonly string[]>;
  readonly trie: TokenTrie;
  readonly documents: ReadonlyMap<string, ReadonlyMap<string, number>>;
  readonly documentFrequency: ReadonlyMap<string, number>;
  readonly averageLength: number;
}

export function buildIndex(
  cards: readonly KnowledgeCard[],
  now = new Date(),
): RetrievalIndex {
  const active = cards.filter(
    (card) => card.approved && !card.revoked && new Date(card.expiresAt) > now,
  );
  const exactMutable = new Map<string, string[]>();
  const trie = new TokenTrie();
  const documents = new Map<string, ReadonlyMap<string, number>>();
  const df = new Map<string, number>();
  let totalLength = 0;
  for (const card of active) {
    for (const alias of card.aliases) {
      const key = alias.normalize("NFKC").trim().toLowerCase();
      exactMutable.set(key, [...(exactMutable.get(key) ?? []), card.cardId]);
      trie.add(tokenize(key), card.cardId);
    }
    const terms = [
      ...tokenize(
        `${card.title} ${card.aliases.join(" ")} ${card.keywords.join(" ")}`,
      ),
      ...grams(card.keywords.join(" ")),
    ];
    totalLength += terms.length;
    const counts = new Map<string, number>();
    for (const term of terms) counts.set(term, (counts.get(term) ?? 0) + 1);
    documents.set(card.cardId, counts);
    for (const term of counts.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  }
  return {
    cards: new Map(active.map((card) => [card.cardId, card])),
    exact: exactMutable,
    trie,
    documents,
    documentFrequency: df,
    averageLength: active.length ? totalLength / active.length : 0,
  };
}

function bm25(
  query: readonly string[],
  document: ReadonlyMap<string, number>,
  index: RetrievalIndex,
): number {
  const length = [...document.values()].reduce((sum, value) => sum + value, 0);
  let score = 0;
  for (const term of query) {
    const frequency = document.get(term) ?? 0;
    if (!frequency) continue;
    const documentFrequency = index.documentFrequency.get(term) ?? 0;
    const idf = Math.log(
      1 +
        (index.cards.size - documentFrequency + 0.5) /
          (documentFrequency + 0.5),
    );
    score +=
      idf *
      ((frequency * 2.2) /
        (frequency +
          1.2 * (0.25 + (0.75 * length) / Math.max(index.averageLength, 1))));
  }
  return score;
}

function trigramSimilarity(left: string, right: string): number {
  const a = new Set(grams(left, [3]));
  const b = new Set(grams(right, [3]));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((item) => b.has(item)).length;
  return (2 * intersection) / (a.size + b.size);
}

export function retrieve(
  input: NormalizedInput,
  domain: Domain,
  index: RetrievalIndex,
  limit = 3,
): readonly Candidate[] {
  const features = new Map<string, MatchFeature[]>();
  const add = (id: string, feature: MatchFeature) =>
    features.set(id, [...(features.get(id) ?? []), feature]);
  for (const id of index.exact.get(input.normalizedText) ?? [])
    add(id, { kind: "exact", value: 1, explanation: "normalized exact alias" });
  for (const id of index.trie.search(input.tokens))
    add(id, { kind: "trie", value: 0.85, explanation: "multi-token alias" });
  const queryTerms = [...input.tokens, ...grams(input.normalizedText)];
  const bmScores = [...index.documents].map(
    ([id, doc]) => [id, bm25(queryTerms, doc, index)] as const,
  );
  const maxBm = Math.max(0, ...bmScores.map(([, score]) => score));
  for (const [id, score] of bmScores)
    if (score > 0)
      add(id, {
        kind: "bm25",
        value: maxBm ? (score / maxBm) * 0.55 : 0,
        explanation: "Korean token and n-gram BM25",
      });
  for (const card of index.cards.values()) {
    if (card.domain !== domain) continue;
    const similarity = Math.max(
      0,
      ...card.aliases.map((alias) =>
        trigramSimilarity(input.normalizedText, alias),
      ),
    );
    if (similarity >= 0.25)
      add(card.cardId, {
        kind: "trigram",
        value: similarity * 0.25,
        explanation: "character trigram fuzzy candidate",
      });
  }
  return [...features.entries()]
    .filter(([id]) => index.cards.get(id)?.domain === domain)
    .map(([cardId, matchFeatures]) => ({
      cardId,
      intent: index.cards.get(cardId)!.intent,
      score: Math.min(
        1,
        matchFeatures.reduce((sum, feature) => sum + feature.value, 0),
      ),
      features: matchFeatures,
    }))
    .sort((a, b) => b.score - a.score || a.cardId.localeCompare(b.cardId))
    .slice(0, limit);
}

export interface StabilityState {
  readonly current?: Candidate;
  readonly frozen: boolean;
  readonly criticalLocked: boolean;
  readonly sequence: number;
}
export function selectStable(
  state: StabilityState,
  incoming: Candidate | undefined,
  sequence: number,
  switchMargin = 0.15,
): StabilityState {
  if (
    sequence < state.sequence ||
    state.frozen ||
    state.criticalLocked ||
    !incoming
  )
    return { ...state, sequence: Math.max(state.sequence, sequence) };
  if (
    !state.current ||
    incoming.intent === state.current.intent ||
    incoming.score >= state.current.score + switchMargin
  )
    return { ...state, current: incoming, sequence };
  return { ...state, sequence };
}
