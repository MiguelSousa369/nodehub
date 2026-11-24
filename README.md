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

## Estado

Ideia documentada. Implementação por começar.
