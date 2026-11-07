package main

/*
#cgo CFLAGS: -x objective-c -Wno-deprecated-declarations
#cgo LDFLAGS: -framework Foundation -framework UserNotifications

#import <Foundation/Foundation.h>
#import <UserNotifications/UserNotifications.h>

// Delegate that forces banners even when app is in foreground
@interface AstraNotifDelegate : NSObject <UNUserNotificationCenterDelegate>
@end
@implementation AstraNotifDelegate
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions))completionHandler {
    if (@available(macOS 11.0, *)) {
        completionHandler(UNNotificationPresentationOptionBanner | UNNotificationPresentationOptionSound | UNNotificationPresentationOptionBadge);
    } else {
        completionHandler(UNNotificationPresentationOptionAlert | UNNotificationPresentationOptionSound);
    }
}
@end

static AstraNotifDelegate *_delegate = nil;

void initNotifications(void) {
    if (_delegate != nil) return;
    _delegate = [[AstraNotifDelegate alloc] init];
    [UNUserNotificationCenter currentNotificationCenter].delegate = _delegate;
    [[UNUserNotificationCenter currentNotificationCenter]
        requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound | UNAuthorizationOptionBadge)
        completionHandler:^(BOOL granted, NSError *error) {}];
}

void sendNotification(const char *title, const char *subtitle, const char *body) {
    NSString *nsTitle    = [NSString stringWithUTF8String:title];
    NSString *nsSubtitle = (subtitle && strlen(subtitle) > 0) ? [NSString stringWithUTF8String:subtitle] : nil;
    NSString *nsBody     = [NSString stringWithUTF8String:body];

    dispatch_async(dispatch_get_main_queue(), ^{
        @autoreleasepool {
            UNMutableNotificationContent *content = [[UNMutableNotificationContent alloc] init];
            content.title = nsTitle;
            if (nsSubtitle) content.subtitle = nsSubtitle;
            content.body  = nsBody;
            content.sound = [UNNotificationSound defaultSound];
            if (@available(macOS 12.0, *)) {
                content.interruptionLevel = UNNotificationInterruptionLevelActive;
            }
            UNNotificationRequest *request = [UNNotificationRequest
                requestWithIdentifier:[[NSUUID UUID] UUIDString]
                content:content
                trigger:nil];
            [[UNUserNotificationCenter currentNotificationCenter]
                addNotificationRequest:request withCompletionHandler:nil];
        }
    });
}
*/
import "C"

// InitNotifications sets up the notification delegate and requests permission.
// Must be called once on app start from the main goroutine.
func InitNotifications() {
	C.initNotifications()
}

// notify sends a native macOS notification with banner + sound.
func notify(title, subtitle, message string) {
	C.sendNotification(C.CString(title), C.CString(subtitle), C.CString(message))
}
