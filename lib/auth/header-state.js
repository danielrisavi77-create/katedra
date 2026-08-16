export function resolveAuthHeaderState({ user, balanceStatus, balanceData } = {}) {
  const loggedIn = Boolean(user)
  const balanceKnown = loggedIn && balanceStatus === 200 && Boolean(balanceData)

  return {
    loggedIn,
    hasPass: balanceKnown && balanceData.hasPass === true,
    ...(balanceKnown && balanceData.adminOverride === true ? { adminOverride: true } : {}),
    balanceKnown,
  }
}
