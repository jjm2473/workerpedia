addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request))
})

/**
 * Respond to the request
 * @param {Request} request
 */
async function handleRequest(request) {
  const replace_wikimedia = function(val) {
    return val.replaceAll(/(https:)?\/\/upload.wikimedia.org/g, "/upload.wikimedia.org")
  }
  class ElementHandler {
    constructor() {
      this.inCss = false
      this.cssContent = undefined
    }
    element(element) {
      ["src", "srcset", "href", "poster", "content"].forEach(function(key) {
        var val = element.getAttribute(key)
        if (val !== null) {
          element.setAttribute(key, replace_wikimedia(val))
        }
      })
      if (element.tagName === 'style') {
        this.inCss = true
        var self = this
        this.cssContent = ""
        element.onEndTag(function() {
          self.inCss = false;
          self.cssContent = undefined
        })
      }
    }
    text(text) {
      if (this.inCss) {
        this.cssContent += text.text
        if (text.lastInTextNode) {
          text.replace(replace_wikimedia(this.cssContent))
        } else {
          text.remove()
        }
      }
    }
  }
  try {
    var u = new URL(request.url)
    if (u.protocol !== "https:") {
      u.protocol = "https:"
      return new Response("", { status: 301, headers: { "Location": u.href } })
    }
    //u.searchParams.append('variant', 'zh-cn')
    if (u.pathname === "/") {
      return new Response("", { status: 302, headers: { "Location": "/wiki/" } })
    }
    var d = null
    var res = null
    if (u.pathname.startsWith("/upload.wikimedia.org/")) {
      var target = `https:/${u.pathname}${u.search}`
      res = await fetch(new Request(target, request))
    } else {
      var ua = request.headers.get("User-Agent")
      var ual = (ua || "").toLowerCase()
      var target = `https://zh${ual.indexOf("mobile") !== -1 || ual.indexOf("android") !== -1 || ual.indexOf("like mac os x") !== -1 ? ".m" : ""}.wik${"ip"}edia.org${u.pathname}${u.search}`
      d = await fetch(new Request(target, request))
      if (u.pathname === "/wiki/" && d.status == 301) {
        var red = new URL(d.headers.get('Location'));
        return new Response("", { status: 301, headers: { "Location": `${red.pathname}${red.search}` } });
      }
      var resptype = d.headers.get("Content-Type")
      if (resptype.startsWith("text/html")) {
        res = new HTMLRewriter().on("*", new ElementHandler()).transform(d)
      } else if ((resptype.startsWith("application/json") && u.pathname === "/w/api.php") ||
        (resptype.startsWith("text/javascript") && u.pathname === "/w/load.php")) {
        const decoder = new TextDecoder("utf-8")
        const encoder = new TextEncoder()
        const { readable, writable } = new TransformStream({ transform: function(v, ctl) {
          ctl.enqueue(encoder.encode(replace_wikimedia(decoder.decode(v))))
        }})
        d.body.pipeTo(writable)
        res = new Response(readable, { status: d.status, headers: d.headers })
      } else {
        res = d
      }
    }
    return res
  } catch (e) {
    return new Response(String(e), { status: 500 })
  }
}
