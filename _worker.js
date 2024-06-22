(() => {
  addEventListener("fetch", (event) => {
    event.respondWith(handleRequest(event.request));
  });

  /**
  * Respond to the request
  * @param {Request} request
  */
  async function handleRequest(request) {
    const replace_wikimedia = function(val) {
      return val.replaceAll(/(https:)?\/\/upload\.wikimedia\.org/g, "/upload.wikimedia.org");
    };
    const replace_metawiki = function(val) {
      return val.replaceAll(/(https:)?\/\/meta\.wikimedia\.org\//g, "/meta.wikimedia.org/");
    };
    class ElementHandler {
      constructor() {
        this.inScript = false;
        this.sctiptContent = undefined;
      }
      element(element) {
        ["src", "srcset", "href", "poster", "content", "data-src", "data-srcset"].forEach(function(key) {
          var val = element.getAttribute(key);
          if (val !== null) {
            element.setAttribute(key, replace_wikimedia(val));
          }
        });
        if (element.tagName === "style") {
          this.inScript = true;
          var self = this;
          this.sctiptContent = "";
          element.onEndTag(function() {
            self.inScript = false;
            self.sctiptContent = undefined;
          });
        }
      }
      text(text) {
        if (this.inScript) {
          this.sctiptContent += text.text;
          if (text.lastInTextNode) {
            text.replace(replace_wikimedia(this.sctiptContent), {html: true});
          } else {
            text.remove();
          }
        }
      }
    }
    try {
      if (request.method != "GET" && request.method != "HEAD") {
        return new Response("405 Method Not Allowed", { status: 405, headers: { "Content-Type": "text/plain",
                            "Etag": "abcdefgh", "Cache-Control": "public, max-age=86400" } });
      }
      var u = new URL(request.url);
      if (u.protocol !== "https:") {
        u.protocol = "https:";
        return new Response("", { status: 301, headers: { "Location": u.href } });
      }
      //u.searchParams.append('variant', 'zh-cn');
      if (u.pathname === "/") {
        return new Response("", { status: 302, headers: { "Location": "/wiki/" } });
      }
      var d = null;
      var res = null;
      var target = null;
      if (u.pathname.startsWith("/upload.wikimedia.org/")) {
        target = `https:/${u.pathname}${u.search}`;
        res = await fetch(new Request(target, request));
      } else {
        if (u.pathname.startsWith("/meta.wikimedia.org/")) {
          target = `https:/${u.pathname}${u.search}`;
        } else {
          var ua = request.headers.get("User-Agent");
          var ual = (ua || "").toLowerCase();
          target = `https://zh${ual.indexOf("mobile") !== -1 || ual.indexOf("android") !== -1 || ual.indexOf("like mac os x") !== -1 ? ".m" : ""}.wik${"ip"}edia.org${u.pathname}${u.search}`;
        }
        d = await fetch(new Request(target, request));
        if (u.pathname === "/wiki/" && d.status == 301) {
          var red = new URL(d.headers.get("Location"));
          return new Response("", { status: 301, headers: { "Location": `${red.pathname}${red.search}` } });
        }
        if (d.status == 302) {
          var red = new URL(d.headers.get("Location"));
          if (red.host.endsWith(".wikipedia.org")) {
            return new Response("", { status: 302, headers: { "Location": `${red.pathname}${red.search}` } });
          } else {
            return d;
          }
        }
        var resptype = d.headers.get("Content-Type");
        if (resptype.startsWith("text/html")) {
          res = new HTMLRewriter().on("*", new ElementHandler()).transform(d);
        } else if ((resptype.startsWith("application/json") &&
                    (u.pathname === "/w/api.php" || u.pathname === "/w/rest.php/v1/search/title")) ||
          (resptype.startsWith("text/javascript") &&
            (u.pathname === "/w/load.php" || u.pathname === "/w/index.php"
            || u.pathname === "/meta.wikimedia.org/w/index.php" ))) {
          const decoder = new TextDecoder("utf-8");
          const encoder = new TextEncoder();
          const { readable, writable } = new TransformStream({ transform: function(v, ctl) {
            ctl.enqueue(encoder.encode(replace_wikimedia(replace_metawiki(decoder.decode(v)))));
          }})
          d.body.pipeTo(writable);
          res = new Response(readable, { status: d.status, headers: d.headers });
        } else {
          res = d;
        }
      }
      return res;
    } catch (e) {
      return new Response(String(e), { status: 500 });
    }
  }
})();
