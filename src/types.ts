export type Category = "agent_inbox" | "test_inbox";

export interface DomainEntry {
  readonly domain: string;
  readonly provider: string;
  readonly category: Category;
  readonly evidence: string;
  readonly mx_host?: string;
  readonly notes?: string;
}

export interface Match {
  /** Host from the input, lowercased. */
  readonly domain: string;
  /** Listed domain that matched: the host itself or one of its parents. */
  readonly matched: string;
  readonly provider: string;
  readonly category: Category;
}
