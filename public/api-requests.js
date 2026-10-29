// Transport-neutral request correlation. The caller owns command IDs and policy.
export function createApiRequests({send, nextId, timeoutMs = 10000}) {
  const pending = new Map();
  function request(command, args, {signal} = {}) {
    if (signal?.aborted) return Promise.reject(signal.reason);
    return new Promise((resolve, reject) => {
      const commandId = nextId();
      let timer;
      const finish = (error, reply) => {
        if (!pending.delete(commandId)) return;
        clearTimeout(timer); signal?.removeEventListener('abort', abort);
        if (error) reject(error); else resolve(reply);
      };
      const abort = () => finish(signal.reason || new DOMException('Aborted', 'AbortError'));
      pending.set(commandId, {finish});
      signal?.addEventListener('abort', abort, {once:true});
      timer = setTimeout(() => finish(Error('api_timeout')), timeoutMs);
      try {
        if (!send({type:'control.command', commandId, command, args})) finish(Error('disconnected'));
      } catch (error) { finish(error); }
    });
  }
  return {request,
    accept(reply) {
      const entry = pending.get(reply.commandId);
      if (!entry) return false;
      entry.finish(null, reply); return true;
    },
    disconnect() {
      for (const entry of [...pending.values()]) entry.finish(Error('disconnected'));
    }
  };
}
