/**
 * Structured logger — thin wrapper over console + Sentry.
 *
 * In development: pretty-prints to console with level prefix.
 * In production:  errors and warnings are also sent to Sentry.
 *
 * Usage:
 *   logger.info('Check-in succeeded', { memberId, serviceId })
 *   logger.error('RPC failed', err, { memberId })
 */

import * as Sentry from '@sentry/react'

type Context = Record<string, unknown>

const IS_PROD = import.meta.env.PROD

function format(level: string, msg: string, ctx?: Context): string {
  const ts = new Date().toISOString()
  return ctx ? `[${ts}] ${level} ${msg} ${JSON.stringify(ctx)}` : `[${ts}] ${level} ${msg}`
}

export const logger = {
  debug(msg: string, ctx?: Context) {
    if (!IS_PROD) console.debug(format('DEBUG', msg, ctx))
  },

  info(msg: string, ctx?: Context) {
    console.info(format('INFO', msg, ctx))
  },

  warn(msg: string, ctx?: Context) {
    console.warn(format('WARN', msg, ctx))
    if (IS_PROD) {
      Sentry.addBreadcrumb({ level: 'warning', message: msg, data: ctx })
    }
  },

  error(msg: string, err?: unknown, ctx?: Context) {
    console.error(format('ERROR', msg, ctx), err ?? '')
    if (IS_PROD && err instanceof Error) {
      Sentry.captureException(err, { extra: { message: msg, ...ctx } })
    } else if (IS_PROD) {
      Sentry.captureMessage(msg, { level: 'error', extra: ctx })
    }
  },
}


