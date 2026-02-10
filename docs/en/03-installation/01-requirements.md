# Prerequisites and Installation

## System Requirements

MCP Suite requires the following components installed on the development machine:

| Requirement | Minimum Version | Purpose |
|-------------|----------------|---------|
| **Node.js** | >= 20.0.0 | JavaScript runtime |
| **pnpm** | >= 9.0.0 | Package manager for workspaces |
| **Git** | any recent | Clone the repository |
| **Native build tools** | see below | Compilation of `better-sqlite3` |

---

## 1. Install Node.js (>= 20.0.0)

### Windows

**Option A - Official installer:**
1. Download the installer from https://nodejs.org/ (LTS version >= 20)
2. Run the `.msi` installer
3. Select the option "Automatically install the necessary tools" during installation

**Option B - nvm-windows:**
```powershell
# Install nvm-windows from https://github.com/coreybutler/nvm-windows
nvm install 20
nvm use 20
```

**Option C - winget:**
```powershell
winget install OpenJS.NodeJS.LTS
```

### macOS

**Option A - Official installer:**
1. Download from https://nodejs.org/ (LTS version >= 20)
2. Run the `.pkg` file

**Option B - Homebrew:**
```bash
brew install node@20
```

**Option C - nvm:**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install 20
nvm use 20
```

### Linux (Ubuntu/Debian)

**Option A - NodeSource:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Option B - nvm:**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

**Option C - fnm (faster):**
```bash
curl -fsSL https://fnm.vercel.app/install | bash
fnm install 20
fnm use 20
```

### Verify Node.js installation

```bash
node --version
# Should return v20.x.x or higher
```

---

## 2. Install pnpm (>= 9.0.0)

pnpm is the package manager used to manage the monorepo workspaces. It is faster and more efficient than npm/yarn for monorepos thanks to content-addressable storage.

### All operating systems

**Option A - Corepack (recommended):**
```bash
# Corepack is included in Node.js >= 16
corepack enable
corepack prepare pnpm@latest --activate
```

**Option B - npm:**
```bash
npm install -g pnpm
```

**Option C - Installation script:**
```bash
# Linux/macOS
curl -fsSL https://get.pnpm.io/install.sh | sh -

# Windows (PowerShell)
iwr https://get.pnpm.io/install.ps1 -useb | iex
```

### macOS with Homebrew

```bash
brew install pnpm
```

### Verify pnpm installation

```bash
pnpm --version
# Should return 9.x.x or higher
```

---

## 3. Install Git

### Windows

```powershell
winget install Git.Git
```

Or download from https://git-scm.com/download/win

### macOS

```bash
# Git is included with Xcode Command Line Tools
xcode-select --install

# Or with Homebrew
brew install git
```

### Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install -y git
```

### Verify Git installation

```bash
git --version
```

---

## 4. Build Tools for Native Modules

The `better-sqlite3` package requires compilation of native C++ bindings. This requires a C/C++ compiler and Python on the system.

### Windows

**Option A - Visual Studio Build Tools (recommended):**
1. Download "Build Tools for Visual Studio" from https://visualstudio.microsoft.com/downloads/
2. In the installer, select the "Desktop development with C++" workload
3. Make sure the following are selected:
   - MSVC (C++ compiler)
   - Windows SDK
   - CMake tools

**Option B - windows-build-tools (run as administrator):**
```powershell
npm install -g windows-build-tools
```

**Note:** This option automatically installs Python and the C++ compiler.

### macOS

```bash
# Install Xcode Command Line Tools (includes C++ compiler)
xcode-select --install
```

If already installed, the command will show an error: that is sufficient.

### Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install -y build-essential python3 python3-pip
```

**Package explanation:**
- `build-essential`: includes `gcc`, `g++`, `make` and development libraries
- `python3`: required by `node-gyp` for native module compilation
- `python3-pip`: for any additional Python dependencies

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

## 5. Project Installation

### Step 1: Clone the repository

```bash
git clone <repository-url> mcp-suite
cd mcp-suite
```

### Step 2: Install dependencies

```bash
pnpm install
```

This command:
- Downloads all dependencies for all packages and servers
- Compiles `better-sqlite3` (native C++ bindings)
- Compiles `esbuild` (native bundler)
- Creates symbolic links between workspaces

**Note:** The first installation may take a few minutes due to native module compilation.

### Step 3: Build the project

```bash
pnpm build
```

This command uses Turborepo to compile all packages and servers in the correct dependency order. The output shows the build graph:

```
 Tasks:    28 successful, 28 total
 Cached:   0 cached, 28 total
   Time:   12.3s
```

### Step 4: Verify the build

```bash
# Check that the dist/ directories exist
ls packages/core/dist/
ls packages/event-bus/dist/
ls servers/scrum-board/dist/

# Use the CLI to check the status
npx @mcp-suite/cli status
```

The expected output of the `status` command is:

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

## 6. Complete Verification

To verify everything works correctly:

```bash
# 1. Version check
node --version      # >= 20.0.0
pnpm --version      # >= 9.0.0

# 2. Full build
pnpm build

# 3. Verify that a server starts
node servers/scrum-board/dist/index.js
# The server starts and waits for STDIO commands
# Press Ctrl+C to terminate

# 4. List available servers
npx @mcp-suite/cli list
```

---

## Troubleshooting

### Error: `better-sqlite3` does not compile

**Problem:** Compilation errors during `pnpm install`.

**Windows solution:**
```powershell
# Make sure Build Tools is installed
npm config set msvs_version 2022
pnpm install
```

**macOS solution:**
```bash
xcode-select --install
pnpm install
```

**Linux solution:**
```bash
sudo apt-get install -y build-essential python3
pnpm install
```

### Error: `EACCES` or insufficient permissions

**Problem:** Permission errors during global pnpm installation.

**Solution:** Do not use `sudo` with npm. Configure the global path:
```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Error: Node.js version too old

**Problem:** `package.json` requires `"node": ">=20.0.0"`.

**Solution:** Update Node.js with nvm:
```bash
nvm install 20
nvm use 20
nvm alias default 20
```

### Error: `turbo` not found

**Problem:** The `turbo` command is not recognized.

**Solution:** Turbo is a devDependency of the root. Make sure you are in the project root:
```bash
cd mcp-suite
pnpm install
pnpm build    # Uses turbo automatically via the script
```

### Error: Empty or missing `dist/` directories

**Problem:** The build did not produce output.

**Solution:**
```bash
# Clean everything and recompile
pnpm clean
pnpm build
```

### Error: `ERR_MODULE_NOT_FOUND` at startup

**Problem:** A server cannot find its modules.

**Solution:** Recompile shared packages before servers:
```bash
pnpm build:packages
pnpm build:servers
```
