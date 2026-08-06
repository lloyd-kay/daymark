# Daymark Windows Installer and Installation Guide Design

**Date:** 2026-08-06  
**Status:** Approved

## Objective

Make Daymark straightforward to understand and install for both nontechnical Windows users and experienced self-hosters. Provide one complete Windows setup executable that installs the application, its local database runtime, background-service support, public-access helper, backup tools, shortcuts, and uninstaller without requiring Node.js, npm, Docker, or a separately installed database.

The same release must retain explicit Docker, Cloudflare, and manual source-installation routes. The README must make the differences between these routes obvious, provide complete first-run instructions, and never imply that a temporary tunnel is suitable for real production bookings.

## Supported first release

The first installer release targets 64-bit Windows 10 and Windows 11. It is an unsigned preview build and must be labelled as such on the download, in the installer, and in the README. Windows may display an unrecognised-publisher warning until a trusted code-signing certificate is introduced.

The downloadable artifact is one assisted NSIS setup executable named in the form `Daymark-Setup-x64-<version>.exe`. It is a complete offline installer rather than a small bootstrapper that downloads application dependencies during setup.

## Installation routes

The README presents four supported routes in a decision table before showing any commands:

1. **Windows installer — recommended:** for normal Windows users who want an included database and guided setup.
2. **Docker Compose:** for Windows or Linux servers whose operators already manage containers.
3. **Cloudflare deployment:** for operators who want the existing Worker and D1 architecture hosted in their own Cloudflare account.
4. **Manual source installation:** for developers working directly with Node.js, npm, Wrangler, and the repository.

Each route contains its own prerequisites, installation steps, first-company setup, public-access implications, data location, upgrade procedure, backup procedure, verification step, and uninstall or removal guidance. Instructions use copyable commands and name the shell in which each command must run.

## Windows installer architecture

### Daymark Control

Add a lightweight Tauri desktop application named **Daymark Control**. It uses Daymark's cream paper texture, coloured file tabs, navy typography, coral accent, restrained shadows, and existing icon language. It must look like part of Daymark rather than a generic server administration utility.

Daymark Control provides:

- a clear Running, Stopped, Starting, Updating, or Needs attention status;
- actions to open the administrator workspace and local booking page;
- service-mode and manual-mode controls;
- a visible warning whenever manual mode is selected;
- local, temporary-test, and permanent-domain public-access states;
- the current Daymark version and database migration state;
- backup creation and restore entry points;
- a link to logs with personal data and secrets excluded; and
- plain-language recovery actions for common failures.

The control application does not contain the booking server or database inside its own process. It manages separately installed components so closing Daymark Control does not stop an always-on Daymark service.

### Daymark server bundle

Bundle a pinned server runtime with the built Daymark Worker. The service host runs the existing Worker application through the Cloudflare-compatible local runtime, preserving D1 binding behaviour and avoiding a second database implementation. The bundle includes the pinned runtime components required to start Daymark; users do not install Node.js, npm, Wrangler, Miniflare, workerd, or SQLite separately.

The local service binds only to loopback by default. Public requests reach it through the optional tunnel rather than an open router port. The service exposes a narrow loopback health endpoint used by Daymark Control and installer verification.

### Persistent database and application data

Use persistent local D1-compatible storage backed by SQLite. The installer creates and migrates the database on first run. Mutable data is stored outside the application directory so upgrades cannot replace it.

Use these logical locations:

- `%ProgramFiles%\Daymark` for versioned application and runtime files;
- `%ProgramData%\Daymark\data` for persistent database state;
- `%ProgramData%\Daymark\backups` for verified backups;
- `%ProgramData%\Daymark\logs` for bounded operational logs; and
- Windows-protected credential storage for setup and tunnel secrets.

The setup code, tunnel token, administrator credentials, appointment contact details, and database contents must never be written into installer logs, repository files, command history, or world-readable configuration.

### Windows service and manual mode

The installer defaults to an always-on Windows service. A bundled service wrapper starts Daymark at boot, restarts it after an unexpected exit, writes bounded diagnostic logs, and stops it cleanly during upgrades.

Users may choose manual mode during installation or later in Daymark Control. Before manual mode is enabled, show this warning:

> Client booking links and temporary public links stop working when Daymark is closed. Availability cannot be served while this computer or Daymark is offline.

