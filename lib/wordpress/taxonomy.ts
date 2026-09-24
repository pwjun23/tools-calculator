import type { WpClient } from "./client";

type Kind = "categories" | "tags";

interface TaxonomyItem {
  id: number;
  name: string;
}

function labelFor(kind: Kind): string {
  return kind === "categories" ? "카테고리" : "태그";
}

export function createTaxonomyResolver(client: WpClient) {
  async function findOrCreate(kind: Kind, name: string): Promise<number> {
    const found = await client.request<TaxonomyItem[]>({
      method: "GET",
      path: `/${kind}?search=${encodeURIComponent(name)}`,
    });
    const exact = found.find((item) => item.name === name);
    if (exact) return exact.id;

    throw new Error(
      `"${name}" ${labelFor(kind)}가 없습니다. WordPress 관리자에서 먼저 만들어 주세요.`,
    );
  }

  return {
    resolveCategoryId: (name: string) => findOrCreate("categories", name),
    resolveTagIds: (names: string[]) =>
      Promise.all(names.map((name) => findOrCreate("tags", name))),
  };
}
