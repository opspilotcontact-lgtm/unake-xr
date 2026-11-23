# Servidor HTTPS en la red local para probar en las Quest (WebXR exige HTTPS).
# Uso:  python servir_lan.py            → https://<IP-del-PC>:18764
#       python servir_lan.py --local    → http://127.0.0.1:18765 (desarrollo en el PC, sin caché)
# La primera vez genera un certificado autofirmado en .cert/ (en las Quest: «Avanzado» → «Continuar»).
import http.server, functools, ssl, socket, subprocess, pathlib, sys

try:
    sys.stdout.reconfigure(encoding='utf-8')  # consola de Windows
except Exception:
    pass
RAIZ = pathlib.Path(__file__).resolve().parent
CERT = RAIZ / '.cert'
LOCAL = '--local' in sys.argv
args = [a for a in sys.argv[1:] if not a.startswith('--')]
PUERTO = int(args[0]) if args else (18765 if LOCAL else 18764)

def ip_local():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1)); return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        s.close()

IP = ip_local()
crt, key = CERT / 'cert.pem', CERT / 'key.pem'
if not crt.exists() and not LOCAL:
    CERT.mkdir(exist_ok=True)
    subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '825',
                    '-keyout', str(key), '-out', str(crt), '-subj', '/CN=unake-xr',
                    '-addext', f'subjectAltName=IP:{IP},IP:127.0.0.1,DNS:localhost'], check=True)

class H(http.server.SimpleHTTPRequestHandler):
    def list_directory(self, path):
        self.send_error(404); return None
    def do_GET(self):
        if self.path.split('?')[0].startswith(('/.cert', '/.git')):
            self.send_error(404); return
        return super().do_GET()
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def log_message(self, *a): pass

if LOCAL:
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PUERTO), functools.partial(H, directory=str(RAIZ)))
    print(f'UNAKÉ XR (desarrollo) → http://127.0.0.1:{PUERTO}', flush=True)
    srv.serve_forever()

srv = http.server.ThreadingHTTPServer(('0.0.0.0', PUERTO), functools.partial(H, directory=str(RAIZ)))
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); ctx.load_cert_chain(str(crt), str(key))
srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
print(f'UNAKÉ XR lista → https://{IP}:{PUERTO}  (en las Quest: abrir en el navegador y aceptar el aviso)', flush=True)
srv.serve_forever()
