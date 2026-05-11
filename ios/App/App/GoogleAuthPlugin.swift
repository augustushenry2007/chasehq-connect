import Foundation
@preconcurrency import Capacitor
import GoogleSignIn

@objc(GoogleAuthPlugin)
public class GoogleAuthPlugin: CAPPlugin, CAPBridgedPlugin, @unchecked Sendable {

    public let identifier = "GoogleAuthPlugin"
    public let jsName = "GoogleAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise),
    ]

    // iOS OAuth client ID (created in Google Cloud Console, type "iOS",
    // bundle ID com.chasehq.app). Reversed form is registered as a URL scheme
    // in Info.plist.
    private let iosClientId = "692266461097-03p7r5s0md8ovg9cii6iclm35ac0vdir.apps.googleusercontent.com"

    // Web OAuth client ID — used as the ID-token audience so Supabase's
    // signInWithIdToken (which validates against the web client) accepts it.
    private let serverClientId = "692266461097-uj1ll1drthbeqjgaba1b47ob5nvpt617.apps.googleusercontent.com"

    public override func load() {
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(
            clientID: iosClientId,
            serverClientID: serverClientId
        )
    }

    @objc func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let presentingVC = self.bridge?.viewController else {
                call.reject("No presenting view controller")
                return
            }

            // Add a full-window opaque UIKit overlay before GIDSignIn presents its modal.
            // iOS takes a UIKit-level snapshot of the key window when the modal presents —
            // this view sits above the WKWebView in the window hierarchy so the snapshot
            // captures it instead of whatever React route is currently rendered.
            let overlayTag = 0xCAFE
            let window = presentingVC.view.window ?? UIApplication.shared.windows.first
            let overlay = UIView()
            overlay.tag = overlayTag
            overlay.backgroundColor = UIColor.systemBackground
            overlay.translatesAutoresizingMaskIntoConstraints = false

            let spinner = UIActivityIndicatorView(style: .medium)
            spinner.translatesAutoresizingMaskIntoConstraints = false
            spinner.startAnimating()

            let label = UILabel()
            label.text = "Signing you in\u{2026}"
            label.font = UIFont.systemFont(ofSize: 14)
            label.textColor = UIColor.secondaryLabel
            label.translatesAutoresizingMaskIntoConstraints = false

            let stack = UIStackView(arrangedSubviews: [spinner, label])
            stack.axis = .vertical
            stack.alignment = .center
            stack.spacing = 8
            stack.translatesAutoresizingMaskIntoConstraints = false
            overlay.addSubview(stack)

            if let window = window {
                window.addSubview(overlay)
                NSLayoutConstraint.activate([
                    overlay.topAnchor.constraint(equalTo: window.topAnchor),
                    overlay.bottomAnchor.constraint(equalTo: window.bottomAnchor),
                    overlay.leadingAnchor.constraint(equalTo: window.leadingAnchor),
                    overlay.trailingAnchor.constraint(equalTo: window.trailingAnchor),
                    stack.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
                    stack.centerYAnchor.constraint(equalTo: overlay.centerYAnchor),
                ])
                window.setNeedsLayout()
                window.layoutIfNeeded()
            }

            GIDSignIn.sharedInstance.signIn(
                withPresenting: presentingVC,
                hint: nil,
                additionalScopes: ["https://www.googleapis.com/auth/gmail.send"]
            ) { result, error in
                if let error = error {
                    // Error / cancel — remove overlay immediately so user sees prior screen.
                    DispatchQueue.main.async {
                        window?.viewWithTag(overlayTag)?.removeFromSuperview()
                    }
                    let nsError = error as NSError
                    if nsError.domain == kGIDSignInErrorDomain
                        && nsError.code == GIDSignInError.canceled.rawValue {
                        call.reject("Sign-in cancelled", "USER_CANCELED")
                    } else {
                        call.reject(error.localizedDescription)
                    }
                    return
                }
                guard let user = result?.user, let idToken = user.idToken?.tokenString else {
                    DispatchQueue.main.async {
                        window?.viewWithTag(overlayTag)?.removeFromSuperview()
                    }
                    call.reject("Missing ID token from Google")
                    return
                }
                // Success — remove overlay, hand off to React OAuthOverlay.
                DispatchQueue.main.async {
                    window?.viewWithTag(overlayTag)?.removeFromSuperview()
                }
                call.resolve([
                    "idToken": idToken,
                    "accessToken": user.accessToken.tokenString,
                    "accessTokenExpiresAt": ISO8601DateFormatter().string(from: user.accessToken.expirationDate ?? Date.distantPast),
                    "refreshToken": user.refreshToken.tokenString,
                    "grantedScopes": user.grantedScopes ?? [],
                    "email": user.profile?.email ?? "",
                    "name": user.profile?.name ?? "",
                    "serverAuthCode": result?.serverAuthCode ?? ""
                ])
            }
        }
    }

    @objc func signOut(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            GIDSignIn.sharedInstance.signOut()
            call.resolve()
        }
    }
}
