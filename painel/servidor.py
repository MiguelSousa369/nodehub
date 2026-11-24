"""Painel do nodehub: servidor local (só 127.0.0.1), sem dependências.

Uso:  python painel/servidor.py [--porta 8737] [--sem-browser]

API:
  GET    /api/maquinas                   máquinas (Tailscale + maquinas.json), clientes, estado do instalador
  PUT    /api/maquinas/<host>            configurar / editar  {cliente, utilizador, notas}
  DELETE /api/maquinas/<host>            remover de maquinas.json
  POST   /api/maquinas/<host>/testar-ssh testar SSH            {utilizador}
  GET    /api/instalador                 descarregar o instalador do cliente (com chaves preenchidas)
"""

import argparse
import json
import os
import re
import subprocess
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PASTA = Path(__file__).resolve().parent
REPO = PASTA.parent
MAQUINAS = REPO / "maquinas.json"
CONFIG_LOCAL = REPO / "config.local.json"
CHAVES_DIR = REPO / "chaves-publicas"
MODELO_INSTALADOR = REPO / "instalador" / "instalar-cliente.ps1"
TAILSCALE = Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Tailscale" / "tailscale.exe"

TAG_CLIENTE = "tag:cliente"
UTILIZADOR_OMISSAO = "nodehub"
SEM_CLIENTE = "Sem cliente atribuído"

RE_HOST = re.compile(r"^[A-Za-z0-9-]{1,63}$")
RE_UTILIZADOR = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
RE_TEXTO = re.compile(r"^[^\"`;$\r\n]*$")  # estes valores acabam numa linha de comando
RE_AUTHKEY = re.compile(r"^tskey-auth-[A-Za-z0-9-]+$")
RE_CHAVE = re.compile(r"^(ssh-ed25519|ssh-rsa|ecdsa-sha2-\S+|sk-\S+) [A-Za-z0-9+/=]+( [^'\r\n]*)?$")

_lock = threading.Lock()
PORTA = 8737


class ErroPedido(Exception):
    def __init__(self, codigo, msg):
        super().__init__(msg)
        self.codigo = codigo


# ---------------------------------------------------------------------------
# maquinas.json
# ---------------------------------------------------------------------------

def ler_maquinas():
    if not MAQUINAS.exists():
        return {}
    with open(MAQUINAS, encoding="utf-8") as f:
        return json.load(f)


def gravar_maquinas(dados):
    tmp = MAQUINAS.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        json.dump(dict(sorted(dados.items())), f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, MAQUINAS)


def validar_config(corpo):
    cliente = str(corpo.get("cliente", "")).strip()
    utilizador = str(corpo.get("utilizador", "") or UTILIZADOR_OMISSAO).strip()
    notas = str(corpo.get("notas", "")).strip()
    if not cliente or len(cliente) > 100 or not RE_TEXTO.match(cliente):
        raise ErroPedido(400, "Nome de cliente inválido (1 a 100 caracteres, sem aspas, ; ou $).")
    if not RE_UTILIZADOR.match(utilizador):
        raise ErroPedido(400, "Utilizador SSH inválido.")
    if len(notas) > 500 or not RE_TEXTO.match(notas):
        raise ErroPedido(400, "Notas inválidas (máx. 500 caracteres, sem aspas, ; ou $).")
    return {"cliente": cliente, "utilizador": utilizador, "notas": notas}


# ---------------------------------------------------------------------------
# Tailscale
# ---------------------------------------------------------------------------

def peers_tailscale():
    """Devolve {host: peer}. O host é o nome único na tailnet (1.º elemento do DNSName)."""
    saida = subprocess.run(
        [str(TAILSCALE), "status", "--json"],
        capture_output=True, text=True, encoding="utf-8", timeout=15, check=True,
    ).stdout
    peers = {}
    for p in (json.loads(saida).get("Peer") or {}).values():
        host = (p.get("DNSName") or "").split(".")[0] or p.get("HostName", "")
        peers[host.lower()] = {**p, "_host": host}
    return peers


