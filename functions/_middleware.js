// One public address: anything reaching the old *.pages.dev address is sent,
// permanently, to the same page on qubicmap.org.
const MAIN = "qubicmap.org";

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  if (url.hostname.endsWith(".pages.dev")) {
    url.protocol = "https:";
    url.hostname = MAIN;
    url.port = "";
    return Response.redirect(url.toString(), 301);
  }
  return next();
}
