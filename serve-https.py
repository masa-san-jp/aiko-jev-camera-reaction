#!/usr/bin/env python3
"""アイコに手を振るページを、tailnet の中だけに HTTPS で出す。

カメラは暗号化された接続でないとブラウザが開かせないので、平文では出せない。
Tailscale の正規証明書はこのアカウントで発行できなかったため、自己署名で立てる。
スマホ側は初回に警告が出るが、進めば安全な接続として扱われ、カメラが使える。
"""
import http.server, ssl, os

os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT = 8443
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain("self.crt", "self.key")
httpd = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), http.server.SimpleHTTPRequestHandler)
httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
print(f"serving https on {PORT}")
httpd.serve_forever()
