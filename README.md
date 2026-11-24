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

### Preparar o instalador (uma vez)

1. Na consola do Tailscale (**Settings → Keys → Generate auth key**), criar uma chave **reutilizável**, **pré-aprovada** e com a tag **`tag:cliente`**.
2. Copiar `config.local.example.json` para `config.local.json` (fica fora do git) e colar lá a chave:
   ```json
   { "tailscale_authkey": "tskey-auth-..." }
   ```
3. As chaves SSH públicas dos técnicos ficam em `chaves-publicas/*.pub` (uma por técnico).

### Adicionar uma máquina

1. No painel: **+ Adicionar máquina → Descarregar instalador**. O ficheiro já leva a chave do Tailscale e as chaves SSH.
2. No PC do cliente: **botão direito → Executar com o PowerShell** e aceitar o pedido de administrador. Não é preciso escrever nada. O instalador:
   - instala o Tailscale e liga-o à tailnet com a `tag:cliente`;
   - cria o utilizador local **`nodehub`** (administrador, escondido do ecrã de login, sem password conhecida);
   - instala o OpenSSH Server, só com autenticação por chave;
   - limita o SSH à rede Tailscale na firewall;
   - apaga-se a si próprio no fim e deixa um registo em `C:\ProgramData\nodehub\instalacao.log`.
3. A máquina aparece sozinha no painel em **Sem cliente atribuído**. Carregar em **Configurar**, escolher o cliente (ou escrever um novo) e **Guardar**.

Para mudar ou tirar uma máquina: menu **⋯ → Editar / Remover**. O `maquinas.json` é gerido pelo painel.

As máquinas são identificadas pelo nome único na tailnet (dois clientes podem ter um PC chamado "SERVIDOR"; o Tailscale distingue-os).

---

## Estrutura

```
nodehub/
├── CLAUDE.md                 regras de helpdesk para o Claude Code
├── maquinas.json             máquina → cliente, utilizador SSH, notas (gerido pelo painel)
├── config.local.json         chave do Tailscale (fora do git; ver config.local.example.json)
├── chaves-publicas/          chaves SSH públicas dos técnicos
├── iniciar-painel.cmd        abre o painel
├── instalador/
│   └── instalar-cliente.ps1  modelo do instalador do PC do cliente (o painel preenche as chaves)
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
- Pedidos que alteram dados só são aceites vindos do próprio painel (`Origin` + JSON), para uma página web não conseguir mexer no `maquinas.json`.
- Só se configuram máquinas que existam na tailnet com a `tag:cliente`.
- O lançador só aceita nomes de máquina simples e que existam em `maquinas.json`, porque um link `nodehub://` pode vir de qualquer página web.
- Não é preciso token da API do Tailscale: os dados vêm do cliente Tailscale local.

---

## Estado

Funcional: painel local (adicionar, configurar, editar e remover máquinas), instalador do cliente, lançador `nodehub://` e regras de helpdesk.

## A fazer

- [ ] **Converter para os padrões `fullstack-ts-standards`**: backend Node + Express + TypeScript (Zod, Winston, Swagger) e frontend React + Vite + Tailwind. Passar o projeto **todo para inglês** (código, interface e documentação).
- [ ] **Base de dados PostgreSQL** (Prisma) em vez do `maquinas.json`.
- [ ] **Tudo a correr em containers** (Docker Compose: backend, frontend e Postgres). Ter em conta:
  - o painel em container não vê o Tailscale do PC: usar a API do Tailscale ou um container Tailscale ao lado;
  - o lançador `nodehub://` e o Claude Code continuam a correr no PC do técnico.
- [ ] **Painel partilhado pela equipa** (consequência dos pontos acima).
- [ ] **Desinstalador do cliente**: remover o utilizador `nodehub`, as chaves, a regra de firewall e tirar a máquina da tailnet.
