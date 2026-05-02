import Foundation
import Capacitor
import GoogleSignIn

@objc(GoogleAuthPlugin)
public class GoogleAuthPlugin: CAPPlugin {

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
            GIDSignIn.sharedInstance.signIn(withPresenting: presentingVC) { result, error in
                if let error = error {
                    call.reject(error.localizedDescription)
                    return
                }
                guard let user = result?.user, let idToken = user.idToken?.tokenString else {
                    call.reject("Missing ID token from Google")
                    return
                }
                call.resolve([
                    "idToken": idToken,
                    "accessToken": user.accessToken.tokenString,
                    "email": user.profile?.email ?? "",
                    "name": user.profile?.name ?? ""
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