Manual mode starts the server only while Daymark Control is running. Switching modes preserves the same database and configuration.

### Public-access helper

Bundle a pinned `cloudflared` executable, subject to its upstream licence and checksum verification. Public access has three explicit states:

- **Local:** Daymark is working only on the host computer.
- **Temporary test link:** an opt-in Quick Tunnel publishes a random HTTPS address for evaluation. The control panel states that the address may change or stop and must not be used for real client bookings.
- **Permanent domain:** a guided flow helps the owner authenticate with Cloudflare and attach a hostname from a domain already managed in Cloudflare. The permanent tunnel runs with the Daymark service when always-on mode is active.

The installer does not promise or fabricate a permanent public address without a domain. It does not collect Cloudflare credentials itself; browser-based authentication or a narrowly scoped tunnel token is used, and stored tokens are protected by Windows.

## Installer and first-run flow

The assisted installer performs these steps:

1. Display the unsigned-preview notice, supported Windows versions, licence links, and data-location summary.
2. Request administrator elevation for a per-machine installation.
3. Install immutable application files and pinned runtime components.
4. Offer always-on service mode by default and manual mode with the approved warning.
5. Create protected data, backup, log, and credential locations with restrictive permissions.
6. Generate a cryptographically random Daymark setup code and store it using Windows-protected storage.
7. Initialise the persistent local database and apply every committed migration in order.
8. Start the selected runtime mode and wait for a successful health check.
9. Open Daymark Control and the first-company setup page.
10. Offer local-only operation or an optional temporary public test link. Permanent-domain setup remains available from Daymark Control for later use.

The first-company page continues to collect company name, company slug, administrator display name, email, and password. Daymark Control displays the generated setup code only when needed for this first setup and offers a deliberate copy action. After the first administrator exists, the setup code is no longer treated as a routine sign-in credential.

## Upgrades, backups, and uninstall

An installer upgrade must detect an existing installation, stop the service cleanly, verify the current data directory, create a pre-upgrade backup, apply migrations, replace only versioned application files, restart the prior operating mode, and confirm health. If migration or health verification fails, the installer leaves the pre-upgrade backup available and reports a recovery path rather than deleting data.

Daymark Control supports manual verified backups. A backup contains the database, required configuration metadata, schema version, application version, creation time, and integrity result. Secrets are exported only through an explicit protected recovery flow, not as plain text in a normal backup.

Uninstall removes application files, services, shortcuts, and optional tunnel integration. Business data and backups are preserved by default. Removing `%ProgramData%\Daymark` requires a separate explicit confirmation that explains the deletion is permanent.

Automatic application updates are out of scope for the unsigned preview. Users install a newer verified setup executable over the existing installation. This avoids creating an unsigned automatic-update channel.

## Docker Compose route

Provide a Dockerfile and `compose.yaml` that run the same built Daymark service host and persistent D1-compatible storage. The compose configuration uses a named volume for database state, mounts no repository secrets into the image, exposes only the configured local port, and includes a health check.

The README supplies exact commands to create the environment file, generate a setup code, build or pull the image, start the service, inspect health, apply upgrades, create a backup, and stop or remove containers without deleting the named data volume. Optional public access is documented separately so `docker compose up` does not silently publish an insecure internet endpoint.

## Cloudflare route

Preserve the existing Cloudflare Worker and D1 installation route. The guide names the required Node.js version, Cloudflare account prerequisites, D1 binding name, database creation steps, migration order, setup secret creation, local verification, deployment command, and first-company flow.

The guide distinguishes local D1 state from remote D1 and uses explicit `--local` or `--remote` flags where applicable. It warns operators to back up D1 before migrations and to verify foreign keys and company isolation after deployment.

No Cloudflare project, tunnel, domain, or hosted deployment is created automatically as part of implementing this design.

## Manual source route

The developer path starts from a clean clone and includes:

- Node.js and npm prerequisites;
- repository clone and `npm ci`;
- `.env.example` to `.env.local` creation for PowerShell, Command Prompt, and POSIX shells;
- a secure setup-code generation example;
- local database migration and development startup;
- Windows-specific environment-variable syntax for build commands;
- full test, lint, build, and rendered-route checks; and
- links to architecture, security, backup, and contribution guidance.

Commands in the README must be runnable as written. Generated paths and example values are clearly identified, and no placeholder is presented as a secure production secret.

## README visual design

