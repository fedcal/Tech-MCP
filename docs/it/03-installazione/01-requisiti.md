# Prerequisiti e Installazione

## Requisiti di Sistema

MCP Suite richiede i seguenti componenti installati sulla macchina di sviluppo:

| Requisito | Versione Minima | Scopo |
|-----------|----------------|-------|
| **Node.js** | >= 20.0.0 | Runtime JavaScript |
| **pnpm** | >= 9.0.0 | Package manager per workspaces |
| **Git** | qualsiasi recente | Clonare il repository |
| **Build tools nativi** | vedi sotto | Compilazione di `better-sqlite3` |

---

## 1. Installare Node.js (>= 20.0.0)

### Windows

**Opzione A - Installer ufficiale:**
1. Scaricare l'installer da https://nodejs.org/ (versione LTS >= 20)
2. Eseguire l'installer `.msi`
3. Selezionare l'opzione "Automatically install the necessary tools" durante l'installazione

**Opzione B - nvm-windows:**
```powershell
# Installare nvm-windows da https://github.com/coreybutler/nvm-windows
nvm install 20
nvm use 20
```

**Opzione C - winget:**
```powershell
winget install OpenJS.NodeJS.LTS
```

### macOS

**Opzione A - Installer ufficiale:**
1. Scaricare da https://nodejs.org/ (versione LTS >= 20)
2. Eseguire il file `.pkg`

**Opzione B - Homebrew:**
```bash
brew install node@20
```

**Opzione C - nvm:**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install 20
nvm use 20
```

### Linux (Ubuntu/Debian)

**Opzione A - NodeSource:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Opzione B - nvm:**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

**Opzione C - fnm (piu veloce):**
```bash
curl -fsSL https://fnm.vercel.app/install | bash
fnm install 20
fnm use 20
```

### Verifica installazione Node.js

```bash
node --version
# Deve restituire v20.x.x o superiore
```

---

## 2. Installare pnpm (>= 9.0.0)

pnpm e il package manager utilizzato per gestire le workspace del monorepo. E piu veloce e piu efficiente di npm/yarn per i monorepo grazie al content-addressable storage.

### Tutti i sistemi operativi

**Opzione A - Corepack (raccomandata):**
```bash
# Corepack e incluso in Node.js >= 16
corepack enable
corepack prepare pnpm@latest --activate
```

**Opzione B - npm:**
```bash
npm install -g pnpm
```

**Opzione C - Script di installazione:**
```bash
# Linux/macOS
curl -fsSL https://get.pnpm.io/install.sh | sh -

# Windows (PowerShell)
iwr https://get.pnpm.io/install.ps1 -useb | iex
```

### macOS con Homebrew

```bash
brew install pnpm
```

### Verifica installazione pnpm

```bash
pnpm --version
# Deve restituire 9.x.x o superiore
```

---

## 3. Installare Git

### Windows

```powershell
winget install Git.Git
```

Oppure scaricare da https://git-scm.com/download/win

### macOS

```bash
# Git e incluso con Xcode Command Line Tools
xcode-select --install

# Oppure con Homebrew
brew install git
```

### Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install -y git
```

### Verifica installazione Git

```bash
git --version
```

---

## 4. Build Tools per Moduli Nativi

Il pacchetto `better-sqlite3` richiede la compilazione di binding C++ nativi. Questo richiede un compilatore C/C++ e Python sul sistema.

### Windows

**Opzione A - Visual Studio Build Tools (raccomandata):**
1. Scaricare "Build Tools for Visual Studio" da https://visualstudio.microsoft.com/downloads/
2. Nell'installer, selezionare il workload "Desktop development with C++"
3. Assicurarsi che siano selezionati:
   - MSVC (compilatore C++)
   - Windows SDK
   - CMake tools

**Opzione B - windows-build-tools (da amministratore):**
```powershell
npm install -g windows-build-tools
```

**Nota:** Questa opzione installa automaticamente Python e il compilatore C++.

### macOS

```bash
# Installare Xcode Command Line Tools (include compilatore C++)
xcode-select --install
```

Se gia installato, il comando mostrera un errore: e sufficiente.

### Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install -y build-essential python3 python3-pip
```

**Spiegazione dei pacchetti:**
- `build-essential`: include `gcc`, `g++`, `make` e le librerie di sviluppo
- `python3`: richiesto da `node-gyp` per la compilazione di moduli nativi
- `python3-pip`: per eventuali dipendenze Python aggiuntive

### Linux (Fedora/RHEL)

```bash
sudo dnf groupinstall "Development Tools"
sudo dnf install python3
```

### Linux (Arch)

```bash
sudo pacman -S base-devel python
```

---

## 5. Installazione del Progetto

### Passo 1: Clonare il repository

```bash
git clone <url-del-repository> mcp-suite
cd mcp-suite
```

### Passo 2: Installare le dipendenze

```bash
pnpm install
```

Questo comando:
- Scarica tutte le dipendenze di tutti i pacchetti e server
- Compila `better-sqlite3` (binding nativi C++)
- Compila `esbuild` (bundler nativo)
- Crea i link simbolici tra le workspace

**Nota:** La prima installazione puo richiedere qualche minuto per la compilazione dei moduli nativi.

### Passo 3: Compilare il progetto

```bash
pnpm build
```

Questo comando utilizza Turborepo per compilare tutti i pacchetti e server nell'ordine corretto delle dipendenze. L'output mostra il grafo di build:

```
 Tasks:    28 successful, 28 total
 Cached:   0 cached, 28 total
   Time:   12.3s
```

### Passo 4: Verificare la compilazione

```bash
# Controllare che le directory dist/ esistano
ls packages/core/dist/
ls packages/event-bus/dist/
ls servers/scrum-board/dist/

# Usare il CLI per verificare lo stato
npx @mcp-suite/cli status
```

L'output atteso del comando `status` e:

```
MCP Suite Status:

  Total servers: 22
  Built: 22
  Not built: 0

  Built servers:
    + agile-metrics
    + api-documentation
    + cicd-monitor
    ...
```

---

## 6. Verifica Completa

Per verificare che tutto funzioni correttamente:

```bash
# 1. Verifica versioni
node --version      # >= 20.0.0
pnpm --version      # >= 9.0.0

# 2. Build completo
pnpm build

# 3. Verifica che un server si avvii
node servers/scrum-board/dist/index.js
# Il server si avvia e attende comandi STDIO
# Premere Ctrl+C per terminare

# 4. Lista server disponibili
npx @mcp-suite/cli list
```

---

## Troubleshooting

### Errore: `better-sqlite3` non si compila

**Problema:** Errori di compilazione durante `pnpm install`.

**Soluzione Windows:**
```powershell
# Assicurarsi che Build Tools sia installato
npm config set msvs_version 2022
pnpm install
```

**Soluzione macOS:**
```bash
xcode-select --install
pnpm install
```

**Soluzione Linux:**
```bash
sudo apt-get install -y build-essential python3
pnpm install
```

### Errore: `EACCES` o permessi insufficienti

**Problema:** Errori di permesso durante l'installazione globale di pnpm.

**Soluzione:** Non usare `sudo` con npm. Configurare il percorso globale:
```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Errore: Versione Node.js troppo vecchia

**Problema:** `package.json` richiede `"node": ">=20.0.0"`.

**Soluzione:** Aggiornare Node.js con nvm:
```bash
nvm install 20
nvm use 20
nvm alias default 20
```

### Errore: `turbo` non trovato

**Problema:** Il comando `turbo` non viene riconosciuto.

**Soluzione:** Turbo e una devDependency del root. Assicurarsi di essere nella root del progetto:
```bash
cd mcp-suite
pnpm install
pnpm build    # Usa turbo automaticamente tramite lo script
```

### Errore: Directory `dist/` vuote o mancanti

**Problema:** La build non ha prodotto output.

**Soluzione:**
```bash
# Pulire tutto e ricompilare
pnpm clean
pnpm build
```

### Errore: `ERR_MODULE_NOT_FOUND` all'avvio

**Problema:** Un server non trova i suoi moduli.

**Soluzione:** Ricompilare i pacchetti condivisi prima dei server:
```bash
pnpm build:packages
pnpm build:servers
```
