# Fondamenti del Model Context Protocol

## Introduzione

Questa guida ti accompagna nella creazione di un server e un client MCP partendo da zero, fino a raggiungere un livello professionale con persistenza, event bus, comunicazione cross-server e testing avanzato.

Il **Model Context Protocol (MCP)** e' uno standard aperto che definisce come le applicazioni AI comunicano con sistemi esterni. Funziona come un "USB-C per le applicazioni AI": un protocollo universale che collega qualsiasi modello di linguaggio a qualsiasi sorgente di dati o strumento.

---

## Il Problema che MCP Risolve

Senza MCP, ogni integrazione tra un'applicazione AI e un sistema esterno richiede un'implementazione ad hoc. Con N applicazioni AI e M servizi esterni, servirebbero N x M integrazioni diverse.

MCP riduce questa complessita' a N + M: ogni applicazione implementa un client MCP, ogni servizio implementa un server MCP, e tutti comunicano attraverso lo stesso protocollo.

```
  SENZA MCP                           CON MCP

  App1 ──── Servizio1                App1 ─┐
  App1 ──── Servizio2                App2 ─┤── Protocollo MCP ──┤── Server1
  App2 ──── Servizio1                App3 ─┘                    ├── Server2
  App2 ──── Servizio2                                           └── Server3
  App3 ──── Servizio1
  App3 ──── Servizio2                N + M connessioni
                                     (invece di N x M)
  N x M connessioni
```

---

## Architettura del Protocollo

MCP segue un'architettura client-server con tre partecipanti:

```
+------------------+       +------------------+       +------------------+
|                  |       |                  |       |                  |
|    MCP Host      |       |    MCP Client    |       |    MCP Server    |
|                  | crea  |                  | JSON  |                  |
|  (Claude Desktop,| ───>  |  (un client per  | ───>  |  (il tuo codice  |
|   VS Code, IDE)  |       |   ogni server)   | RPC   |   che espone     |
|                  |       |                  | 2.0   |   tools/risorse) |
+------------------+       +------------------+       +------------------+
```

### Host

L'applicazione AI che l'utente utilizza. Esempi: Claude Desktop, Claude Code, un IDE con estensione AI. L'Host coordina uno o piu' MCP Client.

### Client

Componente creato dall'Host per comunicare con un singolo Server. Mantiene una connessione dedicata 1:1. Si occupa della negoziazione delle capability e del lifecycle della sessione.

### Server

Il programma che **tu** scrivi. Espone funzionalita' attraverso tre primitive principali:

| Primitiva | Controllo | Descrizione | Esempio |
|-----------|-----------|-------------|---------|
| **Tools** | Modello | Funzioni che il modello AI puo' invocare | `calculate-velocity`, `log-time` |
| **Resources** | Applicazione | Dati contestuali accessibili dal client | File, record DB, risposte API |
| **Prompts** | Utente | Template per strutturare interazioni | Slash commands, workflow predefiniti |

---

## Il Protocollo JSON-RPC 2.0

MCP utilizza JSON-RPC 2.0 come formato di scambio messaggi. Ogni messaggio e' un oggetto JSON con codifica UTF-8.

### Request (richiesta con risposta attesa)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get-weather",
    "arguments": { "city": "Roma" }
  }
}
```

Il campo `id` identifica la richiesta. Il server risponde con lo stesso `id`.

### Response (risposta a una request)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      { "type": "text", "text": "Temperatura a Roma: 22C, soleggiato" }
    ]
  }
}
```

### Notification (messaggio senza risposta)

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

Le notifiche **non hanno** il campo `id` e non prevedono risposta.

### Error (risposta con errore)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Tool non trovato: invalid-tool"
  }
}
```

---

## Lifecycle della Connessione

Ogni connessione MCP attraversa tre fasi:

```
  Client                                Server
    |                                     |
    |  ── initialize (request) ────────>  |    FASE 1: Inizializzazione
    |  <── initialize (response) ───────  |    (negoziazione capability)
    |  ── initialized (notification) ──>  |
    |                                     |
    |  ── tools/list ──────────────────>  |    FASE 2: Operazione
    |  <── tools list result ───────────  |    (scambio messaggi)
    |  ── tools/call ──────────────────>  |
    |  <── tool result ─────────────────  |
    |  ...                                |
    |                                     |
    |  ── disconnect ──────────────────>  |    FASE 3: Terminazione
    |                                     |
```

### Fase 1: Initialize

Il client invia una `initialize` request dichiarando la versione del protocollo e le sue capability:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "sampling": {}
    },
    "clientInfo": {
      "name": "my-client",
      "version": "1.0.0"
    }
  }
}
```

Il server risponde con le proprie capability:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "tools": { "listChanged": true },
      "resources": {},
      "prompts": {}
    },
    "serverInfo": {
      "name": "my-server",
      "version": "1.0.0"
    }
  }
}
```

Il client conferma con una notifica `notifications/initialized` e la sessione e' pronta.

### Fase 2: Operazione

Client e server si scambiano messaggi secondo le capability negoziate. Il client puo' elencare e invocare tool, leggere risorse, ottenere prompt.

### Fase 3: Terminazione

Il client chiude il transport. Per STDIO, termina il processo. Per HTTP, invia DELETE con il session ID.

---

## Transport: Come Viaggiano i Messaggi

Il transport e' il livello che gestisce il canale di comunicazione. MCP supporta due meccanismi:

### STDIO (Standard Input/Output)

Il client lancia il server come processo figlio. I messaggi JSON-RPC viaggiano su stdin (client->server) e stdout (server->client). Ogni messaggio e' delimitato da newline.

```
  Client Process                    Server Process (child)
       |                                  |
       |  ── stdin ──────────────────>    |
       |  <── stdout ─────────────────    |
       |       stderr (log) ──────>       | (visibile solo al client)
       |                                  |
```

**Regola fondamentale**: il server NON deve mai scrivere su stdout nulla che non sia un messaggio JSON-RPC valido. Per il logging, usare stderr.

### Streamable HTTP

Il server e' un processo HTTP indipendente. Il client invia messaggi via POST e riceve risposte come JSON o come SSE (Server-Sent Events) stream.

```
  Client                              Server HTTP
    |                                    |
    |  ── POST /mcp (JSON-RPC) ──────>   |
    |  <── 200 OK (JSON o SSE) ──────    |
    |                                    |
    |  ── GET /mcp ──────────────────>   |   (opzionale: SSE stream)
    |  <── SSE stream ───────────────    |
    |                                    |
```

Il server puo' gestire sessioni tramite l'header `Mcp-Session-Id`.

---

## Prossimo Passo

Ora che conosci i fondamenti del protocollo, nel prossimo capitolo creerai il tuo primo server MCP funzionante.

**Prossimo**: [Creare il Primo Server MCP](./02-primo-server.md)