The README should be visually distinctive without becoming decorative or difficult to maintain:

- lead with the existing Daymark social artwork or approved brand asset;
- use a short product promise and privacy summary before technical material;
- include restrained status badges for Windows, Docker, Cloudflare, licence, and preview state;
- use a compact installation decision table;
- separate install methods with consistent headings and small visual markers;
- use GitHub callouts for warnings, security notes, and temporary-link limitations;
- keep commands in short, shell-labelled blocks;
- use collapsible detail sections only for troubleshooting and advanced configuration; and
- avoid fabricated download buttons, fake release availability, or generic calendar imagery.

Daymark Control follows the same brand system. Accessibility remains mandatory: sufficient contrast, keyboard navigation, visible focus, scalable text, reduced-motion support, and status communication that does not rely on colour alone.

## Build and release automation

Add a repeatable Windows build workflow that:

1. checks out a pinned revision;
2. installs locked JavaScript and Rust dependencies;
3. downloads only pinned external runtime binaries from official sources;
4. verifies every external binary against a committed expected checksum;
5. runs the full Daymark test, lint, build, migration, and packaging checks;
6. builds the 64-bit assisted NSIS installer;
7. produces `SHA256SUMS.txt` for the final artifact; and
8. uploads the installer and checksum as workflow artifacts.

Publishing a GitHub Release remains a separate action requiring explicit user confirmation. The workflow must not publish, deploy the website, create a domain, or create Cloudflare resources merely because a build succeeds.

## Error handling and recovery

Daymark Control and the installer provide specific recovery paths for:

- insufficient administrator permissions;
- unsupported Windows versions or architecture;
- unavailable or conflicting local ports;
- service installation or startup failure;
- corrupt, missing, or locked database state;
- migration failure;
- failed health checks;
- unavailable internet access during optional tunnel setup;
- Quick Tunnel termination or address changes;
- invalid or revoked permanent tunnel credentials;
- backup verification failure; and
- upgrade rollback requirements.

Errors use plain language, preserve diagnostic detail in bounded local logs, and never reveal secrets or appointment content. A failure to enable public access does not damage or disable the working local installation.

## Testing and verification

Automated verification must cover:

- clean Windows installer creation from the locked repository;
- manifest and checksum validation for every bundled binary;
- clean installation into a disposable Windows environment;
- always-on service installation, automatic startup, restart, and clean removal;
- manual mode startup and approved warning text;
- local database creation and the complete migration chain;
- first administrator and first company creation;
- appointment creation and persistence across server and computer restarts;
- upgrade backup, migration, version replacement, and data preservation;
- uninstall with data preserved by default;
- explicit data removal as a separate operation;
- temporary tunnel opt-in, warning copy, and failure isolation;
- health/status reporting in Daymark Control;
- Docker build, startup, health, persistence, backup, and removal without volume deletion;
- documented Cloudflare and manual commands against a clean checkout; and
- the existing company-isolation, booking, authentication, retention, and rendered-page suites.

Manual release verification includes a clean Windows 10/11 x64 installation, Windows restart, service-mode booking smoke test, manual-mode warning review, temporary-link smoke test, upgrade from the previous preview, uninstall with data retained, and README review by a person unfamiliar with the codebase.

## Out of scope

- Digitally signing the first preview installer.
- Automatic background application updates.
- A macOS or Linux desktop installer.
- A portable single-file Daymark application.
- Creating or purchasing a domain.
- Treating Quick Tunnels as a production service.
- Operating a hosted tunnel relay or Daymark Hosted service.
- Publishing a GitHub Release without separate confirmation.
- Deploying the marketing website or application as part of installer development.

## Acceptance criteria

The design is complete when:

- one offline `Daymark-Setup-x64-<version>.exe` includes everything needed for a Windows installation, including persistent database support;
- the installed application runs in always-on service mode by default and supports manual mode with the approved warning;
- local operation works without a Cloudflare account or domain;
- temporary public testing is clearly separated from permanent domain setup;
- application upgrades and uninstall do not silently delete business data;
- Windows installer, Docker, Cloudflare, and manual source routes are explicit and independently usable;
- the README is accurate, visually recognisable as Daymark, and understandable to nontechnical readers;
- build automation produces verifiable unsigned preview artifacts without publishing them automatically; and
- the existing privacy, company-isolation, and booking behaviours remain unchanged.
