# nodehub

Painel central com todos os PCs dos clientes ligados por **Tailscale**, organizados por cliente, a partir do qual se faz **helpdesk remoto com o Claude Code**: diagnóstico, resolução de problemas e deteção de vírus, sem o cliente ter de fazer nada.

---

## A ideia

Os PCs dos clientes já estão na nossa rede privada Tailscale, com um servidor SSH que só aceita a nossa chave. Isso dá-nos acesso direto e seguro a cada máquina, sem portas abertas na internet.

O **nodehub** aproveita esse acesso para duas coisas:

1. **Ver tudo organizado:** um painel com todas as máquinas, agrupadas por cliente, com o estado de cada uma.
2. **Agir com o Claude Code:** escolhe-se uma máquina no painel e o Claude Code liga-se a ela por SSH para diagnosticar e resolver o problema.

```
 PC do técnico                                             PCs dos clientes
 ┌──────────────────────────────┐                          ┌───────────────────────┐
 │ nodehub (painel)             │                          │ Cliente A             │
 │   lista de máquinas          │                          │   srv-a   ● online    │
 │   [Abrir no Claude] [Copiar] │                          │   posto1  ● online    │
 │            │                 │                          ├───────────────────────┤
 │            ▼                 │   tailnet (WireGuard)    │ Cliente B             │
 │ Claude Code ── ssh ──────────┼═════════════════════════▶│   srv-b   ○ offline   │
 │                              │   sem portas abertas     │   ...                 │
 └──────────────────────────────┘                          └───────────────────────┘
```

---

## O painel

Para cada máquina mostra:

| Campo | Origem |
|-------|--------|
| Cliente | Tag / nome no Tailscale |
| Nome da máquina | Tailscale |
| IP Tailscale (100.x) | Tailscale |
| Online / offline | Tailscale |
| Último contacto | Tailscale |
| Sistema operativo | Tailscale |
| Utilizador SSH | Configuração do nodehub |
| Notas | Configuração do nodehub |

A lista de máquinas e o estado vêm da **API do Tailscale**, por isso o painel está sempre atualizado sem registo manual. O que o Tailscale não sabe (cliente a que pertence, utilizador SSH, notas) fica num ficheiro de configuração do nodehub.

---

## Ligação ao Claude Code

Cada máquina no painel tem dois botões.

### 1. Abrir no Claude (principal)

Um clique abre um terminal com o Claude Code já a trabalhar nessa máquina.

Funciona com um **protocolo próprio registado no Windows**:

```
nodehub://open?host=srv-a
```

Ao clicar, o Windows corre um pequeno lançador que:

1. Abre o Windows Terminal na pasta do nodehub.
2. Inicia o `claude` com o contexto da máquina (cliente, host, IP, utilizador SSH) já indicado.
3. O técnico só tem de descrever o problema.

### 2. Copiar para o Claude (alternativa)

Para quando o lançador não está instalado ou se quer usar outro terminal. Copia um texto pronto a colar numa sessão do Claude Code:

```
Helpdesk: cliente A, máquina srv-a (100.x.x.x, utilizador admin).
Problema: <descrever aqui>
```

### O contexto vem do repositório, não do painel

O painel só identifica a máquina. O que o Claude precisa de saber para trabalhar está no próprio repositório:

- **`CLAUDE.md`** com as regras de helpdesk: como se liga por SSH, o que pode fazer sozinho, quando tem de perguntar e onde regista o que fez.
- **Uma pasta por cliente** com o histórico de intervenções em cada máquina, que o Claude lê antes de começar.

Assim, abrir pelo botão ou colar à mão dá o mesmo resultado.

---

## O que se faz com isto

- **Diagnóstico:** "o PC está lento", "não imprime", "a aplicação não arranca".
- **Resolução:** reiniciar serviços, limpar disco, corrigir configurações, aplicar atualizações.
- **Segurança:** verificar o antivírus, procurar ameaças, processos ou software suspeito, contas estranhas.
- **Consulta:** estado do disco, memória, eventos de erro, software instalado.

Tudo por SSH, sem interromper o utilizador e sem ferramentas de acesso remoto ao ecrã.

---

## Segurança

- **Isolamento entre clientes:** as ACLs do Tailscale garantem que só o PC do técnico chega às máquinas e que nenhum cliente vê outro.
- **SSH só por chave:** sem passwords, e só aceite a partir da rede Tailscale.
- **Registo de intervenções:** cada sessão fica registada na pasta do cliente (problema, o que foi feito, resultado).
- **Regras claras para o Claude:** o `CLAUDE.md` define o que pode fazer sem perguntar e o que exige confirmação do técnico.
- **Consentimento do cliente:** o acesso permanente para suporte tem de estar acordado com o cliente.
- **Nada de segredos no repositório:** chaves SSH e tokens da API do Tailscale ficam fora do git.

---

## Como usar

**Requisitos no PC do técnico:** Tailscale ligado, Python 3, Claude Code, chave SSH aceite nas máquinas dos clientes.

1. **Registar o protocolo `nodehub://`** (uma vez, não precisa de admin):
   ```powershell
   .\lancador\instalar-protocolo.ps1
   ```
2. **Configurar as máquinas** em `maquinas.json` (cliente, utilizador SSH, notas).
3. **Abrir o painel:** duplo clique em `iniciar-painel.cmd`. Abre em `http://127.0.0.1:8737`.
4. Escolher a máquina e carregar em **Abrir no Claude** (ou **Copiar** e colar numa sessão do Claude Code aberta nesta pasta).

Para abrir uma máquina sem o painel: `.\lancador\abrir.ps1 <maquina>`.

### Adicionar uma máquina

1. A máquina entra na tailnet com a tag `tag:cliente` e SSH só por chave.
2. Acrescentar a entrada em `maquinas.json`:
   ```json
   "nome-da-maquina": { "cliente": "Nome do cliente", "utilizador": "admin", "notas": "" }
   ```
   Máquinas com `tag:cliente` que ainda não estão no ficheiro aparecem no painel em **Sem cliente atribuído**, sem botões.

---

## Estrutura

```
nodehub/
├── CLAUDE.md                 regras de helpdesk para o Claude Code
├── maquinas.json             máquina → cliente, utilizador SSH, notas
├── iniciar-painel.cmd        abre o painel
├── painel/
│   ├── servidor.py           servidor local (só 127.0.0.1), lê o `tailscale status --json`
│   └── index.html            o painel
├── lancador/
│   ├── abrir.ps1             abre o Claude Code ligado a uma máquina
│   └── instalar-protocolo.ps1  regista / remove (-Remover) o protocolo nodehub://
└── clientes/
    ├── _modelo.md            modelo da ficha de cada máquina
    └── <Cliente>/<host>.md   ficha e histórico de intervenções
```

### Notas de segurança da implementação

- O painel só escuta em `127.0.0.1` e recusa pedidos com outro `Host` (proteção contra DNS rebinding).
- O lançador só aceita nomes de máquina simples e que existam em `maquinas.json`, porque um link `nodehub://` pode vir de qualquer página web.
- Não é preciso token da API do Tailscale: os dados vêm do cliente Tailscale local.

---

## Estado

Primeira versão funcional: painel local, lançador `nodehub://` e regras de helpdesk.
Por fazer: painel partilhado pela equipa (API do Tailscale + servidor).