def lista_maquinas():
    config = ler_maquinas()
    config_lower = {k.lower(): (k, v) for k, v in config.items()}
    maquinas, vistas, erro = [], set(), None

    try:
        peers = peers_tailscale()
    except Exception as e:  # Tailscale parado, etc.
        peers, erro = {}, f"Não foi possível ler o Tailscale: {e}"

    for chave, p in peers.items():
        tags = p.get("Tags") or []
        if chave not in config_lower and TAG_CLIENTE not in tags:
            continue  # máquinas nossas, não de clientes
        nome_cfg, cfg = config_lower.get(chave, (p["_host"], {}))
        vistas.add(chave)
        visto = p.get("LastSeen", "")
        maquinas.append({
            "host": nome_cfg,
            "cliente": cfg.get("cliente") or SEM_CLIENTE,
            "utilizador": cfg.get("utilizador") or "",
            "notas": cfg.get("notas") or "",
            "configurada": bool(cfg),
            "ip": (p.get("TailscaleIPs") or [""])[0],
            "online": bool(p.get("Online")),
            "ultimo_contacto": "" if visto.startswith("0001") else visto,
            "so": p.get("OS", ""),
            "na_tailnet": True,
        })

    for chave, (nome, cfg) in config_lower.items():
        if chave not in vistas:
            maquinas.append({
                "host": nome, "cliente": cfg.get("cliente", ""), "utilizador": cfg.get("utilizador", ""),
                "notas": cfg.get("notas", ""), "configurada": True, "ip": "", "online": False,
                "ultimo_contacto": "", "so": "", "na_tailnet": False,
            })

    # Clientes configurados por ordem alfabética, "Sem cliente atribuído" no fim
    maquinas.sort(key=lambda m: (not m["configurada"], m["cliente"].lower(), m["host"].lower()))
    clientes = sorted({m["cliente"] for m in maquinas if m["configurada"]}, key=str.lower)
    return {"maquinas": maquinas, "clientes": clientes, "erro": erro, "instalador": estado_instalador()}


# ---------------------------------------------------------------------------
# Ações sobre máquinas
# ---------------------------------------------------------------------------

def configurar(host, corpo):
    cfg = validar_config(corpo)
    with _lock:
        dados = ler_maquinas()
        existente = next((k for k in dados if k.lower() == host.lower()), None)
        if existente is None:
            try:
                peer = peers_tailscale().get(host.lower())
            except Exception as e:
                raise ErroPedido(503, f"Não foi possível ler o Tailscale: {e}")
            if not peer or TAG_CLIENTE not in (peer.get("Tags") or []):
                raise ErroPedido(404, f"A máquina '{host}' não está na tailnet com a {TAG_CLIENTE}.")
            existente = peer["_host"]
        dados[existente] = cfg
        gravar_maquinas(dados)
    return {"host": existente, **cfg}


def remover(host):
    with _lock:
        dados = ler_maquinas()
        existente = next((k for k in dados if k.lower() == host.lower()), None)
        if existente is None:
            raise ErroPedido(404, f"A máquina '{host}' não está configurada.")
        del dados[existente]
        gravar_maquinas(dados)
    return {"removida": existente}


def testar_ssh(host, corpo):
    utilizador = str(corpo.get("utilizador", "") or UTILIZADOR_OMISSAO).strip()
    if not RE_UTILIZADOR.match(utilizador):
        raise ErroPedido(400, "Utilizador SSH inválido.")
    try:
        r = subprocess.run(
            ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=8",
             "-o", "StrictHostKeyChecking=accept-new", f"{utilizador}@{host}", "hostname"],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=20,
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "mensagem": "Sem resposta (timeout)."}
    if r.returncode == 0:
        return {"ok": True, "mensagem": f"Ligação OK ({r.stdout.strip()})."}
    linhas = [l for l in r.stderr.splitlines() if l.strip() and not l.startswith("**")]
    return {"ok": False, "mensagem": (linhas[-1] if linhas else f"Falhou (código {r.returncode}).")}


# ---------------------------------------------------------------------------
# Instalador do cliente
# ---------------------------------------------------------------------------

def ler_chaves():
    chaves = []
    if CHAVES_DIR.is_dir():
        for f in sorted(CHAVES_DIR.glob("*.pub")):
            for linha in f.read_text(encoding="utf-8").splitlines():
                linha = linha.strip()
                if RE_CHAVE.match(linha):
                    chaves.append(linha)
    return chaves


def ler_authkey():
    if not CONFIG_LOCAL.exists():
        return None
    try:
        chave = json.loads(CONFIG_LOCAL.read_text(encoding="utf-8")).get("tailscale_authkey", "")
    except json.JSONDecodeError:
        return None
    return chave if RE_AUTHKEY.match(chave or "") else None


def estado_instalador():
    falta = []
    if not ler_authkey():
        falta.append("Chave do Tailscale em config.local.json (\"tailscale_authkey\").")
    if not ler_chaves():
        falta.append("Pelo menos uma chave SSH pública em chaves-publicas/*.pub.")
    return {"pronto": not falta, "falta": falta}


