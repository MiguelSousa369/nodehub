"""Painel do nodehub: servidor local (só 127.0.0.1), sem dependências.

Uso:  python painel/servidor.py [--porta 8737] [--sem-browser]
"""

import argparse
import json
import os
import subprocess
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PASTA = Path(__file__).resolve().parent
REPO = PASTA.parent
TAILSCALE = Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Tailscale" / "tailscale.exe"
TAG_CLIENTE = "tag:cliente"


def ler_maquinas():
    with open(REPO / "maquinas.json", encoding="utf-8") as f:
        return json.load(f)


def estado_tailscale():
    saida = subprocess.run(
        [str(TAILSCALE), "status", "--json"],
        capture_output=True, text=True, encoding="utf-8", timeout=15, check=True,
    ).stdout
    return json.loads(saida)


def lista_maquinas():
    """Junta o estado do Tailscale com a configuração de maquinas.json."""
    config = ler_maquinas()
    config_lower = {k.lower(): (k, v) for k, v in config.items()}
    vistas = set()
    maquinas = []

    erro = None
    try:
        peers = estado_tailscale().get("Peer") or {}
    except Exception as e:  # Tailscale parado, etc.
        peers, erro = {}, f"Não foi possível ler o Tailscale: {e}"

    for p in peers.values():
        nome = (p.get("DNSName") or "").split(".")[0] or p.get("HostName", "")
        tags = p.get("Tags") or []
        chave = nome.lower()
        if chave not in config_lower and TAG_CLIENTE not in tags:
            continue  # máquinas nossas, não de clientes
        nome_cfg, cfg = config_lower.get(chave, (nome, {}))
        vistas.add(chave)
        visto = p.get("LastSeen", "")
        maquinas.append({
            "host": nome_cfg,
            "cliente": cfg.get("cliente") or "Sem cliente atribuído",
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

    maquinas.sort(key=lambda m: (m["cliente"].lower(), m["host"].lower()))
    return {"maquinas": maquinas, "erro": erro}


class Handler(BaseHTTPRequestHandler):
    def _host_valido(self):
        # Proteção contra DNS rebinding: só aceita pedidos dirigidos a localhost.
        h = (self.headers.get("Host") or "").split(":")[0]
        return h in ("127.0.0.1", "localhost")

    def _enviar(self, codigo, corpo, tipo):
        dados = corpo.encode("utf-8") if isinstance(corpo, str) else corpo
        self.send_response(codigo)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(dados)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(dados)

    def do_GET(self):
        if not self._host_valido():
            return self._enviar(403, "Proibido", "text/plain; charset=utf-8")
        if self.path in ("/", "/index.html"):
            return self._enviar(200, (PASTA / "index.html").read_bytes(), "text/html; charset=utf-8")
        if self.path == "/api/maquinas":
            try:
                corpo = json.dumps(lista_maquinas(), ensure_ascii=False)
                return self._enviar(200, corpo, "application/json; charset=utf-8")
            except Exception as e:
                return self._enviar(500, json.dumps({"erro": str(e)}), "application/json; charset=utf-8")
        self._enviar(404, "Não encontrado", "text/plain; charset=utf-8")

    def log_message(self, *args):
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--porta", type=int, default=8737)
    ap.add_argument("--sem-browser", action="store_true")
    a = ap.parse_args()

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
