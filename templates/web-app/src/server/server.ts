import { buildApp } from './app';
import { loadConfig } from './config';

function configOrExit() {
  try {
    return loadConfig();
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'Invalid configuration');
    process.exit(1);
  }
}

const config = configOrExit();
const app = await buildApp({ config });

// On SIGTERM finish open requests and exit well within the platform's 30 seconds.
let closing = false;
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, 'shutting down');
    const force = setTimeout(() => process.exit(1), 20_000);
    force.unref();
    app
      .close()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });
}

await app.listen({ host: '0.0.0.0', port: config.PORT });
