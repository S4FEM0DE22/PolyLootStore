function releaseSigning(env) {
  const publisher = env.POLYLOOT_WINDOWS_PUBLISHER?.trim();
  if (!publisher) throw new Error('Signed Windows release requires POLYLOOT_WINDOWS_PUBLISHER (certificate publisher name).');
  const thumbprint = env.POLYLOOT_WINDOWS_CERT_SHA1?.trim();
  if (thumbprint && !/^[A-Fa-f0-9]{40}$/.test(thumbprint)) throw new Error('Invalid code-signing certificate thumbprint.');
  if (!thumbprint && !env.WIN_CSC_LINK && !env.CSC_LINK) throw new Error('No Windows signing certificate. Supply a CA-issued certificate via CSC_LINK/WIN_CSC_LINK or POLYLOOT_WINDOWS_CERT_SHA1. Self-signed certificates are not public-release signing.');
  return { publisherName: publisher, signingHashAlgorithms: ['sha256'], rfc3161TimeStampServer: 'http://timestamp.digicert.com', ...(thumbprint ? { certificateSha1: thumbprint } : {}) };
}
module.exports = { releaseSigning };
