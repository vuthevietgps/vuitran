import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';

type ClosableLike = {
  close?: () => Promise<unknown> | unknown;
  disconnect?: () => Promise<unknown> | unknown;
  quit?: () => Promise<unknown> | unknown;
  stop?: () => Promise<unknown> | unknown;
};

type E2eCleanupOptions = {
  app?: INestApplication | null;
  moduleRef?: TestingModule | null;
  mongoServer?: ClosableLike | null;
  mongoReplSet?: ClosableLike | null;
  redisClients?: ClosableLike[];
  queues?: ClosableLike[];
  workers?: ClosableLike[];
  timers?: Array<NodeJS.Timeout | null | undefined>;
  extraClosers?: Array<() => Promise<unknown> | unknown>;
};

async function closeIfPresent(resource?: ClosableLike | null): Promise<void> {
  if (!resource) {
    return;
  }

  try {
    if (typeof resource.close === 'function') {
      await resource.close();
      return;
    }

    if (typeof resource.stop === 'function') {
      await resource.stop();
      return;
    }

    if (typeof resource.disconnect === 'function') {
      await resource.disconnect();
      return;
    }

    if (typeof resource.quit === 'function') {
      await resource.quit();
    }
  } catch {
    // Best-effort cleanup only. The underlying test failure must remain visible.
  }
}

export async function closeE2eResources(options: E2eCleanupOptions = {}): Promise<void> {
  const {
    app,
    moduleRef,
    mongoServer,
    mongoReplSet,
    redisClients = [],
    queues = [],
    workers = [],
    timers = [],
    extraClosers = [],
  } = options;

  for (const timer of timers) {
    if (timer) {
      clearTimeout(timer);
      clearInterval(timer);
    }
  }

  await Promise.allSettled([
    app?.close?.(),
    moduleRef?.close?.(),
    closeIfPresent(mongoServer ?? null),
    closeIfPresent(mongoReplSet ?? null),
    ...redisClients.map((client) => closeIfPresent(client)),
    ...queues.map((queue) => closeIfPresent(queue)),
    ...workers.map((worker) => closeIfPresent(worker)),
    ...extraClosers.map(async (closer) => {
      try {
        await closer();
      } catch {
        // ignore best-effort close failures
      }
    }),
  ]);
}
