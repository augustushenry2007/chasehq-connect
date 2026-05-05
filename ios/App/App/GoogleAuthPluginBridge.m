#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Registers the Swift GoogleAuthPlugin with Capacitor's Objective-C runtime
// registry. Required because plugins in the App target are not auto-discovered
// by CAPBridgedPlugin conformance alone (that path only works for plugins
// shipped via Swift Package Manager).
CAP_PLUGIN(GoogleAuthPlugin, "GoogleAuth",
    CAP_PLUGIN_METHOD(signIn, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(signOut, CAPPluginReturnPromise);
)
