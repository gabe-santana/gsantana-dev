// Zoho Campaigns sign-up, disabled: the newsletter now runs on our own
// Pages Functions + D1 (functions/api/newsletter/*). Kept, commented out,
// in case the list moves back to Zoho. It worked as of 2026-09-26: fetch the
// per-view tokens from TrailEvent, then GET weboptin.zc with them.
//
// /**
//  * Zoho Campaigns sign-up form, submitted from our own markup instead of
//  * Zoho's embed (which ships inline styles, a white popup and optin.min.js).
//  * `action` and `fields` are the <form id="zcampaignOptinForm"> action and
//  * its *named* hidden inputs from the embed code; unnamed inputs are never
//  * submitted, so they're left out.
//  *
//  * This mirrors what optin.min.js does: fetch per-view tokens from
//  * TrailEvent, then a GET to weboptin.zc with the named fields, the tokens
//  * and responseMode=inline. Zoho answers with CORS headers for any
//  * origin, so the reply can be read: JSON with responseType "ZC_TYPEJSON" on
//  * success, "ZCERRORJSON" (or an HTML "Problem in optin" page) on failure.
//  */
// export const zohoOptin = {
//   action: "https://zgnp-zngp.maillist-manage.com/weboptin.zc",
//   fields: {
//     submitType: "optinCustomView",
//     formType: "QuickForm",
//     zx: "138144ba4",
//     zcvers: "3.0",
//     mode: "OptinCreateView",
//     zcld: "117cdaf809ba600ad",
//     zctd: "117cdaf809ba5ff71",
//     zc_trackCode: "ZCFORMVIEW",
//     zc_formIx: "3zb940bbf47272ff7e095b0481137fed9296bdbade9eb21efce3015ac402470a60",
//   } as Record<string, string>,
// };
//
// const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//
// export function isValidEmail(value: string): boolean {
//   return EMAIL.test(value.trim());
// }
//
// /**
//  * Per-view tokens Zoho requires on the sign-up request. optin.min.js gets
//  * them from a "form viewed" TrailEvent call made when the form loads; a
//  * submission without them is rejected with "Problem in optin".
//  */
// export interface ZohoViewTokens {
//   tpIx: string;
//   custIx: string;
//   cntrIx: string;
// }
//
// export function trailEventUrl(sourceUrl: string, config = zohoOptin): string {
//   const params = new URLSearchParams({
//     category: "update",
//     action: "view",
//     trackingCode: config.fields.zc_trackCode ?? "ZCFORMVIEW",
//     viewFrom: "URL_ACTION",
//     zx: config.fields.zx ?? "",
//     signupFormIx: config.fields.zc_formIx ?? "",
//     zcvers: config.fields.zcvers ?? "",
//     source: sourceUrl,
//   });
//   return `${new URL(config.action).origin}/ua/TrailEvent?${params}`;
// }
//
// /**
//  * TrailEvent answers with JSONP (zcParamsCallback({...}); zcSFReferrerCallback({...});).
//  * The tokens are read out of the text, never executed.
//  */
// export function parseViewTokens(script: string): ZohoViewTokens | null {
//   const read = (key: string) => script.match(new RegExp(`${key}:"([^"]+)"`))?.[1];
//   const tpIx = read("zc_ref");
//   const custIx = read("custIx");
//   const cntrIx = read("cntrIx");
//   return tpIx && custIx && cntrIx ? { tpIx, custIx, cntrIx } : null;
// }
//
// /** The sign-up request optin.min.js would send for this address. */
// export function newsletterRequestUrl(
//   email: string,
//   sourceUrl: string,
//   tokens: ZohoViewTokens,
//   config: { action: string; fields: Record<string, string> } = zohoOptin
// ): string {
//   const params = new URLSearchParams(config.fields);
//   params.set("CONTACT_EMAIL", email.trim());
//   params.set("responseMode", "inline");
//   params.set("sourceURL", sourceUrl);
//   params.set("tpIx", tokens.tpIx);
//   params.set("custIx", tokens.custIx);
//   params.set("cntrIx", tokens.cntrIx);
//   return `${config.action}?${params}`;
// }
//
// /** Zoho's reply is JSON on success and on handled errors, HTML when it can't process the request at all. */
// export function isNewsletterSuccess(responseText: string): boolean {
//   try {
//     const reply = JSON.parse(responseText) as { responseType?: string };
//     return reply.responseType !== undefined && reply.responseType !== "ZCERRORJSON";
//   } catch {
//     return false;
//   }
// }
