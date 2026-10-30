// Provider adapters use their existing authenticated room connection. No native sockets.
export function providerRequest(provider, entry) {
  if (typeof provider!=='string'||!provider||provider.length>32 ||
      typeof entry?.id!=='string'||!entry.id||entry.id.length>64 ||
      typeof entry.catalogKey!=='string'||!entry.catalogKey||entry.catalogKey.length>512)
    throw Error('provider_identity_required');
  return {type:'request.add',catalogKey:entry.catalogKey,
    clientRequestId:JSON.stringify([provider,entry.id])};
}
