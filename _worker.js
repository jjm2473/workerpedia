addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

/**
 * Respond to the request
 * @param {Request} request
 */
async function handleRequest(request) {
  const replace_wikimedia = function(val){
    return val.replaceAll(/(https:)?\/\/upload.wikimedia.org\//g, '/upload.wikimedia.org/')
  }
  class ElementHandler {
    element(element) {
      ['src','srcset','href'].forEach(function(key){
        var val = element.getAttribute(key)
        if (val !== null) {
          element.setAttribute(key, replace_wikimedia(val))
        }
      })
    }
  }
  try {
    var u = (new URL(request.url))
    if (u.protocol !== 'https:') {
      u.protocol = 'https:'
      return (new Response('', { status: 301, headers: { 'Location': u.href } }))
    }
    var host = request.headers.get("Host")
    //u.searchParams.append('variant', 'zh-cn')
    if (u.pathname === '/') {
      return (new Response('', { status: 302, headers: { 'Location': '/wiki/' } }))
    }
    var d = null
    var res = null
    if (u.pathname.startsWith('/upload.wikimedia.org/')) {
      res = await fetch(`https:/${u.pathname}${u.search}`)
    } else {
      var ua = request.headers.get('User-Agent')
      var ual = (ua || '').toLowerCase()
      d = await fetch(`https://zh${(ual.indexOf('mobile') !== -1 || ual.indexOf('android') !== -1 || ual.indexOf('like mac os x') !== -1) ? '.m' : ''}.wik${'ip'}edia.org${u.pathname}${u.search}`)
      var resptype = d.headers.get('Content-Type')
      if (resptype.startsWith('text/html')) {
        console.log('html');
        res = new HTMLRewriter().on('*', new ElementHandler()).transform(d);
      } else if (resptype.startsWith('application/json')) {
        console.log('json');
        const { readable, writable } = new TransformStream({transform:function(v,ctl){ctl.enqueue(replace_wikimedia(v))}});
        d.body.pipeTo(writable)
        res = new Response(readable, { status: d.status, headers: d.headers })
      } else {
        console.log('other');
        res = d
      }
    }
    return res
  } catch (e) {
    return (new Response(String(e), { status: 500 }))
  }
}
