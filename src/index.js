"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const undici_1 = require("undici");
const zod_1 = require("zod");
const API_KEY = process.env.LIMITLESS_API_KEY;
if (!API_KEY)
    throw new Error("Set LIMITLESS_API_KEY");
const BASE = "https://api.limitless.ai/v1";
const call = (path, qs = {}) => (0, undici_1.request)(`${BASE}${path}?${new URLSearchParams(qs)}`, {
    headers: { "X-API-Key": API_KEY }
}).then(r => r.body.json());
// ──────────────────────────────────────────────────────────────────────────────
// 1. Spin up the server object
// ──────────────────────────────────────────────────────────────────────────────
const server = new mcp_js_1.McpServer({
    name: "limitless",
    version: "0.1.0"
});
// ──────────────────────────────────────────────────────────────────────────────
// 2. Resources  (virtual markdown files for Claude to read)
// ──────────────────────────────────────────────────────────────────────────────
server.resource("lifelogs", new mcp_js_1.ResourceTemplate("lifelogs://{id}", { list: undefined }), (uri) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const id = uri.host; // lifelogs://<id>
    const ll = (yield call(`/lifelogs/${id}`)).data.lifelog;
    return {
        contents: [{ uri: uri.href, text: (_a = ll.markdown) !== null && _a !== void 0 ? _a : "(empty)" }]
    };
}), 
// directory listing handler
() => __awaiter(void 0, void 0, void 0, function* () {
    const logs = (yield call("/lifelogs", { limit: 25 })).data.lifelogs;
    return logs.map((l) => `lifelogs://${l.id}`);
}));
// ──────────────────────────────────────────────────────────────────────────────
// 3. Tools  (callable functions)
// ──────────────────────────────────────────────────────────────────────────────
server.tool("list_lifelogs", { limit: zod_1.z.number().optional() }, (_a) => __awaiter(void 0, [_a], void 0, function* ({ limit = 10 }) {
    const data = (yield call("/lifelogs", { limit })).data.lifelogs;
    return {
        content: [{
                type: "text",
                text: data.map((l) => `${l.id} — ${l.title}`).join("\n")
            }]
    };
}));
server.tool("search_lifelogs", { query: zod_1.z.string(), limit: zod_1.z.number().optional() }, (_a) => __awaiter(void 0, [_a], void 0, function* ({ query, limit = 10 }) {
    const logs = (yield call("/lifelogs", { limit })).data.lifelogs;
    const hits = logs.filter((l) => { var _a; return ((_a = l.markdown) !== null && _a !== void 0 ? _a : "").toLowerCase().includes(query.toLowerCase()); });
    return {
        content: [{
                type: "text",
                text: hits.length
                    ? hits.map((l) => `${l.id} — «${l.title}»`).join("\n")
                    : "No matches."
            }]
    };
}));
// ──────────────────────────────────────────────────────────────────────────────
// 4. Start the server over stdio (Claude / VS Code / etc. expect this)
// ──────────────────────────────────────────────────────────────────────────────
await server.connect(new stdio_js_1.StdioServerTransport());
