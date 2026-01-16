import React, { useEffect } from "react"
import { SignInControl, TenantLogo, LegalNotice } from "@fider/components"
import { Trans } from "@lingui/react/macro"
import { useFider } from "@fider/hooks"

const Locked = (): JSX.Element => {
  const fider = useFider()
  return (
    <>
      <p className="text-title">
        <Trans id="signin.message.locked.title">
          <strong>{fider.session.tenant.name}</strong> is currently locked.
        </Trans>
      </p>
      <Trans id="signin.message.locked.text">To reactivate this site, sign in with an administrator account and update the required settings.</Trans>
    </>
  )
}

const Private = (): JSX.Element => {
  const fider = useFider()
  return (
    <>
      <p className="text-title">
        <Trans id="signin.message.private.title">
          <strong>{fider.session.tenant.name}</strong> is a private space, you must sign in to participate and vote.
        </Trans>
      </p>
      <Trans id="signin.message.private.text">If you have an account or an invitation, you may use following options to sign in.</Trans>
    </>
  )
}

export const SignInPage = () => {
  const fider = useFider()

  // Auto-redirect to OAuth if there's only one provider and email auth is disabled
  useEffect(() => {
    const shouldAutoRedirect =
      fider.settings.oauth.length === 1 &&
      !fider.session.tenant.isEmailAuthAllowed

    if (shouldAutoRedirect) {
      const provider = fider.settings.oauth[0]
      const redirect = new URLSearchParams(window.location.search).get("redirect")
      const redirectTo = redirect && redirect.startsWith("/")
        ? fider.settings.baseURL + redirect
        : fider.settings.baseURL

      // Redirect to OAuth provider
      window.location.href = `${provider.url}?redirect=${redirectTo}`
    }
  }, [fider])

  const onCodeVerified = () => {
    // User is authenticated - redirect to the appropriate URL
    const redirect = new URLSearchParams(window.location.search).get("redirect")
    if (redirect && redirect.startsWith("/")) {
      location.href = fider.settings.baseURL + redirect
    } else {
      location.href = fider.settings.baseURL
    }
  }

  const getRedirectToUrl = () => {
    const fider = useFider()
    const redirect = new URLSearchParams(window.location.search).get("redirect")

    if (redirect && redirect.startsWith("/")) {
      return fider.settings.baseURL + redirect
    }

    return fider.settings.baseURL
  }

  return (
    <div id="p-signin" className="page container w-max-6xl">
      <div className="h-20 text-center mb-4">
        <TenantLogo size={100} />
      </div>
      <div className="text-center w-max-4xl mx-auto mb-4">{fider.session.tenant.isPrivate ? <Private /> : <Locked />}</div>

      <SignInControl onCodeVerified={onCodeVerified} useEmail={true} redirectTo={getRedirectToUrl()} />
      <LegalNotice />
    </div>
  )
}

export default SignInPage
