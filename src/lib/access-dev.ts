// Access insights stand-in for `next dev`: the same flag and blacklist from
// src/.env.local, rows kept in memory and printed to the dev server log.
import { isFlagOn, parseIpList } from "./access-insights";
import { memoryAccessStore, type AccessDeps } from "./access-insights-server";
import { devUserDeps } from "./user-dev";
import { signedInLogin } from "./user-server";

const globalDev = globalThis as { __accessDevStore?: ReturnType<typeof memoryAccessStore> };

export function devAccessDeps(): AccessDeps {
  globalDev.__accessDevStore ??= memoryAccessStore();
  const store = globalDev.__accessDevStore;
  return {
    enabled: isFlagOn(process.env.FLAG_TRACK_USER_ACCESS),
    blacklist: parseIpList(process.env.TRACK_USER_ACCESS_BLACK_LIST),
    store: {
      async upsertPageView(row) {
        await store.upsertPageView(row);
        const saved = store.rows.get(row.id as string);
        console.info(
          `[insights] ${saved?.path} source=${saved?.source} active=${saved?.active_ms}ms scroll=${saved?.max_scroll_pct}% clarity=${saved?.clarity_user_id ?? "-"}`
        );
      },
    },
    now: Date.now(),
    login: (request) => signedInLogin(request, devUserDeps()),
  };
}
