import { WpApiError } from "./client.ts";
import type { WpClient } from "./client.ts";

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
    if (client.dryRun) {
      return -1;
    }

    const found = (await client.request<TaxonomyItem[]>({
      method: "GET",
      path: `/${kind}?search=${encodeURIComponent(name)}`,
    })) as TaxonomyItem[];
    const exact = found.find((item) => item.name === name);
    if (exact) return exact.id;

    try {
      const created = (await client.request<TaxonomyItem>({
        method: "POST",
        path: `/${kind}`,
        body: { name },
      })) as TaxonomyItem;
      return created.id;
    } catch (e) {
      const err = e as any;
      if ((e instanceof WpApiError || err.name === "WpApiError") && (err.status === 401 || err.status === 403)) {
        throw new Error(
          `"${name}" ${labelFor(kind)}가 없고, 현재 계정에는 새로 만들 권한이 없습니다. WordPress 관리자에서 먼저 만들어 주세요.`,
        );
      }
      throw e;
    }
  }

  return {
    resolveCategoryId: (name: string) => findOrCreate("categories", name),
    resolveTagIds: (names: string[]) =>
      Promise.all(names.map((name) => findOrCreate("tags", name))),
  };
}
