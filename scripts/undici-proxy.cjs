const { ProxyAgent, setGlobalDispatcher } = require('undici')

function normalizeProxyUrl(value) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
}

const proxyUrl =
  normalizeProxyUrl(process.env.HTTPS_PROXY) ||
  normalizeProxyUrl(process.env.HTTP_PROXY) ||
  normalizeProxyUrl(process.env.ALL_PROXY) ||
  normalizeProxyUrl('127.0.0.1:7897')

if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl))
  process.env.HTTP_PROXY = proxyUrl
  process.env.HTTPS_PROXY = proxyUrl
  process.env.ALL_PROXY = proxyUrl
}
