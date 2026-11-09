// Builds public/ann.html = dkat's viewer (vendor/bpp9kviewer/index.html, untouched) + the qubicmap layer.
// Usage: node scripts/build-ann.mjs   (run by the ann-sync workflow after each upstream update)
import { readFileSync, writeFileSync } from "node:fs";
const src = readFileSync("vendor/bpp9kviewer/index.html", "utf8");
const up = JSON.parse(readFileSync("vendor/bpp9kviewer/UPSTREAM.json", "utf8"));
const epochs = (src.match(/const EPOCH_TASK = \{([^\n]*)\};/) || [, ""])[1].match(/(\d+):/g)?.map(x => +x.slice(0, -1)) || [];
if (!/<head[^>]*>/i.test(src) || !/<\/body>/i.test(src)) throw new Error("upstream layout changed: no <head> or </body>");
const head = `
<title>Qubic ANN Replay · watch the neural networks Qubic miners build</title>
<meta name="description" content="Watch a top Qubic miner's artificial neural network being rebuilt step by step from on-chain data, every score checked against the chain. Viewer by dkat, on the Qubic Ecosystem Map.">
<link rel="canonical" href="https://qubicmap.org/ann"><meta property="og:type" content="website"><meta property="og:title" content="Qubic ANN Replay"><meta property="og:description" content="The neural networks Qubic miners find for Aigarth, rebuilt live from the chain."><meta property="og:url" content="https://qubicmap.org/ann"><meta property="og:image" content="https://qubicmap.org/cover.jpg"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#0a1019">
<meta name="qm-upstream" content="${up.sha}">
<link rel="stylesheet" href="/ann/qm.css?v=${Date.now().toString(36)}">`;
let out = src.replace(/<title>[\s\S]*?<\/title>/i, "").replace(/<head[^>]*>/i, m => m + head);
const i = out.lastIndexOf("</body>");
out = out.slice(0, i) + `<script src="/ann/qm.js?v=${Date.now().toString(36)}"></script>\n` + out.slice(i);
writeFileSync("public/ann.html", out);
writeFileSync("public/ann/meta.json", JSON.stringify({ upstream: up, epochs, built: new Date().toISOString() }) + "\n");
console.log("ann.html built from", up.sha.slice(0, 7), "epochs", epochs.join(","));
