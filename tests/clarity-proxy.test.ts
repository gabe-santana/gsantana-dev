import { describe, expect, it } from "vitest";
import { rewriteClarityTag, upstreamCollectUrl, upstreamScriptUrl } from "@/lib/clarity-proxy";

// Captured from https://www.clarity.ms/tag/yol0e2ogzk on 2026-09-26.
const REAL_TAG =
  '!function(c,l,a,r,i,t,y){function sync(){(new Image).src="https://c.clarity.ms/c.gif"}"complete"==document.readyState?sync():window.addEventListener("load",sync);a[c].v||a[c].t||a[c]("metadata",(function(){a[c]("set", "C_IS", "0");}),!1,!0);if(a[c].v||a[c].t)return a[c]("event",c,"dup."+i.projectId);a[c].t=!0,(t=l.createElement(r)).async=!0,t.src="https://scripts.clarity.ms/0.8.70/clarity.js",(y=l.getElementsByTagName(r)[0]).parentNode.insertBefore(t,y),a[c]("start",i),a[c].q.unshift(a[c].q.pop()),a[c]("set","C_IS","0")}("clarity",document,window,"script",{"projectId":"yol0e2ogzk","upload":"https://y.clarity.ms/collect","expire":365,"cookies":["_uetmsclkid","_uetvid","_clck"],"track":true,"content":true,"dob":2460});';

describe("Clarity proxy", () => {
  it("rewrites every Clarity endpoint in the real loader to the site's own domain", () => {
    const out = rewriteClarityTag(REAL_TAG, "https://gsantana.dev");
    expect(out).toContain('t.src="https://gsantana.dev/r/s/0.8.70/clarity.js"');
    expect(out).toContain('"upload":"https://gsantana.dev/r/c/y"');
    expect(out).toContain('(new Image).src="https://gsantana.dev/r/p"');
    expect(out).not.toContain("clarity.ms");
    expect(out).toContain('"projectId":"yol0e2ogzk"');
  });

  it("fails loudly if Clarity adds an endpoint the proxy doesn't know", () => {
    expect(() => rewriteClarityTag(`${REAL_TAG}fetch("https://www.clarity.ms/new")`, "https://gsantana.dev")).toThrow();
  });

  it("only proxies Clarity's own script and collect shards", () => {
    expect(upstreamScriptUrl("0.8.70/clarity.js")).toBe("https://scripts.clarity.ms/0.8.70/clarity.js");
    expect(upstreamScriptUrl("../evil.js")).toBeNull();
    expect(upstreamScriptUrl("0.8.70/other.js")).toBeNull();
    // Clarity's loader asked for a prerelease build on 2026-10-05.
    expect(upstreamScriptUrl("0.8.74-beta/clarity.js")).toBe("https://scripts.clarity.ms/0.8.74-beta/clarity.js");
    expect(upstreamScriptUrl("0.8.74-rc.1/clarity.js")).toBe("https://scripts.clarity.ms/0.8.74-rc.1/clarity.js");
    expect(upstreamScriptUrl("0.8.74-../clarity.js")).toBeNull();
    expect(upstreamScriptUrl("0.8.74-beta/../evil.js")).toBeNull();
    expect(upstreamScriptUrl("0.8.74-beta/x/clarity.js")).toBeNull();
    expect(upstreamCollectUrl("y")).toBe("https://y.clarity.ms/collect");
    expect(upstreamCollectUrl("evil.example")).toBeNull();
    expect(upstreamCollectUrl("")).toBeNull();
  });
});