def gerar_instalador():
    estado = estado_instalador()
    if not estado["pronto"]:
        raise ErroPedido(409, "Instalador por configurar: " + " ".join(estado["falta"]))
    texto = MODELO_INSTALADOR.read_text(encoding="utf-8-sig")
    chaves = ",".join("'" + c.replace("'", "''") + "'" for c in ler_chaves())
    texto = texto.replace("'__NODEHUB_AUTHKEY__'", "'" + ler_authkey() + "'")
    texto = texto.replace("'__NODEHUB_PUBKEYS__'", chaves)
    # UTF-8 com BOM e CRLF: o Windows PowerShell 5.1 precisa do BOM para ler os acentos
    return texto.replace("\r\n", "\n").replace("\n", "\r\n").encode("utf-8-sig")


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    def _host_valido(self):
        # Proteção contra DNS rebinding: só aceita pedidos dirigidos a localhost.
        h = (self.headers.get("Host") or "").split(":")[0]
        return h in ("127.0.0.1", "localhost")

    def _origem_valida(self):
        # Proteção contra CSRF: pedidos que alteram dados têm de vir do próprio painel.
        return self.headers.get("Origin") in (f"http://127.0.0.1:{PORTA}", f"http://localhost:{PORTA}")

    def _enviar(self, codigo, corpo, tipo, extra=None):
        dados = corpo.encode("utf-8") if isinstance(corpo, str) else corpo
        self.send_response(codigo)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(dados)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(dados)

    def _json(self, codigo, obj):
        self._enviar(codigo, json.dumps(obj, ensure_ascii=False), "application/json; charset=utf-8")

    def _corpo(self):
        if "application/json" not in (self.headers.get("Content-Type") or ""):
            raise ErroPedido(415, "Content-Type tem de ser application/json.")
        n = int(self.headers.get("Content-Length") or 0)
        if n > 10_000:
            raise ErroPedido(413, "Pedido demasiado grande.")
        try:
            corpo = json.loads(self.rfile.read(n) or b"{}")
        except json.JSONDecodeError:
            raise ErroPedido(400, "JSON inválido.")
        if not isinstance(corpo, dict):
            raise ErroPedido(400, "JSON inválido.")
        return corpo

    def _rota_maquina(self):
        m = re.fullmatch(r"/api/maquinas/([^/]+)(/testar-ssh)?", self.path)
        if not m:
            raise ErroPedido(404, "Não encontrado.")
        host = m.group(1)
        if not RE_HOST.match(host):
            raise ErroPedido(400, "Nome de máquina inválido.")
        return host, bool(m.group(2))

    def _tratar(self, metodo):
        if not self._host_valido():
            return self._enviar(403, "Proibido", "text/plain; charset=utf-8")
        try:
            if metodo == "GET":
                if self.path in ("/", "/index.html"):
                    return self._enviar(200, (PASTA / "index.html").read_bytes(), "text/html; charset=utf-8")
                if self.path == "/api/maquinas":
                    return self._json(200, lista_maquinas())
                if self.path == "/api/instalador":
                    return self._enviar(200, gerar_instalador(), "application/octet-stream", {
                        "Content-Disposition": 'attachment; filename="nodehub-instalar.ps1"',
                    })
                raise ErroPedido(404, "Não encontrado.")

            if not self._origem_valida():
                raise ErroPedido(403, "Origem não permitida.")
            host, testar = self._rota_maquina()
            if metodo == "PUT" and not testar:
                return self._json(200, configurar(host, self._corpo()))
            if metodo == "DELETE" and not testar:
                return self._json(200, remover(host))
            if metodo == "POST" and testar:
                return self._json(200, testar_ssh(host, self._corpo()))
            raise ErroPedido(405, "Método não permitido.")
        except ErroPedido as e:
            return self._json(e.codigo, {"erro": str(e)})
        except Exception as e:
            return self._json(500, {"erro": f"Erro interno: {e}"})

    def do_GET(self):
        self._tratar("GET")

    def do_PUT(self):
        self._tratar("PUT")

    def do_DELETE(self):
        self._tratar("DELETE")

    def do_POST(self):
        self._tratar("POST")

    def log_message(self, *args):
        pass


def main():
    global PORTA
    ap = argparse.ArgumentParser()
    ap.add_argument("--porta", type=int, default=8737)
    ap.add_argument("--sem-browser", action="store_true")
    a = ap.parse_args()
    PORTA = a.porta

    srv = ThreadingHTTPServer(("127.0.0.1", a.porta), Handler)
    url = f"http://127.0.0.1:{a.porta}/"
    print(f"nodehub a correr em {url}  (Ctrl+C para parar)")
    if not a.sem_browser:
        webbrowser.open(url)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
